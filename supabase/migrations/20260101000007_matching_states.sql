-- ============================================================
-- Migration: Matching States & Profile Completeness
-- Adds city, travel_radius, matching_status, and all indexes
-- needed by the weekly matching algorithm.
-- ============================================================


-- ============================================================
-- ENUM: matching_status
-- Tracks where a user is in the current weekly cycle.
-- This is separate from profile_status (active/banned/suspended).
--
--   idle             → onboarding complete, not yet opted in to this cycle
--   waiting_for_match → opted in, awaiting the Monday matching run
--   matched          → placed in a group, group is forming
--   attending        → confirmed the meetup (RSVP yes), event upcoming
--   completed        → attended the meetup (checked in)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE matching_status AS ENUM (
    'idle',
    'waiting_for_match',
    'matched',
    'attending',
    'completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- profiles: add missing fields
-- ============================================================

-- City — coarser than neighborhood, used for cross-city matching rules.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS city TEXT;

-- Travel radius in km the user is willing to travel for a meetup.
-- Default 10 km covers most dense urban areas.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS travel_radius_km SMALLINT NOT NULL DEFAULT 10
    CHECK (travel_radius_km BETWEEN 1 AND 100);

-- Current matching state for the active cycle.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS matching_status matching_status NOT NULL DEFAULT 'idle';

-- Timestamp of the last matching_status change — useful for
-- expiry logic (e.g. auto-reset idle users after N days).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS matching_status_updated_at TIMESTAMPTZ;

-- When the user last opted in to a cycle.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_opted_in_at TIMESTAMPTZ;

-- Cycle the user most recently opted into.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS opted_in_cycle_id UUID REFERENCES match_cycles(id) ON DELETE SET NULL;

-- update matching_status_updated_at automatically
CREATE OR REPLACE FUNCTION sync_matching_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.matching_status IS DISTINCT FROM OLD.matching_status THEN
    NEW.matching_status_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_matching_status_ts ON profiles;
CREATE TRIGGER profiles_matching_status_ts
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_matching_status_timestamp();


-- ============================================================
-- indexes for matching queries
-- ============================================================

-- The matching algorithm's primary query:
-- "Find all users who are waiting_for_match in cycle X"
CREATE INDEX IF NOT EXISTS profiles_matching_status_idx
  ON profiles (matching_status);

-- Filter by city + matching_status together (multi-city deployments)
CREATE INDEX IF NOT EXISTS profiles_city_status_idx
  ON profiles (city, matching_status)
  WHERE city IS NOT NULL;

-- Filter opt-in pool by cycle
CREATE INDEX IF NOT EXISTS profiles_opted_in_cycle_idx
  ON profiles (opted_in_cycle_id)
  WHERE opted_in_cycle_id IS NOT NULL;

-- Neighborhood-level clustering queries
CREATE INDEX IF NOT EXISTS profiles_neighborhood_idx
  ON profiles (neighborhood)
  WHERE neighborhood IS NOT NULL;

-- Age-range filtering (matching by compatible age bands)
CREATE INDEX IF NOT EXISTS profiles_age_idx
  ON profiles (age)
  WHERE age IS NOT NULL;


-- ============================================================
-- availability_slots: add a specific date column
-- Allows one-off slots in addition to recurring day_of_week.
-- ============================================================
ALTER TABLE availability_slots
  ADD COLUMN IF NOT EXISTS specific_date DATE;

-- Index for fetching slots for a specific week
CREATE INDEX IF NOT EXISTS availability_specific_date_idx
  ON availability_slots (specific_date)
  WHERE specific_date IS NOT NULL;

-- Composite: user + day — the matching algorithm's hot path
CREATE INDEX IF NOT EXISTS availability_user_day_idx
  ON availability_slots (user_id, day_of_week);


-- ============================================================
-- blocks: add reason field + matching exclusion index
-- ============================================================
ALTER TABLE blocks
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- Composite index for the matching algorithm's exclusion step:
-- "exclude any pair where a block exists in either direction"
CREATE INDEX IF NOT EXISTS blocks_pair_idx
  ON blocks (LEAST(blocker_id, blocked_id), GREATEST(blocker_id, blocked_id));


-- ============================================================
-- groups: add a soft-deleted flag + current member count cache
-- ============================================================
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS member_count SMALLINT NOT NULL DEFAULT 0;

-- Denormalised count — updated by trigger below.
-- Avoids COUNT(*) on group_members for every group card render.
CREATE OR REPLACE FUNCTION sync_group_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE groups SET member_count = GREATEST(0, member_count - 1) WHERE id = OLD.group_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS group_members_count_sync ON group_members;
CREATE TRIGGER group_members_count_sync
  AFTER INSERT OR DELETE ON group_members
  FOR EACH ROW EXECUTE FUNCTION sync_group_member_count();


-- ============================================================
-- match_cycles: add opt-in window timestamps
-- ============================================================
ALTER TABLE match_cycles
  ADD COLUMN IF NOT EXISTS optin_opens_at  TIMESTAMPTZ,  -- when users can start opting in
  ADD COLUMN IF NOT EXISTS optin_closes_at TIMESTAMPTZ,  -- deadline for opt-in (matching runs after this)
  ADD COLUMN IF NOT EXISTS matched_at      TIMESTAMPTZ;  -- when the matching run completed

-- Index to find the "current" cycle efficiently
CREATE INDEX IF NOT EXISTS match_cycles_optin_closes_idx
  ON match_cycles (optin_closes_at DESC)
  WHERE status IN ('pending', 'matching');


-- ============================================================
-- group_members: matching_cycle_id denorm for faster queries
-- ============================================================
-- Avoids joining through groups → match_cycles on every member query
ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES match_cycles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS group_members_cycle_idx
  ON group_members (cycle_id)
  WHERE cycle_id IS NOT NULL;

-- Composite: find all groups a user has been in
CREATE INDEX IF NOT EXISTS group_members_user_cycle_idx
  ON group_members (user_id, cycle_id);

-- Partial index: only active memberships (hot path for current group queries)
CREATE INDEX IF NOT EXISTS group_members_user_active_idx
  ON group_members (user_id)
  WHERE status = 'active';


-- ============================================================
-- questionnaire_answers: composite for bulk fetching
-- ============================================================
-- Fetch all answers for a set of users in one query (used by matching algo)
CREATE INDEX IF NOT EXISTS qa_user_key_idx
  ON questionnaire_answers (user_id, question_key);


-- ============================================================
-- Helper view: matching pool for a given cycle
-- Returns all users currently waiting_for_match.
-- The matching Edge Function queries this view.
-- ============================================================
CREATE OR REPLACE VIEW matching_pool AS
SELECT
  p.id                 AS user_id,
  p.city,
  p.neighborhood,
  p.travel_radius_km,
  p.age,
  p.matching_status,
  p.opted_in_cycle_id  AS cycle_id,
  p.last_opted_in_at,
  -- JSON-aggregate their availability windows
  COALESCE(
    json_agg(
      json_build_object(
        'day_of_week', avail.day_of_week,
        'start_time',  avail.start_time,
        'end_time',    avail.end_time,
        'specific_date', avail.specific_date
      )
    ) FILTER (WHERE avail.id IS NOT NULL),
    '[]'
  ) AS availability
FROM profiles p
LEFT JOIN availability_slots avail
  ON avail.user_id = p.id
  AND (
    avail.specific_date IS NULL                        -- recurring
    OR avail.specific_date >= CURRENT_DATE             -- future one-off
  )
WHERE p.matching_status = 'waiting_for_match'
  AND p.onboarding_complete = TRUE
  AND (p.status IS NULL OR p.status = 'active')
GROUP BY p.id;


-- ============================================================
-- Helper function: opt a user into the current/next cycle
-- Call from the app after user confirms availability.
-- ============================================================
CREATE OR REPLACE FUNCTION opt_in_to_cycle(
  p_user_id UUID,
  p_cycle_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Guard: user must have completed onboarding
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_user_id AND onboarding_complete = TRUE
  ) THEN
    RAISE EXCEPTION 'User has not completed onboarding';
  END IF;

  -- Guard: cycle must exist and be accepting opt-ins
  IF NOT EXISTS (
    SELECT 1 FROM match_cycles
    WHERE id = p_cycle_id
      AND status = 'pending'
      AND (optin_closes_at IS NULL OR optin_closes_at > NOW())
  ) THEN
    RAISE EXCEPTION 'Cycle is not open for opt-ins';
  END IF;

  UPDATE profiles
  SET
    matching_status       = 'waiting_for_match',
    opted_in_cycle_id     = p_cycle_id,
    last_opted_in_at      = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ============================================================
-- Helper function: advance matching_status on check-in
-- Called from the check-in Edge Function / trigger.
-- ============================================================
CREATE OR REPLACE FUNCTION advance_status_on_checkin()
RETURNS TRIGGER AS $$
BEGIN
  -- When a group_member checks in, flip their profile status to 'completed'
  IF NEW.checked_in = TRUE AND OLD.checked_in = FALSE THEN
    UPDATE profiles
    SET matching_status = 'completed'
    WHERE id = NEW.user_id
      AND matching_status IN ('matched', 'attending');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS group_members_status_advance ON group_members;
CREATE TRIGGER group_members_status_advance
  AFTER UPDATE ON group_members
  FOR EACH ROW EXECUTE FUNCTION advance_status_on_checkin();


-- ============================================================
-- Helper function: advance to 'attending' on RSVP yes
-- ============================================================
CREATE OR REPLACE FUNCTION advance_status_on_rsvp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rsvp_status = 'yes' AND OLD.rsvp_status <> 'yes' THEN
    UPDATE profiles
    SET matching_status = 'attending'
    WHERE id = NEW.user_id
      AND matching_status = 'matched';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS group_members_rsvp_advance ON group_members;
CREATE TRIGGER group_members_rsvp_advance
  AFTER UPDATE ON group_members
  FOR EACH ROW EXECUTE FUNCTION advance_status_on_rsvp();


-- ============================================================
-- Reset matching_status to 'idle' after a cycle completes.
-- Called by the admin/edge function at end-of-week cleanup.
-- Resets users who completed the cycle so they can opt-in next week.
-- ============================================================
CREATE OR REPLACE FUNCTION reset_cycle_matching_statuses(p_cycle_id UUID)
RETURNS INT AS $$
DECLARE
  rows_updated INT;
BEGIN
  UPDATE profiles
  SET
    matching_status       = 'idle',
    opted_in_cycle_id     = NULL
  WHERE opted_in_cycle_id = p_cycle_id
    AND matching_status IN ('completed', 'waiting_for_match', 'matched', 'attending');

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ============================================================
-- Seed: update existing profiles to have a city
-- ============================================================
UPDATE profiles
SET city = 'San Francisco'
WHERE city IS NULL;

UPDATE venues
SET
  lat = CASE name
    WHEN 'The Alembic'   THEN 37.7691
    WHEN 'Sightglass'    THEN 37.7844
    ELSE 37.7749 + (RANDOM() * 0.02 - 0.01)
  END,
  lng = CASE name
    WHEN 'The Alembic'   THEN -122.4382
    WHEN 'Sightglass'    THEN -122.3966
    ELSE -122.4194 + (RANDOM() * 0.02 - 0.01)
  END
WHERE lat IS NULL OR lat = 0;

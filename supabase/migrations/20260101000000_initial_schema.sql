-- ============================================================
-- Squad App — Supabase/Postgres Schema
-- ============================================================
-- Run this against a fresh Supabase project.
-- The auth schema and auth.users table are managed by Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------
-- uuid-ossp not available on hosted Supabase; use gen_random_uuid() from pgcrypto
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ------------------------------------------------------------
-- ENUM Types
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE cycle_status AS ENUM ('pending', 'matching', 'active', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE group_status AS ENUM ('forming', 'active', 'completed', 'dissolved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE member_status AS ENUM ('invited', 'active', 'removed', 'left');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE rsvp_status AS ENUM ('pending', 'yes', 'no', 'maybe');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE feedback_rating AS ENUM ('1', '2', '3', '4', '5');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE message_type AS ENUM ('text', 'system', 'announcement');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM ('free', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired', 'trialing');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('member', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ------------------------------------------------------------
-- Utility: updated_at trigger function
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- TABLE: profiles
-- One row per auth.users entry. id mirrors auth.users.id.
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name     TEXT NOT NULL DEFAULT '',
  bio              TEXT,
  age              SMALLINT CHECK (age IS NULL OR (age >= 18 AND age <= 120)),
  location         TEXT,
  neighborhood     TEXT,
  avatar_url       TEXT,
  role             user_role NOT NULL DEFAULT 'member',
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);
CREATE INDEX IF NOT EXISTS profiles_onboarding_idx ON profiles(onboarding_complete);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create a profile row whenever a new auth user is created.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- TABLE: questionnaire_answers
-- Stores arbitrary answers keyed by question_key + user_id.
-- ============================================================
CREATE TABLE IF NOT EXISTS questionnaire_answers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  answer       JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, question_key)
);

CREATE INDEX IF NOT EXISTS qa_user_id_idx       ON questionnaire_answers(user_id);
CREATE INDEX IF NOT EXISTS qa_question_key_idx  ON questionnaire_answers(question_key);
CREATE INDEX IF NOT EXISTS qa_answer_gin_idx    ON questionnaire_answers USING GIN (answer);

CREATE TRIGGER questionnaire_answers_updated_at
  BEFORE UPDATE ON questionnaire_answers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- TABLE: match_cycles
-- One row per weekly matching run.
-- ============================================================
CREATE TABLE IF NOT EXISTS match_cycles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_date  DATE NOT NULL UNIQUE,  -- ISO week start date (Monday)
  status      cycle_status NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS match_cycles_status_idx     ON match_cycles(status);
CREATE INDEX IF NOT EXISTS match_cycles_cycle_date_idx ON match_cycles(cycle_date DESC);

CREATE TRIGGER match_cycles_updated_at
  BEFORE UPDATE ON match_cycles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- TABLE: availability_slots
-- Per-user recurring or cycle-specific availability windows.
-- ============================================================
CREATE TABLE IF NOT EXISTS availability_slots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sun … 6=Sat
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  cycle_id     UUID REFERENCES match_cycles(id) ON DELETE SET NULL,    -- NULL = recurring
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS availability_user_idx    ON availability_slots(user_id);
CREATE INDEX IF NOT EXISTS availability_cycle_idx   ON availability_slots(cycle_id);
CREATE INDEX IF NOT EXISTS availability_day_idx     ON availability_slots(day_of_week);

CREATE TRIGGER availability_slots_updated_at
  BEFORE UPDATE ON availability_slots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- TABLE: venues
-- Physical venues where groups can meet.
-- ============================================================
CREATE TABLE IF NOT EXISTS venues (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  address      TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  capacity     SMALLINT NOT NULL DEFAULT 20 CHECK (capacity > 0),
  category     TEXT NOT NULL,   -- e.g. 'coffee', 'bar', 'restaurant', 'park'
  lat          NUMERIC(9, 6),
  lng          NUMERIC(9, 6),
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS venues_active_idx        ON venues(active);
CREATE INDEX IF NOT EXISTS venues_neighborhood_idx  ON venues(neighborhood);
CREATE INDEX IF NOT EXISTS venues_category_idx      ON venues(category);

CREATE TRIGGER venues_updated_at
  BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- TABLE: groups
-- A matched social group for a given cycle.
-- ============================================================
CREATE TABLE IF NOT EXISTS groups (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id       UUID NOT NULL REFERENCES match_cycles(id) ON DELETE RESTRICT,
  venue_id       UUID REFERENCES venues(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  status         group_status NOT NULL DEFAULT 'forming',
  scheduled_time TIMESTAMPTZ,
  max_members    SMALLINT NOT NULL DEFAULT 6 CHECK (max_members BETWEEN 2 AND 12),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS groups_cycle_id_idx  ON groups(cycle_id);
CREATE INDEX IF NOT EXISTS groups_venue_id_idx  ON groups(venue_id);
CREATE INDEX IF NOT EXISTS groups_status_idx    ON groups(status);

CREATE TRIGGER groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- TABLE: group_members
-- Join table linking users to groups with RSVP + stay-vote.
-- ============================================================
CREATE TABLE IF NOT EXISTS group_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      member_status NOT NULL DEFAULT 'invited',
  rsvp_status rsvp_status NOT NULL DEFAULT 'pending',
  stay_vote   BOOLEAN,   -- NULL = not yet voted, TRUE = wants to continue, FALSE = does not
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS group_members_group_id_idx ON group_members(group_id);
CREATE INDEX IF NOT EXISTS group_members_user_id_idx  ON group_members(user_id);
CREATE INDEX IF NOT EXISTS group_members_rsvp_idx     ON group_members(rsvp_status);

CREATE TRIGGER group_members_updated_at
  BEFORE UPDATE ON group_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- TABLE: messages
-- In-group messaging.
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL for system messages
  content    TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  type       message_type NOT NULL DEFAULT 'text',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Messages are immutable; no updated_at.
);

CREATE INDEX IF NOT EXISTS messages_group_id_idx   ON messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_user_id_idx    ON messages(user_id);


-- ============================================================
-- TABLE: feedback
-- Post-meetup feedback per user per group.
-- ============================================================
CREATE TABLE IF NOT EXISTS feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_id        UUID NOT NULL REFERENCES match_cycles(id) ON DELETE RESTRICT,
  rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  vibe_score      SMALLINT NOT NULL CHECK (vibe_score BETWEEN 1 AND 5),
  would_meet_again BOOLEAN NOT NULL DEFAULT FALSE,
  notes           TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)   -- one feedback entry per user per group
);

CREATE INDEX IF NOT EXISTS feedback_group_id_idx  ON feedback(group_id);
CREATE INDEX IF NOT EXISTS feedback_user_id_idx   ON feedback(user_id);
CREATE INDEX IF NOT EXISTS feedback_cycle_id_idx  ON feedback(cycle_id);

CREATE TRIGGER feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- TABLE: blocks
-- User-level blocking to prevent re-matching.
-- ============================================================
CREATE TABLE IF NOT EXISTS blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS blocks_blocker_idx ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON blocks(blocked_id);


-- ============================================================
-- TABLE: subscriptions
-- User subscription / billing state.
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan       subscription_plan NOT NULL DEFAULT 'free',
  status     subscription_status NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)   -- one subscription record per user
);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx  ON subscriptions(status);
CREATE INDEX IF NOT EXISTS subscriptions_expires_idx ON subscriptions(expires_at);

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create a free subscription row when a profile is created.
CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_profile();


-- ============================================================
-- Helper view: active group membership for the current user
-- ============================================================
CREATE OR REPLACE VIEW my_active_groups AS
SELECT
  g.id              AS group_id,
  g.name            AS group_name,
  g.status          AS group_status,
  g.scheduled_time,
  g.max_members,
  gm.rsvp_status,
  gm.stay_vote,
  gm.user_id,
  mc.cycle_date
FROM groups g
JOIN group_members gm ON gm.group_id = g.id
JOIN match_cycles  mc ON mc.id = g.cycle_id
WHERE gm.user_id = auth.uid()
  AND g.status IN ('forming', 'active');


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on every table.
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_answers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_cycles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback               ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions          ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- Shared helper: is the calling user an admin?
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Shared helper: is the calling user a member of a given group?
CREATE OR REPLACE FUNCTION is_group_member(p_group_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id
      AND user_id  = auth.uid()
      AND status   = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================
-- profiles RLS
-- ============================================================
-- Anyone authenticated can read any profile (needed for group member display names).
CREATE POLICY "profiles: authenticated read"
  ON profiles FOR SELECT
  TO authenticated
  USING (TRUE);

-- Users can insert their own profile.
CREATE POLICY "profiles: self insert"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Users can update their own profile; admins can update any.
CREATE POLICY "profiles: self or admin update"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR is_admin())
  WITH CHECK (id = auth.uid() OR is_admin());

-- Only admins can delete profiles (soft-delete preferred in practice).
CREATE POLICY "profiles: admin delete"
  ON profiles FOR DELETE
  TO authenticated
  USING (is_admin());


-- ============================================================
-- questionnaire_answers RLS
-- ============================================================
CREATE POLICY "qa: self read"
  ON questionnaire_answers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "qa: self insert"
  ON questionnaire_answers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "qa: self update"
  ON questionnaire_answers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "qa: self delete"
  ON questionnaire_answers FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR is_admin());


-- ============================================================
-- availability_slots RLS
-- ============================================================
CREATE POLICY "avail: self read"
  ON availability_slots FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "avail: self insert"
  ON availability_slots FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "avail: self update"
  ON availability_slots FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "avail: self delete"
  ON availability_slots FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR is_admin());


-- ============================================================
-- match_cycles RLS
-- ============================================================
-- All authenticated users can read cycles (needed for UI).
CREATE POLICY "cycles: authenticated read"
  ON match_cycles FOR SELECT
  TO authenticated
  USING (TRUE);

-- Only admins can create / modify cycles.
CREATE POLICY "cycles: admin write"
  ON match_cycles FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "cycles: admin update"
  ON match_cycles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "cycles: admin delete"
  ON match_cycles FOR DELETE
  TO authenticated
  USING (is_admin());


-- ============================================================
-- venues RLS
-- ============================================================
-- All authenticated users can read active venues.
CREATE POLICY "venues: authenticated read active"
  ON venues FOR SELECT
  TO authenticated
  USING (active = TRUE OR is_admin());

-- Only admins can manage venues.
CREATE POLICY "venues: admin insert"
  ON venues FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "venues: admin update"
  ON venues FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "venues: admin delete"
  ON venues FOR DELETE
  TO authenticated
  USING (is_admin());


-- ============================================================
-- groups RLS
-- ============================================================
-- Members of a group can see their group; admins see all.
CREATE POLICY "groups: member or admin read"
  ON groups FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR is_group_member(id)
  );

-- Only admins (and the matching service via service role) can create groups.
CREATE POLICY "groups: admin insert"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "groups: admin update"
  ON groups FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "groups: admin delete"
  ON groups FOR DELETE
  TO authenticated
  USING (is_admin());


-- ============================================================
-- group_members RLS
-- ============================================================
-- Active members of the same group can see each other.
CREATE POLICY "group_members: same group read"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR is_group_member(group_id)
    OR user_id = auth.uid()
  );

CREATE POLICY "group_members: admin insert"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Members can update their own RSVP/stay_vote; admins can update anything.
CREATE POLICY "group_members: self or admin update"
  ON group_members FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());

CREATE POLICY "group_members: admin delete"
  ON group_members FOR DELETE
  TO authenticated
  USING (is_admin());


-- ============================================================
-- messages RLS
-- ============================================================
-- Only group members can read messages in their groups.
CREATE POLICY "messages: group member read"
  ON messages FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR is_group_member(group_id)
  );

-- Group members can send messages to their own groups.
CREATE POLICY "messages: group member insert"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_group_member(group_id)
  );

-- Messages are immutable for regular users; admins may delete.
CREATE POLICY "messages: admin delete"
  ON messages FOR DELETE
  TO authenticated
  USING (is_admin());


-- ============================================================
-- feedback RLS
-- ============================================================
CREATE POLICY "feedback: self or admin read"
  ON feedback FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "feedback: self insert"
  ON feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_group_member(group_id)
  );

CREATE POLICY "feedback: self update"
  ON feedback FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "feedback: admin delete"
  ON feedback FOR DELETE
  TO authenticated
  USING (is_admin());


-- ============================================================
-- blocks RLS
-- ============================================================
CREATE POLICY "blocks: self read"
  ON blocks FOR SELECT
  TO authenticated
  USING (blocker_id = auth.uid() OR is_admin());

CREATE POLICY "blocks: self insert"
  ON blocks FOR INSERT
  TO authenticated
  WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "blocks: self delete"
  ON blocks FOR DELETE
  TO authenticated
  USING (blocker_id = auth.uid() OR is_admin());


-- ============================================================
-- subscriptions RLS
-- ============================================================
CREATE POLICY "subscriptions: self or admin read"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "subscriptions: admin write"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "subscriptions: admin update"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "subscriptions: admin delete"
  ON subscriptions FOR DELETE
  TO authenticated
  USING (is_admin());


-- ============================================================
-- Grant service role full access (used by edge functions)
-- ============================================================
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Authenticated users get access to public schema objects.
GRANT USAGE  ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Anon users can do nothing by default (no anon grants except via specific policies).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

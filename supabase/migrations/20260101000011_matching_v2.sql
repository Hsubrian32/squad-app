-- ============================================================
-- Migration: Matching V2 — lat/lng, venue metadata, redistribution
-- ============================================================


-- ============================================================
-- 1. Add lat/lng columns to profiles for proximity matching
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;


-- ============================================================
-- 2. Enums: venue_type, budget_tier
-- ============================================================
DO $$ BEGIN
  CREATE TYPE venue_type AS ENUM (
    'bar',
    'coffee_shop',
    'restaurant',
    'arcade_bar',
    'park',
    'activity_center',
    'rooftop',
    'lounge',
    'brewery',
    'cafe'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE budget_tier AS ENUM (
    'budget',
    'mid_range',
    'upscale'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- 3. Add metadata columns to venues table
-- ============================================================
ALTER TABLE venues ADD COLUMN IF NOT EXISTS venue_type     venue_type;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS vibe_tags      TEXT[]    NOT NULL DEFAULT '{}';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS budget_tier    budget_tier NOT NULL DEFAULT 'mid_range';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_outdoor     BOOLEAN   NOT NULL DEFAULT FALSE;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_alcohol_free BOOLEAN  NOT NULL DEFAULT FALSE;


-- ============================================================
-- 4. Spatial index on profiles for proximity queries
-- ============================================================
CREATE INDEX IF NOT EXISTS profiles_location_idx
  ON profiles (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;


-- ============================================================
-- 5. Update seed venues with metadata
-- ============================================================

-- Birch Coffee
UPDATE venues
SET
  venue_type      = 'coffee_shop',
  vibe_tags       = '{chill,intellectual}',
  budget_tier     = 'budget',
  is_outdoor      = FALSE,
  is_alcohol_free = TRUE
WHERE id = 'b1b1b1b1-0001-0000-0000-000000000001';

-- The Rusty Knot
UPDATE venues
SET
  venue_type      = 'bar',
  vibe_tags       = '{lively,chill}',
  budget_tier     = 'mid_range',
  is_outdoor      = TRUE,
  is_alcohol_free = FALSE
WHERE id = 'b1b1b1b1-0002-0000-0000-000000000002';

-- Russ & Daughters
UPDATE venues
SET
  venue_type      = 'restaurant',
  vibe_tags       = '{foodie,intellectual}',
  budget_tier     = 'upscale',
  is_outdoor      = FALSE,
  is_alcohol_free = FALSE
WHERE id = 'b1b1b1b1-0003-0000-0000-000000000003';

-- Ace Bar
UPDATE venues
SET
  venue_type      = 'arcade_bar',
  vibe_tags       = '{lively,adventurous,games}',
  budget_tier     = 'budget',
  is_outdoor      = FALSE,
  is_alcohol_free = FALSE
WHERE id = 'b1b1b1b1-0004-0000-0000-000000000004';

-- Joe Coffee
UPDATE venues
SET
  venue_type      = 'coffee_shop',
  vibe_tags       = '{chill,intellectual}',
  budget_tier     = 'budget',
  is_outdoor      = FALSE,
  is_alcohol_free = TRUE
WHERE id = 'b1b1b1b1-0005-0000-0000-000000000005';


-- ============================================================
-- 6. Replace the matching_pool view with lat/lng + questionnaire
-- Postgres requires DROP + recreate when column order changes.
-- ============================================================
DROP VIEW IF EXISTS matching_pool;
CREATE VIEW matching_pool AS
SELECT
  p.id                  AS user_id,
  p.city,
  p.neighborhood,
  p.lat,
  p.lng,
  p.travel_radius_km,
  p.age,
  p.matching_status,
  p.opted_in_cycle_id   AS cycle_id,
  p.last_opted_in_at,
  -- JSON-aggregate recurring availability windows
  COALESCE(
    json_agg(
      json_build_object(
        'day_of_week', avail.day_of_week,
        'start_time',  avail.start_time,
        'end_time',    avail.end_time
      )
    ) FILTER (WHERE avail.id IS NOT NULL),
    '[]'
  ) AS availability,
  -- All questionnaire answers as a flat key→value map
  COALESCE(
    (SELECT json_object_agg(qa.question_key, qa.answer)
     FROM questionnaire_answers qa
     WHERE qa.user_id = p.id),
    '{}'::json
  ) AS questionnaire
FROM profiles p
LEFT JOIN availability_slots avail
  ON avail.user_id = p.id
  AND avail.specific_date IS NULL
WHERE p.matching_status = 'waiting_for_match'
  AND p.onboarding_complete = TRUE
  AND (p.status IS NULL OR p.status = 'active')
GROUP BY p.id;

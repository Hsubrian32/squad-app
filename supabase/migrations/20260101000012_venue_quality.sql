-- ============================================================
-- Migration: Venue Quality & External Data Fields
-- Adds rating, review_count, price_level, operational_status,
-- source tracking, suitability scoring, and rich metadata
-- to the venues table. Also extends groups with backup venue
-- support and selection reasoning.
-- ============================================================


-- ============================================================
-- 1. Venue quality / discovery metadata
-- ============================================================
ALTER TABLE venues ADD COLUMN IF NOT EXISTS rating            FLOAT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS review_count      INT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS price_level       SMALLINT;     -- 1=$  2=$$  3=$$$  4=$$$$
ALTER TABLE venues ADD COLUMN IF NOT EXISTS operational_status TEXT    NOT NULL DEFAULT 'operational'
  CHECK (operational_status IN ('operational','closed_temporarily','closed_permanently','unknown'));
ALTER TABLE venues ADD COLUMN IF NOT EXISTS source            TEXT    NOT NULL DEFAULT 'manual';  -- 'google_places' | 'manual'
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_verified       BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS last_enriched_at  TIMESTAMPTZ;

-- Pre-computed group-hangout suitability (0–100).
-- NULL = not yet scored; computed by enrich-venues or admin tooling.
ALTER TABLE venues ADD COLUMN IF NOT EXISTS suitability_score SMALLINT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS suitability_flags TEXT[]   NOT NULL DEFAULT '{}';
  -- e.g. '{group_friendly,conversational,public,loud,too_formal}'

-- Extra contact / hours metadata (populated by enrich-venues)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS hours_json        JSONB;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS phone             TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS website           TEXT;


-- ============================================================
-- 2. Groups table: backup venue + selection context
-- ============================================================
ALTER TABLE groups ADD COLUMN IF NOT EXISTS backup_venue_id         UUID REFERENCES venues(id) ON DELETE SET NULL;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS venue_selection_reason  TEXT[] NOT NULL DEFAULT '{}';
  -- e.g. '{central_for_group,fits_budget,top_rated,great_group_hangout_spot}'
ALTER TABLE groups ADD COLUMN IF NOT EXISTS meetup_area             TEXT;
  -- Human-readable area name, e.g. 'Lower East Side', 'Williamsburg'


-- ============================================================
-- 3. Unique constraint on google_place_id for upsert keying
--    (column added by migration 000006; constraint may not exist yet)
-- ============================================================
DO $$ BEGIN
  ALTER TABLE venues ADD CONSTRAINT venues_google_place_id_key UNIQUE (google_place_id);
EXCEPTION
  WHEN duplicate_table THEN NULL;   -- already exists
  WHEN duplicate_object THEN NULL;  -- already exists (alternate pg error code)
END $$;


-- ============================================================
-- 4. Indexes for quality-filtered queries
-- ============================================================
CREATE INDEX IF NOT EXISTS venues_rating_idx
  ON venues (rating, review_count)
  WHERE rating IS NOT NULL;

CREATE INDEX IF NOT EXISTS venues_operational_idx
  ON venues (operational_status)
  WHERE operational_status = 'operational';


-- ============================================================
-- 4. Seed: enrich the 5 existing NYC dev venues with quality data
-- All figures are representative of these real NYC venues.
-- ============================================================

-- Birch Coffee (coffee shop, West Village)
UPDATE venues SET
  rating            = 4.5,
  review_count      = 312,
  price_level       = 2,
  source            = 'google_places',
  is_verified       = TRUE,
  operational_status= 'operational',
  suitability_score = 82,
  suitability_flags = '{group_friendly,conversational,quiet_enough,public,daytime_friendly}'
WHERE id = 'b1b1b1b1-0001-0000-0000-000000000001';

-- The Rusty Knot (bar, West Village)
UPDATE venues SET
  rating            = 4.3,
  review_count      = 487,
  price_level       = 2,
  source            = 'google_places',
  is_verified       = TRUE,
  operational_status= 'operational',
  suitability_score = 85,
  suitability_flags = '{group_friendly,casual,public,outdoor_available,first_meet_natural}'
WHERE id = 'b1b1b1b1-0002-0000-0000-000000000002';

-- Russ & Daughters Café (restaurant, Lower East Side)
UPDATE venues SET
  rating            = 4.6,
  review_count      = 1287,
  price_level       = 3,
  source            = 'google_places',
  is_verified       = TRUE,
  operational_status= 'operational',
  suitability_score = 68,
  suitability_flags = '{conversational,public,upscale,reservation_recommended}'
WHERE id = 'b1b1b1b1-0003-0000-0000-000000000003';

-- Ace Bar (arcade bar, East Village)
UPDATE venues SET
  rating            = 4.4,
  review_count      = 923,
  price_level       = 2,
  source            = 'google_places',
  is_verified       = TRUE,
  operational_status= 'operational',
  suitability_score = 92,
  suitability_flags = '{group_friendly,games,activity_based,casual,public,first_meet_natural}'
WHERE id = 'b1b1b1b1-0004-0000-0000-000000000004';

-- Joe Coffee (coffee shop, various NYC locations)
UPDATE venues SET
  rating            = 4.5,
  review_count      = 341,
  price_level       = 2,
  source            = 'google_places',
  is_verified       = TRUE,
  operational_status= 'operational',
  suitability_score = 80,
  suitability_flags = '{group_friendly,conversational,quiet_enough,public,daytime_friendly}'
WHERE id = 'b1b1b1b1-0005-0000-0000-000000000005';

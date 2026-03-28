-- ============================================================
-- Migration: Meetup Map System
-- Adds lat/lng to venues, meetup_locations, venue_switch_proposals,
-- venue_switch_votes tables plus all needed indexes.
-- ============================================================


-- ============================================================
-- venues: add lat/lng for map display
-- ============================================================
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS lat  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS google_place_id TEXT;

-- Spatial-ish index for bounding-box queries (no PostGIS needed)
CREATE INDEX IF NOT EXISTS venues_lat_lng_idx ON venues (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;


-- ============================================================
-- meetup_locations
-- The confirmed location for an active group's meetup.
-- May differ from the original venue if the group voted to switch.
-- ============================================================
CREATE TABLE IF NOT EXISTS meetup_locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  venue_id      UUID REFERENCES venues(id) ON DELETE SET NULL,

  -- May be null if a custom dropped-pin location is used
  name          TEXT NOT NULL,
  address       TEXT,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,

  -- Who set this location ('system' | user UUID)
  set_by        TEXT NOT NULL DEFAULT 'system',

  -- Was this a switch from the original venue?
  is_switch     BOOLEAN NOT NULL DEFAULT FALSE,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active location per group
CREATE UNIQUE INDEX IF NOT EXISTS meetup_locations_group_idx
  ON meetup_locations (group_id);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION touch_meetup_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS meetup_locations_updated ON meetup_locations;
CREATE TRIGGER meetup_locations_updated
  BEFORE UPDATE ON meetup_locations
  FOR EACH ROW EXECUTE FUNCTION touch_meetup_location();

-- RLS
ALTER TABLE meetup_locations ENABLE ROW LEVEL SECURITY;

-- Group members can read their group's meetup location
CREATE POLICY "Group members can view meetup location"
  ON meetup_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = meetup_locations.group_id
        AND gm.user_id = auth.uid()
        AND gm.status = 'active'
    )
  );

-- System / Edge Functions insert/update (service role bypasses RLS)


-- ============================================================
-- venue_switch_proposals
-- A group member proposes moving to a different location.
-- ============================================================
CREATE TABLE IF NOT EXISTS venue_switch_proposals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  proposed_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Proposed destination
  venue_id      UUID REFERENCES venues(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  address       TEXT,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  reason        TEXT,

  status        TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'accepted', 'rejected', 'expired')),

  -- Voting window closes at this time
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),

  -- Cached counts updated by Edge Function
  votes_yes     SMALLINT NOT NULL DEFAULT 0,
  votes_no      SMALLINT NOT NULL DEFAULT 0,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS proposals_group_open_idx
  ON venue_switch_proposals (group_id, status)
  WHERE status = 'open';

CREATE OR REPLACE FUNCTION touch_proposal()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS proposals_updated ON venue_switch_proposals;
CREATE TRIGGER proposals_updated
  BEFORE UPDATE ON venue_switch_proposals
  FOR EACH ROW EXECUTE FUNCTION touch_proposal();

-- RLS
ALTER TABLE venue_switch_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view proposals"
  ON venue_switch_proposals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = venue_switch_proposals.group_id
        AND gm.user_id = auth.uid()
        AND gm.status = 'active'
    )
  );

CREATE POLICY "Active group members can create proposals"
  ON venue_switch_proposals FOR INSERT
  WITH CHECK (
    proposed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = venue_switch_proposals.group_id
        AND gm.user_id = auth.uid()
        AND gm.status = 'active'
    )
  );


-- ============================================================
-- venue_switch_votes
-- One row per member per proposal.
-- ============================================================
CREATE TABLE IF NOT EXISTS venue_switch_votes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id   UUID NOT NULL REFERENCES venue_switch_proposals(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote          BOOLEAN NOT NULL,   -- TRUE = yes, FALSE = no
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (proposal_id, user_id)
);

CREATE INDEX IF NOT EXISTS votes_proposal_idx
  ON venue_switch_votes (proposal_id);

-- RLS
ALTER TABLE venue_switch_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view votes"
  ON venue_switch_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM venue_switch_proposals p
      JOIN group_members gm ON gm.group_id = p.group_id
      WHERE p.id = venue_switch_votes.proposal_id
        AND gm.user_id = auth.uid()
        AND gm.status = 'active'
    )
  );

CREATE POLICY "Members can cast their own vote"
  ON venue_switch_votes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM venue_switch_proposals p
      JOIN group_members gm ON gm.group_id = p.group_id
      WHERE p.id = venue_switch_votes.proposal_id
        AND gm.user_id = auth.uid()
        AND gm.status = 'active'
        AND p.status = 'open'
        AND p.expires_at > NOW()
    )
  );

-- Prevent changing vote (delete + re-insert blocked by unique constraint)
CREATE POLICY "Members can delete their own vote"
  ON venue_switch_votes FOR DELETE
  USING (user_id = auth.uid());


-- ============================================================
-- group_members: add proximity check-in columns
-- ============================================================
ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS checked_in_lat  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS checked_in_lng  DOUBLE PRECISION;


-- ============================================================
-- Helper view: group arrival stats (privacy-safe aggregate)
-- Never exposes individual locations; only the count breakdown.
-- ============================================================
CREATE OR REPLACE VIEW group_arrival_stats AS
SELECT
  group_id,
  COUNT(*) FILTER (WHERE arrival_status = 'arrived')      AS arrived_count,
  COUNT(*) FILTER (WHERE arrival_status = 'on_the_way')   AS on_the_way_count,
  COUNT(*) FILTER (WHERE arrival_status = 'running_late') AS running_late_count,
  COUNT(*) FILTER (WHERE arrival_status = 'cant_make_it') AS cant_make_it_count,
  COUNT(*)                                                 AS total_count
FROM group_members
WHERE status = 'active'
GROUP BY group_id;


-- ============================================================
-- Seed: ensure venues have coordinates for dev
-- (Only updates rows where lat is still null)
-- ============================================================
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
WHERE lat IS NULL;

-- Seed meetup_locations for any active groups that don't have one yet
INSERT INTO meetup_locations (group_id, venue_id, name, address, lat, lng, set_by)
SELECT
  g.id,
  g.venue_id,
  v.name,
  v.address,
  v.lat,
  v.lng,
  'system'
FROM groups g
JOIN venues v ON v.id = g.venue_id
WHERE g.status IN ('forming', 'active')
  AND v.lat IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM meetup_locations ml WHERE ml.group_id = g.id
  );

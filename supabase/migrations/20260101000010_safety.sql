-- =============================================================================
-- Migration: safety — user reports table + supporting RLS
-- =============================================================================
-- Adds:
--   • user_reports   — structured abuse / safety reports submitted by users
--   • Ensures blocks table RLS is complete (blocks already exists, policies
--     were created in 000000 — this migration is additive only)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- user_reports
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id        uuid REFERENCES groups(id) ON DELETE SET NULL,
  reason          text NOT NULL,           -- e.g. 'harassment', 'no_show', 'inappropriate', 'other'
  details         text,                    -- optional free-text from the user
  status          text NOT NULL DEFAULT 'pending',  -- pending | reviewed | resolved | dismissed
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- A user can only submit one report per (reporter, reported, reason) combination
  CONSTRAINT user_reports_unique UNIQUE (reporter_id, reported_id, reason)
);

CREATE INDEX IF NOT EXISTS user_reports_reporter_idx ON user_reports(reporter_id);
CREATE INDEX IF NOT EXISTS user_reports_reported_idx ON user_reports(reported_id);
CREATE INDEX IF NOT EXISTS user_reports_status_idx   ON user_reports(status);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS user_reports_updated_at ON user_reports;
CREATE TRIGGER user_reports_updated_at
  BEFORE UPDATE ON user_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

-- Reporters can read their own submissions
CREATE POLICY "user_reports: self read"
  ON user_reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- Any authenticated user can submit a report
CREATE POLICY "user_reports: self insert"
  ON user_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Reporters cannot update or delete — admin only (handled via service role)

-- Admins can read all reports
CREATE POLICY "user_reports: admin read"
  ON user_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update report status
CREATE POLICY "user_reports: admin update"
  ON user_reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Helper: check if caller has blocked a user or been blocked by them
-- Useful for filtering group members from blocked users' views
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_blocked_by_or_blocks(other_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = other_user_id)
       OR (blocker_id = other_user_id AND blocked_id = auth.uid())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_blocked_by_or_blocks TO authenticated;

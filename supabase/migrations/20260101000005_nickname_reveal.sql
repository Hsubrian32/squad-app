-- Migration: nickname_reveal
-- Adds nickname/identity fields to profiles and arrival/reveal fields to group_members.
-- Re-runnable: all DDL uses IF NOT EXISTS / IF EXISTS guards.

-- ============================================================
-- profiles table additions
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS nickname TEXT,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS intro TEXT,
  ADD COLUMN IF NOT EXISTS vibe_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS privacy_preference TEXT NOT NULL DEFAULT 'nickname_only',
  ADD COLUMN IF NOT EXISTS venue_flexibility TEXT NOT NULL DEFAULT 'flexible';

-- Unique index on LOWER(nickname) for case-insensitive uniqueness.
-- The index itself enforces uniqueness; NULLs are excluded automatically.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_nickname_lower_idx
  ON profiles ( LOWER(nickname) )
  WHERE nickname IS NOT NULL;

-- ============================================================
-- group_members table additions
-- ============================================================

ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS arrival_status TEXT,
  ADD COLUMN IF NOT EXISTS name_revealed BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- Trigger: reveal_name_on_checkin
-- BEFORE UPDATE on group_members — when checked_in flips FALSE → TRUE,
-- set name_revealed = TRUE and arrival_status = 'arrived'.
-- ============================================================

CREATE OR REPLACE FUNCTION reveal_name_on_checkin_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.checked_in = FALSE AND NEW.checked_in = TRUE THEN
    NEW.name_revealed := TRUE;
    NEW.arrival_status := 'arrived';
  END IF;
  RETURN NEW;
END;
$$;

-- Drop the trigger first so we can recreate it idempotently
-- (CREATE OR REPLACE TRIGGER requires PG 14+; use DROP/CREATE for wider compat).
DROP TRIGGER IF EXISTS reveal_name_on_checkin ON group_members;

CREATE TRIGGER reveal_name_on_checkin
  BEFORE UPDATE ON group_members
  FOR EACH ROW
  EXECUTE FUNCTION reveal_name_on_checkin_fn();

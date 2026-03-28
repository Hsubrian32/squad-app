-- Add check-in tracking to group_members
ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS checked_in BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS group_members_checked_in_idx ON group_members(group_id, checked_in);

-- Add a profile_visible flag — true once the user has checked in to their first event
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_visible BOOLEAN NOT NULL DEFAULT FALSE;

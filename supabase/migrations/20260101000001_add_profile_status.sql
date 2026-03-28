-- Add status column to profiles for ban/suspend functionality
DO $$ BEGIN
  CREATE TYPE profile_status AS ENUM ('active', 'banned', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status profile_status NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS profiles_status_idx ON profiles(status);

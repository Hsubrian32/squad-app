-- ============================================================
-- Dev Tools  (local / staging only)
-- ============================================================
-- Provides helper Postgres functions used exclusively during
-- local development and testing.  These functions are safe to
-- deploy to production; they will simply be unused there.
-- ============================================================

-- ------------------------------------------------------------
-- dev_join_demo_group
-- ------------------------------------------------------------
-- Adds a user to the seeded "The Night Owls" demo group so
-- a freshly-onboarded test account can immediately see the
-- full matched experience without waiting for real matching.
--
-- Behaviour:
--   1. Patches the profile with a dev nickname if none exists.
--   2. Enforces a hard cap of 8 members (same as MAX_GROUP_SIZE).
--      If the group is already at 8, the oldest prior Tester*
--      account is evicted to make room for the new one.
--   3. Inserts a group_members row (idempotent — safe to call
--      multiple times; subsequent calls are no-ops).
--   4. Returns the demo group's UUID.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.dev_join_demo_group(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_group_id    uuid := 'd1d1d1d1-0001-0000-0000-000000000001';
  v_nickname    text;
  v_count       int;
  v_evict_id    uuid;
  DEV_MAX       constant int := 8;
BEGIN
  -- ── 1. Ensure profile has a nickname ─────────────────────
  SELECT nickname INTO v_nickname FROM profiles WHERE id = p_user_id;

  IF v_nickname IS NULL OR trim(v_nickname) = '' THEN
    UPDATE profiles
    SET
      nickname   = 'Tester' || upper(substring(p_user_id::text, 1, 4)),
      first_name = COALESCE(NULLIF(trim(COALESCE(first_name, '')), ''), 'Test User')
    WHERE id = p_user_id;
  END IF;

  -- ── 2. Verify demo group exists ───────────────────────────
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = v_group_id) THEN
    RAISE EXCEPTION
      'Demo group % not found. Run: supabase db reset', v_group_id;
  END IF;

  -- ── 3. Hard cap at DEV_MAX — evict oldest Tester if full ──
  -- Short-circuit: if this user is already a member, skip all of this.
  IF NOT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = v_group_id AND user_id = p_user_id
  ) THEN
    SELECT COUNT(*) INTO v_count
    FROM group_members WHERE group_id = v_group_id;

    IF v_count >= DEV_MAX THEN
      -- Find the oldest Tester* member (joined earliest, nickname starts with 'Tester')
      SELECT gm.user_id INTO v_evict_id
      FROM group_members gm
      JOIN profiles p ON p.id = gm.user_id
      WHERE gm.group_id = v_group_id
        AND p.nickname LIKE 'Tester%'
        AND gm.user_id != p_user_id
      ORDER BY gm.joined_at ASC
      LIMIT 1;

      IF v_evict_id IS NULL THEN
        RAISE EXCEPTION
          'Demo group is full (% members) and no Tester accounts found to evict. Run: supabase db reset',
          v_count;
      END IF;

      DELETE FROM group_members
      WHERE group_id = v_group_id AND user_id = v_evict_id;
    END IF;
  END IF;

  -- Keep max_members pinned at exactly DEV_MAX — never grow beyond it
  UPDATE groups
  SET max_members = DEV_MAX
  WHERE id = v_group_id AND max_members != DEV_MAX;

  -- ── 4. Add user (idempotent) ──────────────────────────────
  INSERT INTO group_members (
    group_id, user_id, status, rsvp_status, joined_at, updated_at
  )
  VALUES (
    v_group_id, p_user_id, 'active', 'yes', NOW(), NOW()
  )
  ON CONFLICT (group_id, user_id) DO NOTHING;

  -- ── 5. Ensure meetup_locations row exists ─────────────────
  -- The map screen queries meetup_locations; seed data should
  -- already have this row, but upsert it here as a safety net.
  INSERT INTO meetup_locations (
    group_id, venue_id, name, address, lat, lng, set_by, is_switch
  )
  SELECT
    g.id,
    g.venue_id,
    v.name,
    v.address,
    v.lat,
    v.lng,
    'system',
    FALSE
  FROM groups g
  JOIN venues v ON v.id = g.venue_id
  WHERE g.id = v_group_id
    AND v.lat IS NOT NULL
  ON CONFLICT DO NOTHING;

  RETURN v_group_id;
END;
$$;

-- Authenticated users can call this in dev (no harm on prod —
-- the demo group only exists after a db reset with seed data).
GRANT EXECUTE ON FUNCTION public.dev_join_demo_group(uuid) TO authenticated;

COMMENT ON FUNCTION public.dev_join_demo_group IS
  'DEV ONLY — joins a user to the seeded Night Owls demo group for local testing. '
  'Hard-capped at 8 members (MAX_GROUP_SIZE). If full, the oldest prior Tester account '
  'is evicted to make room. Run supabase db reset to restore the original 8-person seed group.';

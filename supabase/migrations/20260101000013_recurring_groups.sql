-- ============================================================
-- MIGRATION: Recurring Groups, Post-Event Reviews, Stay/Leave
-- ============================================================

-- ============================================================
-- TABLE: event_instances
-- Each group meetup is an event instance. Recurring groups have
-- multiple event_instances (one per week).
-- ============================================================
CREATE TABLE IF NOT EXISTS event_instances (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  cycle_id      UUID REFERENCES match_cycles(id),
  week_number   SMALLINT NOT NULL DEFAULT 1,
  scheduled_time TIMESTAMPTZ NOT NULL,
  venue_id      UUID REFERENCES venues(id),
  status        TEXT NOT NULL DEFAULT 'scheduled'
                CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, week_number)
);

CREATE TRIGGER event_instances_updated_at
  BEFORE UPDATE ON event_instances
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: event_attendance
-- Per-event attendance tracking (replaces per-group check-in
-- for recurring scenarios).
-- ============================================================
CREATE TABLE IF NOT EXISTS event_attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES event_instances(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  checked_in      BOOLEAN NOT NULL DEFAULT false,
  checked_in_at   TIMESTAMPTZ,
  checked_in_lat  DOUBLE PRECISION,
  checked_in_lng  DOUBLE PRECISION,
  arrival_status  TEXT CHECK (arrival_status IN ('on_the_way', 'arrived', 'running_late', 'cant_make_it')),
  rsvp_status     TEXT NOT NULL DEFAULT 'pending'
                  CHECK (rsvp_status IN ('pending', 'yes', 'no', 'maybe')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE TRIGGER event_attendance_updated_at
  BEFORE UPDATE ON event_attendance
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: post_event_reviews
-- User reviews tied to specific event instances.
-- Separate from stay/leave decision.
-- ============================================================
CREATE TABLE IF NOT EXISTS post_event_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES event_instances(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  overall_rating  SMALLINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  vibe_rating     SMALLINT CHECK (vibe_rating BETWEEN 1 AND 5),
  venue_rating    SMALLINT CHECK (venue_rating BETWEEN 1 AND 5),
  would_return    BOOLEAN,
  comment         TEXT CHECK (char_length(comment) <= 1000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- ============================================================
-- TABLE: stay_leave_decisions
-- Anonymous post-event decision: stay in group or leave.
-- ============================================================
CREATE TABLE IF NOT EXISTS stay_leave_decisions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES event_instances(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  decision    TEXT NOT NULL CHECK (decision IN ('stay', 'leave')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- ============================================================
-- ALTER: groups — add recurring support columns
-- ============================================================
ALTER TABLE groups ADD COLUMN IF NOT EXISTS day_of_week SMALLINT CHECK (day_of_week BETWEEN 0 AND 6);
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS min_members SMALLINT NOT NULL DEFAULT 3;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS current_event_id UUID REFERENCES event_instances(id);
ALTER TABLE groups ADD COLUMN IF NOT EXISTS total_events SMALLINT NOT NULL DEFAULT 0;

-- ============================================================
-- ALTER: profiles — track first check-in for multi-group unlock
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_checkin_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_group_count SMALLINT NOT NULL DEFAULT 0;

-- ============================================================
-- ALTER: group_members — add event-level tracking
-- ============================================================
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS events_attended SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS last_event_id UUID REFERENCES event_instances(id);
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ;
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS leave_reason TEXT CHECK (leave_reason IN ('voluntary', 'no_show', 'dissolved', 'removed'));

-- ============================================================
-- FUNCTION: record_first_checkin
-- Sets profiles.first_checkin_at on first-ever check-in
-- ============================================================
CREATE OR REPLACE FUNCTION record_first_checkin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.checked_in = true AND (OLD.checked_in IS NULL OR OLD.checked_in = false) THEN
    UPDATE profiles
    SET first_checkin_at = COALESCE(first_checkin_at, now())
    WHERE id = NEW.user_id AND first_checkin_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER event_attendance_first_checkin
  AFTER UPDATE OF checked_in ON event_attendance
  FOR EACH ROW
  WHEN (NEW.checked_in = true AND OLD.checked_in = false)
  EXECUTE FUNCTION record_first_checkin();

-- Also track first check-in from legacy group_members table
CREATE OR REPLACE FUNCTION record_first_checkin_legacy()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.checked_in = true AND (OLD.checked_in IS NULL OR OLD.checked_in = false) THEN
    UPDATE profiles
    SET first_checkin_at = COALESCE(first_checkin_at, now())
    WHERE id = NEW.user_id AND first_checkin_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS group_members_first_checkin ON group_members;
CREATE TRIGGER group_members_first_checkin
  AFTER UPDATE OF checked_in ON group_members
  FOR EACH ROW
  WHEN (NEW.checked_in = true AND OLD.checked_in = false)
  EXECUTE FUNCTION record_first_checkin_legacy();

-- ============================================================
-- FUNCTION: sync_active_group_count
-- Keeps profiles.active_group_count in sync
-- ============================================================
CREATE OR REPLACE FUNCTION sync_active_group_count()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id UUID;
  new_count SMALLINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD.user_id;
  ELSE
    target_user_id := NEW.user_id;
  END IF;

  SELECT COUNT(*)::SMALLINT INTO new_count
  FROM group_members gm
  JOIN groups g ON g.id = gm.group_id
  WHERE gm.user_id = target_user_id
    AND gm.status = 'active'
    AND g.status IN ('forming', 'active');

  UPDATE profiles SET active_group_count = new_count
  WHERE id = target_user_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_active_groups ON group_members;
CREATE TRIGGER sync_active_groups
  AFTER INSERT OR UPDATE OR DELETE ON group_members
  FOR EACH ROW EXECUTE FUNCTION sync_active_group_count();

-- ============================================================
-- FUNCTION: process_stay_leave_decisions
-- After all members have voted for an event, process the group.
-- Called by admin/cron after decision deadline.
-- ============================================================
CREATE OR REPLACE FUNCTION process_group_after_event(p_event_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_group_id UUID;
  v_min_members SMALLINT;
  v_stay_count INT;
  v_leave_count INT;
  v_no_vote_count INT;
  v_total_members INT;
  v_result JSONB;
BEGIN
  -- Get group info
  SELECT ei.group_id, g.min_members
  INTO v_group_id, v_min_members
  FROM event_instances ei
  JOIN groups g ON g.id = ei.group_id
  WHERE ei.id = p_event_id;

  IF v_group_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Event not found');
  END IF;

  -- Count decisions
  SELECT COUNT(*) INTO v_total_members
  FROM group_members WHERE group_id = v_group_id AND status = 'active';

  SELECT COUNT(*) INTO v_stay_count
  FROM stay_leave_decisions WHERE event_id = p_event_id AND decision = 'stay';

  SELECT COUNT(*) INTO v_leave_count
  FROM stay_leave_decisions WHERE event_id = p_event_id AND decision = 'leave';

  v_no_vote_count := v_total_members - v_stay_count - v_leave_count;

  -- Process leavers: mark as 'left'
  UPDATE group_members
  SET status = 'left', left_at = now(), leave_reason = 'voluntary'
  WHERE group_id = v_group_id
    AND user_id IN (
      SELECT user_id FROM stay_leave_decisions
      WHERE event_id = p_event_id AND decision = 'leave'
    );

  -- Process no-shows who didn't check in: mark as 'left'
  UPDATE group_members
  SET status = 'left', left_at = now(), leave_reason = 'no_show'
  WHERE group_id = v_group_id
    AND status = 'active'
    AND user_id NOT IN (
      SELECT user_id FROM event_attendance
      WHERE event_id = p_event_id AND checked_in = true
    )
    AND user_id NOT IN (
      SELECT user_id FROM stay_leave_decisions
      WHERE event_id = p_event_id
    );

  -- Recount active members after removals
  SELECT COUNT(*) INTO v_stay_count
  FROM group_members WHERE group_id = v_group_id AND status = 'active';

  -- Decide group fate
  IF v_stay_count >= v_min_members THEN
    -- Group continues! Mark as recurring
    UPDATE groups
    SET is_recurring = true,
        total_events = total_events + 1
    WHERE id = v_group_id;

    v_result := jsonb_build_object(
      'action', 'continue',
      'remaining_members', v_stay_count,
      'spots_to_fill', (SELECT max_members FROM groups WHERE id = v_group_id) - v_stay_count
    );
  ELSE
    -- Group dissolves
    UPDATE groups SET status = 'dissolved' WHERE id = v_group_id;

    -- Mark remaining members
    UPDATE group_members
    SET status = 'left', left_at = now(), leave_reason = 'dissolved'
    WHERE group_id = v_group_id AND status = 'active';

    v_result := jsonb_build_object(
      'action', 'dissolve',
      'remaining_members', v_stay_count,
      'reason', 'below_minimum'
    );
  END IF;

  -- Mark event as completed
  UPDATE event_instances SET status = 'completed' WHERE id = p_event_id;

  -- Sync active group counts for all affected users
  UPDATE profiles p
  SET active_group_count = (
    SELECT COUNT(*)::SMALLINT
    FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    WHERE gm.user_id = p.id
      AND gm.status = 'active'
      AND g.status IN ('forming', 'active')
  )
  WHERE p.id IN (
    SELECT user_id FROM group_members WHERE group_id = v_group_id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: can_join_new_group
-- Checks if user is eligible for a new group
-- ============================================================
CREATE OR REPLACE FUNCTION can_join_new_group(p_user_id UUID, p_day_of_week SMALLINT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_first_checkin TIMESTAMPTZ;
  v_active_count SMALLINT;
  v_max_groups SMALLINT;
  v_day_conflict BOOLEAN := false;
BEGIN
  SELECT first_checkin_at, active_group_count
  INTO v_first_checkin, v_active_count
  FROM profiles WHERE id = p_user_id;

  -- Before first check-in: max 1 group
  -- After first check-in: max 3 groups
  IF v_first_checkin IS NULL THEN
    v_max_groups := 1;
  ELSE
    v_max_groups := 3;
  END IF;

  IF v_active_count >= v_max_groups THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'max_groups_reached',
      'max_groups', v_max_groups,
      'active_count', v_active_count
    );
  END IF;

  -- Check day-of-week conflict
  IF p_day_of_week IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1
      FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      WHERE gm.user_id = p_user_id
        AND gm.status = 'active'
        AND g.status IN ('forming', 'active')
        AND g.day_of_week = p_day_of_week
    ) INTO v_day_conflict;

    IF v_day_conflict THEN
      RETURN jsonb_build_object(
        'eligible', false,
        'reason', 'day_conflict',
        'conflicting_day', p_day_of_week
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'eligible', true,
    'max_groups', v_max_groups,
    'active_count', v_active_count,
    'slots_remaining', v_max_groups - v_active_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- VIEW: user_group_history
-- Clean view for displaying active + past groups
-- ============================================================
CREATE OR REPLACE VIEW user_group_history AS
SELECT
  gm.user_id,
  g.id AS group_id,
  g.name AS group_name,
  g.status AS group_status,
  g.day_of_week,
  g.is_recurring,
  g.scheduled_time,
  g.total_events,
  g.created_at AS group_created_at,
  gm.status AS membership_status,
  gm.joined_at,
  gm.left_at,
  gm.leave_reason,
  gm.events_attended,
  gm.checked_in AS ever_checked_in,
  v.name AS venue_name,
  v.neighborhood AS venue_neighborhood,
  -- Derived fields
  CASE
    WHEN g.status IN ('forming', 'active') AND gm.status = 'active' THEN 'active'
    WHEN gm.leave_reason = 'voluntary' THEN 'left'
    WHEN gm.leave_reason = 'dissolved' THEN 'dissolved'
    WHEN gm.leave_reason = 'no_show' THEN 'no_show'
    WHEN g.status = 'completed' THEN 'completed'
    ELSE 'unknown'
  END AS display_status,
  -- Sort key: active groups first (0), then by most recent activity
  CASE
    WHEN g.status IN ('forming', 'active') AND gm.status = 'active' THEN 0
    ELSE 1
  END AS sort_section,
  COALESCE(gm.left_at, g.scheduled_time, g.created_at) AS sort_date
FROM group_members gm
JOIN groups g ON g.id = gm.group_id
LEFT JOIN venues v ON v.id = g.venue_id
ORDER BY sort_section ASC, sort_date DESC;

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE event_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_event_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE stay_leave_decisions ENABLE ROW LEVEL SECURITY;

-- event_instances: members can read their group's events
CREATE POLICY "Members can view group events"
  ON event_instances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = event_instances.group_id
        AND user_id = auth.uid()
    )
    OR is_admin()
  );

CREATE POLICY "Admin can manage events"
  ON event_instances FOR ALL
  USING (is_admin());

-- event_attendance: users can read/update their own
CREATE POLICY "Users can view own attendance"
  ON event_attendance FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can update own attendance"
  ON event_attendance FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can manage attendance"
  ON event_attendance FOR ALL
  USING (is_admin());

-- post_event_reviews: users can create/read their own
CREATE POLICY "Users can create own reviews"
  ON post_event_reviews FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own reviews"
  ON post_event_reviews FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

-- stay_leave_decisions: users can create their own, NO ONE can read others'
CREATE POLICY "Users can create own decisions"
  ON stay_leave_decisions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own decisions"
  ON stay_leave_decisions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admin can view all decisions"
  ON stay_leave_decisions FOR SELECT
  USING (is_admin());

-- Fix: Allow users to update their own reviews (needed for upsert)
CREATE POLICY "Users can update own reviews"
  ON post_event_reviews FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Fix: Allow users to update their own decisions (needed for upsert)
CREATE POLICY "Users can update own decisions"
  ON stay_leave_decisions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Fix: Allow system/admin to insert event_attendance rows
CREATE POLICY "System can insert attendance"
  ON event_attendance FOR INSERT
  WITH CHECK (user_id = auth.uid() OR is_admin());

-- Update default max_members from 6 to 8
ALTER TABLE groups ALTER COLUMN max_members SET DEFAULT 8;

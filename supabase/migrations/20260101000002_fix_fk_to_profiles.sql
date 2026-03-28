-- Re-point user_id foreign keys to profiles(id) instead of auth.users(id)
-- This allows PostgREST to auto-join to profiles in nested selects.
-- profiles.id is the same value as auth.users.id (1-to-1 mirror).

-- group_members
ALTER TABLE group_members DROP CONSTRAINT group_members_user_id_fkey;
ALTER TABLE group_members
  ADD CONSTRAINT group_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- messages (nullable user_id for system messages)
ALTER TABLE messages DROP CONSTRAINT messages_user_id_fkey;
ALTER TABLE messages
  ADD CONSTRAINT messages_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- feedback
ALTER TABLE feedback DROP CONSTRAINT feedback_user_id_fkey;
ALTER TABLE feedback
  ADD CONSTRAINT feedback_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- questionnaire_answers
ALTER TABLE questionnaire_answers DROP CONSTRAINT questionnaire_answers_user_id_fkey;
ALTER TABLE questionnaire_answers
  ADD CONSTRAINT questionnaire_answers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- availability_slots
ALTER TABLE availability_slots DROP CONSTRAINT availability_slots_user_id_fkey;
ALTER TABLE availability_slots
  ADD CONSTRAINT availability_slots_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- blocks
ALTER TABLE blocks DROP CONSTRAINT blocks_blocker_id_fkey;
ALTER TABLE blocks DROP CONSTRAINT blocks_blocked_id_fkey;
ALTER TABLE blocks
  ADD CONSTRAINT blocks_blocker_id_fkey
  FOREIGN KEY (blocker_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE blocks
  ADD CONSTRAINT blocks_blocked_id_fkey
  FOREIGN KEY (blocked_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- subscriptions
ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_user_id_fkey;
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

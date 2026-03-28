-- ============================================================
-- Squad App — Seed Data
-- ============================================================
-- Populates the database with realistic NYC-based sample data.
-- Safe to run multiple times (ON CONFLICT DO NOTHING throughout).
--
-- NOTE: Inserting directly into auth.users is only supported on
-- local / self-hosted Supabase instances.  In a hosted project,
-- create real accounts via the Auth API and then run only the
-- non-auth portions of this script, or use the Supabase dashboard
-- "SQL editor" with service_role credentials.
-- ============================================================

BEGIN;

-- ============================================================
-- 0. Deterministic UUIDs for seed records
--    (stable across re-runs so ON CONFLICT works correctly)
-- ============================================================

-- Users
DO $$ BEGIN
  -- Just declare for documentation; we'll use literals inline.
END $$;

-- user_1  : Jordan Rivera       — 2a1b3c4d-0001-0000-0000-000000000001
-- user_2  : Morgan Chen         — 2a1b3c4d-0002-0000-0000-000000000002
-- user_3  : Taylor Okonkwo      — 2a1b3c4d-0003-0000-0000-000000000003
-- user_4  : Alex Petrov         — 2a1b3c4d-0004-0000-0000-000000000004
-- user_5  : Priya Sharma        — 2a1b3c4d-0005-0000-0000-000000000005
-- user_6  : Dante Reyes         — 2a1b3c4d-0006-0000-0000-000000000006
-- user_7  : Chloe Park          — 2a1b3c4d-0007-0000-0000-000000000007
-- user_8  : Sam Nguyen          — 2a1b3c4d-0008-0000-0000-000000000008
-- admin_1 : Squad Admin         — 2a1b3c4d-0099-0000-0000-000000000099

-- Venues
-- venue_1 : Birch Coffee        — b1b1b1b1-0001-0000-0000-000000000001
-- venue_2 : The Rusty Knot      — b1b1b1b1-0002-0000-0000-000000000002
-- venue_3 : Russ & Daughters    — b1b1b1b1-0003-0000-0000-000000000003
-- venue_4 : Ace Bar              — b1b1b1b1-0004-0000-0000-000000000004
-- venue_5 : Joe Coffee           — b1b1b1b1-0005-0000-0000-000000000005

-- Cycle
-- cycle_1 : week of 2026-03-23  — c1c1c1c1-0001-0000-0000-000000000001

-- Group
-- group_1 : The Night Owls      — d1d1d1d1-0001-0000-0000-000000000001


-- ============================================================
-- 1. Auth Users  (service_role / local Supabase only)
-- ============================================================

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
VALUES
  (
    '2a1b3c4d-0001-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'jordan.rivera@example.com',
    crypt('SeedPass123!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Jordan Rivera"}',
    FALSE, '', '', '', ''
  ),
  (
    '2a1b3c4d-0002-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'morgan.chen@example.com',
    crypt('SeedPass123!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Morgan Chen"}',
    FALSE, '', '', '', ''
  ),
  (
    '2a1b3c4d-0003-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'taylor.okonkwo@example.com',
    crypt('SeedPass123!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Taylor Okonkwo"}',
    FALSE, '', '', '', ''
  ),
  (
    '2a1b3c4d-0004-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'alex.petrov@example.com',
    crypt('SeedPass123!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Alex Petrov"}',
    FALSE, '', '', '', ''
  ),
  (
    '2a1b3c4d-0005-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'priya.sharma@example.com',
    crypt('SeedPass123!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Priya Sharma"}',
    FALSE, '', '', '', ''
  ),
  (
    '2a1b3c4d-0006-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'dante.reyes@example.com',
    crypt('SeedPass123!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Dante Reyes"}',
    FALSE, '', '', '', ''
  ),
  (
    '2a1b3c4d-0007-0000-0000-000000000007',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'chloe.park@example.com',
    crypt('SeedPass123!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Chloe Park"}',
    FALSE, '', '', '', ''
  ),
  (
    '2a1b3c4d-0008-0000-0000-000000000008',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'sam.nguyen@example.com',
    crypt('SeedPass123!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Sam Nguyen"}',
    FALSE, '', '', '', ''
  ),
  (
    '2a1b3c4d-0099-0000-0000-000000000099',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'admin@squad.app',
    crypt('AdminPass999!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Squad Admin"}',
    FALSE, '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 2. Profiles
-- ============================================================

INSERT INTO profiles (
  id, display_name, bio, age, location, neighborhood,
  avatar_url, role, onboarding_complete, created_at, updated_at
)
VALUES
  (
    '2a1b3c4d-0001-0000-0000-000000000001',
    'Jordan Rivera',
    'Software engineer by day, amateur chef by night. Looking for genuine connections over good food.',
    28, 'New York, NY', 'East Village',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=jordan',
    'member', TRUE, NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day'
  ),
  (
    '2a1b3c4d-0002-0000-0000-000000000002',
    'Morgan Chen',
    'Freelance illustrator obsessed with museums, vintage records, and late-night ramen spots.',
    31, 'New York, NY', 'Williamsburg',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=morgan',
    'member', TRUE, NOW() - INTERVAL '9 days', NOW() - INTERVAL '2 days'
  ),
  (
    '2a1b3c4d-0003-0000-0000-000000000003',
    'Taylor Okonkwo',
    'Urban planner passionate about transit, basketball, and finding the best jollof rice in the city.',
    26, 'New York, NY', 'Harlem',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=taylor',
    'member', TRUE, NOW() - INTERVAL '12 days', NOW() - INTERVAL '3 days'
  ),
  (
    '2a1b3c4d-0004-0000-0000-000000000004',
    'Alex Petrov',
    'Startup founder who loves chess, hiking the Catskills on weekends, and nerding out about history.',
    34, 'New York, NY', 'Greenpoint',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
    'member', TRUE, NOW() - INTERVAL '8 days', NOW() - INTERVAL '1 day'
  ),
  (
    '2a1b3c4d-0005-0000-0000-000000000005',
    'Priya Sharma',
    'Data scientist, amateur stand-up comedian, lifelong learner. Always up for a spirited debate.',
    29, 'New York, NY', 'Astoria',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=priya',
    'member', TRUE, NOW() - INTERVAL '11 days', NOW() - INTERVAL '2 days'
  ),
  (
    '2a1b3c4d-0006-0000-0000-000000000006',
    'Dante Reyes',
    'Music producer, salsa dancer, and coffee aficionado. Believe every stranger is just a friend you haven''t met.',
    27, 'New York, NY', 'Washington Heights',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=dante',
    'member', TRUE, NOW() - INTERVAL '7 days', NOW() - INTERVAL '1 day'
  ),
  (
    '2a1b3c4d-0007-0000-0000-000000000007',
    'Chloe Park',
    'UX designer who collects houseplants and Korean cookbooks. Introvert working on my extrovert era.',
    30, 'New York, NY', 'Sunnyside',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=chloe',
    'member', TRUE, NOW() - INTERVAL '14 days', NOW() - INTERVAL '4 days'
  ),
  (
    '2a1b3c4d-0008-0000-0000-000000000008',
    'Sam Nguyen',
    'Nurse by profession, trail runner by passion. Looking for people to explore the city''s hidden gems.',
    32, 'New York, NY', 'Flushing',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=sam',
    'member', TRUE, NOW() - INTERVAL '6 days', NOW()
  ),
  (
    '2a1b3c4d-0099-0000-0000-000000000099',
    'Squad Admin',
    'Platform administrator.',
    NULL, 'New York, NY', NULL,
    NULL,
    'admin', TRUE, NOW() - INTERVAL '30 days', NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  display_name       = EXCLUDED.display_name,
  bio                = EXCLUDED.bio,
  age                = EXCLUDED.age,
  location           = EXCLUDED.location,
  neighborhood       = EXCLUDED.neighborhood,
  avatar_url         = EXCLUDED.avatar_url,
  role               = EXCLUDED.role,
  onboarding_complete = EXCLUDED.onboarding_complete;


-- ============================================================
-- 3. Subscriptions  (auto-created by trigger, but ensure seed)
-- ============================================================

INSERT INTO subscriptions (user_id, plan, status, expires_at, created_at, updated_at)
VALUES
  ('2a1b3c4d-0001-0000-0000-000000000001', 'premium', 'active',  NOW() + INTERVAL '11 months', NOW() - INTERVAL '10 days', NOW()),
  ('2a1b3c4d-0002-0000-0000-000000000002', 'free',    'active',  NULL,                           NOW() - INTERVAL '9 days',  NOW()),
  ('2a1b3c4d-0003-0000-0000-000000000003', 'free',    'active',  NULL,                           NOW() - INTERVAL '12 days', NOW()),
  ('2a1b3c4d-0004-0000-0000-000000000004', 'premium', 'active',  NOW() + INTERVAL '6 months',   NOW() - INTERVAL '8 days',  NOW()),
  ('2a1b3c4d-0005-0000-0000-000000000005', 'free',    'active',  NULL,                           NOW() - INTERVAL '11 days', NOW()),
  ('2a1b3c4d-0006-0000-0000-000000000006', 'free',    'active',  NULL,                           NOW() - INTERVAL '7 days',  NOW()),
  ('2a1b3c4d-0007-0000-0000-000000000007', 'premium', 'active',  NOW() + INTERVAL '3 months',   NOW() - INTERVAL '14 days', NOW()),
  ('2a1b3c4d-0008-0000-0000-000000000008', 'free',    'active',  NULL,                           NOW() - INTERVAL '6 days',  NOW()),
  ('2a1b3c4d-0099-0000-0000-000000000099', 'premium', 'active',  NOW() + INTERVAL '99 years',   NOW() - INTERVAL '30 days', NOW())
ON CONFLICT (user_id) DO NOTHING;


-- ============================================================
-- 4. Questionnaire Answers
-- Keys: interests | personality_type | conversation_style |
--       energy_level | group_preference
-- ============================================================

-- Jordan Rivera
INSERT INTO questionnaire_answers (user_id, question_key, answer) VALUES
  ('2a1b3c4d-0001-0000-0000-000000000001', 'interests',          '["cooking","technology","hiking","film"]'),
  ('2a1b3c4d-0001-0000-0000-000000000001', 'personality_type',   '"ambivert"'),
  ('2a1b3c4d-0001-0000-0000-000000000001', 'conversation_style', '"deep-diver"'),
  ('2a1b3c4d-0001-0000-0000-000000000001', 'energy_level',       '"medium"'),
  ('2a1b3c4d-0001-0000-0000-000000000001', 'group_preference',   '{"size":"small","setting":"indoor","time_of_day":"evening"}')
ON CONFLICT (user_id, question_key) DO NOTHING;

-- Morgan Chen
INSERT INTO questionnaire_answers (user_id, question_key, answer) VALUES
  ('2a1b3c4d-0002-0000-0000-000000000002', 'interests',          '["art","music","travel","food"]'),
  ('2a1b3c4d-0002-0000-0000-000000000002', 'personality_type',   '"introvert"'),
  ('2a1b3c4d-0002-0000-0000-000000000002', 'conversation_style', '"listener"'),
  ('2a1b3c4d-0002-0000-0000-000000000002', 'energy_level',       '"low"'),
  ('2a1b3c4d-0002-0000-0000-000000000002', 'group_preference',   '{"size":"small","setting":"cozy-cafe","time_of_day":"afternoon"}')
ON CONFLICT (user_id, question_key) DO NOTHING;

-- Taylor Okonkwo
INSERT INTO questionnaire_answers (user_id, question_key, answer) VALUES
  ('2a1b3c4d-0003-0000-0000-000000000003', 'interests',          '["sports","urban-planning","cooking","politics"]'),
  ('2a1b3c4d-0003-0000-0000-000000000003', 'personality_type',   '"extrovert"'),
  ('2a1b3c4d-0003-0000-0000-000000000003', 'conversation_style', '"storyteller"'),
  ('2a1b3c4d-0003-0000-0000-000000000003', 'energy_level',       '"high"'),
  ('2a1b3c4d-0003-0000-0000-000000000003', 'group_preference',   '{"size":"medium","setting":"bar","time_of_day":"evening"}')
ON CONFLICT (user_id, question_key) DO NOTHING;

-- Alex Petrov
INSERT INTO questionnaire_answers (user_id, question_key, answer) VALUES
  ('2a1b3c4d-0004-0000-0000-000000000004', 'interests',          '["entrepreneurship","chess","history","hiking"]'),
  ('2a1b3c4d-0004-0000-0000-000000000004', 'personality_type',   '"ambivert"'),
  ('2a1b3c4d-0004-0000-0000-000000000004', 'conversation_style', '"deep-diver"'),
  ('2a1b3c4d-0004-0000-0000-000000000004', 'energy_level',       '"medium"'),
  ('2a1b3c4d-0004-0000-0000-000000000004', 'group_preference',   '{"size":"small","setting":"indoor","time_of_day":"evening"}')
ON CONFLICT (user_id, question_key) DO NOTHING;

-- Priya Sharma
INSERT INTO questionnaire_answers (user_id, question_key, answer) VALUES
  ('2a1b3c4d-0005-0000-0000-000000000005', 'interests',          '["comedy","data-science","debate","travel"]'),
  ('2a1b3c4d-0005-0000-0000-000000000005', 'personality_type',   '"extrovert"'),
  ('2a1b3c4d-0005-0000-0000-000000000005', 'conversation_style', '"debater"'),
  ('2a1b3c4d-0005-0000-0000-000000000005', 'energy_level',       '"high"'),
  ('2a1b3c4d-0005-0000-0000-000000000005', 'group_preference',   '{"size":"small","setting":"bar","time_of_day":"evening"}')
ON CONFLICT (user_id, question_key) DO NOTHING;

-- Dante Reyes
INSERT INTO questionnaire_answers (user_id, question_key, answer) VALUES
  ('2a1b3c4d-0006-0000-0000-000000000006', 'interests',          '["music","dancing","coffee","travel"]'),
  ('2a1b3c4d-0006-0000-0000-000000000006', 'personality_type',   '"extrovert"'),
  ('2a1b3c4d-0006-0000-0000-000000000006', 'conversation_style', '"storyteller"'),
  ('2a1b3c4d-0006-0000-0000-000000000006', 'energy_level',       '"high"'),
  ('2a1b3c4d-0006-0000-0000-000000000006', 'group_preference',   '{"size":"medium","setting":"bar","time_of_day":"night"}')
ON CONFLICT (user_id, question_key) DO NOTHING;

-- Chloe Park
INSERT INTO questionnaire_answers (user_id, question_key, answer) VALUES
  ('2a1b3c4d-0007-0000-0000-000000000007', 'interests',          '["design","plants","cooking","photography"]'),
  ('2a1b3c4d-0007-0000-0000-000000000007', 'personality_type',   '"introvert"'),
  ('2a1b3c4d-0007-0000-0000-000000000007', 'conversation_style', '"listener"'),
  ('2a1b3c4d-0007-0000-0000-000000000007', 'energy_level',       '"medium"'),
  ('2a1b3c4d-0007-0000-0000-000000000007', 'group_preference',   '{"size":"small","setting":"cozy-cafe","time_of_day":"afternoon"}')
ON CONFLICT (user_id, question_key) DO NOTHING;

-- Sam Nguyen
INSERT INTO questionnaire_answers (user_id, question_key, answer) VALUES
  ('2a1b3c4d-0008-0000-0000-000000000008', 'interests',          '["running","healthcare","food","nature"]'),
  ('2a1b3c4d-0008-0000-0000-000000000008', 'personality_type',   '"ambivert"'),
  ('2a1b3c4d-0008-0000-0000-000000000008', 'conversation_style', '"deep-diver"'),
  ('2a1b3c4d-0008-0000-0000-000000000008', 'energy_level',       '"medium"'),
  ('2a1b3c4d-0008-0000-0000-000000000008', 'group_preference',   '{"size":"small","setting":"restaurant","time_of_day":"evening"}')
ON CONFLICT (user_id, question_key) DO NOTHING;


-- ============================================================
-- 5. Venues (NYC)
-- ============================================================

INSERT INTO venues (id, name, address, neighborhood, capacity, category, lat, lng, active)
VALUES
  (
    'b1b1b1b1-0001-0000-0000-000000000001',
    'Birch Coffee',
    '56 7th Ave S, New York, NY 10014',
    'West Village',
    30, 'coffee',
    40.733540, -74.002560,
    TRUE
  ),
  (
    'b1b1b1b1-0002-0000-0000-000000000002',
    'The Rusty Knot',
    '425 West St, New York, NY 10014',
    'West Village',
    60, 'bar',
    40.734812, -74.008765,
    TRUE
  ),
  (
    'b1b1b1b1-0003-0000-0000-000000000003',
    'Russ & Daughters Cafe',
    '127 Orchard St, New York, NY 10002',
    'Lower East Side',
    45, 'restaurant',
    40.719654, -73.988452,
    TRUE
  ),
  (
    'b1b1b1b1-0004-0000-0000-000000000004',
    'Ace Bar',
    '531 E 5th St, New York, NY 10009',
    'East Village',
    80, 'bar',
    40.725801, -73.978934,
    TRUE
  ),
  (
    'b1b1b1b1-0005-0000-0000-000000000005',
    'Joe Coffee',
    '405 W 23rd St, New York, NY 10011',
    'Chelsea',
    25, 'coffee',
    40.746201, -74.001123,
    TRUE
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 6. Match Cycle  (current week — Mon 2026-03-23)
-- ============================================================

INSERT INTO match_cycles (id, cycle_date, status, created_at, updated_at)
VALUES (
  'c1c1c1c1-0001-0000-0000-000000000001',
  '2026-03-23',
  'active',
  '2026-03-20 09:00:00+00',
  '2026-03-23 10:00:00+00'
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 7. Availability Slots
--    day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
-- ============================================================

-- Jordan Rivera — Tue/Thu evenings, Sat afternoons (recurring + cycle-specific)
INSERT INTO availability_slots (user_id, day_of_week, start_time, end_time, cycle_id)
VALUES
  ('2a1b3c4d-0001-0000-0000-000000000001', 2, '18:00', '21:00', NULL),
  ('2a1b3c4d-0001-0000-0000-000000000001', 4, '18:00', '21:00', NULL),
  ('2a1b3c4d-0001-0000-0000-000000000001', 6, '13:00', '18:00', NULL),
  ('2a1b3c4d-0001-0000-0000-000000000001', 5, '19:00', '22:00', 'c1c1c1c1-0001-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Morgan Chen — Wed/Fri evenings, Sun afternoons
INSERT INTO availability_slots (user_id, day_of_week, start_time, end_time, cycle_id)
VALUES
  ('2a1b3c4d-0002-0000-0000-000000000002', 3, '17:00', '20:00', NULL),
  ('2a1b3c4d-0002-0000-0000-000000000002', 5, '17:00', '20:00', NULL),
  ('2a1b3c4d-0002-0000-0000-000000000002', 0, '12:00', '16:00', NULL)
ON CONFLICT DO NOTHING;

-- Taylor Okonkwo — Mon/Wed/Fri evenings
INSERT INTO availability_slots (user_id, day_of_week, start_time, end_time, cycle_id)
VALUES
  ('2a1b3c4d-0003-0000-0000-000000000003', 1, '19:00', '22:00', NULL),
  ('2a1b3c4d-0003-0000-0000-000000000003', 3, '19:00', '22:00', NULL),
  ('2a1b3c4d-0003-0000-0000-000000000003', 5, '19:00', '23:00', NULL)
ON CONFLICT DO NOTHING;

-- Alex Petrov — Thu/Fri evenings, Sat all day
INSERT INTO availability_slots (user_id, day_of_week, start_time, end_time, cycle_id)
VALUES
  ('2a1b3c4d-0004-0000-0000-000000000004', 4, '18:30', '21:30', NULL),
  ('2a1b3c4d-0004-0000-0000-000000000004', 5, '18:00', '22:00', NULL),
  ('2a1b3c4d-0004-0000-0000-000000000004', 6, '10:00', '20:00', NULL)
ON CONFLICT DO NOTHING;

-- Priya Sharma — Tue/Thu/Sat evenings
INSERT INTO availability_slots (user_id, day_of_week, start_time, end_time, cycle_id)
VALUES
  ('2a1b3c4d-0005-0000-0000-000000000005', 2, '19:00', '22:30', NULL),
  ('2a1b3c4d-0005-0000-0000-000000000005', 4, '19:00', '22:30', NULL),
  ('2a1b3c4d-0005-0000-0000-000000000005', 6, '18:00', '23:00', NULL)
ON CONFLICT DO NOTHING;

-- Dante Reyes — Fri/Sat nights
INSERT INTO availability_slots (user_id, day_of_week, start_time, end_time, cycle_id)
VALUES
  ('2a1b3c4d-0006-0000-0000-000000000006', 5, '20:00', '24:00', NULL),
  ('2a1b3c4d-0006-0000-0000-000000000006', 6, '20:00', '24:00', NULL),
  ('2a1b3c4d-0006-0000-0000-000000000006', 4, '19:00', '22:00', NULL)
ON CONFLICT DO NOTHING;

-- Chloe Park — Wed afternoons, Sat/Sun afternoons
INSERT INTO availability_slots (user_id, day_of_week, start_time, end_time, cycle_id)
VALUES
  ('2a1b3c4d-0007-0000-0000-000000000007', 3, '14:00', '18:00', NULL),
  ('2a1b3c4d-0007-0000-0000-000000000007', 6, '12:00', '17:00', NULL),
  ('2a1b3c4d-0007-0000-0000-000000000007', 0, '12:00', '17:00', NULL)
ON CONFLICT DO NOTHING;

-- Sam Nguyen — Mon/Tue/Thu evenings (post-shift)
INSERT INTO availability_slots (user_id, day_of_week, start_time, end_time, cycle_id)
VALUES
  ('2a1b3c4d-0008-0000-0000-000000000008', 1, '19:00', '22:00', NULL),
  ('2a1b3c4d-0008-0000-0000-000000000008', 2, '19:00', '22:00', NULL),
  ('2a1b3c4d-0008-0000-0000-000000000008', 4, '19:00', '22:00', NULL)
ON CONFLICT DO NOTHING;


-- ============================================================
-- 8. Group: "The Night Owls"
--    6 members, meeting Friday 2026-03-27 at Ace Bar
-- ============================================================

INSERT INTO groups (id, cycle_id, venue_id, name, status, scheduled_time, max_members, created_at, updated_at)
VALUES (
  'd1d1d1d1-0001-0000-0000-000000000001',
  'c1c1c1c1-0001-0000-0000-000000000001',
  'b1b1b1b1-0004-0000-0000-000000000004',
  'The Night Owls',
  'active',
  '2026-03-27 19:30:00+00',
  6,
  '2026-03-23 10:15:00+00',
  '2026-03-23 10:15:00+00'
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 9. Group Members  (6 active members, 2 users are not in group)
-- ============================================================

INSERT INTO group_members (id, group_id, user_id, status, rsvp_status, stay_vote, joined_at, updated_at)
VALUES
  (
    uuid_generate_v4(),
    'd1d1d1d1-0001-0000-0000-000000000001',
    '2a1b3c4d-0001-0000-0000-000000000001',  -- Jordan
    'active', 'yes', NULL,
    '2026-03-23 10:15:00+00', '2026-03-23 11:00:00+00'
  ),
  (
    uuid_generate_v4(),
    'd1d1d1d1-0001-0000-0000-000000000001',
    '2a1b3c4d-0003-0000-0000-000000000003',  -- Taylor
    'active', 'yes', NULL,
    '2026-03-23 10:15:00+00', '2026-03-23 12:30:00+00'
  ),
  (
    uuid_generate_v4(),
    'd1d1d1d1-0001-0000-0000-000000000001',
    '2a1b3c4d-0004-0000-0000-000000000004',  -- Alex
    'active', 'yes', NULL,
    '2026-03-23 10:15:00+00', '2026-03-23 14:00:00+00'
  ),
  (
    uuid_generate_v4(),
    'd1d1d1d1-0001-0000-0000-000000000001',
    '2a1b3c4d-0005-0000-0000-000000000005',  -- Priya
    'active', 'yes', NULL,
    '2026-03-23 10:15:00+00', '2026-03-23 15:45:00+00'
  ),
  (
    uuid_generate_v4(),
    'd1d1d1d1-0001-0000-0000-000000000001',
    '2a1b3c4d-0006-0000-0000-000000000006',  -- Dante
    'active', 'maybe', NULL,
    '2026-03-23 10:15:00+00', '2026-03-23 16:20:00+00'
  ),
  (
    uuid_generate_v4(),
    'd1d1d1d1-0001-0000-0000-000000000001',
    '2a1b3c4d-0008-0000-0000-000000000008',  -- Sam
    'active', 'pending', NULL,
    '2026-03-23 10:15:00+00', '2026-03-23 10:15:00+00'
  )
ON CONFLICT (group_id, user_id) DO NOTHING;
-- Note: Morgan (user_2) and Chloe (user_7) were not matched this cycle.


-- ============================================================
-- 10. Messages
-- ============================================================

INSERT INTO messages (id, group_id, user_id, content, type, created_at)
VALUES
  -- System announcement when group was formed
  (
    uuid_generate_v4(),
    'd1d1d1d1-0001-0000-0000-000000000001',
    NULL,
    'Welcome to The Night Owls! Your group has been matched for the week of March 23. You are meeting at Ace Bar on Friday, March 27 at 7:30 PM.',
    'system',
    '2026-03-23 10:15:30+00'
  ),
  -- Jordan kicks off the conversation
  (
    uuid_generate_v4(),
    'd1d1d1d1-0001-0000-0000-000000000001',
    '2a1b3c4d-0001-0000-0000-000000000001',
    'Hey everyone! Really excited to meet you all on Friday. Ace Bar is a great pick — they have excellent craft beer and some seriously good bar snacks.',
    'text',
    '2026-03-23 11:02:00+00'
  ),
  -- Taylor responds
  (
    uuid_generate_v4(),
    'd1d1d1d1-0001-0000-0000-000000000001',
    '2a1b3c4d-0003-0000-0000-000000000003',
    'Can''t wait! I''ve walked by Ace Bar a dozen times but never actually gone in. Friday works perfectly for me.',
    'text',
    '2026-03-23 12:35:00+00'
  ),
  -- Alex joins
  (
    uuid_generate_v4(),
    'd1d1d1d1-0001-0000-0000-000000000001',
    '2a1b3c4d-0004-0000-0000-000000000004',
    'Confirmed for me too. Should we grab a table or just meet at the bar area? Usually easier to chat at a table.',
    'text',
    '2026-03-23 14:05:00+00'
  ),
  -- Priya
  (
    uuid_generate_v4(),
    'd1d1d1d1-0001-0000-0000-000000000001',
    '2a1b3c4d-0005-0000-0000-000000000005',
    'Table 100%. Also — fair warning, I will absolutely challenge someone to darts if they have a board. Just setting expectations early 😄',
    'text',
    '2026-03-23 15:50:00+00'
  ),
  -- Dante
  (
    uuid_generate_v4(),
    'd1d1d1d1-0001-0000-0000-000000000001',
    '2a1b3c4d-0006-0000-0000-000000000006',
    'They do have darts! I used to live two blocks away. Really cool spot. I''m about 80% sure I can make it — will confirm Thursday.',
    'text',
    '2026-03-23 16:25:00+00'
  ),
  -- Jordan again
  (
    uuid_generate_v4(),
    'd1d1d1d1-0001-0000-0000-000000000001',
    '2a1b3c4d-0001-0000-0000-000000000001',
    'Great, I''ll aim to arrive a few minutes early and grab a table near the back. See you all there!',
    'text',
    '2026-03-23 17:10:00+00'
  ),
  -- System reminder
  (
    uuid_generate_v4(),
    'd1d1d1d1-0001-0000-0000-000000000001',
    NULL,
    'Reminder: Your meetup at Ace Bar is tomorrow (Friday, March 27) at 7:30 PM. Don''t forget to RSVP if you haven''t already!',
    'announcement',
    '2026-03-26 09:00:00+00'
  ),
  -- Priya the day before
  (
    uuid_generate_v4(),
    'd1d1d1d1-0001-0000-0000-000000000001',
    '2a1b3c4d-0005-0000-0000-000000000005',
    'See everyone tomorrow! Coming straight from work so I''ll be right on time.',
    'text',
    '2026-03-26 10:30:00+00'
  ),
  -- Taylor
  (
    uuid_generate_v4(),
    'd1d1d1d1-0001-0000-0000-000000000001',
    '2a1b3c4d-0003-0000-0000-000000000003',
    'Same here. Looking forward to it!',
    'text',
    '2026-03-26 11:00:00+00'
  )
ON CONFLICT DO NOTHING;


-- ============================================================
-- 11. Feedback  (post-cycle feedback from 4 members)
--     Submitted as if the meetup already happened.
-- ============================================================

INSERT INTO feedback (id, group_id, user_id, cycle_id, rating, vibe_score, would_meet_again, notes, created_at, updated_at)
VALUES
  (
    uuid_generate_v4(),
    'd1d1d1d1-0001-0000-0000-000000000001',
    '2a1b3c4d-0001-0000-0000-000000000001',
    'c1c1c1c1-0001-0000-0000-000000000001',
    5, 5, TRUE,
    'Honestly one of the best evenings I''ve had in months. Everyone was so different but it just clicked. Taylor''s stories had us in stitches.',
    '2026-03-28 09:15:00+00',
    '2026-03-28 09:15:00+00'
  ),
  (
    uuid_generate_v4(),
    'd1d1d1d1-0001-0000-0000-000000000001',
    '2a1b3c4d-0003-0000-0000-000000000003',
    'c1c1c1c1-0001-0000-0000-000000000001',
    5, 4, TRUE,
    'Great group! Priya is hilarious. Alex has fascinating startup stories. I''d definitely hang with this crew again.',
    '2026-03-28 10:40:00+00',
    '2026-03-28 10:40:00+00'
  ),
  (
    uuid_generate_v4(),
    'd1d1d1d1-0001-0000-0000-000000000001',
    '2a1b3c4d-0004-0000-0000-000000000004',
    'c1c1c1c1-0001-0000-0000-000000000001',
    4, 4, TRUE,
    'Really solid night. Conversation flowed naturally. The venue was a little loud by 9pm but the group energy made up for it.',
    '2026-03-28 12:00:00+00',
    '2026-03-28 12:00:00+00'
  ),
  (
    uuid_generate_v4(),
    'd1d1d1d1-0001-0000-0000-000000000001',
    '2a1b3c4d-0005-0000-0000-000000000005',
    'c1c1c1c1-0001-0000-0000-000000000001',
    5, 5, TRUE,
    'I won three rounds of darts AND made four new friends. 10/10 would Squad again.',
    '2026-03-28 08:30:00+00',
    '2026-03-28 08:30:00+00'
  )
ON CONFLICT (group_id, user_id) DO NOTHING;


-- ============================================================
-- 12. Sample Block  (Sam blocks nobody yet; just a placeholder
--     showing the constraint works)
-- ============================================================
-- No blocks seeded to keep the graph clean, but schema is validated.


-- ============================================================
-- Verify counts
-- ============================================================
DO $$
DECLARE
  v_profiles      INT;
  v_venues        INT;
  v_cycles        INT;
  v_groups        INT;
  v_members       INT;
  v_messages      INT;
  v_feedback      INT;
  v_avail         INT;
  v_qa            INT;
  v_subs          INT;
BEGIN
  SELECT COUNT(*) INTO v_profiles  FROM profiles;
  SELECT COUNT(*) INTO v_venues    FROM venues;
  SELECT COUNT(*) INTO v_cycles    FROM match_cycles;
  SELECT COUNT(*) INTO v_groups    FROM groups;
  SELECT COUNT(*) INTO v_members   FROM group_members;
  SELECT COUNT(*) INTO v_messages  FROM messages;
  SELECT COUNT(*) INTO v_feedback  FROM feedback;
  SELECT COUNT(*) INTO v_avail     FROM availability_slots;
  SELECT COUNT(*) INTO v_qa        FROM questionnaire_answers;
  SELECT COUNT(*) INTO v_subs      FROM subscriptions;

  RAISE NOTICE '=== Squad Seed Summary ===';
  RAISE NOTICE 'profiles:             %', v_profiles;
  RAISE NOTICE 'venues:               %', v_venues;
  RAISE NOTICE 'match_cycles:         %', v_cycles;
  RAISE NOTICE 'groups:               %', v_groups;
  RAISE NOTICE 'group_members:        %', v_members;
  RAISE NOTICE 'messages:             %', v_messages;
  RAISE NOTICE 'feedback:             %', v_feedback;
  RAISE NOTICE 'availability_slots:   %', v_avail;
  RAISE NOTICE 'questionnaire_answers:%', v_qa;
  RAISE NOTICE 'subscriptions:        %', v_subs;
  RAISE NOTICE '==========================';
END $$;


-- ============================================================
-- 12b. Meetup location for The Night Owls (map screen source)
-- ============================================================
-- The meetup map queries meetup_locations first.  This row is
-- the canonical source and what Realtime listens to for venue
-- switches.  Ace Bar coordinates match section 5 venues seed.
-- ============================================================

INSERT INTO meetup_locations (
  group_id,
  venue_id,
  name,
  address,
  lat,
  lng,
  set_by,
  is_switch
)
VALUES (
  'd1d1d1d1-0001-0000-0000-000000000001',   -- The Night Owls
  'b1b1b1b1-0004-0000-0000-000000000004',   -- Ace Bar
  'Ace Bar',
  '531 E 5th St, New York, NY 10009',
  40.725801,
  -73.978934,
  'system',
  FALSE
)
ON CONFLICT DO NOTHING;


-- ============================================================
-- 13. Nickname + first_name patches for seed users
-- ============================================================
-- MemberRow uses `nickname` for pre-reveal display and
-- `first_name` for post-reveal display.  These columns were
-- added after the initial seed, so we patch them here.
-- Safe to re-run: DO UPDATE only changes nickname/first_name.
-- ============================================================

UPDATE profiles SET
  nickname   = 'NightOwl',
  first_name = 'Jordan',
  intro      = 'Software engineer by day, amateur chef by night.',
  vibe_tags  = ARRAY['foodie', 'tech', 'chill']
WHERE id = '2a1b3c4d-0001-0000-0000-000000000001'
  AND (nickname IS NULL OR nickname = '');

UPDATE profiles SET
  nickname   = 'Picasso',
  first_name = 'Morgan',
  intro      = 'Freelance illustrator obsessed with museums and late-night ramen.',
  vibe_tags  = ARRAY['artsy', 'music', 'introvert']
WHERE id = '2a1b3c4d-0002-0000-0000-000000000002'
  AND (nickname IS NULL OR nickname = '');

UPDATE profiles SET
  nickname   = 'Hooper',
  first_name = 'Taylor',
  intro      = 'Urban planner, basketball, and the best jollof rice in the city.',
  vibe_tags  = ARRAY['sports', 'extrovert', 'local']
WHERE id = '2a1b3c4d-0003-0000-0000-000000000003'
  AND (nickname IS NULL OR nickname = '');

UPDATE profiles SET
  nickname   = 'ChessKing',
  first_name = 'Alex',
  intro      = 'Startup founder who loves chess, hiking, and nerding out on history.',
  vibe_tags  = ARRAY['entrepreneur', 'thinker', 'outdoors']
WHERE id = '2a1b3c4d-0004-0000-0000-000000000004'
  AND (nickname IS NULL OR nickname = '');

UPDATE profiles SET
  nickname   = 'ComedyNerd',
  first_name = 'Priya',
  intro      = 'Data scientist, amateur stand-up. Always up for a spirited debate.',
  vibe_tags  = ARRAY['comedy', 'debate', 'curious']
WHERE id = '2a1b3c4d-0005-0000-0000-000000000005'
  AND (nickname IS NULL OR nickname = '');

UPDATE profiles SET
  nickname   = 'BeatMaker',
  first_name = 'Dante',
  intro      = 'Music producer, salsa dancer, coffee aficionado.',
  vibe_tags  = ARRAY['music', 'dancer', 'social']
WHERE id = '2a1b3c4d-0006-0000-0000-000000000006'
  AND (nickname IS NULL OR nickname = '');

UPDATE profiles SET
  nickname   = 'PlantMom',
  first_name = 'Chloe',
  intro      = 'UX designer collecting houseplants and Korean cookbooks.',
  vibe_tags  = ARRAY['design', 'homebody', 'creative']
WHERE id = '2a1b3c4d-0007-0000-0000-000000000007'
  AND (nickname IS NULL OR nickname = '');

UPDATE profiles SET
  nickname   = 'TrailRunner',
  first_name = 'Sam',
  intro      = 'Nurse by profession, trail runner by passion.',
  vibe_tags  = ARRAY['fitness', 'outdoors', 'explorer']
WHERE id = '2a1b3c4d-0008-0000-0000-000000000008'
  AND (nickname IS NULL OR nickname = '');


COMMIT;

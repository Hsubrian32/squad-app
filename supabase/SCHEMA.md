# Squad — Complete Database Schema Reference

> **Source of truth** for all tables, columns, relationships, and indexes.
> Applied via sequential migration files in `supabase/migrations/`.

---

## Entity Relationship Overview

```
auth.users (managed by Supabase Auth)
    │
    ├── profiles           (1:1)  — user identity, status, preferences
    │     ├── questionnaire_answers  (1:N)
    │     ├── availability_slots     (1:N)
    │     └── subscriptions          (1:1)
    │
    ├── match_cycles       (N)    — one per week
    │     └── groups       (1:N)  — matched social groups per cycle
    │           ├── group_members (N:M with profiles)
    │           │     └── profiles (N:1)
    │           ├── messages (1:N)
    │           ├── feedback (1:N)
    │           └── meetup_locations (1:N — one active at a time)
    │                 └── venue_switch_proposals (1:N)
    │                       └── venue_switch_votes (1:N)
    │
    └── blocks             (self-referential M:M)
```

---

## Tables

### `profiles`
One row per `auth.users` entry. The central user record.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID PK` | Mirrors `auth.users.id` |
| `display_name` | `TEXT NOT NULL DEFAULT ''` | Full name shown post-reveal |
| `first_name` | `TEXT` | Real first name — shown to group after check-in |
| `nickname` | `TEXT UNIQUE` | Shown to group before check-in. Case-insensitive unique index |
| `bio` | `TEXT` | Long-form bio |
| `intro` | `TEXT` | Short one-liner (≤100 chars) |
| `vibe_tags` | `TEXT[] DEFAULT '{}'` | Up to 3 tags (e.g. `['foodie', 'traveler']`) |
| `age` | `SMALLINT` | Check: 18–120 |
| `city` | `TEXT` | City-level location (e.g. `'San Francisco'`) |
| `neighborhood` | `TEXT` | Finer-grained area |
| `location` | `TEXT` | Legacy / free-form location string |
| `avatar_url` | `TEXT` | Storage URL |
| `travel_radius_km` | `SMALLINT NOT NULL DEFAULT 10` | How far user will travel (1–100) |
| `role` | `user_role ENUM` | `member` \| `admin` |
| `status` | `profile_status ENUM` | `active` \| `banned` \| `suspended` |
| `matching_status` | `matching_status ENUM` | See state machine below |
| `matching_status_updated_at` | `TIMESTAMPTZ` | Auto-set by trigger |
| `onboarding_complete` | `BOOLEAN DEFAULT FALSE` | |
| `profile_visible` | `BOOLEAN DEFAULT FALSE` | Set true on first check-in |
| `privacy_preference` | `TEXT DEFAULT 'nickname_only'` | `nickname_only` \| `standard` |
| `venue_flexibility` | `TEXT DEFAULT 'flexible'` | `flexible` \| `prefer_original` \| `strict` |
| `last_opted_in_at` | `TIMESTAMPTZ` | When user last joined a cycle pool |
| `opted_in_cycle_id` | `UUID FK → match_cycles` | Current cycle opt-in |
| `created_at` | `TIMESTAMPTZ` | |
| `updated_at` | `TIMESTAMPTZ` | Auto-updated by trigger |

**Triggers:**
- `on_auth_user_created` → auto-creates profile row
- `profiles_updated_at` → sets `updated_at`
- `profiles_matching_status_ts` → sets `matching_status_updated_at` when status changes
- `on_profile_created` → auto-creates `subscriptions` row

---

### `matching_status` State Machine

```
         onboarding
         complete
             │
             ▼
          [idle]
             │  user opts in
             ▼
    [waiting_for_match]
             │  matching run assigns group
             ▼
          [matched]
             │  user RSVPs yes
             ▼
         [attending]
             │  user checks in at venue
             ▼
         [completed]
             │  cycle reset (end of week)
             ▼
          [idle]  ← ready for next week
```

**Transitions:**
| From | To | Trigger |
|------|----|---------|
| `idle` | `waiting_for_match` | `opt_in_to_cycle()` function |
| `waiting_for_match` | `matched` | Matching Edge Function |
| `matched` | `attending` | `group_members.rsvp_status` set to `yes` |
| `attending` | `completed` | `group_members.checked_in` set to `true` |
| any | `idle` | `reset_cycle_matching_statuses()` at cycle end |

---

### `questionnaire_answers`
Stores all onboarding questionnaire responses.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID PK` | |
| `user_id` | `UUID FK → auth.users` | |
| `question_key` | `TEXT` | e.g. `social_energy`, `interests`, `goal` |
| `answer` | `JSONB` | Single value or array; flexible for all question types |
| `created_at` | `TIMESTAMPTZ` | |
| `updated_at` | `TIMESTAMPTZ` | |

**Constraint:** `UNIQUE (user_id, question_key)` — one answer per question per user.
**Index:** GIN index on `answer` for JSONB containment queries during matching.

---

### `availability_slots`
When a user is available for meetups.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID PK` | |
| `user_id` | `UUID FK → auth.users` | |
| `day_of_week` | `SMALLINT` | 0=Sun … 6=Sat |
| `start_time` | `TIME` | e.g. `17:00:00` |
| `end_time` | `TIME` | e.g. `21:00:00` |
| `cycle_id` | `UUID FK → match_cycles` | NULL = recurring every week |
| `specific_date` | `DATE` | For one-off overrides (overrides day_of_week) |
| `created_at` | `TIMESTAMPTZ` | |
| `updated_at` | `TIMESTAMPTZ` | |

---

### `match_cycles`
One row per weekly matching run. Created on Sunday, matching runs Monday morning.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID PK` | |
| `cycle_date` | `DATE UNIQUE` | Always a Monday (ISO week start) |
| `status` | `cycle_status ENUM` | `pending` → `matching` → `active` → `completed` |
| `optin_opens_at` | `TIMESTAMPTZ` | When users can start opting in (typically prior Friday) |
| `optin_closes_at` | `TIMESTAMPTZ` | Deadline (typically Sunday midnight) |
| `matched_at` | `TIMESTAMPTZ` | When matching run completed |
| `created_at` | `TIMESTAMPTZ` | |
| `updated_at` | `TIMESTAMPTZ` | |

---

### `venues`
Physical venues. Curated by admin, used as meetup locations.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID PK` | |
| `name` | `TEXT NOT NULL` | |
| `address` | `TEXT NOT NULL` | |
| `neighborhood` | `TEXT NOT NULL` | |
| `city` | `TEXT` | For multi-city support |
| `category` | `TEXT NOT NULL` | `coffee` \| `bar` \| `restaurant` \| `park` \| `other` |
| `capacity` | `SMALLINT DEFAULT 20` | Maximum group size this venue supports |
| `lat` | `NUMERIC(9,6)` | WGS84 latitude |
| `lng` | `NUMERIC(9,6)` | WGS84 longitude |
| `active` | `BOOLEAN DEFAULT TRUE` | Only active venues used in matching |
| `notes` | `TEXT` | Admin-only notes |
| `created_at` | `TIMESTAMPTZ` | |
| `updated_at` | `TIMESTAMPTZ` | |

---

### `groups`
A matched social group for a given cycle.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID PK` | |
| `cycle_id` | `UUID FK → match_cycles` | |
| `venue_id` | `UUID FK → venues` | Original assigned venue (may differ from active meetup_location) |
| `name` | `TEXT NOT NULL` | Auto-generated (e.g. "The Fog Squad") |
| `status` | `group_status ENUM` | `forming` → `active` → `completed` \| `dissolved` |
| `scheduled_time` | `TIMESTAMPTZ` | Meetup date + time |
| `max_members` | `SMALLINT DEFAULT 6` | 2–12 |
| `member_count` | `SMALLINT DEFAULT 0` | Denormalised; maintained by trigger |
| `created_at` | `TIMESTAMPTZ` | |
| `updated_at` | `TIMESTAMPTZ` | |

**group_status transitions:**
```
forming → active (on match day) → completed (after meetup)
                                 → dissolved (group fell apart / too few members)
```

---

### `group_members`
Join table: users ↔ groups. The richest table — tracks the full meetup lifecycle per member.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID PK` | |
| `group_id` | `UUID FK → groups` | |
| `user_id` | `UUID FK → auth.users` | |
| `cycle_id` | `UUID FK → match_cycles` | Denormalised from group for faster queries |
| `status` | `member_status ENUM` | `invited` \| `active` \| `removed` \| `left` |
| `rsvp_status` | `rsvp_status ENUM` | `pending` \| `yes` \| `no` \| `maybe` |
| `arrival_status` | `TEXT` | `on_the_way` \| `arrived` \| `running_late` \| `cant_make_it` |
| `stay_vote` | `BOOLEAN` | Post-meetup: wants to stay/continue with group |
| `joined_at` | `TIMESTAMPTZ DEFAULT NOW()` | |
| `checked_in` | `BOOLEAN DEFAULT FALSE` | Set when user arrives at venue |
| `checked_in_at` | `TIMESTAMPTZ` | |
| `checkin_lat` | `DOUBLE PRECISION` | Where user was when they checked in |
| `checkin_lng` | `DOUBLE PRECISION` | |
| `name_revealed` | `BOOLEAN DEFAULT FALSE` | True after check-in — real name visible to group |
| `updated_at` | `TIMESTAMPTZ` | |

**Constraint:** `UNIQUE (group_id, user_id)`

**Triggers:**
- `group_members_count_sync` → updates `groups.member_count`
- `group_members_status_advance` → sets `profiles.matching_status = 'completed'` on check-in
- `group_members_rsvp_advance` → sets `profiles.matching_status = 'attending'` on RSVP yes
- `reveal_name_on_checkin` → sets `name_revealed = TRUE` and `arrival_status = 'arrived'` on check-in

---

### `messages`
Group chat messages. Immutable after insert.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID PK` | |
| `group_id` | `UUID FK → groups` | |
| `user_id` | `UUID FK → auth.users` | NULL for system messages |
| `content` | `TEXT` | 1–4000 chars |
| `type` | `message_type ENUM` | `text` \| `system` \| `announcement` |
| `created_at` | `TIMESTAMPTZ` | No `updated_at` — messages are immutable |

---

### `feedback`
Post-meetup feedback. One per user per group.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID PK` | |
| `group_id` | `UUID FK → groups` | |
| `cycle_id` | `UUID FK → match_cycles` | |
| `user_id` | `UUID FK → auth.users` | |
| `rating` | `SMALLINT` | 1–5 overall group rating |
| `vibe_score` | `SMALLINT` | 1–5 vibe check |
| `would_meet_again` | `BOOLEAN` | |
| `notes` | `TEXT` | Optional, ≤2000 chars |
| `created_at` | `TIMESTAMPTZ` | |
| `updated_at` | `TIMESTAMPTZ` | |

**Constraint:** `UNIQUE (group_id, user_id)`

---

### `blocks`
Prevents two users being matched together again.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID PK` | |
| `blocker_id` | `UUID FK → auth.users` | |
| `blocked_id` | `UUID FK → auth.users` | |
| `reason` | `TEXT` | Optional (harassment, bad experience, etc.) |
| `created_at` | `TIMESTAMPTZ` | |

**Constraint:** `UNIQUE (blocker_id, blocked_id)`, `CHECK (blocker_id <> blocked_id)`
**Index:** Composite on `LEAST(blocker_id, blocked_id), GREATEST(...)` — O(1) exclusion checks in both directions.

---

### `subscriptions`
User plan / billing state. Auto-created as `free` on sign-up.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID PK` | |
| `user_id` | `UUID FK → auth.users UNIQUE` | |
| `plan` | `subscription_plan ENUM` | `free` \| `premium` |
| `status` | `subscription_status ENUM` | `active` \| `cancelled` \| `expired` \| `trialing` |
| `expires_at` | `TIMESTAMPTZ` | NULL for free tier |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | |

---

### `meetup_locations`
The **active** meetup location for a group. Initially mirrors the assigned venue. Updated if a venue-switch vote passes.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID PK` | |
| `group_id` | `UUID FK → groups` | |
| `venue_id` | `UUID FK → venues` | NULL if custom pin |
| `name` | `TEXT NOT NULL` | Display name |
| `address` | `TEXT` | |
| `lat` | `DOUBLE PRECISION NOT NULL` | WGS84 |
| `lng` | `DOUBLE PRECISION NOT NULL` | WGS84 |
| `is_original` | `BOOLEAN DEFAULT TRUE` | False if switched |
| `is_active` | `BOOLEAN DEFAULT TRUE` | Only one active per group |
| `created_at` | `TIMESTAMPTZ` | |

**Rule:** Only one row per `group_id` should have `is_active = TRUE`. Enforced by the switch Edge Function.

---

### `venue_switch_proposals`
A proposal by a group member to move the meetup to a different location.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID PK` | |
| `group_id` | `UUID FK → groups` | |
| `proposed_by` | `UUID FK → profiles` | |
| `original_location_id` | `UUID FK → meetup_locations` | |
| `proposed_name` | `TEXT NOT NULL` | |
| `proposed_address` | `TEXT` | |
| `proposed_lat/lng` | `DOUBLE PRECISION` | |
| `proposed_venue_id` | `UUID FK → venues` | NULL if custom pin |
| `status` | `TEXT DEFAULT 'pending'` | `pending` \| `approved` \| `rejected` \| `expired` |
| `expires_at` | `TIMESTAMPTZ NOT NULL` | Default: 15 min after creation |
| `required_votes` | `INT DEFAULT 4` | 2/3 of 6 members |
| `created_at` | `TIMESTAMPTZ` | |

**Guardrails enforced by Edge Function:**
- Max 1 active proposal per group at a time
- Proposed location within 2km of original
- Fewer than 2 members already `arrived`

---

### `venue_switch_votes`
Individual votes on a switch proposal.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID PK` | |
| `proposal_id` | `UUID FK → venue_switch_proposals` | |
| `user_id` | `UUID FK → profiles` | |
| `vote` | `TEXT CHECK IN ('yes','no')` | |
| `created_at` | `TIMESTAMPTZ` | |

**Constraint:** `UNIQUE (proposal_id, user_id)` — one vote per user per proposal.

---

## Key Indexes Summary

```sql
-- Matching algorithm hot paths
profiles (matching_status)
profiles (city, matching_status) WHERE city IS NOT NULL
profiles (opted_in_cycle_id) WHERE opted_in_cycle_id IS NOT NULL
profiles (neighborhood) WHERE neighborhood IS NOT NULL
profiles (age) WHERE age IS NOT NULL

-- Group queries
group_members (user_id) WHERE status = 'active'    -- "my current groups"
group_members (user_id, cycle_id)                  -- "my history"
group_members (group_id, checked_in)               -- "who's arrived"

-- Availability matching
availability_slots (user_id, day_of_week)
availability_slots (specific_date) WHERE NOT NULL

-- Block exclusion (bidirectional O(1))
blocks (LEAST(a,b), GREATEST(a,b))

-- Chat
messages (group_id, created_at DESC)

-- Venue switching
meetup_locations (group_id, is_active)
venue_switch_proposals (group_id, status)
venue_switch_votes (proposal_id)
```

---

## Views

| View | Purpose |
|------|---------|
| `my_active_groups` | Current user's active groups (uses `auth.uid()`) |
| `matching_pool` | All `waiting_for_match` users with availability JSON aggregated |

---

## Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `run-matching` | Admin / cron | Reads `matching_pool`, builds groups, inserts into `groups` + `group_members` |
| `process-venue-vote` | Called after each vote | Counts votes, approves/rejects proposal, updates `meetup_locations` |

---

## Row Level Security Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `profiles` | any authenticated | self | self or admin | admin |
| `questionnaire_answers` | self or admin | self | self | self or admin |
| `availability_slots` | self or admin | self | self | self or admin |
| `match_cycles` | any authenticated | admin | admin | admin |
| `venues` | any authenticated (active only) | admin | admin | admin |
| `groups` | group members or admin | admin | admin | admin |
| `group_members` | same-group members or admin | admin | self or admin | admin |
| `messages` | group members or admin | group members (own) | ❌ | admin |
| `feedback` | self or admin | self (if member) | self | admin |
| `blocks` | self or admin | self | ❌ | self or admin |
| `subscriptions` | self or admin | admin | admin | admin |
| `meetup_locations` | authenticated | service role | service role | service role |
| `venue_switch_proposals` | group members | authenticated | service role | service role |
| `venue_switch_votes` | group members | authenticated (own) | ❌ | service role |

---

## Migration Files

| File | Contents |
|------|----------|
| `000000_initial_schema.sql` | Core tables, RLS, triggers, grants |
| `000001_add_profile_status.sql` | `profile_status` enum + `profiles.status` column |
| `000002_fix_fk_to_profiles.sql` | FK corrections |
| `000003_storage_buckets.sql` | Supabase Storage bucket + RLS |
| `000004_checkin.sql` | `checked_in`, `checked_in_at`, `profile_visible` |
| `000005_nickname_reveal.sql` | `nickname`, `first_name`, `intro`, `vibe_tags`, `arrival_status`, `name_revealed` |
| `000006_meetup_map.sql` | `meetup_locations`, `venue_switch_proposals`, `venue_switch_votes`, venue lat/lng |
| `000007_matching_states.sql` | `matching_status` enum, `city`, `travel_radius_km`, matching indexes, helper functions |

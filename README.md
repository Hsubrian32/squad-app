# Squad — Weekly Curated Small-Group Social Matching App

MVP monorepo for the Squad app: a weekly matching service that forms 6-person social groups and facilitates real-world meetups.

## Structure

```
squad-app/
├── apps/
│   ├── mobile/          # Expo + React Native (iOS & Android)
│   └── admin/           # Vite + React web admin dashboard
├── packages/
│   └── shared/          # Shared TypeScript types and constants
└── supabase/
    ├── schema.sql        # Full Postgres schema with RLS
    ├── seed.sql          # Sample data for development
    ├── config.toml       # Local Supabase config
    └── functions/        # Deno Edge Functions
        ├── run-matching/       # Weekly matching algorithm
        ├── send-notifications/ # Push notification dispatcher
        └── _shared/            # Shared utilities
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo + TypeScript |
| Admin | React + Vite + TypeScript |
| Backend | Supabase (Auth, Postgres, Realtime, Edge Functions) |
| Database | Postgres (via Supabase) |
| Auth | Supabase Auth (email/password) |

## Quick Start

### Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Supabase CLI: `brew install supabase/tap/supabase`

### 1. Start Supabase locally

```bash
cd squad-app
supabase start
supabase db reset  # applies schema.sql + seed.sql
```

### 2. Configure environment variables

```bash
# Mobile app
cp apps/mobile/.env.example apps/mobile/.env
# Fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
# (printed by `supabase start`)

# Admin dashboard
cp apps/admin/.env.example apps/admin/.env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY
```

### 3. Run the mobile app

```bash
cd apps/mobile
npm install
npx expo start
```

### 4. Run the admin dashboard

```bash
cd apps/admin
npm install
npm run dev
# Opens at http://localhost:5173
```

## Data Model

| Table | Purpose |
|-------|---------|
| `profiles` | Extended user info (name, bio, age, avatar) |
| `questionnaire_answers` | Per-question JSONB answers for matching |
| `availability_slots` | Day/time windows users are free each week |
| `match_cycles` | Weekly matching runs (pending → matching → active → completed) |
| `groups` | 6-person groups formed each cycle |
| `group_members` | Membership, RSVP status, stay/leave vote |
| `venues` | Pre-curated venue list (coffee shops, bars, restaurants) |
| `messages` | Group chat messages (text + system events) |
| `feedback` | Post-event ratings, vibe scores, notes |
| `blocks` | User-to-user blocks (excluded from matching) |
| `subscriptions` | Free/premium tier tracking |

## Matching Algorithm

The `run-matching` edge function runs every Monday:

1. Fetches all onboarded users with availability for the current week
2. Filters blocked pairs
3. Computes pairwise **compatibility scores** (max ~50 pts):
   - Shared interests: +3/interest (max 15)
   - Personality compatibility: +2 to +5
   - Conversation style match: +3 to +5
   - Energy level similarity: +0 to +5
   - Overlapping availability: +2/slot (max 10)
   - Never grouped before: +4 bonus
4. Greedily forms groups of 6 from highest-scored pairings
5. Assigns a venue and scheduled time based on shared availability
6. Notifies all members

## Weekly Lifecycle

```
Monday     → Matching runs, groups formed, members notified
Tuesday    → RSVP window opens
Wednesday  → RSVP reminder sent
Friday     → Event happens
Saturday   → Feedback form sent
Sunday     → Stay/leave vote closes
             Groups with ≥60% "stay" votes persist to next week
```

## Admin Dashboard

Access at `http://localhost:5173` after running the admin app.

| Page | Purpose |
|------|---------|
| Dashboard | Stats overview + "Run Matching" trigger |
| Users | Paginated list, search, ban/unban |
| Groups | All groups across cycles, filter by status |
| Cycles | Match cycle history with stats |
| Venues | CRUD for venue list |
| Feedback | Feedback records and aggregates |

## Deploying to Production

1. Create a Supabase project at supabase.com
2. Push schema: `supabase db push`
3. Deploy edge functions: `supabase functions deploy run-matching`
4. Build admin: `cd apps/admin && npm run build` — deploy `dist/` to Vercel/Netlify
5. Build mobile: `eas build` (requires Expo EAS account)

## Environment Variables Reference

### Mobile (`apps/mobile/.env`)
| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |

### Admin (`apps/admin/.env`)
| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | Service role key (never expose publicly) |

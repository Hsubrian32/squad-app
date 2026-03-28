# Production / TestFlight Launch Checklist

> Work through this top-to-bottom before every TestFlight build.
> Items are grouped by who owns them and when they are needed.

---

## P0 — Must complete before ANY TestFlight build

### App code
- [ ] Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the **production** Supabase project values in your CI/CD secrets (not the local dev values).
- [ ] Confirm `app.json → expo.ios.bundleIdentifier` is `com.squad.app` (or your registered ID).
- [ ] Confirm `app.json → expo.android.package` matches.
- [ ] Run `npx expo prebuild --clean` and verify the build completes with zero errors.
- [ ] Run `npx expo build:ios --profile production` (or EAS Build equivalent) — do **not** use the Expo Go client for TestFlight.

### Supabase (production project)
- [ ] Run all migrations against the **production** Supabase project in order:
  ```
  supabase db push   # applies all local migrations to remote
  ```
- [ ] **DO NOT run `seed.sql` against production.** Seed data (fake users, demo groups, test venues) is dev-only.
- [ ] Verify the `dev_join_demo_group` RPC function exists but is harmless — it references the demo group UUID (`d1d1d1d1-0001-0000-0000-000000000001`) which will not exist in production, so calling it returns an error safely. The `__DEV__` guard in `lib/api/dev.ts` means it is never called from a production build anyway.
- [ ] Enable Supabase **Email confirmations** (Auth → Settings → Email). New users should confirm their address before accessing the app.
- [ ] Set a sensible JWT expiry (default 3600 s is fine; consider 7 days for mobile).
- [ ] Review Auth → Rate limits. Enable `captcha` or rate-limit sign-up to prevent abuse.
- [ ] Enable **Point-in-Time Recovery** on the production database.
- [ ] Set up at least one **Supabase alert** (e.g. DB CPU > 80%, error rate spike).

### Dev-only code isolation
- [ ] The `__DEV__` amber panel in `app/(app)/group.tsx` is already guarded by `{__DEV__ && ...}`. Expo/Metro strips this at build time when `NODE_ENV=production`. No action needed.
- [ ] The import of `lib/api/dev.ts` in `group.tsx` is safe — it tree-shakes out in production because `joinDemoGroup()` returns an error immediately when `!__DEV__`.
- [ ] Search the codebase for any remaining `console.log` / `console.error` before release:
  ```bash
  grep -r "console\." apps/mobile/lib apps/mobile/app --include="*.ts" --include="*.tsx"
  ```
  Replace any found with `logger.info()` / `logger.error()` from `lib/logger.ts`.

---

## P1 — Before inviting external beta testers

### Analytics
- [ ] Install PostHog React Native (recommended) or Mixpanel:
  ```bash
  npx expo install posthog-react-native
  ```
- [ ] Fill in the `TODO` sections in `lib/analytics.ts` with your PostHog API key.
- [ ] Verify `identify` fires correctly after sign-in: check PostHog → People dashboard.
- [ ] Verify key funnel events arrive: `sign_up_completed`, `onboarding_completed`, `check_in_completed`, `feedback_completed`.

### Error tracking
- [ ] Install Sentry:
  ```bash
  npx expo install @sentry/react-native
  npx sentry-wizard -i reactNative
  ```
- [ ] Uncomment the Sentry lines in `lib/logger.ts` and `components/ErrorBoundary.tsx`.
- [ ] Trigger a test error in dev and confirm it appears in Sentry.

### Safety / trust
- [ ] Review the `user_reports` table in Supabase Studio — make sure the admin team has a process to action reports within 24 hours during beta.
- [ ] Add the "Report" / "Block" feature to `app/(app)/profile.tsx` for users discovered outside of the group screen (e.g. after the meetup).
- [ ] Consider adding an in-app Safety Tips card on the `group.tsx` screen for the first meetup.

### Admin dashboard
- [ ] Confirm the admin app (`apps/admin`) connects to the **production** Supabase project (update `.env`).
- [ ] Add 2FA / SSO to the admin login — do not ship a password-only admin in production.
- [ ] Fix `lib/api.ts` line 187: replace `listUsers({ perPage: 1000 })` with paginated calls before user count exceeds a few hundred.

### Legal / compliance
- [ ] Add a Terms of Service and Privacy Policy URL to `app/(auth)/sign-up.tsx` — currently links are placeholder text.
- [ ] If collecting location data (check-in / meetup map), add a clear permission rationale string in `app.json → ios.infoPlist.NSLocationWhenInUseUsageDescription`.
- [ ] Review GDPR / CCPA requirements for your user base — implement a data deletion flow (Supabase Auth → delete user, cascade deletes handle the rest via FK constraints).

---

## P2 — Nice-to-have before wider rollout

### Performance
- [ ] Enable Supabase **Connection Pooling** (PgBouncer) for the production database.
- [ ] Add `react-query` or `swr` for stale-while-revalidate caching instead of re-fetching on every mount.
- [ ] Profile the app with Flipper or React DevTools Profiler — check for unnecessary re-renders in `group.tsx` (large member list).

### Reliability
- [ ] Add a retry mechanism to `groupStore.ts` — currently a failed `fetchGroup()` leaves the user on a loading screen with no retry button.
- [ ] Wire `OfflineBanner` (from `components/OfflineBanner.tsx`) into `app/(app)/index.tsx` and `app/(app)/group.tsx`:
  ```tsx
  const { isOnline } = useNetworkState();
  // ...
  <OfflineBanner visible={!isOnline} />
  ```
- [ ] Add a `NetInfo.fetch()` check before attempting check-in — fail fast with a clear message if offline.

### Testing
- [ ] Add at least smoke-test coverage for the auth flow with Jest + React Native Testing Library.
- [ ] Add a Detox E2E test for the happy path: sign-up → complete onboarding → check in → submit feedback.

### Matching logic
- [ ] The `triggerMatching()` RPC in the admin dashboard currently runs manually. Before scaling, implement a Supabase Edge Function or cron job to run matching automatically each Monday morning.
- [ ] The `availability_slots` table stores recurring preferences but the matching algorithm must actually query them — verify the matching function reads from this table (not just from questionnaire answers).

---

## Ongoing (every release)

- [ ] Bump `app.json → expo.version` and `expo.ios.buildNumber` / `expo.android.versionCode`.
- [ ] Tag the git commit: `git tag v1.0.0-beta.1`.
- [ ] Run migrations with `supabase db push` before deploying a new build.
- [ ] Test the happy path on a physical device (not simulator) before each TestFlight submission.
- [ ] Check that `EXPO_PUBLIC_SUPABASE_URL` points to **production**, not localhost.

---

## Architecture notes for ops team

### Dev-only migration
`supabase/migrations/20260101000009_dev_tools.sql` creates the `dev_join_demo_group`
Postgres function. This migration runs in production but is safe:
- The function references `d1d1d1d1-0001-0000-0000-000000000001` (the seeded demo group) which does not exist in production.
- The function is only callable by `authenticated` users (not anon).
- The client-side guard (`if (!__DEV__) return error`) means no production build can invoke it.
- If preferred, you can manually `DROP FUNCTION dev_join_demo_group` after deploying to production — it has no runtime side effects either way.

### Seed data
`supabase/seed.sql` contains 8 fake users with bcrypt-hashed passwords and NYC venue data.
**Never run this file against the production database.**
It is only applied by `supabase db reset` (local dev) and CI pipeline tests.

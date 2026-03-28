/**
 * DEV-ONLY API helpers.
 *
 * All exports in this file are guarded by `__DEV__` and are safe to import
 * in production builds — they become no-ops outside of development.
 *
 * Do NOT import this file from production code paths that run regardless
 * of environment.
 */

import { supabase, getErrorMessage } from '../supabase';
import type { ApiResult } from '../../constants/types';

/** Stable UUID of the seeded "The Night Owls" demo group. */
const DEMO_GROUP_ID = 'd1d1d1d1-0001-0000-0000-000000000001';

/**
 * Joins the current user into the seeded demo group so they can immediately
 * see the full matched Group-tab experience after onboarding.
 *
 * - Idempotent: calling it multiple times is safe.
 * - The server function patches the profile with a dev nickname if one hasn't
 *   been set yet (e.g. the user skipped the nickname step in testing).
 * - Returns the demo group's UUID on success.
 *
 * @param userId  The authenticated user's UUID (from `useAuth`).
 */
export async function joinDemoGroup(userId: string): Promise<ApiResult<string>> {
  if (!__DEV__) {
    return {
      data: null,
      error: 'joinDemoGroup is only available in __DEV__ mode.',
    };
  }

  try {
    const { data, error } = await supabase.rpc('dev_join_demo_group', {
      p_user_id: userId,
    });

    if (error) return { data: null, error: error.message };

    // The RPC returns the group UUID; fall back to the known constant.
    return { data: (data as string | null) ?? DEMO_GROUP_ID, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

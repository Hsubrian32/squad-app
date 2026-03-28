/**
 * Safety API — user reporting and blocking.
 *
 * These functions are intentionally conservative: they only allow users to
 * act on their own data (enforced client-side here and in RLS server-side).
 */

import { supabase, getErrorMessage } from '../supabase';
import type { ApiResult } from '../../constants/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReportReason =
  | 'harassment'
  | 'inappropriate_behaviour'
  | 'no_show'
  | 'spam'
  | 'fake_profile'
  | 'other';

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  harassment:               'Harassment or bullying',
  inappropriate_behaviour:  'Inappropriate behaviour',
  no_show:                  'Didn\'t show up (repeated)',
  spam:                     'Spam or scam',
  fake_profile:             'Fake or impersonation',
  other:                    'Something else',
};

export interface ReportUserPayload {
  reporterId: string;
  reportedId: string;
  groupId:    string | null;
  reason:     ReportReason;
  details?:   string;
}

// ---------------------------------------------------------------------------
// Report a user
// ---------------------------------------------------------------------------

/**
 * Submit a safety report. Idempotent — re-submitting the same
 * (reporter, reported, reason) triple silently succeeds.
 */
export async function reportUser(payload: ReportUserPayload): Promise<ApiResult<null>> {
  try {
    const { error } = await supabase
      .from('user_reports')
      .upsert(
        {
          reporter_id: payload.reporterId,
          reported_id: payload.reportedId,
          group_id:    payload.groupId ?? null,
          reason:      payload.reason,
          details:     payload.details?.trim() || null,
          status:      'pending',
        },
        { onConflict: 'reporter_id,reported_id,reason', ignoreDuplicates: true }
      );

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

// ---------------------------------------------------------------------------
// Block a user
// ---------------------------------------------------------------------------

/**
 * Block another user. Idempotent — blocking an already-blocked user is a no-op.
 */
export async function blockUser(
  blockerId: string,
  blockedId: string
): Promise<ApiResult<null>> {
  try {
    const { error } = await supabase
      .from('blocks')
      .upsert(
        { blocker_id: blockerId, blocked_id: blockedId },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true }
      );

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

/**
 * Unblock a previously blocked user.
 */
export async function unblockUser(
  blockerId: string,
  blockedId: string
): Promise<ApiResult<null>> {
  try {
    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

/**
 * Check whether the current user has blocked another user.
 */
export async function hasBlocked(
  blockerId: string,
  blockedId: string
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId)
      .maybeSingle();

    return data !== null;
  } catch {
    return false;
  }
}

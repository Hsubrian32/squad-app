import { supabase, getErrorMessage } from '../supabase';
import type { ApiResult } from '../../constants/types';

/**
 * Opt the user into the current open match cycle.
 *
 * Strategy:
 *  1. Find the latest pending cycle (optin_closes_at IS NULL or in the future).
 *  2. Call the opt_in_to_cycle() RPC which sets matching_status = 'waiting_for_match'.
 *  3. Fallback: if no pending cycle exists (common in dev / early beta), directly
 *     set matching_status = 'waiting_for_match' so the user appears in the pool.
 */
export async function optInToCurrentCycle(userId: string): Promise<ApiResult<null>> {
  try {
    // Step 1: find the current open cycle
    const { data: cycles, error: cycleError } = await supabase
      .from('match_cycles')
      .select('id')
      .eq('status', 'pending')
      .or('optin_closes_at.is.null,optin_closes_at.gt.' + new Date().toISOString())
      .order('optin_closes_at', { ascending: true, nullsFirst: false })
      .limit(1);

    if (cycleError) {
      return { data: null, error: cycleError.message };
    }

    if (cycles && cycles.length > 0) {
      // Step 2: use the proper RPC — validates onboarding + cycle state
      const { error: rpcError } = await supabase.rpc('opt_in_to_cycle', {
        p_user_id: userId,
        p_cycle_id: cycles[0].id,
      });

      if (rpcError) {
        return { data: null, error: rpcError.message };
      }
      return { data: null, error: null };
    }

    // Step 3: no open cycle — set status directly (dev / early beta fallback)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        matching_status: 'waiting_for_match',
        last_opted_in_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      return { data: null, error: updateError.message };
    }

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

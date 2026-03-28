import { supabase, getErrorMessage } from '../supabase';
import type { Feedback, FeedbackSubmission, ApiResult } from '../../constants/types';

/**
 * Submit post-event feedback for a group.
 */
export async function submitFeedback(
  feedbackData: FeedbackSubmission
): Promise<ApiResult<Feedback>> {
  try {
    const { data, error } = await supabase
      .from('feedback')
      .insert({
        group_id: feedbackData.group_id,
        cycle_id: feedbackData.cycle_id,
        user_id: feedbackData.user_id,
        rating: feedbackData.rating,
        vibe_score: feedbackData.vibe_score,
        would_meet_again: feedbackData.would_meet_again,
        notes: feedbackData.notes ?? null,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Feedback, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

/**
 * Check whether the user has already submitted feedback for a given cycle.
 */
export async function hasFeedbackForCycle(
  userId: string,
  cycleId: string
): Promise<ApiResult<boolean>> {
  try {
    const { data, error } = await supabase
      .from('feedback')
      .select('id')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data !== null, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

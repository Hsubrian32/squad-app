import { supabase, getErrorMessage } from '../supabase';
import type { QuestionnaireAnswer, ApiResult } from '../../constants/types';
import { REQUIRED_QUESTION_KEYS } from '../../constants/questionnaire';

/**
 * Upsert a single questionnaire answer for a user.
 */
export async function saveQuestionnaireAnswer(
  userId: string,
  questionKey: string,
  answer: string | string[] | number
): Promise<ApiResult<QuestionnaireAnswer>> {
  try {
    // Serialize arrays/objects to JSON string for storage
    const serializedAnswer =
      typeof answer === 'object' ? JSON.stringify(answer) : String(answer);

    const { data, error } = await supabase
      .from('questionnaire_answers')
      .upsert(
        {
          user_id: userId,
          question_key: questionKey,
          answer: serializedAnswer,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,question_key',
        }
      )
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    // Deserialize the answer back
    const parsed = parseAnswer(data.answer);
    return { data: { ...data, answer: parsed } as QuestionnaireAnswer, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

/**
 * Fetch all questionnaire answers for a user.
 */
export async function getQuestionnaireAnswers(
  userId: string
): Promise<ApiResult<QuestionnaireAnswer[]>> {
  try {
    const { data, error } = await supabase
      .from('questionnaire_answers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }

    // Deserialize answers
    const parsed = (data ?? []).map((row) => ({
      ...row,
      answer: parseAnswer(row.answer),
    })) as QuestionnaireAnswer[];

    return { data: parsed, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

/**
 * Check whether all required questions have been answered by the user.
 */
export async function isQuestionnaireComplete(userId: string): Promise<ApiResult<boolean>> {
  try {
    const { data, error } = await supabase
      .from('questionnaire_answers')
      .select('question_key')
      .eq('user_id', userId)
      .in('question_key', REQUIRED_QUESTION_KEYS);

    if (error) {
      return { data: null, error: error.message };
    }

    const answeredKeys = new Set((data ?? []).map((row) => row.question_key));
    const allAnswered = REQUIRED_QUESTION_KEYS.every((key) => answeredKeys.has(key));

    return { data: allAnswered, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

/**
 * Mark the user's onboarding as complete in the profiles table.
 */
export async function markOnboardingComplete(userId: string): Promise<ApiResult<null>> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_complete: true, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseAnswer(raw: unknown): string | string[] | number {
  if (typeof raw !== 'string') return String(raw ?? '');
  // Try to parse as JSON (arrays or numbers stored as JSON strings)
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) || typeof parsed === 'number') {
      return parsed as string[] | number;
    }
  } catch {
    // Not JSON — return as-is string
  }
  return raw;
}

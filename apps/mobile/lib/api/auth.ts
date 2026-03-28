import { supabase, getErrorMessage } from '../supabase';
import { logger } from '../logger';
import type { Profile, ApiResult } from '../../constants/types';

export interface AuthUser {
  id: string;
  email: string | undefined;
}

export interface UserWithProfile {
  user: AuthUser;
  profile: Profile | null;
}

/**
 * Sign up a new user, then insert a profile row.
 */
export async function signUp(
  email: string,
  password: string,
  firstName: string
): Promise<ApiResult<UserWithProfile>> {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      return { data: null, error: authError.message };
    }

    if (!authData.user) {
      return { data: null, error: 'No user returned after sign up' };
    }

    // The on_auth_user_created trigger already inserts a bare profile row
    // (with first_name = NULL) before this code runs. Using .update() instead
    // of .upsert() avoids a race condition where the upsert's INSERT path
    // conflicts with the trigger-created row and silently skips the UPDATE,
    // leaving first_name as NULL.
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        bio: null,
        age: null,
        avatar_url: null,
        onboarding_complete: false,
      })
      .eq('id', authData.user.id)
      .select()
      .single();

    if (profileError) {
      // Auth user was created but profile update failed; still return user
      logger.error('Profile update failed during sign-up:', profileError.message);
      return {
        data: {
          user: { id: authData.user.id, email: authData.user.email },
          profile: null,
        },
        error: null,
      };
    }

    return {
      data: {
        user: { id: authData.user.id, email: authData.user.email },
        profile: profileData as Profile,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

/**
 * Sign in an existing user with email and password.
 */
export async function signIn(
  email: string,
  password: string
): Promise<ApiResult<UserWithProfile>> {
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return { data: null, error: authError.message };
    }

    if (!authData.user) {
      return { data: null, error: 'No user returned after sign in' };
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      return {
        data: {
          user: { id: authData.user.id, email: authData.user.email },
          profile: null,
        },
        error: null,
      };
    }

    return {
      data: {
        user: { id: authData.user.id, email: authData.user.email },
        profile: profileData as Profile,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<ApiResult<null>> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { data: null, error: error.message };
    }
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

/**
 * Get current authenticated user along with their profile.
 */
export async function getCurrentUser(): Promise<ApiResult<UserWithProfile>> {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      return { data: null, error: sessionError.message };
    }

    if (!sessionData.session?.user) {
      return { data: null, error: null };
    }

    const authUser = sessionData.session.user;

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (profileError) {
      return {
        data: {
          user: { id: authUser.id, email: authUser.email },
          profile: null,
        },
        error: null,
      };
    }

    return {
      data: {
        user: { id: authUser.id, email: authUser.email },
        profile: profileData as Profile,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

/**
 * Update the current user's profile row.
 */
export async function updateProfile(
  userId: string,
  updates: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>
): Promise<ApiResult<Profile>> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Profile, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

/**
 * Check if a nickname is available (not taken by another user).
 * Returns true if available, false if taken.
 */
export async function checkNicknameAvailable(
  nickname: string,
  currentUserId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .ilike('nickname', nickname)
      .neq('id', currentUserId)
      .maybeSingle();
    if (error) return true; // fail open — don't block the user if the query errors
    return data === null; // null = not found = available
  } catch {
    return true; // fail open
  }
}

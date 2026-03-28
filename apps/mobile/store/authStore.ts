import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser, signIn as apiSignIn, signOut as apiSignOut } from '../lib/api/auth';
import type { Profile } from '../constants/types';

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string | undefined;
}

interface AuthState {
  user: AuthUser | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: { user: AuthUser; profile: Profile | null } }
  | { type: 'SET_PROFILE'; payload: Profile }
  | { type: 'CLEAR_AUTH' };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_USER':
      return {
        ...state,
        user: action.payload.user,
        profile: action.payload.profile,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'SET_PROFILE':
      return { ...state, profile: action.payload };
    case 'CLEAR_AUTH':
      return {
        user: null,
        profile: null,
        isAuthenticated: false,
        isLoading: false,
      };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /**
   * Called immediately after a successful signUp() call to set auth state
   * atomically, avoiding the race between onAuthStateChange and refreshProfile()
   * that caused a brief flash of the questionnaire screen.
   */
  applySignUpResult: (user: AuthUser, profile: Profile | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    profile: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Load initial session on mount
  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      dispatch({ type: 'SET_LOADING', payload: true });
      const { data, error } = await getCurrentUser();

      if (!mounted) return;

      if (error || !data?.user) {
        dispatch({ type: 'CLEAR_AUTH' });
        return;
      }

      dispatch({
        type: 'SET_USER',
        payload: { user: data.user, profile: data.profile },
      });
    }

    loadSession();

    // Listen for auth state changes (token refresh, sign out from another tab, etc.)
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT' || !session) {
        dispatch({ type: 'CLEAR_AUTH' });
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const { data: userData } = await getCurrentUser();
        if (userData?.user) {
          dispatch({
            type: 'SET_USER',
            payload: { user: userData.user, profile: userData.profile },
          });
        }
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      dispatch({ type: 'SET_LOADING', payload: true });
      const { data, error } = await apiSignIn(email, password);

      if (error || !data) {
        dispatch({ type: 'SET_LOADING', payload: false });
        return { error: error ?? 'Sign in failed' };
      }

      dispatch({
        type: 'SET_USER',
        payload: { user: data.user, profile: data.profile },
      });

      return { error: null };
    },
    []
  );

  const signOut = useCallback(async () => {
    await apiSignOut();
    dispatch({ type: 'CLEAR_AUTH' });
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await getCurrentUser();
    if (data?.profile) {
      dispatch({ type: 'SET_PROFILE', payload: data.profile });
    }
  }, []);

  // Set user + profile in a single dispatch so NavigationGuard only fires once.
  // This prevents the sign-up → questionnaire flash caused by the race between
  // onAuthStateChange and refreshProfile().
  const applySignUpResult = useCallback((user: AuthUser, profile: Profile | null) => {
    dispatch({ type: 'SET_USER', payload: { user, profile } });
  }, []);

  const value: AuthContextValue = {
    ...state,
    signIn,
    signOut,
    refreshProfile,
    applySignUpResult,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

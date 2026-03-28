import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  getCurrentGroup,
  getGroupMessages,
  sendMessage as apiSendMessage,
} from '../lib/api/groups';
import type { Group, Message } from '../constants/types';

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

interface GroupState {
  currentGroup: Group | null;
  messages: Message[];
  isLoading: boolean;
  isMessagesLoading: boolean;
  error: string | null;
}

type GroupAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_MESSAGES_LOADING'; payload: boolean }
  | { type: 'SET_GROUP'; payload: Group | null }
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'APPEND_MESSAGE'; payload: Message }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_GROUP' };

function groupReducer(state: GroupState, action: GroupAction): GroupState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_MESSAGES_LOADING':
      return { ...state, isMessagesLoading: action.payload };
    case 'SET_GROUP':
      return { ...state, currentGroup: action.payload, isLoading: false, error: null };
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload, isMessagesLoading: false };
    case 'APPEND_MESSAGE':
      // Avoid duplicate messages
      if (state.messages.some((m) => m.id === action.payload.id)) {
        return state;
      }
      return { ...state, messages: [...state.messages, action.payload] };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'CLEAR_GROUP':
      return {
        currentGroup: null,
        messages: [],
        isLoading: false,
        isMessagesLoading: false,
        error: null,
      };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface GroupContextValue extends GroupState {
  fetchGroup: (userId: string) => Promise<void>;
  fetchMessages: (groupId: string) => Promise<void>;
  sendMessage: (groupId: string, userId: string, content: string) => Promise<{ error: string | null }>;
  subscribeToMessages: (groupId: string) => () => void;
}

const GroupContext = createContext<GroupContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(groupReducer, {
    currentGroup: null,
    messages: [],
    isLoading: true,   // start true — prevents empty-state flash before first fetch
    isMessagesLoading: false,
    error: null,
  });

  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchGroup = useCallback(async (userId: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    const { data, error } = await getCurrentGroup(userId);

    if (error) {
      dispatch({ type: 'SET_ERROR', payload: error });
      return;
    }

    dispatch({ type: 'SET_GROUP', payload: data });
  }, []);

  const fetchMessages = useCallback(async (groupId: string) => {
    dispatch({ type: 'SET_MESSAGES_LOADING', payload: true });
    const { data, error } = await getGroupMessages(groupId);

    if (error) {
      dispatch({ type: 'SET_MESSAGES_LOADING', payload: false });
      return;
    }

    dispatch({ type: 'SET_MESSAGES', payload: data ?? [] });
  }, []);

  const sendMessage = useCallback(
    async (
      groupId: string,
      userId: string,
      content: string
    ): Promise<{ error: string | null }> => {
      const { data, error } = await apiSendMessage(groupId, userId, content);

      if (error) {
        return { error };
      }

      if (data) {
        dispatch({ type: 'APPEND_MESSAGE', payload: data });
      }

      return { error: null };
    },
    []
  );

  const subscribeToMessages = useCallback((groupId: string): (() => void) => {
    // Clean up existing subscription
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const channel = supabase
      .channel(`group-messages-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;

          // Fetch the profile for the sender
          if (newMessage.user_id && newMessage.type === 'text') {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('id, display_name, first_name, avatar_url, bio, age, neighborhood, city, location, role, onboarding_complete, nickname, intro, vibe_tags, privacy_preference, venue_flexibility, travel_radius_km, lat, lng, matching_status, created_at, updated_at')
              .eq('id', newMessage.user_id)
              .single();

            if (profileData) {
              dispatch({
                type: 'APPEND_MESSAGE',
                payload: { ...newMessage, profile: profileData },
              });
              return;
            }
          }

          dispatch({ type: 'APPEND_MESSAGE', payload: newMessage });
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      realtimeChannelRef.current = null;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, []);

  const value: GroupContextValue = {
    ...state,
    fetchGroup,
    fetchMessages,
    sendMessage,
    subscribeToMessages,
  };

  return React.createElement(GroupContext.Provider, { value }, children);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGroup(): GroupContextValue {
  const context = useContext(GroupContext);
  if (!context) {
    throw new Error('useGroup must be used within a GroupProvider');
  }
  return context;
}

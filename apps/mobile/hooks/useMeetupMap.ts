import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getActiveMeetupLocation, getGroupArrivalStats } from '../lib/api/meetup';
import { getOpenProposal, getUserVoteForProposal } from '../lib/api/venue-switch';
import type { MeetupLocation, GroupArrivalStats, VenueSwitchProposal, VenueSwitchVote } from '../constants/mapTypes';

interface UseMeetupMapParams {
  groupId: string;
  userId: string;
}

interface UseMeetupMapReturn {
  meetupLocation: MeetupLocation | null;
  arrivalStats: GroupArrivalStats | null;
  openProposal: VenueSwitchProposal | null;
  myVote: VenueSwitchVote | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMeetupMap({ groupId, userId }: UseMeetupMapParams): UseMeetupMapReturn {
  const [meetupLocation, setMeetupLocation] = useState<MeetupLocation | null>(null);
  const [arrivalStats, setArrivalStats] = useState<GroupArrivalStats | null>(null);
  const [openProposal, setOpenProposal] = useState<VenueSwitchProposal | null>(null);
  const [myVote, setMyVote] = useState<VenueSwitchVote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [locResult, statsResult, proposalResult] = await Promise.all([
        getActiveMeetupLocation(groupId),
        getGroupArrivalStats(groupId),
        getOpenProposal(groupId),
      ]);

      if (locResult.data) setMeetupLocation(locResult.data);
      if (statsResult.data) setArrivalStats(statsResult.data);
      setOpenProposal(proposalResult.data);

      // Fetch my vote for the open proposal if any
      if (proposalResult.data) {
        const voteResult = await getUserVoteForProposal(proposalResult.data.id, userId);
        setMyVote(voteResult.data);
      } else {
        setMyVote(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load map data');
    } finally {
      setLoading(false);
    }
  }, [groupId, userId]);

  // Initial fetch
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime subscriptions
  useEffect(() => {
    // 1. meetup_locations changes → location switched
    const locationChannel = supabase
      .channel(`meetup_location:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meetup_locations',
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          getActiveMeetupLocation(groupId).then((r) => {
            if (r.data) setMeetupLocation(r.data);
          });
        },
      )
      .subscribe();

    // 2. group_members changes → arrival stats update
    const membersChannel = supabase
      .channel(`group_members_map:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'group_members',
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          getGroupArrivalStats(groupId).then((r) => {
            if (r.data) setArrivalStats(r.data);
          });
        },
      )
      .subscribe();

    // 3. venue_switch_proposals → new proposal or status change
    const proposalChannel = supabase
      .channel(`proposals:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'venue_switch_proposals',
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          getOpenProposal(groupId).then((r) => {
            setOpenProposal(r.data);
            if (r.data) {
              getUserVoteForProposal(r.data.id, userId).then((v) =>
                setMyVote(v.data),
              );
            } else {
              setMyVote(null);
            }
          });
        },
      )
      .subscribe();

    channelsRef.current = [locationChannel, membersChannel, proposalChannel];

    return () => {
      channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [groupId, userId]);

  return {
    meetupLocation,
    arrivalStats,
    openProposal,
    myVote,
    loading,
    error,
    refetch: fetchAll,
  };
}

import { supabase } from '../supabase';
import type { VenueSwitchProposal, VenueSwitchVote } from '../../constants/mapTypes';
import type { ApiResult } from '../../constants/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum votes-yes fraction required to accept a switch (2/3) */
const ACCEPT_THRESHOLD = 2 / 3;
/** Maximum group members that can already be 'arrived' for a switch to be allowed */
const MAX_ARRIVED_FOR_SWITCH = 2;
/** How far from original venue a proposal can be (meters) */
export const PROPOSAL_MAX_DISTANCE_METERS = 2000;

// ---------------------------------------------------------------------------
// Check whether a switch proposal is allowed for this group right now
// ---------------------------------------------------------------------------

export interface SwitchEligibility {
  allowed: boolean;
  reason?: string;
  arrivedCount: number;
  openProposalId: string | null;
}

export async function checkSwitchEligibility(
  groupId: string,
): Promise<ApiResult<SwitchEligibility>> {
  // Check for an already-open proposal
  const { data: openProposals, error: e1 } = await supabase
    .from('venue_switch_proposals')
    .select('id')
    .eq('group_id', groupId)
    .eq('status', 'open')
    .limit(1);

  if (e1) return { data: null, error: e1.message };

  const openProposalId = openProposals?.[0]?.id ?? null;

  if (openProposalId) {
    return {
      data: { allowed: false, reason: 'A vote is already in progress.', arrivedCount: 0, openProposalId },
      error: null,
    };
  }

  // Count how many members have arrived
  const { data: stats, error: e2 } = await supabase
    .from('group_arrival_stats')
    .select('arrived_count')
    .eq('group_id', groupId)
    .maybeSingle();

  if (e2) return { data: null, error: e2.message };

  const arrivedCount = stats?.arrived_count ?? 0;

  if (arrivedCount > MAX_ARRIVED_FOR_SWITCH) {
    return {
      data: {
        allowed: false,
        reason: `${arrivedCount} members have already arrived — it's too late to switch.`,
        arrivedCount,
        openProposalId: null,
      },
      error: null,
    };
  }

  return {
    data: { allowed: true, arrivedCount, openProposalId: null },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Get the open proposal for a group (if any)
// ---------------------------------------------------------------------------

export async function getOpenProposal(
  groupId: string,
): Promise<ApiResult<VenueSwitchProposal | null>> {
  const { data, error } = await supabase
    .from('venue_switch_proposals')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'open')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

// ---------------------------------------------------------------------------
// Get the current user's vote for a proposal
// ---------------------------------------------------------------------------

export async function getUserVoteForProposal(
  proposalId: string,
  userId: string,
): Promise<ApiResult<VenueSwitchVote | null>> {
  const { data, error } = await supabase
    .from('venue_switch_votes')
    .select('*')
    .eq('proposal_id', proposalId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

// ---------------------------------------------------------------------------
// Process vote + check threshold (client-side optimistic version)
// The Edge Function does the authoritative check.
// Returns whether the proposal was accepted based on current counts.
// ---------------------------------------------------------------------------

export function didProposalPass(
  proposal: VenueSwitchProposal,
  totalMembers: number,
): boolean {
  const totalVoted = proposal.votes_yes + proposal.votes_no;
  if (totalVoted === 0) return false;
  // Must have at least 2/3 of active members voting yes
  return proposal.votes_yes / totalMembers >= ACCEPT_THRESHOLD;
}

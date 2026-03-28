import { supabase } from '../supabase';
import type { MeetupLocation, GroupArrivalStats, NearbyVenue } from '../../constants/mapTypes';
import type { ApiResult } from '../../constants/types';
import { haversineDistance } from '../utils/location';

// ---------------------------------------------------------------------------
// Get the active meetup location for a group
//
// Resolution order:
//   1. meetup_locations table  — the canonical source; set after a venue switch
//   2. groups → venues fallback — synthesised from the group's assigned venue;
//      covers active groups that have never had a venue switch (i.e. most of them)
// ---------------------------------------------------------------------------

export async function getActiveMeetupLocation(
  groupId: string,
): Promise<ApiResult<MeetupLocation>> {
  // ── 1. Check dedicated meetup_locations row ────────────────────────────
  const { data: locData, error: locError } = await supabase
    .from('meetup_locations')
    .select('*')
    .eq('group_id', groupId)
    .maybeSingle();

  if (locError) return { data: null, error: locError.message };
  if (locData) return { data: locData as MeetupLocation, error: null };

  // ── 2. Fall back: derive from the group's assigned venue ───────────────
  // This handles every active group that doesn't (yet) have a meetup_locations
  // row — which is the normal case until a venue switch has been accepted.
  const { data: groupData, error: groupError } = await supabase
    .from('groups')
    .select('id, venue_id, venues ( id, name, address, lat, lng )')
    .eq('id', groupId)
    .maybeSingle();

  if (groupError) return { data: null, error: groupError.message };

  // Supabase returns the FK-joined row as an object (many-to-one relationship).
  // Cast via unknown to avoid the "array vs object" type mismatch.
  const v = (groupData?.venues as unknown) as {
    id: string;
    name: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
  } | null;

  if (!v || v.lat == null || v.lng == null) {
    // No venue or venue has no coordinates — map can't show anything.
    return { data: null, error: null };
  }

  // Shape into a MeetupLocation so the rest of the screen works unchanged.
  // The synthetic id prefix 'venue-' distinguishes it from a real DB row.
  const synthetic: MeetupLocation = {
    id: `venue-${v.id}`,
    group_id: groupId,
    venue_id: v.id,
    name: v.name,
    address: v.address ?? null,
    lat: v.lat,
    lng: v.lng,
    set_by: 'system',
    is_switch: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return { data: synthetic, error: null };
}

// ---------------------------------------------------------------------------
// Get arrival stats for a group (privacy-safe aggregate)
// ---------------------------------------------------------------------------

export async function getGroupArrivalStats(
  groupId: string,
): Promise<ApiResult<GroupArrivalStats>> {
  const { data, error } = await supabase
    .from('group_arrival_stats')
    .select('*')
    .eq('group_id', groupId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

// ---------------------------------------------------------------------------
// Check in with location coordinates
// Sets checked_in, arrival_status = 'arrived', records lat/lng
// ---------------------------------------------------------------------------

export async function checkInWithLocation(
  groupId: string,
  userId: string,
  lat: number,
  lng: number,
): Promise<ApiResult<null>> {
  const { error } = await supabase
    .from('group_members')
    .update({
      checked_in: true,
      checked_in_at: new Date().toISOString(),
      checked_in_lat: lat,
      checked_in_lng: lng,
      arrival_status: 'arrived',
      name_revealed: true,
    })
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

// ---------------------------------------------------------------------------
// Create a venue switch proposal
// ---------------------------------------------------------------------------

export async function createSwitchProposal(params: {
  groupId: string;
  proposedBy: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  venueId?: string;
  reason?: string;
}): Promise<ApiResult<{ id: string }>> {
  const { data, error } = await supabase
    .from('venue_switch_proposals')
    .insert({
      group_id: params.groupId,
      proposed_by: params.proposedBy,
      venue_id: params.venueId ?? null,
      name: params.name,
      address: params.address ?? null,
      lat: params.lat,
      lng: params.lng,
      reason: params.reason ?? null,
    })
    .select('id')
    .single();

  if (error) return { data: null, error: error.message };
  return { data: { id: data.id }, error: null };
}

// ---------------------------------------------------------------------------
// Cast a vote on a proposal
// Upserts (delete old + insert new) via the unique constraint
// ---------------------------------------------------------------------------

export async function submitVote(
  proposalId: string,
  userId: string,
  vote: boolean,
): Promise<ApiResult<null>> {
  // Delete existing vote first (unique constraint: one vote per user per proposal)
  await supabase
    .from('venue_switch_votes')
    .delete()
    .eq('proposal_id', proposalId)
    .eq('user_id', userId);

  const { error } = await supabase
    .from('venue_switch_votes')
    .insert({ proposal_id: proposalId, user_id: userId, vote });

  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

// ---------------------------------------------------------------------------
// Get nearby venues from DB within ~2km bounding box
// ---------------------------------------------------------------------------

export async function getNearbyVenuesFromDB(
  lat: number,
  lng: number,
  radiusMeters = 2000,
): Promise<ApiResult<NearbyVenue[]>> {
  // Approximate bounding box: 1 degree lat ≈ 111km
  const latDelta = radiusMeters / 111_000;
  const lngDelta = radiusMeters / (111_000 * Math.cos((lat * Math.PI) / 180));

  const { data, error } = await supabase
    .from('venues')
    .select('id, name, address, lat, lng, category')
    .gte('lat', lat - latDelta)
    .lte('lat', lat + latDelta)
    .gte('lng', lng - lngDelta)
    .lte('lng', lng + lngDelta)
    .eq('active', true)
    .not('lat', 'is', null);

  if (error) return { data: null, error: error.message };

  const venues: NearbyVenue[] = (data ?? [])
    .map((v) => ({
      id: v.id,
      name: v.name,
      address: v.address ?? '',
      lat: v.lat,
      lng: v.lng,
      category: v.category ?? null,
      distanceMeters: haversineDistance({ lat, lng }, { lat: v.lat, lng: v.lng }),
    }))
    .filter((v) => v.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 10);

  return { data: venues, error: null };
}

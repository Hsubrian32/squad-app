import { supabase, getErrorMessage } from '../supabase';
import type {
  Group,
  Message,
  ApiResult,
  RsvpStatus,
  ArrivalStatus,
  PostEventReview,
  StayLeaveDecision,
  UserGroupHistoryEntry,
  EventInstance,
} from '../../constants/types';

// Fetch all venue columns — using * avoids compile-time parsing failures
// that Supabase's type inference triggers on very long explicit field lists.
const VENUE_FIELDS = `*`;

const GROUP_FIELDS = `
  id,
  cycle_id,
  venue_id,
  backup_venue_id,
  scheduled_time,
  status,
  name,
  max_members,
  created_at,
  venue_selection_reason,
  meetup_area,
  venues ( ${VENUE_FIELDS} ),
  group_members (
    id,
    group_id,
    user_id,
    rsvp_status,
    stay_vote,
    joined_at,
    checked_in,
    checked_in_at,
    arrival_status,
    name_revealed,
    profiles (
      id,
      display_name,
      bio,
      age,
      avatar_url,
      neighborhood,
      onboarding_complete,
      created_at,
      updated_at,
      nickname,
      first_name,
      intro,
      vibe_tags
    )
  )
`;

const MESSAGE_FIELDS = `
  id,
  group_id,
  user_id,
  content,
  type,
  created_at,
  profiles ( id, first_name, display_name, avatar_url )
`;

/**
 * Get the user's current active group, including venue and member profiles.
 */
export async function getCurrentGroup(userId: string): Promise<ApiResult<Group | null>> {
  try {
    // !inner makes this an INNER JOIN — only memberships where the group
    // matches the status filter are returned, so ORDER + LIMIT work correctly.
    const { data: memberData, error: memberError } = await supabase
      .from('group_members')
      .select(`group_id, groups!inner ( ${GROUP_FIELDS} )`)
      .eq('user_id', userId)
      .in('groups.status', ['forming', 'active'])
      .order('created_at', { referencedTable: 'groups', ascending: false })
      .limit(1)
      .maybeSingle();

    if (memberError) return { data: null, error: memberError.message };
    if (!memberData || !memberData.groups) return { data: null, error: null };

    const g = memberData.groups as unknown as Record<string, unknown>;
    const group: Group = {
      id: g.id as string,
      cycle_id: g.cycle_id as string,
      venue_id: g.venue_id as string | null,
      backup_venue_id: (g.backup_venue_id as string | null) ?? null,
      scheduled_time: g.scheduled_time as string | null,
      status: g.status as Group['status'],
      name: (g.name as string) ?? '',
      max_members: (g.max_members as number) ?? 6,
      created_at: g.created_at as string,
      venue_selection_reason: (g.venue_selection_reason as string[]) ?? [],
      meetup_area: (g.meetup_area as string | null) ?? null,
      venue: g.venues as Group['venue'],
      members: (g.group_members as Group['members']) ?? [],
    };

    return { data: group, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

/**
 * Get all messages for a group, including sender profiles.
 */
export async function getGroupMessages(groupId: string): Promise<ApiResult<Message[]>> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(MESSAGE_FIELDS)
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as Message[], error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

/**
 * Send a message to the group chat.
 */
export async function sendMessage(
  groupId: string,
  userId: string,
  content: string
): Promise<ApiResult<Message>> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({ group_id: groupId, user_id: userId, content: content.trim(), type: 'text' })
      .select(MESSAGE_FIELDS)
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Message, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

/**
 * Update the user's RSVP status for a group.
 */
export async function updateRsvp(
  groupId: string,
  userId: string,
  status: RsvpStatus
): Promise<ApiResult<null>> {
  try {
    const { error } = await supabase
      .from('group_members')
      .update({ rsvp_status: status })
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

/**
 * Submit a stay/leave vote after the event.
 */
export async function submitStayVote(
  groupId: string,
  userId: string,
  stayVote: boolean
): Promise<ApiResult<null>> {
  try {
    const { error } = await supabase
      .from('group_members')
      .update({ stay_vote: stayVote })
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

/**
 * Check the user in to their group event.
 * Also sets name_revealed and arrival_status (trigger handles this server-side,
 * but we set them explicitly in the payload for immediate client consistency).
 */
export async function checkInToGroup(
  groupId: string,
  userId: string
): Promise<ApiResult<null>> {
  try {
    const { error } = await supabase
      .from('group_members')
      .update({
        checked_in: true,
        checked_in_at: new Date().toISOString(),
        name_revealed: true,
        arrival_status: 'arrived',
      })
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

/**
 * Update a member's arrival status for a group.
 */
export async function updateArrivalStatus(
  groupId: string,
  userId: string,
  status: ArrivalStatus
): Promise<ApiResult<null>> {
  try {
    const { error } = await supabase
      .from('group_members')
      .update({ arrival_status: status })
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

/**
 * Get the user's past groups.
 */
export async function getGroupHistory(userId: string): Promise<ApiResult<Group[]>> {
  try {
    const { data: memberData, error: memberError } = await supabase
      .from('group_members')
      .select(`
        group_id,
        groups (
          id, cycle_id, venue_id, backup_venue_id, scheduled_time, status, name,
          max_members, created_at, venue_selection_reason, meetup_area,
          venues ( ${VENUE_FIELDS} )
        )
      `)
      .eq('user_id', userId)
      .in('groups.status', ['completed', 'dissolved'])
      .order('groups(scheduled_time)', { ascending: false });

    if (memberError) return { data: null, error: memberError.message };

    const groups: Group[] = (memberData ?? [])
      .filter((m) => m.groups != null)
      .map((m) => {
        const g = m.groups as unknown as Record<string, unknown>;
        return {
          id: g.id as string,
          cycle_id: g.cycle_id as string,
          venue_id: g.venue_id as string | null,
          backup_venue_id: (g.backup_venue_id as string | null) ?? null,
          scheduled_time: g.scheduled_time as string | null,
          status: g.status as Group['status'],
          name: (g.name as string) ?? '',
          max_members: (g.max_members as number) ?? 6,
          created_at: g.created_at as string,
          venue_selection_reason: (g.venue_selection_reason as string[]) ?? [],
          meetup_area: (g.meetup_area as string | null) ?? null,
          venue: g.venues as Group['venue'],
        };
      });

    return { data: groups, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

// ---- Post-Event Review ----

export async function submitPostEventReview(
  eventId: string,
  userId: string,
  groupId: string,
  review: {
    overall_rating: number;
    vibe_rating?: number;
    venue_rating?: number;
    would_return?: boolean;
    comment?: string;
  }
): Promise<ApiResult<PostEventReview>> {
  const { data, error } = await supabase
    .from('post_event_reviews')
    .upsert(
      {
        event_id: eventId,
        user_id: userId,
        group_id: groupId,
        overall_rating: review.overall_rating,
        vibe_rating: review.vibe_rating ?? null,
        venue_rating: review.venue_rating ?? null,
        would_return: review.would_return ?? null,
        comment: review.comment?.trim() || null,
      },
      { onConflict: 'event_id,user_id' }
    )
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

export async function getMyReview(
  eventId: string,
  userId: string
): Promise<ApiResult<PostEventReview | null>> {
  const { data, error } = await supabase
    .from('post_event_reviews')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();

  return { data: data ?? null, error: error?.message ?? null };
}

// ---- Stay/Leave Decision ----

export async function submitStayLeaveDecision(
  eventId: string,
  userId: string,
  groupId: string,
  decision: 'stay' | 'leave'
): Promise<ApiResult<StayLeaveDecision>> {
  const { data, error } = await supabase
    .from('stay_leave_decisions')
    .upsert(
      {
        event_id: eventId,
        user_id: userId,
        group_id: groupId,
        decision,
      },
      { onConflict: 'event_id,user_id' }
    )
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

export async function getMyDecision(
  eventId: string,
  userId: string
): Promise<ApiResult<StayLeaveDecision | null>> {
  const { data, error } = await supabase
    .from('stay_leave_decisions')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();

  return { data: data ?? null, error: error?.message ?? null };
}

// ---- Group History ----

export async function getUserGroupHistory(
  userId: string
): Promise<ApiResult<UserGroupHistoryEntry[]>> {
  const { data, error } = await supabase
    .from('user_group_history')
    .select('*')
    .eq('user_id', userId)
    .order('sort_section', { ascending: true })
    .order('sort_date', { ascending: false });

  return { data: data ?? [], error: error?.message ?? null };
}

// ---- Event Instances ----

export async function getGroupEvents(
  groupId: string
): Promise<ApiResult<EventInstance[]>> {
  const { data, error } = await supabase
    .from('event_instances')
    .select('*, venue:venues(*)')
    .eq('group_id', groupId)
    .order('week_number', { ascending: true });

  return { data: data ?? [], error: error?.message ?? null };
}

export async function getCurrentEvent(
  groupId: string
): Promise<ApiResult<EventInstance | null>> {
  const { data, error } = await supabase
    .from('event_instances')
    .select('*, venue:venues(*)')
    .eq('group_id', groupId)
    .in('status', ['scheduled', 'active'])
    .order('week_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  return { data: data ?? null, error: error?.message ?? null };
}

// ---- Multi-group eligibility ----

export async function checkGroupEligibility(
  userId: string,
  dayOfWeek?: number
): Promise<ApiResult<{
  eligible: boolean;
  reason?: string;
  max_groups: number;
  active_count: number;
  slots_remaining?: number;
}>> {
  const { data, error } = await supabase.rpc('can_join_new_group', {
    p_user_id: userId,
    p_day_of_week: dayOfWeek ?? null,
  });

  return { data, error: error?.message ?? null };
}

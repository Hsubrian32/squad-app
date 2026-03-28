import { supabase } from './supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserStatus = 'active' | 'banned' | 'suspended'
export type OnboardingStatus = 'complete' | 'incomplete' | 'pending'
export type GroupStatus = 'forming' | 'confirmed' | 'active' | 'completed' | 'cancelled'
export type CycleStatus = 'pending' | 'matching' | 'active' | 'completed'

export interface UserProfile {
  id: string           // same as auth.users.id
  first_name: string | null
  display_name: string | null
  email?: string       // joined from auth.users (optional, admin only)
  avatar_url: string | null
  bio: string | null
  neighborhood: string | null
  age: number | null
  role: 'member' | 'admin'
  onboarding_complete: boolean
  status: UserStatus
  created_at: string
  updated_at: string
}

export interface QuestionnaireAnswer {
  id: string
  user_id: string
  question_key: string
  question_label: string
  answer: string | string[]
  created_at: string
}

export interface Availability {
  day: string
  slots: string[]
}

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  rsvp_status: 'pending' | 'confirmed' | 'declined'
  stay_vote: boolean | null
  profile: UserProfile
}

export interface Venue {
  id: string
  name: string
  neighborhood: string
  category: string
  address: string
  capacity: number | null
  active: boolean
  notes: string | null
  created_at: string
}

export interface Group {
  id: string
  cycle_id: string
  venue_id: string | null
  name: string
  status: GroupStatus
  scheduled_time: string | null
  member_count?: number
  avg_feedback?: number | null
  venue?: Venue | null
  created_at: string
}

export interface Message {
  id: string
  group_id: string
  user_id: string
  content: string
  created_at: string
  profile?: Pick<UserProfile, 'first_name' | 'display_name' | 'avatar_url'>
}

export interface Feedback {
  id: string
  group_id: string
  user_id: string
  rating: number
  vibe_score: number | null
  would_meet_again: boolean | null
  notes: string | null
  created_at: string
  profile?: Pick<UserProfile, 'first_name' | 'display_name' | 'avatar_url'>
  group?: Pick<Group, 'name' | 'cycle_id'>
}

export interface Cycle {
  id: string
  cycle_date: string   // Monday ISO date — week start
  week_start: string  // alias for cycle_date (computed client-side)
  week_end: string    // cycle_date + 6 days (computed client-side)
  status: CycleStatus
  total_groups?: number
  total_members?: number
  completion_rate?: number
  avg_feedback?: number | null
  created_at: string
}

function enrichCycle(c: Record<string, unknown>): Cycle {
  const start = new Date(c.cycle_date as string)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return {
    ...(c as unknown as Cycle),
    week_start: (c.cycle_date as string),
    week_end: end.toISOString().split('T')[0],
  }
}

export interface DashboardStats {
  totalUsers: number
  activeGroups: number
  currentCycleStatus: CycleStatus | null
  avgFeedbackRating: number | null
  completionRate: number | null
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface UserDetail {
  profile: UserProfile
  questionnaireAnswers: QuestionnaireAnswer[]
  availability: Availability[]
  groupHistory: Array<Group & { members: GroupMember[] }>
  feedbackGiven: Feedback[]
  feedbackReceived: number
}

export interface GroupDetail {
  group: Group
  members: GroupMember[]
  messages: Message[]
  feedbackSummary: {
    avgRating: number | null
    avgVibeScore: number | null
    wouldMeetAgainPercent: number | null
    totalResponses: number
  }
  feedbacks: Feedback[]
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUsers(
  page = 1,
  limit = 20,
  search?: string,
  onboardingFilter?: boolean
): Promise<PaginatedResult<UserProfile>> {
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,display_name.ilike.%${search}%`)
  }

  if (onboardingFilter !== undefined) {
    query = query.eq('onboarding_complete', onboardingFilter)
  }

  const { data, error, count } = await query
  if (error) throw error

  // Fetch emails from auth.admin for display
  let emailMap: Record<string, string> = {}
  try {
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (authData?.users) {
      emailMap = Object.fromEntries(authData.users.map((u) => [u.id, u.email ?? '']))
    }
  } catch { /* non-critical */ }

  const profiles = (data ?? []).map((p) => ({
    ...(p as UserProfile),
    email: emailMap[p.id] ?? '',
  }))

  return { data: profiles, total: count ?? 0, page, limit }
}

export async function getUserDetail(userId: string): Promise<UserDetail> {
  const [profileRes, answersRes, availabilityRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase
      .from('questionnaire_answers')
      .select('*')
      .eq('user_id', userId)
      .order('question_key'),
    supabase.from('availability_slots').select('*').eq('user_id', userId),
  ])

  if (profileRes.error) throw profileRes.error

  // Group history: groups where this user is a member
  const { data: memberRows, error: memberErr } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)

  if (memberErr) throw memberErr

  const groupIds = (memberRows ?? []).map((r: { group_id: string }) => r.group_id)

  let groupHistory: Array<Group & { members: GroupMember[] }> = []
  if (groupIds.length > 0) {
    const { data: groups, error: groupsErr } = await supabase
      .from('groups')
      .select('*, venue:venues(*), members:group_members(*, profile:profiles(*))')
      .in('id', groupIds)
      .order('created_at', { ascending: false })

    if (groupsErr) throw groupsErr
    groupHistory = (groups ?? []) as Array<Group & { members: GroupMember[] }>
  }

  // Feedback given by user
  const { data: feedbackGiven, error: feedbackErr } = await supabase
    .from('feedback')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (feedbackErr) throw feedbackErr

  // Count feedback received (from others about groups this user was in)
  const { count: feedbackReceivedCount } = await supabase
    .from('feedback')
    .select('*', { count: 'exact', head: true })
    .in('group_id', groupIds)
    .neq('user_id', userId)

  return {
    profile: profileRes.data as UserProfile,
    questionnaireAnswers: (answersRes.data as QuestionnaireAnswer[]) ?? [],
    availability: (availabilityRes.data as Availability[]) ?? [],
    groupHistory,
    feedbackGiven: (feedbackGiven as Feedback[]) ?? [],
    feedbackReceived: feedbackReceivedCount ?? 0,
  }
}

// ─── Groups ───────────────────────────────────────────────────────────────────

export async function getGroups(cycleId?: string): Promise<Group[]> {
  let query = supabase
    .from('groups')
    .select(`
      *,
      venue:venues(*),
      members:group_members(count)
    `)
    .order('created_at', { ascending: false })

  if (cycleId) {
    query = query.eq('cycle_id', cycleId)
  }

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as Array<Group & { members: Array<{ count: number }> }>).map((g) => ({
    ...g,
    member_count: g.members?.[0]?.count ?? 0,
  }))
}

export async function getGroupDetail(groupId: string): Promise<GroupDetail> {
  const { data: group, error: groupErr } = await supabase
    .from('groups')
    .select('*, venue:venues(*)')
    .eq('id', groupId)
    .single()

  if (groupErr) throw groupErr

  const { data: members, error: membersErr } = await supabase
    .from('group_members')
    .select('*, profile:profiles(*)')
    .eq('group_id', groupId)

  if (membersErr) throw membersErr

  const { data: messages, error: messagesErr } = await supabase
    .from('messages')
    .select('*, profile:profiles(first_name, display_name, avatar_url)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (messagesErr) throw messagesErr

  const { data: feedbacks, error: feedbackErr } = await supabase
    .from('feedback')
    .select('*, profile:profiles(first_name, display_name, avatar_url)')
    .eq('group_id', groupId)

  if (feedbackErr) throw feedbackErr

  const feedbackList = (feedbacks as Feedback[]) ?? []
  const totalResponses = feedbackList.length

  let avgRating: number | null = null
  let avgVibeScore: number | null = null
  let wouldMeetAgainPercent: number | null = null

  if (totalResponses > 0) {
    avgRating =
      feedbackList.reduce((sum, f) => sum + f.rating, 0) / totalResponses

    const vibeItems = feedbackList.filter((f) => f.vibe_score !== null)
    if (vibeItems.length > 0) {
      avgVibeScore =
        vibeItems.reduce((sum, f) => sum + (f.vibe_score ?? 0), 0) / vibeItems.length
    }

    const meetItems = feedbackList.filter((f) => f.would_meet_again !== null)
    if (meetItems.length > 0) {
      wouldMeetAgainPercent =
        (meetItems.filter((f) => f.would_meet_again).length / meetItems.length) * 100
    }
  }

  return {
    group: group as Group,
    members: (members as GroupMember[]) ?? [],
    messages: ((messages as Message[]) ?? []).reverse(),
    feedbackSummary: {
      avgRating,
      avgVibeScore,
      wouldMeetAgainPercent,
      totalResponses,
    },
    feedbacks: feedbackList,
  }
}

// ─── Cycles ───────────────────────────────────────────────────────────────────

export async function getCycles(): Promise<Cycle[]> {
  const { data: cycles, error } = await supabase
    .from('match_cycles')
    .select('*')
    .order('cycle_date', { ascending: false })

  if (error) throw error

  const cycleList = ((cycles ?? []) as Record<string, unknown>[]).map(enrichCycle)

  // Enrich each cycle with stats
  const enriched = await Promise.all(
    cycleList.map(async (cycle) => {
      const { data: groups, error: groupsErr } = await supabase
        .from('groups')
        .select('id, status')
        .eq('cycle_id', cycle.id)

      if (groupsErr) return cycle

      const groupList = groups ?? []
      const totalGroups = groupList.length
      const completedGroups = groupList.filter(
        (g: { status: string }) => g.status === 'completed'
      ).length

      const groupIds = groupList.map((g: { id: string }) => g.id)

      let totalMembers = 0
      let avgFeedback: number | null = null

      if (groupIds.length > 0) {
        const { count: memberCount } = await supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .in('group_id', groupIds)

        totalMembers = memberCount ?? 0

        const { data: feedbackRows } = await supabase
          .from('feedback')
          .select('rating')
          .in('group_id', groupIds)

        if (feedbackRows && feedbackRows.length > 0) {
          avgFeedback =
            feedbackRows.reduce(
              (sum: number, f: { rating: number }) => sum + f.rating,
              0
            ) / feedbackRows.length
        }
      }

      return {
        ...cycle,
        total_groups: totalGroups,
        total_members: totalMembers,
        completion_rate: totalGroups > 0 ? (completedGroups / totalGroups) * 100 : undefined,
        avg_feedback: avgFeedback,
      }
    })
  )

  return enriched
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export async function getFeedback(groupId?: string): Promise<Feedback[]> {
  let query = supabase
    .from('feedback')
    .select('*, profile:profiles(display_name, avatar_url), group:groups(name, cycle_id)')
    .order('created_at', { ascending: false })

  if (groupId) {
    query = query.eq('group_id', groupId)
  }

  const { data, error } = await query
  if (error) throw error

  return (data as Feedback[]) ?? []
}

// ─── Matching ─────────────────────────────────────────────────────────────────

export async function triggerMatching(): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.functions.invoke('run-matching', {
    body: {},
  })

  if (error) throw error

  return data as { success: boolean; message: string }
}

// ─── User Management ──────────────────────────────────────────────────────────

export async function updateUserStatus(
  userId: string,
  status: UserStatus
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) throw error
}

// ─── Venues ───────────────────────────────────────────────────────────────────

export async function getVenues(): Promise<Venue[]> {
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .order('name')

  if (error) throw error
  return (data as Venue[]) ?? []
}

export async function createVenue(
  venue: Omit<Venue, 'id' | 'created_at'>
): Promise<Venue> {
  const { data, error } = await supabase
    .from('venues')
    .insert(venue)
    .select()
    .single()

  if (error) throw error
  return data as Venue
}

export async function updateVenueStatus(
  venueId: string,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from('venues')
    .update({ active: isActive })
    .eq('id', venueId)

  if (error) throw error
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const [usersRes, activeGroupsRes, cyclesRes, feedbackRes] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase
      .from('groups')
      .select('*', { count: 'exact', head: true })
      .in('status', ['forming', 'active']),
    supabase
      .from('match_cycles')
      .select('status')
      .order('cycle_date', { ascending: false })
      .limit(1),
    supabase.from('feedback').select('rating'),
  ])

  const totalUsers = usersRes.count ?? 0
  const activeGroups = activeGroupsRes.count ?? 0

  const currentCycleStatus: CycleStatus | null =
    cyclesRes.data && cyclesRes.data.length > 0
      ? (cyclesRes.data[0].status as CycleStatus)
      : null

  let avgFeedbackRating: number | null = null
  if (feedbackRes.data && feedbackRes.data.length > 0) {
    avgFeedbackRating =
      feedbackRes.data.reduce(
        (sum: number, f: { rating: number }) => sum + f.rating,
        0
      ) / feedbackRes.data.length
  }

  // Completion rate: completed groups / total groups in most recent cycle
  let completionRate: number | null = null
  if (cyclesRes.data && cyclesRes.data.length > 0) {
    const { data: recentCycles } = await supabase
      .from('match_cycles')
      .select('id')
      .order('cycle_date', { ascending: false })
      .limit(1)

    if (recentCycles && recentCycles.length > 0) {
      const cycleId = recentCycles[0].id
      const { data: allGroups } = await supabase
        .from('groups')
        .select('status')
        .eq('cycle_id', cycleId)

      if (allGroups && allGroups.length > 0) {
        const completed = allGroups.filter(
          (g: { status: string }) => g.status === 'completed'
        ).length
        completionRate = (completed / allGroups.length) * 100
      }
    }
  }

  return {
    totalUsers,
    activeGroups,
    currentCycleStatus,
    avgFeedbackRating,
    completionRate,
  }
}

// ─── Group Member Management ──────────────────────────────────────────────────

/**
 * Remove a single user from a group.
 * Hard-blocks removal if it would leave the group with 0 members;
 * caller should warn if it would drop below MIN_GROUP_SIZE (5).
 */
export async function removeUserFromGroup(
  groupId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)

  if (error) throw error
}

/**
 * Move a user from one group to another within the same cycle.
 * Enforces MAX_GROUP_SIZE = 8 on the target group before moving.
 * Resets RSVP to 'pending' so the user re-confirms for their new group.
 */
export async function moveUserToGroup(
  userId: string,
  fromGroupId: string,
  toGroupId: string
): Promise<void> {
  // Verify target group has room
  const { count, error: countErr } = await supabase
    .from('group_members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', toGroupId)

  if (countErr) throw countErr
  if ((count ?? 0) >= 8) {
    throw new Error('Target group is already at maximum capacity (8 members)')
  }

  // Fetch existing member row to preserve status
  const { data: existing, error: fetchErr } = await supabase
    .from('group_members')
    .select('status')
    .eq('group_id', fromGroupId)
    .eq('user_id', userId)
    .single()

  if (fetchErr) throw fetchErr

  // Delete from old group
  const { error: deleteErr } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', fromGroupId)
    .eq('user_id', userId)

  if (deleteErr) throw deleteErr

  // Insert into new group (reset RSVP — they need to re-confirm)
  const { error: insertErr } = await supabase
    .from('group_members')
    .insert({
      group_id: toGroupId,
      user_id: userId,
      status: (existing as { status: string })?.status ?? 'active',
      rsvp_status: 'pending',
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

  if (insertErr) throw insertErr
}

/**
 * Fetch all groups in the same cycle as the given group, with live member counts.
 * Used by the move-user modal to show available destinations.
 */
export async function getGroupsForCycle(
  cycleId: string,
  excludeGroupId?: string
): Promise<Array<Group & { member_count: number }>> {
  let query = supabase
    .from('groups')
    .select('*, venue:venues(*), members:group_members(count)')
    .eq('cycle_id', cycleId)
    .order('created_at', { ascending: true })

  if (excludeGroupId) {
    query = query.neq('id', excludeGroupId)
  }

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as Array<Group & { members: Array<{ count: number }> }>).map((g) => ({
    ...g,
    member_count: g.members?.[0]?.count ?? 0,
  }))
}

// ─── Recent Activity ──────────────────────────────────────────────────────────

export interface RecentActivity {
  recentGroups: Array<Group & { venue: Venue | null }>
  recentSignups: UserProfile[]
}

export async function getRecentActivity(): Promise<RecentActivity> {
  const [groupsRes, signupsRes] = await Promise.all([
    supabase
      .from('groups')
      .select('*, venue:venues(*)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return {
    recentGroups: (groupsRes.data as Array<Group & { venue: Venue | null }>) ?? [],
    recentSignups: (signupsRes.data as UserProfile[]) ?? [],
  }
}

export async function getCurrentCycle(): Promise<Cycle | null> {
  const { data, error } = await supabase
    .from('match_cycles')
    .select('*')
    .order('cycle_date', { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return enrichCycle(data as Record<string, unknown>)
}

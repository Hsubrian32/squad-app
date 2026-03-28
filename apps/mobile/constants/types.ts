// Database types matching Supabase schema

export type ArrivalStatus = 'on_the_way' | 'arrived' | 'running_late' | 'cant_make_it';
export type PrivacyPreference = 'nickname_only' | 'standard';
export type VenueFlexibility = 'flexible' | 'prefer_original' | 'strict';

export type MatchingStatus = 'idle' | 'waiting_for_match' | 'matched' | 'attending' | 'completed';

export interface Profile {
  id: string;
  display_name: string | null;
  first_name: string | null;
  bio: string | null;
  age: number | null;
  avatar_url: string | null;
  neighborhood: string | null;
  city: string | null;
  location: string | null;
  role: 'member' | 'admin';
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
  nickname: string | null;
  intro: string | null;
  vibe_tags: string[];
  privacy_preference: PrivacyPreference;
  venue_flexibility: VenueFlexibility;
  travel_radius_km: number | null;
  lat: number | null;
  lng: number | null;
  matching_status: MatchingStatus;
}

export interface QuestionnaireAnswer {
  id: string;
  user_id: string;
  question_key: string;
  answer: string | string[] | number;
  created_at: string;
  updated_at: string;
}

export interface AvailabilitySlot {
  id: string;
  user_id: string;
  day_of_week: number; // 0 = Sunday … 6 = Saturday
  start_time: string;  // HH:MM:SS
  end_time: string;    // HH:MM:SS
  cycle_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  neighborhood: string | null;
  category: string;
  capacity: number;
  active: boolean;
  // Coordinates
  lat: number | null;
  lng: number | null;
  // Quality metadata (populated by enrich-venues edge function)
  rating: number | null;
  review_count: number | null;
  price_level: number | null;           // 1=$  2=$$  3=$$$  4=$$$$
  operational_status: string | null;    // 'operational' | 'closed_temporarily' | etc.
  is_verified: boolean;
  suitability_score: number | null;     // 0–100, group hangout suitability
  suitability_flags: string[];          // e.g. ['group_friendly','conversational']
  website: string | null;
  phone: string | null;
  // Preference metadata
  venue_type: string | null;
  budget_tier: string | null;
  is_outdoor: boolean;
  is_alcohol_free: boolean;
  vibe_tags: string[];
}

export interface MatchingCycle {
  id: string;
  cycle_date: string;  // ISO date — Monday of the week
  status: 'pending' | 'matching' | 'active' | 'completed';
  created_at: string;
  updated_at: string;
}

export type RsvpStatus = 'pending' | 'yes' | 'no' | 'maybe';
export type MessageType = 'text' | 'system' | 'announcement';

export interface Group {
  id: string;
  cycle_id: string;
  venue_id: string | null;
  backup_venue_id: string | null;
  scheduled_time: string | null;
  status: 'forming' | 'active' | 'completed' | 'dissolved';
  name: string;
  max_members: number;
  created_at: string;
  /** Human-readable token list explaining why this venue was chosen */
  venue_selection_reason: string[];
  /** Neighborhood/area label for the meetup, e.g. 'Lower East Side' */
  meetup_area: string | null;
  venue?: Venue;
  members?: GroupMember[];
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  rsvp_status: RsvpStatus;
  stay_vote: boolean | null;
  joined_at: string;
  checked_in: boolean;
  checked_in_at: string | null;
  arrival_status: ArrivalStatus | null;
  name_revealed: boolean;
  profile?: Profile;
}

export interface Message {
  id: string;
  group_id: string;
  user_id: string | null;
  content: string;
  type: MessageType;
  created_at: string;
  profile?: Profile;
}

export interface FeedbackSubmission {
  group_id: string;
  cycle_id: string;
  user_id: string;
  rating: number;       // was group_rating
  vibe_score: number;
  would_meet_again: boolean;
  notes: string | null;
}

export interface Feedback {
  id: string;
  group_id: string;
  cycle_id: string;
  user_id: string;
  rating: number;       // was group_rating
  vibe_score: number;
  would_meet_again: boolean;
  notes: string | null;
  created_at: string;
}

export interface ApiResult<T> {
  data: T | null;
  error: string | null;
}

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
// TimeSlot is a UI concept — maps to start_time/end_time on save
export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night';

export const DAY_NAMES: Record<DayOfWeek, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

export const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  morning: 'Morning (9–12)',
  afternoon: 'Afternoon (12–5)',
  evening: 'Evening (5–9)',
  night: 'Night (9–12)',
};

/** Map UI time slots to DB start/end times */
export const TIME_SLOT_RANGES: Record<TimeSlot, { start: string; end: string }> = {
  morning:   { start: '09:00:00', end: '12:00:00' },
  afternoon: { start: '12:00:00', end: '17:00:00' },
  evening:   { start: '17:00:00', end: '21:00:00' },
  night:     { start: '21:00:00', end: '24:00:00' },
};

// Event Instances (recurring group events)
export interface EventInstance {
  id: string;
  group_id: string;
  cycle_id: string | null;
  week_number: number;
  scheduled_time: string;
  venue_id: string | null;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  venue?: Venue;
  created_at: string;
}

// Event Attendance
export interface EventAttendance {
  id: string;
  event_id: string;
  user_id: string;
  group_id: string;
  checked_in: boolean;
  checked_in_at: string | null;
  arrival_status: 'on_the_way' | 'arrived' | 'running_late' | 'cant_make_it' | null;
  rsvp_status: 'pending' | 'yes' | 'no' | 'maybe';
}

// Post-Event Review
export interface PostEventReview {
  id: string;
  event_id: string;
  user_id: string;
  group_id: string;
  overall_rating: number;
  vibe_rating: number | null;
  venue_rating: number | null;
  would_return: boolean | null;
  comment: string | null;
  created_at: string;
}

// Stay/Leave Decision
export interface StayLeaveDecision {
  id: string;
  event_id: string;
  user_id: string;
  group_id: string;
  decision: 'stay' | 'leave';
  created_at: string;
}

// User Group History (from view)
export interface UserGroupHistoryEntry {
  user_id: string;
  group_id: string;
  group_name: string | null;
  group_status: 'forming' | 'active' | 'completed' | 'dissolved';
  day_of_week: number | null;
  is_recurring: boolean;
  scheduled_time: string | null;
  total_events: number;
  group_created_at: string;
  membership_status: 'invited' | 'active' | 'removed' | 'left';
  joined_at: string;
  left_at: string | null;
  leave_reason: 'voluntary' | 'no_show' | 'dissolved' | 'removed' | null;
  events_attended: number;
  ever_checked_in: boolean;
  venue_name: string | null;
  venue_neighborhood: string | null;
  display_status: 'active' | 'left' | 'dissolved' | 'no_show' | 'completed' | 'unknown';
  sort_section: number;
  sort_date: string;
}

// Post-event flow state
export type PostEventStep = 'review' | 'stay_leave' | 'complete';

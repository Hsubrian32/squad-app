// ============================================================
// Squad App — Shared Type Definitions
// ============================================================

// ------------------------------------------------------------
// Enums
// ------------------------------------------------------------

export enum GroupStatus {
  Forming = 'forming',       // Group has been created, awaiting event
  Active = 'active',         // Event has occurred; voting open
  Persisted = 'persisted',   // Group voted to stay together
  Dissolved = 'dissolved',   // Group dissolved after voting
  Cancelled = 'cancelled',   // Group cancelled before event
}

export enum MemberStatus {
  Invited = 'invited',       // Matched and notified; has not confirmed
  Confirmed = 'confirmed',   // Confirmed attendance
  Declined = 'declined',     // Declined the invitation
  Removed = 'removed',       // Removed from the group
  Waitlisted = 'waitlisted', // On the waitlist for this cycle
}

export enum CycleStatus {
  Pending = 'pending',       // Cycle created but matching not yet run
  Matching = 'matching',     // Matching algorithm is running
  Matched = 'matched',       // Groups have been formed
  EventDay = 'event_day',    // It is the day of the event
  Voting = 'voting',         // Post-event voting window is open
  Completed = 'completed',   // Voting window has closed
  Failed = 'failed',         // Cycle failed (not enough participants, etc.)
}

export enum RsvpStatus {
  Pending = 'pending',
  Going = 'going',
  NotGoing = 'not_going',
  Maybe = 'maybe',
}

export enum MessageType {
  Text = 'text',
  System = 'system',       // Auto-generated system messages
  Image = 'image',
  Giphy = 'giphy',
}

export enum SubscriptionPlan {
  Free = 'free',
  Plus = 'plus',
  Pro = 'pro',
}

export enum OnboardingStep {
  Profile = 'profile',
  Questionnaire = 'questionnaire',
  Availability = 'availability',
  Complete = 'complete',
}

// ------------------------------------------------------------
// Database Base Types (mirror Postgres schema)
// ------------------------------------------------------------

export interface User {
  id: string;                          // UUID primary key
  email: string;
  phone: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;                  // ISO timestamp
  updated_at: string;
  last_sign_in_at: string | null;
  onboarding_step: OnboardingStep;
  onboarding_completed_at: string | null;
  is_active: boolean;
  is_banned: boolean;
  subscription_plan: SubscriptionPlan;
  subscription_expires_at: string | null;
  push_token: string | null;
  notification_preferences: NotificationPreferences;
}

export interface NotificationPreferences {
  match_notifications: boolean;
  message_notifications: boolean;
  event_reminders: boolean;
  vote_reminders: boolean;
  marketing_emails: boolean;
}

export interface Profile {
  id: string;                          // UUID, FK -> users.id
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;        // ISO date string YYYY-MM-DD
  age: number | null;                  // Computed or stored
  gender: string | null;
  location_city: string | null;
  location_state: string | null;
  location_country: string | null;
  location_lat: number | null;
  location_lng: number | null;
  instagram_handle: string | null;
  linkedin_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionnaireAnswer {
  id: string;                          // UUID
  user_id: string;
  question_id: string;
  answer_value: string | string[] | number; // Depends on question type
  created_at: string;
  updated_at: string;
}

export interface AvailabilitySlot {
  id: string;                          // UUID
  user_id: string;
  day_of_week: number;                 // 0 = Sunday, 6 = Saturday
  time_slot: string;                   // e.g. "18:00", "19:00"
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface MatchCycle {
  id: string;                          // UUID
  cycle_number: number;                // Incrementing integer
  week_start: string;                  // ISO date of Monday
  event_date: string;                  // ISO date of Friday
  status: CycleStatus;
  matched_at: string | null;
  event_start_time: string;            // e.g. "19:00"
  event_end_time: string;              // e.g. "22:00"
  city: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;                          // UUID
  cycle_id: string;
  name: string | null;                 // Optional fun group name
  status: GroupStatus;
  venue_id: string | null;
  meeting_time: string | null;         // ISO timestamp of scheduled meetup
  stay_votes: number;                  // Count of "stay together" votes
  leave_votes: number;                 // Count of "dissolve" votes
  vote_deadline: string | null;        // ISO timestamp
  persisted_at: string | null;         // When the group was marked as persisted
  dissolved_at: string | null;
  invite_code: string | null;          // Short code for manual joining
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;                          // UUID
  group_id: string;
  user_id: string;
  status: MemberStatus;
  rsvp_status: RsvpStatus;
  rsvp_at: string | null;
  stay_vote: boolean | null;           // null = not yet voted
  voted_at: string | null;
  match_score: number | null;          // Score used during matching
  is_host: boolean;                    // One member is designated host
  joined_at: string;
  left_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Venue {
  id: string;                          // UUID
  name: string;
  address: string;
  city: string;
  state: string | null;
  country: string;
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
  venue_type: string;                  // e.g. "bar", "restaurant", "cafe", "park"
  description: string | null;
  website_url: string | null;
  phone: string | null;
  google_place_id: string | null;
  photo_urls: string[];
  avg_cost_per_person: number | null;  // In cents
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;                          // UUID
  group_id: string;
  user_id: string | null;              // null for system messages
  type: MessageType;
  content: string;
  metadata: Record<string, unknown> | null; // e.g. image dimensions, giphy id
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Feedback {
  id: string;                          // UUID
  cycle_id: string;
  group_id: string;
  from_user_id: string;
  about_user_id: string | null;        // null = feedback about the event overall
  rating: number;                      // 1-5
  comment: string | null;
  tags: string[];
  is_anonymous: boolean;
  created_at: string;
}

export interface Block {
  id: string;                          // UUID
  blocker_user_id: string;
  blocked_user_id: string;
  reason: string | null;
  created_at: string;
}

export interface Report {
  id: string;                          // UUID
  reporter_user_id: string;
  reported_user_id: string;
  group_id: string | null;
  reason: string;
  description: string | null;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;                          // UUID
  user_id: string;
  plan: SubscriptionPlan;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing' | 'paused';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string;        // ISO timestamp
  current_period_end: string;          // ISO timestamp
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  trial_start: string | null;
  trial_end: string | null;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------
// Extended / Joined Types
// ------------------------------------------------------------

export interface GroupMemberWithProfile extends GroupMember {
  profile: Profile;
  user: Pick<User, 'id' | 'email' | 'subscription_plan'>;
}

export interface GroupWithMembers extends Group {
  members: GroupMemberWithProfile[];
  venue: Venue | null;
  cycle: MatchCycle;
}

export interface MessageWithProfile extends Message {
  profile: Pick<Profile, 'id' | 'user_id' | 'display_name' | 'avatar_url'> | null;
}

export interface UserWithProfile extends User {
  profile: Profile;
  questionnaire_answers: QuestionnaireAnswer[];
  availability_slots: AvailabilitySlot[];
}

export interface FeedbackWithProfiles extends Feedback {
  from_profile: Pick<Profile, 'id' | 'display_name' | 'avatar_url'>;
  about_profile: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null;
}

// ------------------------------------------------------------
// Matching Algorithm Types
// ------------------------------------------------------------

export interface MatchScore {
  user_a_id: string;
  user_b_id: string;
  total_score: number;              // 0–100 composite score
  interest_score: number;           // 0–100: overlap of interests
  personality_score: number;        // 0–100: personality compatibility
  availability_score: number;       // 0–100: schedule overlap
  energy_score: number;             // 0–100: energy level compatibility
  conversation_score: number;       // 0–100: conversation style match
  previously_matched: boolean;      // Penalise repeat pairings
  blocked: boolean;                 // One user has blocked the other
  score_breakdown: Record<string, number>;
}

export interface MatchCycleInput {
  cycle_id: string;
  eligible_users: UserWithProfile[];
  city: string;
  group_size: number;
}

export interface MatchCycleResult {
  cycle_id: string;
  groups: MatchedGroup[];
  unmatched_user_ids: string[];
  stats: MatchStats;
}

export interface MatchedGroup {
  members: string[];               // Array of user IDs
  avg_score: number;
  venue_suggestion_ids: string[];
}

export interface MatchStats {
  total_participants: number;
  total_groups: number;
  unmatched_count: number;
  avg_group_score: number;
  run_duration_ms: number;
}

// ------------------------------------------------------------
// API Response Types
// ------------------------------------------------------------

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  success: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  status?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
}

// ------------------------------------------------------------
// Questionnaire Types
// ------------------------------------------------------------

export type QuestionType = 'single' | 'multi' | 'scale' | 'text';

export interface QuestionOption {
  value: string;
  label: string;
  emoji?: string;
}

export interface QuestionnaireQuestion {
  id: string;
  section_id: string;
  text: string;
  subtext?: string;
  type: QuestionType;
  options?: QuestionOption[];       // For single / multi
  scale_min?: number;               // For scale
  scale_max?: number;               // For scale
  scale_min_label?: string;
  scale_max_label?: string;
  required: boolean;
  max_selections?: number;          // For multi questions
  order: number;
}

export interface QuestionnaireSection {
  id: string;
  title: string;
  description?: string;
  order: number;
  questions: QuestionnaireQuestion[];
}

export interface QuestionnaireSubmission {
  user_id: string;
  answers: Array<{
    question_id: string;
    answer_value: string | string[] | number;
  }>;
  submitted_at: string;
}

// ------------------------------------------------------------
// Onboarding Types
// ------------------------------------------------------------

export interface OnboardingState {
  current_step: OnboardingStep;
  completed_steps: OnboardingStep[];
  profile_data: Partial<ProfileFormData>;
  questionnaire_data: Partial<QuestionnaireSubmission>;
  availability_data: AvailabilityFormData;
}

export interface ProfileFormData {
  display_name: string;
  first_name: string;
  last_name: string;
  bio: string;
  date_of_birth: string;
  gender: string;
  location_city: string;
  location_state: string;
  location_country: string;
  avatar_url: string;
  instagram_handle: string;
  linkedin_url: string;
}

export interface AvailabilityFormData {
  slots: Array<{
    day_of_week: number;
    time_slot: string;
    is_available: boolean;
  }>;
}

// ------------------------------------------------------------
// Push / Notification Types
// ------------------------------------------------------------

export type NotificationType =
  | 'match_ready'
  | 'group_invite'
  | 'rsvp_reminder'
  | 'event_reminder'
  | 'vote_open'
  | 'vote_reminder'
  | 'group_persisted'
  | 'group_dissolved'
  | 'new_message'
  | 'system_announcement';

export interface PushNotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  image_url?: string;
}

// ------------------------------------------------------------
// Voting / Post-Event Types
// ------------------------------------------------------------

export interface VotePayload {
  group_id: string;
  user_id: string;
  vote: 'stay' | 'leave';
}

export interface VoteSummary {
  group_id: string;
  stay_votes: number;
  leave_votes: number;
  total_members: number;
  votes_cast: number;
  stay_percentage: number;
  quorum_reached: boolean;
  result: 'stay' | 'dissolve' | 'pending';
  vote_deadline: string;
}

// ------------------------------------------------------------
// Search / Filter Types
// ------------------------------------------------------------

export interface UserSearchFilters {
  city?: string;
  age_min?: number;
  age_max?: number;
  interests?: string[];
  subscription_plan?: SubscriptionPlan;
  is_active?: boolean;
}

export interface GroupSearchFilters {
  cycle_id?: string;
  status?: GroupStatus;
  city?: string;
}

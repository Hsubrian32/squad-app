// ============================================================
// Squad App — Shared Constants
// ============================================================

import type { QuestionnaireQuestion, QuestionnaireSection } from './types';

// ------------------------------------------------------------
// Core Matching & Scheduling Constants
// ------------------------------------------------------------

/** Number of members in each Squad group. */
export const GROUP_SIZE = 6;

/**
 * Fraction of members that must vote "stay" for a group to persist
 * into the next cycle (0.6 = 60 %).
 */
export const MIN_STAY_VOTE_PERCENTAGE = 0.6;

/** Day of the week when the matching algorithm runs. */
export const MATCH_CYCLE_DAY = 'monday' as const;

/** Day of the week when group events take place. */
export const EVENT_DAY = 'friday' as const;

/** Default event start time (24-hour, local). */
export const DEFAULT_EVENT_START_TIME = '19:00' as const;

/** Default event end time (24-hour, local). */
export const DEFAULT_EVENT_END_TIME = '22:00' as const;

/** How many hours after event_start that voting opens. */
export const VOTING_OPENS_HOURS_AFTER_EVENT = 2;

/** How many hours the voting window stays open after it opens. */
export const VOTING_WINDOW_HOURS = 48;

/** Maximum number of previous cycles to look back when penalising repeat pairings. */
export const REPEAT_PAIRING_LOOKBACK_CYCLES = 4;

/** Penalty applied to match score for a repeat pairing (0–100 scale). */
export const REPEAT_PAIRING_PENALTY = 20;

/** Minimum match score threshold (0–100) for a valid pairing. */
export const MIN_MATCH_SCORE_THRESHOLD = 30;

// ------------------------------------------------------------
// Questionnaire Questions
// ------------------------------------------------------------

export const QUESTIONNAIRE_QUESTIONS: QuestionnaireQuestion[] = [
  // ── Interests ──────────────────────────────────────────────
  {
    id: 'interests',
    section_id: 'about_you',
    text: 'What are your interests?',
    subtext: 'Pick everything that resonates — the more you share, the better your matches.',
    type: 'multi',
    required: true,
    max_selections: undefined, // unlimited
    order: 1,
    options: [
      { value: 'art',      label: 'Art & Design',       emoji: '🎨' },
      { value: 'music',    label: 'Music',               emoji: '🎵' },
      { value: 'food',     label: 'Food & Dining',       emoji: '🍜' },
      { value: 'sports',   label: 'Sports & Fitness',    emoji: '⚽' },
      { value: 'tech',     label: 'Tech & Startups',     emoji: '💻' },
      { value: 'outdoors', label: 'Outdoors & Nature',   emoji: '🏕️' },
      { value: 'games',    label: 'Games & Puzzles',     emoji: '🎲' },
      { value: 'film',     label: 'Film & TV',           emoji: '🎬' },
      { value: 'reading',  label: 'Books & Reading',     emoji: '📚' },
      { value: 'travel',   label: 'Travel',              emoji: '✈️' },
      { value: 'wellness', label: 'Wellness & Mindfulness', emoji: '🧘' },
      { value: 'comedy',   label: 'Comedy & Improv',     emoji: '😂' },
      { value: 'politics', label: 'Politics & Society',  emoji: '🗳️' },
      { value: 'science',  label: 'Science & Research',  emoji: '🔬' },
      { value: 'fashion',  label: 'Fashion & Style',     emoji: '👗' },
      { value: 'pets',     label: 'Pets & Animals',      emoji: '🐾' },
    ],
  },

  // ── Personality ────────────────────────────────────────────
  {
    id: 'personality_type',
    section_id: 'personality',
    text: 'How would you describe your social energy?',
    type: 'single',
    required: true,
    order: 2,
    options: [
      {
        value: 'introvert',
        label: 'Introvert',
        emoji: '🌙',
      },
      {
        value: 'ambivert',
        label: 'Ambivert — somewhere in between',
        emoji: '☯️',
      },
      {
        value: 'extrovert',
        label: 'Extrovert',
        emoji: '☀️',
      },
    ],
  },

  // ── Conversation Style ──────────────────────────────────────
  {
    id: 'conversation_style',
    section_id: 'personality',
    text: 'What kind of conversations do you enjoy most?',
    type: 'single',
    required: true,
    order: 3,
    options: [
      {
        value: 'deep',
        label: 'Deep & meaningful — let\'s get philosophical',
        emoji: '🧠',
      },
      {
        value: 'casual',
        label: 'Light & fun — jokes, stories, good vibes',
        emoji: '😄',
      },
      {
        value: 'mix',
        label: 'A mix — start light, go deep',
        emoji: '🎭',
      },
    ],
  },

  // ── Energy Level ────────────────────────────────────────────
  {
    id: 'energy_level',
    section_id: 'personality',
    text: 'How would you rate your social energy level on a typical Friday evening?',
    subtext: '1 = very low-key and chill, 5 = high energy and ready to party',
    type: 'scale',
    required: true,
    order: 4,
    scale_min: 1,
    scale_max: 5,
    scale_min_label: 'Low-key & chill',
    scale_max_label: 'High energy',
  },

  // ── Ideal Group Size Preference ─────────────────────────────
  {
    id: 'group_size_preference',
    section_id: 'preferences',
    text: 'What\'s your ideal group size for a social hangout?',
    type: 'single',
    required: true,
    order: 5,
    options: [
      { value: 'small',  label: '2–4 people — keep it intimate',    emoji: '🤝' },
      { value: 'medium', label: '5–8 people — sweet spot',          emoji: '👥' },
      { value: 'large',  label: '9+ people — the more the merrier', emoji: '🎉' },
    ],
  },

  // ── Looking For ─────────────────────────────────────────────
  {
    id: 'looking_for',
    section_id: 'preferences',
    text: 'What are you primarily looking for through Squad?',
    subtext: 'Select all that apply.',
    type: 'multi',
    required: true,
    max_selections: 3,
    order: 6,
    options: [
      {
        value: 'friendship',
        label: 'New friendships',
        emoji: '💙',
      },
      {
        value: 'networking',
        label: 'Professional networking',
        emoji: '🤝',
      },
      {
        value: 'dating_friendly',
        label: 'Open to dating (no pressure)',
        emoji: '💛',
      },
      {
        value: 'activity_partners',
        label: 'Activity partners',
        emoji: '🎯',
      },
      {
        value: 'all',
        label: 'All of the above — I\'m open!',
        emoji: '🌈',
      },
    ],
  },

  // ── Communication Preference ────────────────────────────────
  {
    id: 'communication_preference',
    section_id: 'preferences',
    text: 'How do you prefer to communicate with a new group before meeting?',
    type: 'single',
    required: false,
    order: 7,
    options: [
      { value: 'app_only',    label: 'Keep it in the Squad app',       emoji: '📱' },
      { value: 'light_chat',  label: 'A few messages to coordinate',   emoji: '💬' },
      { value: 'active_chat', label: 'Active chat — get to know each other beforehand', emoji: '🔥' },
    ],
  },

  // ── Comfort with Strangers ──────────────────────────────────
  {
    id: 'new_people_comfort',
    section_id: 'personality',
    text: 'How comfortable are you meeting a completely new group of people?',
    type: 'scale',
    required: true,
    order: 8,
    scale_min: 1,
    scale_max: 5,
    scale_min_label: 'A little nervous',
    scale_max_label: 'Totally in my element',
  },

  // ── Dietary / Accessibility ─────────────────────────────────
  {
    id: 'venue_preferences',
    section_id: 'logistics',
    text: 'Any venue preferences we should know about?',
    subtext: 'We\'ll do our best to find a spot that works for everyone.',
    type: 'multi',
    required: false,
    order: 9,
    options: [
      { value: 'vegetarian_friendly', label: 'Vegetarian-friendly menu', emoji: '🥦' },
      { value: 'vegan_friendly',      label: 'Vegan-friendly menu',      emoji: '🌱' },
      { value: 'halal',               label: 'Halal options',            emoji: '☪️' },
      { value: 'kosher',              label: 'Kosher options',           emoji: '✡️' },
      { value: 'alcohol_free',        label: 'Alcohol-free venue',       emoji: '🧃' },
      { value: 'wheelchair_access',   label: 'Wheelchair accessible',    emoji: '♿' },
      { value: 'outdoor_seating',     label: 'Outdoor seating',          emoji: '🌳' },
      { value: 'quiet_environment',   label: 'Quieter environment',      emoji: '🤫' },
    ],
  },

  // ── Fun Icebreaker ──────────────────────────────────────────
  {
    id: 'fun_fact',
    section_id: 'icebreaker',
    text: 'Share a fun fact about yourself.',
    subtext: 'This will be shared with your group before you meet. Keep it light!',
    type: 'text',
    required: false,
    order: 10,
  },
];

// ------------------------------------------------------------
// Questionnaire Sections
// ------------------------------------------------------------

export const QUESTIONNAIRE_SECTIONS: QuestionnaireSection[] = [
  {
    id: 'about_you',
    title: 'About You',
    description: 'Help us understand what makes you tick.',
    order: 1,
    questions: QUESTIONNAIRE_QUESTIONS.filter((q) => q.section_id === 'about_you'),
  },
  {
    id: 'personality',
    title: 'Your Personality',
    description: 'No wrong answers — we just want to find your people.',
    order: 2,
    questions: QUESTIONNAIRE_QUESTIONS.filter((q) => q.section_id === 'personality'),
  },
  {
    id: 'preferences',
    title: 'Your Preferences',
    description: 'Tell us what you\'re looking for.',
    order: 3,
    questions: QUESTIONNAIRE_QUESTIONS.filter((q) => q.section_id === 'preferences'),
  },
  {
    id: 'logistics',
    title: 'Logistics',
    description: 'Help us find the perfect spot.',
    order: 4,
    questions: QUESTIONNAIRE_QUESTIONS.filter((q) => q.section_id === 'logistics'),
  },
  {
    id: 'icebreaker',
    title: 'Icebreaker',
    description: 'A little something to get the conversation started.',
    order: 5,
    questions: QUESTIONNAIRE_QUESTIONS.filter((q) => q.section_id === 'icebreaker'),
  },
];

// ------------------------------------------------------------
// Interest Categories (for profile display & filtering)
// ------------------------------------------------------------

export interface InterestCategory {
  value: string;
  label: string;
  emoji: string;
  color: string; // Hex color for tag backgrounds
}

export const INTEREST_CATEGORIES: InterestCategory[] = [
  { value: 'art',      label: 'Art & Design',          emoji: '🎨', color: '#F3E8FF' },
  { value: 'music',    label: 'Music',                  emoji: '🎵', color: '#FEF3C7' },
  { value: 'food',     label: 'Food & Dining',          emoji: '🍜', color: '#FEE2E2' },
  { value: 'sports',   label: 'Sports & Fitness',       emoji: '⚽', color: '#D1FAE5' },
  { value: 'tech',     label: 'Tech & Startups',        emoji: '💻', color: '#DBEAFE' },
  { value: 'outdoors', label: 'Outdoors & Nature',      emoji: '🏕️', color: '#D1FAE5' },
  { value: 'games',    label: 'Games & Puzzles',        emoji: '🎲', color: '#FDE68A' },
  { value: 'film',     label: 'Film & TV',              emoji: '🎬', color: '#FCE7F3' },
  { value: 'reading',  label: 'Books & Reading',        emoji: '📚', color: '#E0E7FF' },
  { value: 'travel',   label: 'Travel',                 emoji: '✈️', color: '#CFFAFE' },
  { value: 'wellness', label: 'Wellness & Mindfulness', emoji: '🧘', color: '#F0FDF4' },
  { value: 'comedy',   label: 'Comedy & Improv',        emoji: '😂', color: '#FEF9C3' },
  { value: 'politics', label: 'Politics & Society',     emoji: '🗳️', color: '#F5F5F4' },
  { value: 'science',  label: 'Science & Research',     emoji: '🔬', color: '#EFF6FF' },
  { value: 'fashion',  label: 'Fashion & Style',        emoji: '👗', color: '#FDF2F8' },
  { value: 'pets',     label: 'Pets & Animals',         emoji: '🐾', color: '#FFF7ED' },
];

/** Lookup map from interest value -> InterestCategory */
export const INTEREST_CATEGORY_MAP: Record<string, InterestCategory> = Object.fromEntries(
  INTEREST_CATEGORIES.map((c) => [c.value, c]),
);

// ------------------------------------------------------------
// Availability Time Slots
// ------------------------------------------------------------

export interface TimeSlot {
  value: string;   // 24-hour "HH:MM"
  label: string;   // Human-readable
}

export const AVAILABILITY_TIME_SLOTS: TimeSlot[] = [
  { value: '17:00', label: '5:00 PM' },
  { value: '17:30', label: '5:30 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '18:30', label: '6:30 PM' },
  { value: '19:00', label: '7:00 PM' },
  { value: '19:30', label: '7:30 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '20:30', label: '8:30 PM' },
  { value: '21:00', label: '9:00 PM' },
  { value: '21:30', label: '9:30 PM' },
  { value: '22:00', label: '10:00 PM' },
];

/** Days of the week with labels. Index corresponds to JS Date.getDay() (0 = Sunday). */
export const DAYS_OF_WEEK = [
  { value: 0, short: 'Sun', label: 'Sunday' },
  { value: 1, short: 'Mon', label: 'Monday' },
  { value: 2, short: 'Tue', label: 'Tuesday' },
  { value: 3, short: 'Wed', label: 'Wednesday' },
  { value: 4, short: 'Thu', label: 'Thursday' },
  { value: 5, short: 'Fri', label: 'Friday' },
  { value: 6, short: 'Sat', label: 'Saturday' },
] as const;

// ------------------------------------------------------------
// Subscription Plans
// ------------------------------------------------------------

export interface PlanFeature {
  label: string;
  included: boolean;
}

export interface PlanDefinition {
  plan: string;
  label: string;
  price_monthly_cents: number;
  price_annual_cents: number;
  features: PlanFeature[];
}

export const SUBSCRIPTION_PLANS: PlanDefinition[] = [
  {
    plan: 'free',
    label: 'Free',
    price_monthly_cents: 0,
    price_annual_cents: 0,
    features: [
      { label: 'One group match per cycle',          included: true },
      { label: 'Group chat',                         included: true },
      { label: 'Basic profile',                      included: true },
      { label: 'See who else is in your group',      included: true },
      { label: 'Priority matching',                  included: false },
      { label: 'View past group members',            included: false },
      { label: 'Advanced interest filters',          included: false },
      { label: 'Exclusive venue access',             included: false },
    ],
  },
  {
    plan: 'plus',
    label: 'Plus',
    price_monthly_cents: 999,
    price_annual_cents: 7999,
    features: [
      { label: 'One group match per cycle',          included: true },
      { label: 'Group chat',                         included: true },
      { label: 'Basic profile',                      included: true },
      { label: 'See who else is in your group',      included: true },
      { label: 'Priority matching',                  included: true },
      { label: 'View past group members',            included: true },
      { label: 'Advanced interest filters',          included: false },
      { label: 'Exclusive venue access',             included: false },
    ],
  },
  {
    plan: 'pro',
    label: 'Pro',
    price_monthly_cents: 1999,
    price_annual_cents: 15999,
    features: [
      { label: 'One group match per cycle',          included: true },
      { label: 'Group chat',                         included: true },
      { label: 'Basic profile',                      included: true },
      { label: 'See who else is in your group',      included: true },
      { label: 'Priority matching',                  included: true },
      { label: 'View past group members',            included: true },
      { label: 'Advanced interest filters',          included: true },
      { label: 'Exclusive venue access',             included: true },
    ],
  },
];

// ------------------------------------------------------------
// Validation Constants
// ------------------------------------------------------------

export const VALIDATION = {
  DISPLAY_NAME_MIN_LENGTH: 2,
  DISPLAY_NAME_MAX_LENGTH: 30,
  BIO_MAX_LENGTH: 300,
  FUN_FACT_MAX_LENGTH: 150,
  MESSAGE_MAX_LENGTH: 2000,
  MIN_AGE: 18,
  MAX_AGE: 99,
  MIN_INTERESTS_REQUIRED: 1,
  MAX_INTERESTS_SELECTABLE: 16,
} as const;

// ------------------------------------------------------------
// Error Codes
// ------------------------------------------------------------

export const ERROR_CODES = {
  // Auth
  UNAUTHENTICATED:           'UNAUTHENTICATED',
  UNAUTHORIZED:              'UNAUTHORIZED',
  EMAIL_ALREADY_EXISTS:      'EMAIL_ALREADY_EXISTS',
  INVALID_CREDENTIALS:       'INVALID_CREDENTIALS',
  SESSION_EXPIRED:           'SESSION_EXPIRED',

  // User / Profile
  USER_NOT_FOUND:            'USER_NOT_FOUND',
  PROFILE_NOT_FOUND:         'PROFILE_NOT_FOUND',
  ONBOARDING_INCOMPLETE:     'ONBOARDING_INCOMPLETE',
  USER_BANNED:               'USER_BANNED',

  // Matching / Groups
  CYCLE_NOT_FOUND:           'CYCLE_NOT_FOUND',
  GROUP_NOT_FOUND:           'GROUP_NOT_FOUND',
  ALREADY_IN_GROUP:          'ALREADY_IN_GROUP',
  NOT_IN_GROUP:              'NOT_IN_GROUP',
  GROUP_FULL:                'GROUP_FULL',
  VOTING_CLOSED:             'VOTING_CLOSED',
  ALREADY_VOTED:             'ALREADY_VOTED',

  // Messages
  MESSAGE_NOT_FOUND:         'MESSAGE_NOT_FOUND',
  MESSAGE_TOO_LONG:          'MESSAGE_TOO_LONG',

  // General
  VALIDATION_ERROR:          'VALIDATION_ERROR',
  NOT_FOUND:                 'NOT_FOUND',
  INTERNAL_ERROR:            'INTERNAL_ERROR',
  RATE_LIMITED:              'RATE_LIMITED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ------------------------------------------------------------
// Route / Deep-link Paths
// ------------------------------------------------------------

export const ROUTES = {
  // Auth
  SIGN_IN:              '/auth/sign-in',
  SIGN_UP:              '/auth/sign-up',
  FORGOT_PASSWORD:      '/auth/forgot-password',

  // Onboarding
  ONBOARDING_PROFILE:   '/onboarding/profile',
  ONBOARDING_QUESTIONS: '/onboarding/questionnaire',
  ONBOARDING_AVAILABILITY: '/onboarding/availability',

  // Main app
  HOME:                 '/home',
  MY_GROUP:             '/group',
  GROUP_CHAT:           '/group/chat',
  GROUP_VOTE:           '/group/vote',
  PROFILE:              '/profile',
  SETTINGS:             '/settings',
  SUBSCRIPTION:         '/settings/subscription',
} as const;

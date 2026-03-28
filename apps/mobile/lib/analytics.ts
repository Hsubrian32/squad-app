/**
 * Analytics module — lightweight funnel event tracker.
 *
 * Works out of the box (logs to console in __DEV__).
 * Wire a real SDK by filling in the TODO sections below — all call sites
 * across the app stay unchanged.
 *
 * Recommended SDK: PostHog React Native
 *   npm install posthog-react-native
 *   https://posthog.com/docs/libraries/react-native
 *
 * Alternative: Mixpanel, Amplitude, or Segment.
 */

// ---------------------------------------------------------------------------
// Event catalogue — add new events here to keep them typo-safe
// ---------------------------------------------------------------------------

export type AnalyticsEvent =
  // Auth funnel
  | 'sign_up_started'
  | 'sign_up_completed'
  | 'sign_in_completed'
  | 'sign_out'
  // Onboarding funnel
  | 'onboarding_step_completed'
  | 'onboarding_completed'
  // Availability
  | 'availability_saved'
  | 'availability_updated'
  // Group experience
  | 'group_viewed'
  | 'rsvp_updated'
  | 'arrival_status_updated'
  | 'check_in_completed'
  | 'stay_vote_submitted'
  // Chat
  | 'message_sent'
  // Meetup map
  | 'map_opened'
  | 'venue_switch_proposed'
  | 'venue_switch_voted'
  // Feedback
  | 'feedback_started'
  | 'feedback_completed'
  // Post-event
  | 'post_event_review_submitted'
  | 'stay_leave_decision_submitted'
  // Matching
  | 'manual_opt_in'
  // Groups page
  | 'groups_page_viewed'
  // Safety
  | 'user_reported'
  | 'user_blocked';

export type EventProperties = Record<string, string | number | boolean | null | undefined>;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _userId: string | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Call once after a successful sign-in or sign-up to associate subsequent
 * events with this user.
 */
export function identifyUser(userId: string, traits?: EventProperties): void {
  _userId = userId;

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[Analytics] identify', { userId, ...traits });
  }

  // TODO — PostHog:
  // posthog.identify(userId, traits);

  // TODO — Mixpanel:
  // Mixpanel.identify(userId);
  // if (traits) Mixpanel.getPeople().set(traits);
}

/**
 * Call after sign-out to disassociate the current user.
 */
export function resetAnalyticsUser(): void {
  _userId = null;

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[Analytics] reset');
  }

  // TODO — PostHog: posthog.reset();
  // TODO — Mixpanel: Mixpanel.reset();
}

/**
 * Track a named event with optional properties.
 * Safe to call before identifyUser() — events are still captured.
 */
export function track(event: AnalyticsEvent, properties?: EventProperties): void {
  const payload: EventProperties = {
    ...properties,
    ..._userId ? { user_id: _userId } : {},
    client_ts: new Date().toISOString(),
  };

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[Analytics] ${event}`, payload);
    return; // In dev, skip the SDK calls to avoid polluting production data
  }

  // TODO — PostHog:
  // posthog.capture(event, payload);

  // TODO — Mixpanel:
  // Mixpanel.track(event, payload);

  // TODO — Amplitude:
  // amplitude.track(event, payload);
}

/**
 * Track a screen view. Call from screen components or navigation listeners.
 */
export function trackScreen(screenName: string, properties?: EventProperties): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[Analytics] screen: ${screenName}`, properties);
    return;
  }

  // TODO — PostHog: posthog.screen(screenName, properties);
}

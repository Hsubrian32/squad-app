import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, nextMonday, differenceInDays, differenceInHours, isPast } from 'date-fns';
import { useAuth } from '../../store/authStore';
import { useGroup } from '../../store/groupStore';
import { GroupCard } from '../../components/GroupCard';
import { checkInToGroup, getMyDecision } from '../../lib/api/groups';
import { optInToCurrentCycle } from '../../lib/api/matching';
import { Colors, Spacing, Radius, Typography } from '../../constants/theme';
import { track } from '../../lib/analytics';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUCCESS_GREEN = '#10B981';
const SUCCESS_GREEN_LIGHT = 'rgba(16, 185, 129, 0.15)';
const SUCCESS_GREEN_BORDER = 'rgba(16, 185, 129, 0.35)';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNextMatchingCountdown(): string {
  const now = new Date();
  const next = nextMonday(now);
  const days = differenceInDays(next, now);
  const hours = differenceInHours(next, now);

  if (days > 1) return `${days} days`;
  if (hours > 1) return `${hours} hours`;
  return 'very soon';
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { currentGroup, isLoading, fetchGroup } = useGroup();
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [optInLoading, setOptInLoading] = useState(false);
  const [hasSubmittedDecision, setHasSubmittedDecision] = useState(false);

  const { refreshProfile } = useAuth();

  const loadGroup = useCallback(async () => {
    if (user) {
      await fetchGroup(user.id);
      await refreshProfile();
    }
  }, [user, fetchGroup, refreshProfile]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  const hasActiveGroup =
    currentGroup != null &&
    (currentGroup.status === 'active' || currentGroup.status === 'forming');

  // Find current user's member entry
  const myMember = currentGroup?.members?.find((m) => m.user_id === user?.id);
  const isCheckedIn = myMember?.checked_in === true;

  // Check-in counts (only for active groups)
  const checkedInCount =
    currentGroup?.members?.filter((m) => m.checked_in).length ?? 0;
  const totalMembers = currentGroup?.members?.length ?? 0;

  // Post-event: has the scheduled time passed and user checked in?
  const eventTimePassed =
    currentGroup?.scheduled_time && isPast(new Date(currentGroup.scheduled_time));
  const needsPostEventReview = isCheckedIn && eventTimePassed && !hasSubmittedDecision;

  // Check if user already submitted decision for this group
  useEffect(() => {
    if (!user || !currentGroup?.id) return;
    // Use a simple event_id placeholder — in production this would be the actual event_id
    getMyDecision(currentGroup.id, user.id).then(({ data }) => {
      if (data) setHasSubmittedDecision(true);
    });
  }, [user, currentGroup?.id]);

  async function handleJoinPool() {
    if (!user) return;
    setOptInLoading(true);
    try {
      const { error } = await optInToCurrentCycle(user.id);
      if (error) {
        console.warn('[home] opt-in failed:', error);
      }
      track('manual_opt_in', { source: 'home_screen' });
      await refreshProfile();
    } finally {
      setOptInLoading(false);
    }
  }

  async function handleCheckIn() {
    if (!user || !currentGroup) return;
    setCheckInLoading(true);
    setCheckInError(null);
    try {
      const { error } = await checkInToGroup(currentGroup.id, user.id);
      if (error) {
        setCheckInError(error);
        return;
      }
      track('check_in_completed', { group_id: currentGroup.id });
      await fetchGroup(user.id);
    } finally {
      setCheckInLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadGroup}
            tintColor={Colors.accent}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Hey {profile?.first_name ?? profile?.display_name?.split(' ')[0] ?? 'there'} 👋
            </Text>
            <Text style={styles.headerSubtitle}>
              {hasActiveGroup ? "You've been matched!" : profile?.matching_status === 'waiting_for_match' ? "You're in the queue" : "Let's find your group"}
            </Text>
          </View>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>S</Text>
          </View>
        </View>

        {hasActiveGroup && currentGroup ? (
          // ----------------------------------------------------------------
          // Active group view
          // ----------------------------------------------------------------
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>This Week's Group</Text>

            {/* Check-in card — only when event is fully active */}
            {currentGroup.status === 'active' && (
              isCheckedIn ? (
                // Success state
                <View style={styles.checkedInCard}>
                  <View style={styles.checkedInIconRow}>
                    <View style={styles.checkedInIconWrapper}>
                      <Ionicons name="checkmark-circle" size={28} color={SUCCESS_GREEN} />
                    </View>
                    <View style={styles.checkedInTextGroup}>
                      <Text style={styles.checkedInTitle}>You're checked in!</Text>
                      <Text style={styles.checkedInSubtitle}>
                        Welcome to your group. Full profiles are now unlocked.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.checkedInCountRow}>
                    <Ionicons name="people-outline" size={14} color={SUCCESS_GREEN} />
                    <Text style={styles.checkedInCountText}>
                      {checkedInCount} of {totalMembers} members checked in
                    </Text>
                  </View>

                  {/* Post-event review prompt */}
                  {needsPostEventReview && (
                    <TouchableOpacity
                      style={styles.postEventPrompt}
                      onPress={() =>
                        router.push({
                          pathname: '/(app)/post-event',
                          params: { groupId: currentGroup.id, eventId: currentGroup.id },
                        })
                      }
                      activeOpacity={0.8}
                    >
                      <Ionicons name="star" size={18} color={Colors.accent} />
                      <Text style={styles.postEventPromptText}>
                        How was the meetup? Rate & review
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                // Not yet checked in
                <View style={styles.checkInCard}>
                  <View style={styles.checkInIconWrapper}>
                    <Text style={styles.checkInEmoji}>📍</Text>
                  </View>
                  <Text style={styles.checkInTitle}>You're almost there!</Text>
                  <Text style={styles.checkInSubtitle}>
                    Check in when you arrive at the venue to unlock your group's full profiles
                  </Text>

                  {checkInError != null && (
                    <View style={styles.errorRow}>
                      <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
                      <Text style={styles.errorText}>{checkInError}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.checkInButton, checkInLoading && styles.checkInButtonDisabled]}
                    onPress={handleCheckIn}
                    disabled={checkInLoading}
                    activeOpacity={0.8}
                  >
                    {checkInLoading ? (
                      <ActivityIndicator size="small" color={Colors.textPrimary} />
                    ) : (
                      <>
                        <Ionicons name="location" size={18} color={Colors.textPrimary} />
                        <Text style={styles.checkInButtonText}>Check In Now</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )
            )}

            <GroupCard
              group={currentGroup}
              onPress={() => router.push('/(app)/group')}
            />
            <TouchableOpacity
              style={styles.chatButton}
              onPress={() => router.push('/(app)/chat')}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubbles-outline" size={18} color={Colors.accent} />
              <Text style={styles.chatButtonText}>Open Group Chat</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : (
          // ----------------------------------------------------------------
          // Waiting / no group view
          // ----------------------------------------------------------------
          <>
            {/* Status card — differs based on matching_status */}
            {profile?.matching_status === 'waiting_for_match' ||
            profile?.matching_status === 'matched' ||
            profile?.matching_status === 'attending' ? (
              <View style={styles.statusCard}>
                <View style={styles.statusIconWrapper}>
                  <Ionicons name="time-outline" size={32} color={Colors.accent} />
                </View>
                <Text style={styles.statusTitle}>You're in the pool</Text>
                <Text style={styles.statusSubtitle}>
                  Matching happens every Monday. We'll notify you when your group is ready.
                </Text>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusBadgeText}>In Queue</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.statusCard, styles.statusCardIdle]}>
                <View style={[styles.statusIconWrapper, styles.statusIconWrapperIdle]}>
                  <Ionicons name="people-outline" size={32} color={Colors.accent} />
                </View>
                <Text style={styles.statusTitle}>Ready to meet up?</Text>
                <Text style={styles.statusSubtitle}>
                  Join this week's matching pool and we'll pair you with a group for a real-life hangout.
                </Text>
                <TouchableOpacity
                  style={styles.joinPoolButton}
                  onPress={handleJoinPool}
                  disabled={optInLoading}
                  activeOpacity={0.8}
                >
                  {optInLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="add-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.joinPoolButtonText}>Join the Pool</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Countdown */}
            <View style={styles.countdownCard}>
              <Text style={styles.countdownLabel}>Next matching in</Text>
              <Text style={styles.countdownValue}>{getNextMatchingCountdown()}</Text>
              <Text style={styles.countdownDate}>
                {format(nextMonday(new Date()), 'EEEE, MMMM d')}
              </Text>
            </View>

            {/* How it works */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>How Squad Works</Text>
              <HowItWorksStep
                number="1"
                title="Get Matched"
                description="Every week we match you with 6–8 people based on your interests and availability."
              />
              <HowItWorksStep
                number="2"
                title="Meet Up"
                description="We pick a curated spot in your city — a hidden bar, rooftop, or local gem. Show up, check in, and vibe."
              />
              <HowItWorksStep
                number="3"
                title="Stay or Explore"
                description="After the meetup, decide if you want to keep your group or get matched with new people next week."
              />
              <HowItWorksStep
                number="4"
                title="Unlock More Groups"
                description="After your first meetup, join up to 3 groups on different days. Find your people through real experiences."
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HowItWorksStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDescription}>{description}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  greeting: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMarkText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  // -------------------------------------------------------------------------
  // Check-in card (not yet checked in)
  // -------------------------------------------------------------------------
  checkInCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: SUCCESS_GREEN_BORDER,
    alignItems: 'center',
  },
  checkInIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: SUCCESS_GREEN_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  checkInEmoji: {
    fontSize: 28,
  },
  checkInTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  checkInSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.error,
    flexShrink: 1,
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SUCCESS_GREEN,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    width: '100%',
    minHeight: 48,
  },
  checkInButtonDisabled: {
    opacity: 0.6,
  },
  checkInButtonText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  // -------------------------------------------------------------------------
  // Checked-in success card
  // -------------------------------------------------------------------------
  checkedInCard: {
    backgroundColor: SUCCESS_GREEN_LIGHT,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: SUCCESS_GREEN_BORDER,
    gap: Spacing.sm,
  },
  checkedInIconRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  checkedInIconWrapper: {
    marginTop: 2,
    flexShrink: 0,
  },
  checkedInTextGroup: {
    flex: 1,
    gap: 2,
  },
  checkedInTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  checkedInSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  checkedInCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: SUCCESS_GREEN_BORDER,
  },
  checkedInCountText: {
    ...Typography.label,
    color: SUCCESS_GREEN,
  },
  postEventPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: SUCCESS_GREEN_BORDER,
  },
  postEventPromptText: {
    ...Typography.body,
    color: Colors.accent,
    fontWeight: '600',
    flex: 1,
  },
  // -------------------------------------------------------------------------
  // Chat button
  // -------------------------------------------------------------------------
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  chatButtonText: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    fontWeight: '500',
  },
  // -------------------------------------------------------------------------
  // Status card (no group / waiting)
  // -------------------------------------------------------------------------
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  statusTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  statusSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.full,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },
  statusBadgeText: {
    ...Typography.label,
    color: Colors.accent,
  },
  statusCardIdle: {
    borderColor: Colors.border,
    opacity: 0.85,
  },
  statusIconWrapperIdle: {
    backgroundColor: Colors.surface,
  },
  statusBadgeIdle: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statusDotIdle: {
    backgroundColor: Colors.textTertiary,
  },
  statusBadgeTextIdle: {
    color: Colors.textSecondary,
  },
  joinPoolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    minHeight: 48,
  },
  joinPoolButtonText: {
    ...Typography.label,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // -------------------------------------------------------------------------
  // Countdown
  // -------------------------------------------------------------------------
  countdownCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countdownLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  countdownValue: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.accent,
    marginBottom: 2,
  },
  countdownDate: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  // -------------------------------------------------------------------------
  // How it works steps
  // -------------------------------------------------------------------------
  stepRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  stepNumberText: {
    ...Typography.label,
    color: Colors.accent,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  stepDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
});

import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { format, isPast, parseISO } from 'date-fns';
import { useAuth } from '../../store/authStore';
import { useGroup } from '../../store/groupStore';
import { updateRsvp, updateArrivalStatus, submitStayVote, getGroupById } from '../../lib/api/groups';
import { joinDemoGroup } from '../../lib/api/dev';
import { reportUser, blockUser, REPORT_REASON_LABELS, type ReportReason } from '../../lib/api/safety';
import { track } from '../../lib/analytics';
import { MemberRow } from '../../components/MemberRow';
import type { RsvpStatus, ArrivalStatus } from '../../constants/types';
import { Colors, Spacing, Radius, Typography } from '../../constants/theme';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUCCESS_GREEN = '#10B981';
const SUCCESS_GREEN_LIGHT = 'rgba(16, 185, 129, 0.15)';
const SUCCESS_GREEN_BORDER = 'rgba(16, 185, 129, 0.35)';

interface ArrivalOption {
  status: ArrivalStatus;
  icon: string;
  label: string;
  color: string;
  bgColor: string;
  shadowColor: string;
  /** Implicit RSVP mapping */
  rsvp: RsvpStatus;
}

const ARRIVAL_OPTIONS: ArrivalOption[] = [
  {
    status: 'on_the_way',
    icon: '🚶',
    label: 'On the way',
    color: '#60A5FA',
    bgColor: 'rgba(96,165,250,0.12)',
    shadowColor: 'rgba(96,165,250,0.4)',
    rsvp: 'yes',
  },
  {
    status: 'arrived',
    icon: '✅',
    label: "I'm here!",
    color: SUCCESS_GREEN,
    bgColor: SUCCESS_GREEN_LIGHT,
    shadowColor: 'rgba(16,185,129,0.4)',
    rsvp: 'yes',
  },
  {
    status: 'running_late',
    icon: '⏰',
    label: 'Running late',
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.12)',
    shadowColor: 'rgba(245,158,11,0.4)',
    rsvp: 'maybe',
  },
  {
    status: 'cant_make_it',
    icon: '❌',
    label: "Can't make it",
    color: '#F87171',
    bgColor: 'rgba(248,113,113,0.12)',
    shadowColor: 'rgba(248,113,113,0.4)',
    rsvp: 'no',
  },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function GroupScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id: groupIdParam } = useLocalSearchParams<{ id?: string }>();
  const { currentGroup, isLoading, fetchGroup } = useGroup();

  // When an explicit group ID is passed via query param, fetch that group directly
  const [specificGroup, setSpecificGroup] = useState<import('../../constants/types').Group | null>(null);
  const [specificGroupLoading, setSpecificGroupLoading] = useState(false);

  const [arrivalStatus, setArrivalStatus] = useState<ArrivalStatus | null>(null);
  const [arrivalLoading, setArrivalLoading] = useState(false);

  // DEV ONLY ─────────────────────────────────────────────────────────────────
  const [devJoining, setDevJoining] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);

  async function handleJoinDemoGroup() {
    if (!user) return;
    setDevJoining(true);
    setDevError(null);
    const { error } = await joinDemoGroup(user.id);
    if (error) {
      setDevError(error);
      setDevJoining(false);
      return;
    }
    // Reload the group — should now find the demo group
    await fetchGroup(user.id);
    setDevJoining(false);
  }
  // ──────────────────────────────────────────────────────────────────────────
  const [arrivalError, setArrivalError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<ArrivalStatus | null>(null);

  // Keep for backwards compat — not shown in UI but called in background
  const [voteLoading, setVoteLoading] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [voteSuccess, setVoteSuccess] = useState<string | null>(null);

  const loadGroup = useCallback(async () => {
    if (groupIdParam) {
      setSpecificGroupLoading(true);
      const { data, error } = await getGroupById(groupIdParam);
      if (!error && data) setSpecificGroup(data);
      setSpecificGroupLoading(false);
    } else if (user) {
      await fetchGroup(user.id);
    }
  }, [user, fetchGroup, groupIdParam]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  // Resolve which group to display: specific (from param) or current (from store)
  const displayGroup = groupIdParam ? specificGroup : currentGroup;
  const displayLoading = groupIdParam ? specificGroupLoading : isLoading;

  // Sync local arrivalStatus from server data
  useEffect(() => {
    if (!displayGroup || !user) return;
    const members = displayGroup.members ?? [];
    const me = members.find((m) => m.user_id === user.id);
    setArrivalStatus(me?.arrival_status ?? null);
  }, [displayGroup, user]);

  if (displayLoading && !displayGroup) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!displayGroup) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={56} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>No active group</Text>
          <Text style={styles.emptySubtitle}>
            Your group will appear here once you're matched.
          </Text>

          {/* ── DEV ONLY: join the seeded demo group instantly ───────────── */}
          {__DEV__ && (
            <View style={styles.devPanel}>
              <View style={styles.devBadgeRow}>
                <Text style={styles.devBadge}>🧪 DEV</Text>
              </View>
              <Text style={styles.devPanelTitle}>Test matched experience</Text>
              <Text style={styles.devPanelBody}>
                Join the seeded "Night Owls" demo group to preview the Group tab,
                meetup map, and chat without waiting for live matching.
              </Text>

              {devError != null && (
                <Text style={styles.devError}>{devError}</Text>
              )}

              <TouchableOpacity
                style={[styles.devButton, devJoining && styles.devButtonDisabled]}
                onPress={handleJoinDemoGroup}
                disabled={devJoining}
                activeOpacity={0.8}
              >
                {devJoining ? (
                  <ActivityIndicator size="small" color="#0C0C1A" />
                ) : (
                  <Text style={styles.devButtonText}>⚡ Join demo group</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
          {/* ─────────────────────────────────────────────────────────────── */}
        </View>
      </SafeAreaView>
    );
  }

  const venue = displayGroup.venue;
  const members = displayGroup.members ?? [];
  const me = members.find((m) => m.user_id === user?.id);

  const scheduledTime = displayGroup.scheduled_time
    ? parseISO(displayGroup.scheduled_time)
    : null;
  const eventIsPast = scheduledTime ? isPast(scheduledTime) : false;

  // Past groups (completed or dissolved) always show full profiles —
  // the meetup already happened so there's no more mystery to preserve.
  const isPastGroup =
    displayGroup.status === 'completed' || displayGroup.status === 'dissolved';

  // Arrival stats
  const arrivedCount = members.filter(
    (m) => m.arrival_status === 'arrived' || m.checked_in
  ).length;
  const onTheWayCount = members.filter(
    (m) => m.arrival_status === 'on_the_way'
  ).length;

  // ---- Handlers ----

  async function handleArrivalStatus(option: ArrivalOption) {
    if (!user || !displayGroup) return;
    setArrivalLoading(true);
    setArrivalError(null);
    setSavingStatus(option.status);

    // Optimistic update
    setArrivalStatus(option.status);

    try {
      const { error: arrivalErr } = await updateArrivalStatus(
        displayGroup.id,
        user.id,
        option.status
      );
      if (arrivalErr) {
        setArrivalError(arrivalErr);
        // Revert on failure
        setArrivalStatus(me?.arrival_status ?? null);
        return;
      }

      // Background RSVP sync — fire-and-forget, ignore errors
      updateRsvp(displayGroup.id, user.id, option.rsvp).catch(() => undefined);

      await loadGroup();
    } finally {
      setArrivalLoading(false);
      setSavingStatus(null);
    }
  }

  // Show a reason picker then submit the report
  function handleReportMember(memberId: string, memberNickname: string) {
    if (!user || !displayGroup) return;
    if (memberId === user.id) return; // can't report yourself

    const reasons = Object.entries(REPORT_REASON_LABELS) as [ReportReason, string][];

    Alert.alert(
      `Report ${memberNickname}`,
      "What's the issue? We review every report.",
      [
        ...reasons.map(([reason, label]) => ({
          text: label,
          onPress: async () => {
            Alert.alert(
              'Submit report?',
              `This will flag ${memberNickname} for "${label}". Our team will review it.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Report',
                  style: 'destructive',
                  onPress: async () => {
                    const { error } = await reportUser({
                      reporterId: user.id,
                      reportedId: memberId,
                      groupId: displayGroup.id,
                      reason,
                    });
                    track('user_reported', { reason, group_id: displayGroup.id });
                    Alert.alert(
                      error ? 'Could not submit report' : 'Report submitted',
                      error ?? 'Thanks — our team will review this.',
                      [{ text: 'OK' }]
                    );
                  },
                },
              ]
            );
          },
        })),
        { text: 'Block this person', style: 'destructive', onPress: () => confirmBlock(memberId, memberNickname) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  function confirmBlock(memberId: string, memberNickname: string) {
    if (!user) return;
    Alert.alert(
      `Block ${memberNickname}?`,
      'You won\'t be matched with them again and they won\'t see your profile.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            await blockUser(user.id, memberId);
            track('user_blocked', { group_id: displayGroup?.id });
            Alert.alert('Blocked', `${memberNickname} has been blocked.`);
          },
        },
      ]
    );
  }

  async function handleStayVote(stay: boolean) {
    if (!user || !displayGroup) return;
    setVoteLoading(true);
    setVoteError(null);
    setVoteSuccess(null);
    try {
      const { error } = await submitStayVote(displayGroup.id, user.id, stay);
      if (error) {
        setVoteError(error);
        return;
      }
      setVoteSuccess(
        stay
          ? "You're staying! Have a great time!"
          : "We've recorded your vote. See you next week!"
      );
      await loadGroup();
    } finally {
      setVoteLoading(false);
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
        {/* Group header */}
        <View style={styles.groupHeader}>
          <View style={styles.groupHeaderLeft}>
            <Text style={styles.groupName}>
              {displayGroup.name ?? 'Your Group'}
            </Text>
            {/* Arrival stats */}
            <View style={styles.checkInStat}>
              {arrivedCount === 0 && onTheWayCount === 0 ? (
                <>
                  <Ionicons
                    name="walk-outline"
                    size={14}
                    color={Colors.textTertiary}
                  />
                  <Text style={styles.checkInStatText}>
                    Be the first to check in!
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={arrivedCount > 0 ? SUCCESS_GREEN : Colors.textTertiary}
                  />
                  <Text
                    style={[
                      styles.checkInStatText,
                      arrivedCount > 0 && styles.checkInStatTextActive,
                    ]}
                  >
                    {arrivedCount} arrived
                    {onTheWayCount > 0 ? ` · ${onTheWayCount} on the way` : ''}
                  </Text>
                </>
              )}
            </View>
          </View>
          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    displayGroup.status === 'active'
                      ? Colors.success
                      : Colors.warning,
                },
              ]}
            />
            <Text style={styles.statusPillText}>
              {displayGroup.status === 'active' ? 'Active' : 'Forming'}
            </Text>
          </View>
        </View>

        {/* Venue card */}
        {venue && (
          <View style={styles.venueCard}>
            <View style={styles.venueIconWrapper}>
              <Ionicons name="location" size={22} color={Colors.accent} />
            </View>
            <View style={styles.venueInfo}>
              <Text style={styles.venueName}>{venue.name}</Text>
              <Text style={styles.venueAddress}>{venue.address}</Text>
              {venue.neighborhood && (
                <Text style={styles.venueCity}>{venue.neighborhood}</Text>
              )}
              {/* Original venue badge */}
              {displayGroup.venue_id === venue.id && (
                <View style={styles.originalVenueBadge}>
                  <Text style={styles.originalVenueBadgeText}>
                    📍 Original venue
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Scheduled time */}
        {scheduledTime && (
          <View style={styles.timeCard}>
            <Ionicons name="calendar-outline" size={18} color={Colors.accent} />
            <Text style={styles.timeText}>
              {format(scheduledTime, "EEEE, MMMM d 'at' h:mm a")}
            </Text>
          </View>
        )}

        {/* Map button — only shown when the group has a venue with coordinates */}
        {(displayGroup.status === 'active' || displayGroup.status === 'forming') &&
          venue != null && (venue as any).lat != null && (
          <TouchableOpacity
            style={styles.mapButton}
            onPress={() => router.push('/(app)/meetup-map')}
            activeOpacity={0.85}
          >
            <Ionicons name="map-outline" size={20} color={Colors.accent} />
            <View style={styles.mapButtonText}>
              <Text style={styles.mapButtonTitle}>Open meetup map</Text>
              <Text style={styles.mapButtonSub}>
                {venue ? venue.address : 'See live locations & check in'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}

        {/* Members */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Members ({members.length})
          </Text>

          {/* Privacy notice — only shown for active groups, not past ones */}
          {!isPastGroup && (
            <View style={styles.privacyNotice}>
              <Text style={styles.privacyNoticeText}>
                🔒 Real names revealed when members check in at the venue
              </Text>
            </View>
          )}

          {members.map((member) => {
            const isCurrentUser = member.user_id === user?.id;
            const displayName = member.profile?.nickname ?? member.profile?.first_name ?? member.profile?.display_name ?? 'Member';
            return (
              <TouchableOpacity
                key={member.id}
                activeOpacity={1}
                onLongPress={
                  isCurrentUser
                    ? undefined
                    : () => handleReportMember(member.user_id, displayName)
                }
                delayLongPress={600}
              >
                <MemberRow
                  member={member}
                  isCurrentUser={isCurrentUser}
                  isPastGroup={isPastGroup}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Arrival status section — replaces old RSVP buttons */}
        {!eventIsPast && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How's it going?</Text>

            {arrivalError != null && (
              <View style={styles.inlineError}>
                <Ionicons
                  name="alert-circle-outline"
                  size={14}
                  color={Colors.error}
                />
                <Text style={styles.inlineErrorText}>{arrivalError}</Text>
              </View>
            )}

            <View style={styles.arrivalGrid}>
              {ARRIVAL_OPTIONS.map((option) => {
                const isSelected = arrivalStatus === option.status;
                const isSaving =
                  arrivalLoading && savingStatus === option.status;
                return (
                  <TouchableOpacity
                    key={option.status}
                    style={[
                      styles.arrivalButton,
                      isSelected && {
                        borderColor: option.color,
                        backgroundColor: option.bgColor,
                        shadowColor: option.shadowColor,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.6,
                        shadowRadius: 8,
                        elevation: 4,
                      },
                    ]}
                    onPress={() => handleArrivalStatus(option)}
                    disabled={arrivalLoading}
                    activeOpacity={0.75}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color={option.color} />
                    ) : (
                      <Text style={styles.arrivalButtonIcon}>{option.icon}</Text>
                    )}
                    <Text
                      style={[
                        styles.arrivalButtonLabel,
                        isSelected && { color: option.color, fontWeight: '600' },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Stay/Leave vote — shown after event */}
        {eventIsPast && (
          <View style={styles.section}>
            <View style={styles.voteCard}>
              <Text style={styles.voteTitle}>Vote to stay or head out?</Text>
              <Text style={styles.voteSubtitle}>
                Let your group know if you want to keep the night going.
              </Text>

              {voteError != null && (
                <View style={styles.inlineError}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={14}
                    color={Colors.error}
                  />
                  <Text style={styles.inlineErrorText}>{voteError}</Text>
                </View>
              )}

              {voteSuccess != null && (
                <View style={styles.inlineSuccess}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={14}
                    color={SUCCESS_GREEN}
                  />
                  <Text style={styles.inlineSuccessText}>{voteSuccess}</Text>
                </View>
              )}

              <View style={styles.voteButtons}>
                <TouchableOpacity
                  style={[styles.voteButton, styles.voteButtonStay]}
                  onPress={() => handleStayVote(true)}
                  disabled={voteLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.voteButtonText}>Stay 🎉</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.voteButton, styles.voteButtonLeave]}
                  onPress={() => handleStayVote(false)}
                  disabled={voteLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.voteButtonText}>Head out 🏡</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  // -------------------------------------------------------------------------
  // Dev panel (DEV mode only — never shown in production)
  // -------------------------------------------------------------------------
  devPanel: {
    marginTop: Spacing.xl,
    width: '100%',
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderStyle: 'dashed',
  },
  devBadgeRow: {
    flexDirection: 'row',
  },
  devBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    overflow: 'hidden',
    letterSpacing: 0.5,
  },
  devPanelTitle: {
    ...Typography.h4,
    color: '#F59E0B',
    marginTop: 2,
  },
  devPanelBody: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  devError: {
    ...Typography.bodySmall,
    color: Colors.error,
  },
  devButton: {
    marginTop: Spacing.xs,
    backgroundColor: '#F59E0B',
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devButtonDisabled: {
    opacity: 0.6,
  },
  devButtonText: {
    ...Typography.body,
    color: '#0C0C1A',
    fontWeight: '700',
  },
  // -------------------------------------------------------------------------
  // Group header
  // -------------------------------------------------------------------------
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  groupHeaderLeft: {
    flex: 1,
    gap: 4,
  },
  groupName: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  checkInStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkInStatText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  checkInStatTextActive: {
    color: SUCCESS_GREEN,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    flexShrink: 0,
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  statusPillText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  // -------------------------------------------------------------------------
  // Venue
  // -------------------------------------------------------------------------
  venueCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  venueIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  venueInfo: {
    flex: 1,
    gap: 2,
  },
  venueName: {
    ...Typography.h4,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  venueAddress: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  venueCity: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
  originalVenueBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.25)',
  },
  originalVenueBadgeText: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '500',
  },
  // -------------------------------------------------------------------------
  // Time / map
  // -------------------------------------------------------------------------
  timeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  timeText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  mapPlaceholder: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  mapPlaceholderText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  mapPlaceholderHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mapButtonText: {
    flex: 1,
  },
  mapButtonTitle: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: 2,
  },
  mapButtonSub: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  // -------------------------------------------------------------------------
  // Members section
  // -------------------------------------------------------------------------
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  privacyNotice: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  privacyNoticeText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  // -------------------------------------------------------------------------
  // Arrival status grid
  // -------------------------------------------------------------------------
  arrivalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  arrivalButton: {
    // 2×2 grid: each button takes ~half width minus gap
    width: '47.5%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.xs,
    minHeight: 72,
  },
  arrivalButtonIcon: {
    fontSize: 22,
  },
  arrivalButtonLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  // -------------------------------------------------------------------------
  // Inline feedback
  // -------------------------------------------------------------------------
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  inlineErrorText: {
    ...Typography.bodySmall,
    color: Colors.error,
    flexShrink: 1,
  },
  inlineSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: SUCCESS_GREEN_LIGHT,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  inlineSuccessText: {
    ...Typography.bodySmall,
    color: SUCCESS_GREEN,
    flexShrink: 1,
  },
  // -------------------------------------------------------------------------
  // Stay / leave vote
  // -------------------------------------------------------------------------
  voteCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  voteTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  voteSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 21,
  },
  voteButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  voteButton: {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  voteButtonStay: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  voteButtonLeave: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  voteButtonText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
});

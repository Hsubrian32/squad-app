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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { track } from '../../lib/analytics';
import type { UserGroupHistoryEntry } from '../../constants/types';
import { Colors, Spacing, Radius, Typography } from '../../constants/theme';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_NAMES_FULL: Record<number, string> = {
  0: 'Sundays',
  1: 'Mondays',
  2: 'Tuesdays',
  3: 'Wednesdays',
  4: 'Thursdays',
  5: 'Fridays',
  6: 'Saturdays',
};

type StatusPillConfig = {
  label: string;
  color: string;
  bg: string;
};

function getActiveStatusPill(entry: UserGroupHistoryEntry): StatusPillConfig {
  if (!entry.scheduled_time) {
    return { label: 'Forming', color: Colors.warning, bg: Colors.warningLight };
  }
  const now = new Date();
  const scheduled = parseISO(entry.scheduled_time);
  const diffMs = scheduled.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 7 && diffDays >= 0) {
    return { label: 'This Week', color: Colors.accent, bg: Colors.accentLight };
  }
  return { label: 'Upcoming', color: Colors.success, bg: Colors.successLight };
}

type PastStatusConfig = {
  label: string;
  color: string;
  bg: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

function getPastStatusConfig(status: UserGroupHistoryEntry['display_status']): PastStatusConfig {
  switch (status) {
    case 'completed':
      return { label: 'Completed', color: '#10B981', bg: 'rgba(16,185,129,0.15)', icon: 'checkmark-circle' };
    case 'left':
      return { label: 'Left', color: Colors.textTertiary, bg: 'rgba(85,85,85,0.15)', icon: 'exit-outline' };
    case 'dissolved':
      return { label: 'Dissolved', color: Colors.error, bg: Colors.errorLight, icon: 'close-circle' };
    case 'no_show':
      return { label: 'No-show', color: Colors.warning, bg: Colors.warningLight, icon: 'alert-circle' };
    default:
      return { label: 'Past', color: Colors.textTertiary, bg: 'rgba(85,85,85,0.15)', icon: 'time-outline' };
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function GroupsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [entries, setEntries] = useState<UserGroupHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGroups = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('user_group_history')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_section', { ascending: true })
        .order('sort_date', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        return;
      }
      setEntries(data ?? []);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load groups');
    }
  }, [user]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGroups();
    setRefreshing(false);
  }, [fetchGroups]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await fetchGroups();
      setIsLoading(false);
    })();
  }, [fetchGroups]);

  useEffect(() => {
    track('groups_page_viewed');
  }, []);

  // Split into active (sort_section = 1) and past (sort_section = 2)
  const activeGroups = entries.filter((e) => e.sort_section === 1);
  const pastGroups = entries.filter((e) => e.sort_section === 2);

  // -- Loading state --
  if (isLoading && entries.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // -- Error state --
  if (error && entries.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh} activeOpacity={0.8}>
            <Ionicons name="refresh-outline" size={18} color={Colors.accent} />
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
          />
        }
      >
        {/* Page title */}
        <Text style={styles.pageTitle}>My Groups</Text>

        {/* ── Active Groups ──────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Groups</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{activeGroups.length}</Text>
          </View>
        </View>

        {activeGroups.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyCardTitle}>No active groups</Text>
            <Text style={styles.emptyCardSubtitle}>
              Join the pool to get matched!
            </Text>
            <TouchableOpacity
              style={styles.emptyCardButton}
              onPress={() => router.push('/(app)/availability-edit')}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={18} color={Colors.accent} />
              <Text style={styles.emptyCardButtonText}>Set your availability</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.activeList}>
            {activeGroups.map((group) => {
              const pill = getActiveStatusPill(group);
              return (
                <TouchableOpacity
                  key={group.group_id}
                  style={styles.activeCard}
                  onPress={() => router.push(`/(app)/group?id=${group.group_id}`)}
                  activeOpacity={0.7}
                >
                  {/* Top row: name + status pill */}
                  <View style={styles.activeCardTop}>
                    <Text style={styles.activeCardName} numberOfLines={1}>
                      {group.group_name ?? 'Your Group'}
                    </Text>
                    <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                      <Text style={[styles.pillText, { color: pill.color }]}>
                        {pill.label}
                      </Text>
                    </View>
                  </View>

                  {/* Day of week */}
                  {group.day_of_week != null && (
                    <View style={styles.activeCardRow}>
                      <Ionicons name="calendar-outline" size={14} color={Colors.textTertiary} />
                      <Text style={styles.activeCardMeta}>
                        Meets on {DAY_NAMES_FULL[group.day_of_week] ?? 'TBD'}
                      </Text>
                    </View>
                  )}

                  {/* Next meetup */}
                  {group.scheduled_time && (
                    <View style={styles.activeCardRow}>
                      <Ionicons name="time-outline" size={14} color={Colors.textTertiary} />
                      <Text style={styles.activeCardMeta}>
                        {format(parseISO(group.scheduled_time), "MMM d 'at' h:mm a")}
                      </Text>
                    </View>
                  )}

                  {/* Venue */}
                  {group.venue_name && (
                    <View style={styles.activeCardRow}>
                      <Ionicons name="location-outline" size={14} color={Colors.textTertiary} />
                      <Text style={styles.activeCardMeta} numberOfLines={1}>
                        {group.venue_name}
                        {group.venue_neighborhood ? ` · ${group.venue_neighborhood}` : ''}
                      </Text>
                    </View>
                  )}

                  {/* Member count */}
                  <View style={styles.activeCardRow}>
                    <Ionicons name="people-outline" size={14} color={Colors.textTertiary} />
                    <Text style={styles.activeCardMeta}>
                      {group.total_events > 0
                        ? `${group.events_attended} of ${group.total_events} meetups attended`
                        : 'New group'}
                    </Text>
                  </View>

                  {/* Chevron */}
                  <View style={styles.activeCardChevron}>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Past Groups ────────────────────────────────────────────── */}
        <View style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
          <Text style={styles.sectionTitle}>Past Groups</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{pastGroups.length}</Text>
          </View>
        </View>

        {pastGroups.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="time-outline" size={36} color={Colors.textTertiary} />
            <Text style={styles.emptyCardSubtitle}>
              Your group history will appear here after your first meetup.
            </Text>
          </View>
        ) : (
          <View style={styles.pastList}>
            {pastGroups.map((group) => {
              const statusCfg = getPastStatusConfig(group.display_status);
              return (
                <View key={group.group_id} style={styles.pastRow}>
                  {/* Left: status icon */}
                  <View style={[styles.pastIconWrapper, { backgroundColor: statusCfg.bg }]}>
                    <Ionicons name={statusCfg.icon} size={18} color={statusCfg.color} />
                  </View>

                  {/* Center: info */}
                  <View style={styles.pastInfo}>
                    <View style={styles.pastNameRow}>
                      <Text style={styles.pastName} numberOfLines={1}>
                        {group.group_name ?? 'Group'}
                      </Text>
                      <View style={[styles.pastStatusBadge, { backgroundColor: statusCfg.bg }]}>
                        <Text style={[styles.pastStatusText, { color: statusCfg.color }]}>
                          {statusCfg.label}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.pastMetaRow}>
                      {group.venue_name && (
                        <>
                          <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
                          <Text style={styles.pastMeta} numberOfLines={1}>
                            {group.venue_name}
                          </Text>
                        </>
                      )}
                    </View>

                    <View style={styles.pastMetaRow}>
                      <Ionicons name="calendar-outline" size={12} color={Colors.textTertiary} />
                      <Text style={styles.pastMeta}>
                        {group.sort_date
                          ? format(parseISO(group.sort_date), 'MMM d, yyyy')
                          : 'Unknown date'}
                      </Text>
                      <Text style={styles.pastMetaDivider}> · </Text>
                      <Text style={styles.pastMeta}>
                        {group.events_attended} {group.events_attended === 1 ? 'meetup' : 'meetups'}
                      </Text>
                      {group.ever_checked_in && (
                        <Ionicons
                          name="checkmark-circle"
                          size={12}
                          color="#10B981"
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },

  // -- Page title --
  pageTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },

  // -- Section headers --
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  countBadge: {
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countBadgeText: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600',
  },

  // -- Empty states --
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyCardTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  emptyCardSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  emptyCardButtonText: {
    ...Typography.label,
    color: Colors.accent,
  },

  // -- Error state --
  errorTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  errorSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  retryButtonText: {
    ...Typography.label,
    color: Colors.accent,
  },

  // -- Active group cards --
  activeList: {
    gap: Spacing.sm,
  },
  activeCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 6,
    position: 'relative',
  },
  activeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    paddingRight: Spacing.lg,
  },
  activeCardName: {
    ...Typography.h4,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  activeCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: Spacing.lg,
  },
  activeCardMeta: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
  },
  activeCardChevron: {
    position: 'absolute',
    right: Spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },

  // -- Status pills --
  pill: {
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillText: {
    ...Typography.caption,
    fontWeight: '600',
  },

  // -- Past group rows --
  pastList: {
    gap: Spacing.xs,
  },
  pastRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
    alignItems: 'center',
  },
  pastIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pastInfo: {
    flex: 1,
    gap: 3,
  },
  pastNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pastName: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  pastStatusBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexShrink: 0,
  },
  pastStatusText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  pastMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pastMeta: {
    ...Typography.caption,
    color: Colors.textTertiary,
    flexShrink: 1,
  },
  pastMetaDivider: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
});

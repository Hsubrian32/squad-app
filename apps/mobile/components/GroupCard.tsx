import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { Avatar } from './ui/Avatar';
import { RsvpBadge } from './ui/Badge';
import type { Group, GroupMember } from '../constants/types';
import { Colors, Spacing, Radius, Typography } from '../constants/theme';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GroupCardProps {
  group: Group;
  onPress?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GroupCard({ group, onPress }: GroupCardProps) {
  const venue = group.venue;
  const members = group.members ?? [];
  const scheduledTime = group.scheduled_time ? parseISO(group.scheduled_time) : null;

  // Show up to 5 member avatars, then a "+N more" indicator
  const visibleMembers = members.slice(0, 5);
  const extraCount = Math.max(0, members.length - 5);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      disabled={!onPress}
    >
      {/* Venue info */}
      <View style={styles.venueRow}>
        <View style={styles.venueIconWrapper}>
          <Ionicons name="location" size={18} color={Colors.accent} />
        </View>
        <View style={styles.venueTextWrapper}>
          <Text style={styles.venueName} numberOfLines={1}>
            {venue?.name ?? 'Venue TBD'}
          </Text>
          {venue?.address && (
            <Text style={styles.venueAddress} numberOfLines={1}>
              {venue.address}
            </Text>
          )}
        </View>
        {onPress && (
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        )}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Scheduled time */}
      {scheduledTime && (
        <View style={styles.timeRow}>
          <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.timeText}>
            {format(scheduledTime, "EEE, MMM d 'at' h:mm a")}
          </Text>
        </View>
      )}

      {/* Members avatars row */}
      <View style={styles.membersRow}>
        <View style={styles.avatarStack}>
          {visibleMembers.map((member, index) => (
            <View
              key={member.id}
              style={[
                styles.avatarWrapper,
                { marginLeft: index === 0 ? 0 : -10, zIndex: visibleMembers.length - index },
              ]}
            >
              <Avatar
                name={member.profile?.first_name ?? member.profile?.display_name ?? '?'}
                imageUrl={member.profile?.avatar_url}
                size="sm"
              />
            </View>
          ))}
          {extraCount > 0 && (
            <View style={styles.extraAvatarBadge}>
              <Text style={styles.extraAvatarText}>+{extraCount}</Text>
            </View>
          )}
        </View>

        {/* RSVP breakdown */}
        <View style={styles.rsvpSummary}>
          <RsvpCountChip
            icon="checkmark-circle"
            color={Colors.success}
            count={members.filter((m) => m.rsvp_status === 'yes').length}
          />
          <RsvpCountChip
            icon="help-circle"
            color={Colors.warning}
            count={members.filter((m) => m.rsvp_status === 'maybe').length}
          />
          <RsvpCountChip
            icon="time-outline"
            color={Colors.textTertiary}
            count={members.filter((m) => m.rsvp_status === 'pending').length}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RsvpCountChip({
  icon,
  color,
  count,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  count: number;
}) {
  if (count === 0) return null;
  return (
    <View style={chipStyles.chip}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[chipStyles.count, { color }]}>{count}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  count: {
    ...Typography.caption,
    fontWeight: '600',
  },
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  venueIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  venueTextWrapper: {
    flex: 1,
  },
  venueName: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  venueAddress: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },
  timeText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    paddingTop: Spacing.sm,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    borderWidth: 2,
    borderColor: Colors.surface,
    borderRadius: 999,
  },
  extraAvatarBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  extraAvatarText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  rsvpSummary: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
});

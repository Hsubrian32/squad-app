import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './ui/Avatar';
import { RsvpBadge } from './ui/Badge';
import type { GroupMember, ArrivalStatus } from '../constants/types';
import { Colors, Spacing, Radius, Typography } from '../constants/theme';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUCCESS_GREEN = '#10B981';
const SUCCESS_GREEN_LIGHT = 'rgba(16, 185, 129, 0.15)';

const ARRIVAL_CONFIG: Record<
  ArrivalStatus,
  { icon: string; label: string; color: string; bgColor: string }
> = {
  on_the_way:   { icon: '🚶', label: 'On the way',    color: '#60A5FA', bgColor: 'rgba(96,165,250,0.15)' },
  arrived:      { icon: '✅', label: 'Arrived',        color: SUCCESS_GREEN, bgColor: SUCCESS_GREEN_LIGHT },
  running_late: { icon: '⏰', label: 'Running late',   color: '#F59E0B', bgColor: 'rgba(245,158,11,0.15)' },
  cant_make_it: { icon: '❌', label: "Can't make it",  color: '#F87171', bgColor: 'rgba(248,113,113,0.15)' },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MemberRowProps {
  member: GroupMember;
  isCurrentUser?: boolean;
  /**
   * Pass true for completed / dissolved groups — full profiles are always
   * visible after a meetup has happened, regardless of check-in state.
   */
  isPastGroup?: boolean;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ArrivalBadge({ status }: { status: ArrivalStatus }) {
  const cfg = ARRIVAL_CONFIG[status];
  return (
    <View style={[styles.arrivalBadge, { backgroundColor: cfg.bgColor }]}>
      <Text style={styles.arrivalBadgeIcon}>{cfg.icon}</Text>
      <Text style={[styles.arrivalBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function VibeTags({ tags }: { tags: string[] }) {
  const visible = tags.slice(0, 3);
  if (visible.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.vibeTagsRow}
    >
      {visible.map((tag) => (
        <View key={tag} style={styles.vibeTag}>
          <Text style={styles.vibeTagText}>{tag}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MemberRow({ member, isCurrentUser = false, isPastGroup = false }: MemberRowProps) {
  const profile = member.profile;

  // Reveal rules:
  //   - Always revealed for the current user (you always see yourself fully)
  //   - Always revealed for past / completed groups (meetup already happened)
  //   - Revealed for active groups once the member has checked in (name_revealed = true)
  const isRevealed = isCurrentUser || isPastGroup || member.name_revealed;

  const nickname = profile?.nickname ?? null;
  const firstName = profile?.first_name ?? null;
  const vibeTags: string[] = profile?.vibe_tags ?? [];
  const intro = profile?.intro ?? null;
  const neighborhood = profile?.neighborhood ?? null;
  const age = profile?.age ?? null;

  // Derive a rough "age range" string, e.g. "mid-20s"
  const ageRange = age != null ? deriveAgeRange(age) : null;

  const cantMakeIt = member.arrival_status === 'cant_make_it';

  // ---- Pre-reveal card (anonymous) ----
  if (!isRevealed) {
    return (
      <View
        style={[
          styles.row,
          styles.rowAnonymous,
          cantMakeIt && styles.rowCantMakeIt,
        ]}
      >
        {/* Anonymous avatar placeholder */}
        <View style={styles.anonymousAvatarWrapper}>
          <View style={styles.anonymousAvatar}>
            <Ionicons name="person-outline" size={20} color={Colors.textTertiary} />
          </View>
        </View>

        {/* Info */}
        <View style={styles.info}>
          {/* Nickname + age/neighborhood row */}
          <View style={styles.nameRow}>
            <Text style={styles.nicknameText} numberOfLines={1}>
              {nickname ? `@${nickname}` : 'Member'}
            </Text>
            {isCurrentUser && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>You</Text>
              </View>
            )}
          </View>

          {/* Age range / neighborhood */}
          {(ageRange != null || neighborhood != null) && (
            <Text style={styles.subMeta} numberOfLines={1}>
              {[ageRange, neighborhood].filter(Boolean).join(' · ')}
            </Text>
          )}

          {/* Intro one-liner */}
          {intro != null && (
            <Text style={styles.intro} numberOfLines={1}>
              {intro}
            </Text>
          )}

          {/* Vibe tags */}
          <VibeTags tags={vibeTags} />

          {/* Arrival badge or RSVP fallback */}
          {member.arrival_status != null ? (
            <ArrivalBadge status={member.arrival_status} />
          ) : (
            <RsvpBadge status={member.rsvp_status} />
          )}
        </View>

        {/* Lock icon */}
        <View style={styles.lockIconWrapper}>
          <Ionicons name="lock-closed-outline" size={14} color={Colors.textTertiary} />
        </View>
      </View>
    );
  }

  // ---- Post-reveal card (full profile) ----
  const displayName = firstName ?? profile?.display_name ?? 'Unknown';

  return (
    <View style={[styles.row, cantMakeIt && styles.rowCantMakeIt]}>
      {/* Avatar with optional arrived badge */}
      <View style={styles.avatarWrapper}>
        <Avatar
          name={displayName}
          imageUrl={profile?.avatar_url}
          size="md"
        />
        {(member.checked_in || member.arrival_status === 'arrived') && (
          <View style={styles.arrivedBadge}>
            <Ionicons name="checkmark-circle" size={16} color={SUCCESS_GREEN} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        {/* Name row */}
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {isCurrentUser && (
            <View style={styles.youBadge}>
              <Text style={styles.youBadgeText}>You</Text>
            </View>
          )}
        </View>

        {/* Nickname subdued */}
        {nickname != null && (
          <Text style={styles.nicknameSubdued} numberOfLines={1}>
            @{nickname}
          </Text>
        )}

        {/* Intro */}
        {intro != null && (
          <Text style={styles.intro} numberOfLines={1}>
            {intro}
          </Text>
        )}

        {/* Vibe tags */}
        <VibeTags tags={vibeTags} />

        {/* Arrival badge or RSVP fallback */}
        {member.arrival_status != null ? (
          <ArrivalBadge status={member.arrival_status} />
        ) : (
          <RsvpBadge status={member.rsvp_status} />
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveAgeRange(age: number): string {
  if (age < 25) return 'early 20s';
  if (age < 28) return 'mid-20s';
  if (age < 31) return 'late 20s';
  if (age < 35) return 'early 30s';
  if (age < 38) return 'mid-30s';
  if (age < 41) return 'late 30s';
  return '40s+';
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  rowAnonymous: {
    // Subtle dimming for pre-reveal cards
    opacity: 0.8,
  },
  rowCantMakeIt: {
    opacity: 0.45,
  },
  // -------------------------------------------------------------------------
  // Avatar wrappers
  // -------------------------------------------------------------------------
  avatarWrapper: {
    position: 'relative',
    flexShrink: 0,
  },
  arrivedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anonymousAvatarWrapper: {
    flexShrink: 0,
  },
  anonymousAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  // -------------------------------------------------------------------------
  // Text
  // -------------------------------------------------------------------------
  info: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  name: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
    flexShrink: 1,
  },
  nicknameText: {
    ...Typography.body,
    color: Colors.accent,
    fontWeight: '600',
    flexShrink: 1,
  },
  nicknameSubdued: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
  subMeta: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  intro: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  // -------------------------------------------------------------------------
  // Vibe tags
  // -------------------------------------------------------------------------
  vibeTagsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingVertical: 2,
  },
  vibeTag: {
    backgroundColor: 'rgba(108,99,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.25)',
  },
  vibeTagText: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: '500',
  },
  // -------------------------------------------------------------------------
  // Arrival badge
  // -------------------------------------------------------------------------
  arrivalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
    marginTop: 2,
  },
  arrivalBadgeIcon: {
    fontSize: 11,
  },
  arrivalBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // -------------------------------------------------------------------------
  // Misc badges
  // -------------------------------------------------------------------------
  youBadge: {
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.full,
    paddingVertical: 2,
    paddingHorizontal: 8,
    flexShrink: 0,
  },
  youBadgeText: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600',
  },
  lockIconWrapper: {
    flexShrink: 0,
    paddingTop: 2,
  },
});

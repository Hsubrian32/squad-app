import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors, Radius, Typography } from '../../constants/theme';
import type { RsvpStatus } from '../../constants/types';

// ---------------------------------------------------------------------------
// RSVP Badge
// ---------------------------------------------------------------------------

interface RsvpBadgeProps {
  status: RsvpStatus;
  style?: StyleProp<ViewStyle>;
}

const RSVP_CONFIG: Record<
  RsvpStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  yes: {
    label: 'Going',
    bg: Colors.successLight,
    text: Colors.success,
    dot: Colors.success,
  },
  no: {
    label: "Can't go",
    bg: Colors.errorLight,
    text: Colors.error,
    dot: Colors.error,
  },
  maybe: {
    label: 'Maybe',
    bg: Colors.warningLight,
    text: Colors.warning,
    dot: Colors.warning,
  },
  pending: {
    label: 'Pending',
    bg: 'rgba(136,136,136,0.15)',
    text: Colors.textSecondary,
    dot: Colors.textSecondary,
  },
};

export function RsvpBadge({ status, style }: RsvpBadgeProps) {
  const config = RSVP_CONFIG[status];

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: config.bg },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: config.dot }]} />
      <Text style={[styles.pillText, { color: config.text }]}>
        {config.label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Generic Badge (for status labels, tags, etc.)
// ---------------------------------------------------------------------------

export type BadgeColor = 'accent' | 'success' | 'warning' | 'error' | 'neutral';

interface BadgeProps {
  label: string;
  color?: BadgeColor;
  style?: StyleProp<ViewStyle>;
}

const BADGE_COLORS: Record<BadgeColor, { bg: string; text: string }> = {
  accent: { bg: Colors.accentLight, text: Colors.accent },
  success: { bg: Colors.successLight, text: Colors.success },
  warning: { bg: Colors.warningLight, text: Colors.warning },
  error: { bg: Colors.errorLight, text: Colors.error },
  neutral: { bg: 'rgba(136,136,136,0.15)', text: Colors.textSecondary },
};

export function Badge({ label, color = 'accent', style }: BadgeProps) {
  const colors = BADGE_COLORS[color];

  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }, style]}>
      <Text style={[styles.pillText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    paddingVertical: 3,
    paddingHorizontal: 8,
    gap: 5,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
  },
  pillText: {
    ...Typography.caption,
    fontWeight: '600',
  },
});

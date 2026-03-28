import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors, Radius } from '../../constants/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: AvatarSize;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SIZE_MAP: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 52,
  xl: 80,
};

const FONT_SIZE_MAP: Record<AvatarSize, number> = {
  xs: 10,
  sm: 13,
  md: 16,
  lg: 20,
  xl: 30,
};

/** Palette of background colors for avatar initials */
const AVATAR_COLORS = [
  '#6C63FF', // accent purple
  '#FF6584', // coral
  '#43B89C', // teal
  '#F7CB73', // amber
  '#4FC3F7', // sky blue
  '#CE93D8', // lavender
  '#80DEEA', // cyan
  '#FFAB91', // peach
];

/**
 * Derive a deterministic background color from the user's display name
 * using a simple character-code hash.
 */
function getAvatarColor(name: string): string {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/**
 * Extract up to 2 initials from a display name.
 * "Alice Johnson" → "AJ"
 * "Bob" → "B"
 */
function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Avatar({ name, imageUrl, size = 'md' }: AvatarProps) {
  const diameter = SIZE_MAP[size];
  const fontSize = FONT_SIZE_MAP[size];
  const initials = getInitials(name);
  const bgColor = getAvatarColor(name);

  const containerStyle = {
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
    backgroundColor: bgColor,
  };

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[styles.image, containerStyle]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.initials, { fontSize, lineHeight: fontSize * 1.2 }]}>
        {initials}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    overflow: 'hidden',
  },
  initials: {
    color: Colors.textPrimary,
    fontWeight: '700',
    includeFontPadding: false,
  },
});

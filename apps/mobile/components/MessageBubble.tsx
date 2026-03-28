import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import type { Message } from '../constants/types';
import { Colors, Spacing, Radius, Typography } from '../constants/theme';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(isoString: string): string {
  try {
    const date = parseISO(isoString);
    if (isToday(date)) {
      return format(date, 'h:mm a');
    }
    if (isYesterday(date)) {
      return `Yesterday ${format(date, 'h:mm a')}`;
    }
    return format(date, 'MMM d, h:mm a');
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  // System messages — centered, grey
  if (message.type === 'system' || message.type === 'announcement') {
    return (
      <View style={styles.systemWrapper}>
        <Text style={styles.systemText}>{message.content}</Text>
        <Text style={styles.systemTimestamp}>
          {formatTimestamp(message.created_at)}
        </Text>
      </View>
    );
  }

  const senderName = message.profile?.first_name ?? message.profile?.display_name ?? 'Unknown';

  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
      {/* Message bubble */}
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        {/* Sender name — only for others */}
        {!isOwn && (
          <Text style={styles.senderName}>{senderName}</Text>
        )}

        {/* Message content */}
        <Text style={[styles.content, isOwn ? styles.contentOwn : styles.contentOther]}>
          {message.content}
        </Text>

        {/* Timestamp */}
        <Text style={[styles.timestamp, isOwn ? styles.timestampOwn : styles.timestampOther]}>
          {formatTimestamp(message.created_at)}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // System messages
  systemWrapper: {
    alignItems: 'center',
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    gap: 2,
  },
  systemText: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    textAlign: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  systemTimestamp: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },

  // Row
  row: {
    marginVertical: 3,
    paddingHorizontal: Spacing.sm,
  },
  rowOwn: {
    alignItems: 'flex-end',
  },
  rowOther: {
    alignItems: 'flex-start',
  },

  // Bubble
  bubble: {
    maxWidth: '78%',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 2,
  },
  bubbleOwn: {
    backgroundColor: Colors.accent,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Sender name (others only)
  senderName: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600',
    marginBottom: 2,
  },

  // Content
  content: {
    ...Typography.body,
    lineHeight: 21,
  },
  contentOwn: {
    color: Colors.textPrimary,
  },
  contentOther: {
    color: Colors.textPrimary,
  },

  // Timestamp
  timestamp: {
    ...Typography.caption,
    marginTop: 2,
  },
  timestampOwn: {
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'right',
  },
  timestampOther: {
    color: Colors.textTertiary,
  },
});

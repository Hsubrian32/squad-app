import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../store/authStore';
import { useGroup } from '../../store/groupStore';
import { submitFeedback } from '../../lib/api/feedback';
import { Colors, Spacing, Radius, Typography } from '../../constants/theme';
import { track } from '../../lib/analytics';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIBE_EMOJIS = ['😐', '🙂', '😊', '😄', '🤩'];
const VIBE_LABELS = ['Meh', 'Okay', 'Good', 'Great', 'Amazing'];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function FeedbackScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentGroup } = useGroup();

  const [groupRating, setGroupRating] = useState(0);
  const [vibeScore, setVibeScore] = useState(0);
  const [wouldMeetAgain, setWouldMeetAgain] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit =
    groupRating > 0 && vibeScore > 0 && wouldMeetAgain !== null;

  async function handleSubmit() {
    if (!user || !currentGroup || !canSubmit) return;

    setIsSaving(true);
    setSubmitError(null);
    try {
      const { error } = await submitFeedback({
        group_id: currentGroup.id,
        cycle_id: currentGroup.cycle_id,
        user_id: user.id,
        rating: groupRating,
        vibe_score: vibeScore,
        would_meet_again: wouldMeetAgain!,
        notes: notes.trim() || null,
      });

      if (error) {
        setSubmitError(error);
        return;
      }

      track('feedback_completed', {
        group_id: currentGroup?.id,
        rating: groupRating,
        vibe_score: vibeScore,
        would_meet_again: wouldMeetAgain ?? undefined,
      });
      setSubmitted(true);
    } finally {
      setIsSaving(false);
    }
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successContainer}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={styles.successTitle}>Thanks for the feedback!</Text>
          <Text style={styles.successSubtitle}>
            We'll use this to make your next Squad even better.
          </Text>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={() => router.replace('/(app)')}
            activeOpacity={0.85}
          >
            <Text style={styles.submitButtonText}>Back to Home</Text>
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
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>How was your group?</Text>
          <Text style={styles.subtitle}>
            Help us make Squad better — it takes 30 seconds.
          </Text>
        </View>

        {/* Group rating */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overall Rating</Text>
          <Text style={styles.sectionSubtitle}>
            How would you rate this week's group overall?
          </Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setGroupRating(star)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.star,
                    star <= groupRating ? styles.starActive : styles.starInactive,
                  ]}
                >
                  ★
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {groupRating > 0 && (
            <Text style={styles.ratingLabel}>
              {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][groupRating]}
            </Text>
          )}
        </View>

        {/* Vibe score */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vibe Check</Text>
          <Text style={styles.sectionSubtitle}>What was the vibe like?</Text>
          <View style={styles.vibeRow}>
            {VIBE_EMOJIS.map((emoji, index) => {
              const score = index + 1;
              const isSelected = vibeScore === score;
              return (
                <TouchableOpacity
                  key={score}
                  style={[
                    styles.vibeButton,
                    isSelected ? styles.vibeButtonSelected : null,
                  ]}
                  onPress={() => setVibeScore(score)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.vibeEmoji}>{emoji}</Text>
                  <Text
                    style={[
                      styles.vibeLabel,
                      isSelected ? styles.vibeLabelSelected : null,
                    ]}
                  >
                    {VIBE_LABELS[index]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Would meet again */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Would You Meet Again?</Text>
          <Text style={styles.sectionSubtitle}>
            Would you want to meet this group again?
          </Text>
          <View style={styles.binaryRow}>
            <TouchableOpacity
              style={[
                styles.binaryButton,
                wouldMeetAgain === true ? styles.binaryButtonYes : null,
              ]}
              onPress={() => setWouldMeetAgain(true)}
              activeOpacity={0.75}
            >
              <Text style={styles.binaryEmoji}>👍</Text>
              <Text
                style={[
                  styles.binaryLabel,
                  wouldMeetAgain === true ? styles.binaryLabelSelected : null,
                ]}
              >
                Yes!
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.binaryButton,
                wouldMeetAgain === false ? styles.binaryButtonNo : null,
              ]}
              onPress={() => setWouldMeetAgain(false)}
              activeOpacity={0.75}
            >
              <Text style={styles.binaryEmoji}>👎</Text>
              <Text
                style={[
                  styles.binaryLabel,
                  wouldMeetAgain === false ? styles.binaryLabelSelected : null,
                ]}
              >
                Not really
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Any notes? (optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything specific you'd like to share with the Squad team?"
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={500}
            selectionColor={Colors.accent}
          />
          <Text style={styles.charCount}>{notes.length}/500</Text>
        </View>
      </ScrollView>

      {/* Submit button */}
      <View style={styles.footer}>
        {submitError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{submitError}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!canSubmit || isSaving) ? styles.submitButtonDisabled : null,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit || isSaving}
          activeOpacity={0.85}
        >
          {isSaving ? (
            <ActivityIndicator color={Colors.textPrimary} />
          ) : (
            <Text style={styles.submitButtonText}>Submit Feedback</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.replace('/(app)')}
        >
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: Spacing.md,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  // Stars
  starsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  star: {
    fontSize: 40,
  },
  starActive: {
    color: '#FFD700',
  },
  starInactive: {
    color: Colors.border,
  },
  ratingLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  // Vibe
  vibeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  vibeButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 4,
  },
  vibeButtonSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
  },
  vibeEmoji: {
    fontSize: 24,
  },
  vibeLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  vibeLabelSelected: {
    color: Colors.accent,
    fontWeight: '600',
  },
  // Binary
  binaryRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  binaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  binaryButtonYes: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  binaryButtonNo: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  binaryEmoji: {
    fontSize: 22,
  },
  binaryLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  binaryLabelSelected: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  // Notes
  notesInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.body,
    color: Colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: 4,
  },
  // Footer
  footer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.xs,
  },
  submitButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  skipButton: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  skipButtonText: {
    ...Typography.body,
    color: Colors.textTertiary,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  successEmoji: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  successTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  successSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  errorBanner: {
    backgroundColor: 'rgba(220,38,38,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.3)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  errorBannerText: {
    ...Typography.bodySmall,
    color: '#f87171',
    textAlign: 'center',
  },
});

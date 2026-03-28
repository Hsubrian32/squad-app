import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../store/authStore';
import { submitPostEventReview, submitStayLeaveDecision } from '../../lib/api/groups';
import { track } from '../../lib/analytics';
import { Colors, Spacing, Radius, Typography } from '../../constants/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 'review' | 'stay-leave' | 'confirmation';
type StayLeaveChoice = 'stay' | 'leave' | null;

// ---------------------------------------------------------------------------
// Star Rating Component
// ---------------------------------------------------------------------------

function StarRating({
  value,
  onChange,
  label,
  size = 32,
}: {
  value: number;
  onChange: (rating: number) => void;
  label: string;
  size?: number;
}) {
  return (
    <View style={styles.starRatingContainer}>
      <Text style={styles.starRatingLabel}>{label}</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onChange(star)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={star <= value ? 'star' : 'star-outline'}
              size={size}
              color={star <= value ? '#FFD700' : Colors.textTertiary}
              style={styles.starIcon}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function PostEventScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { eventId, groupId } = useLocalSearchParams<{
    eventId: string;
    groupId: string;
  }>();

  // Step management
  const [step, setStep] = useState<Step>('review');

  // Step 1: Review state
  const [overallRating, setOverallRating] = useState(0);
  const [vibeRating, setVibeRating] = useState(0);
  const [venueRating, setVenueRating] = useState(0);
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState('');

  // Step 2: Stay/Leave state
  const [stayLeaveChoice, setStayLeaveChoice] = useState<StayLeaveChoice>(null);

  // Shared state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirmation animation
  const confirmScale = useRef(new Animated.Value(0)).current;
  const confirmOpacity = useRef(new Animated.Value(0)).current;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const playConfirmationAnimation = useCallback(() => {
    Animated.parallel([
      Animated.spring(confirmScale, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(confirmOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [confirmScale, confirmOpacity]);

  const handleNextStep = async () => {
    if (!eventId || !groupId || !user?.id) {
      setError('Missing required information. Please go back and try again.');
      return;
    }

    if (overallRating === 0) {
      Alert.alert('Rating Required', 'Please provide an overall rating before continuing.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await submitPostEventReview(eventId!, user!.id, groupId!, {
        overall_rating: overallRating,
        vibe_rating: vibeRating || undefined,
        venue_rating: venueRating || undefined,
        would_return: wouldReturn ?? undefined,
        comment: feedback.trim() || undefined,
      });

      track('post_event_review_submitted', {
        eventId,
        groupId,
        overallRating,
        vibeRating,
        venueRating,
        wouldReturn,
        hasFeedback: feedback.trim().length > 0,
      });

      setStep('stay-leave');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitDecision = async () => {
    if (!eventId || !groupId || !user?.id) {
      setError('Missing required information. Please go back and try again.');
      return;
    }

    if (!stayLeaveChoice) {
      Alert.alert('Choice Required', 'Please choose whether to stay or leave.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await submitStayLeaveDecision(eventId!, user!.id, groupId!, stayLeaveChoice);

      track('stay_leave_decision_submitted', {
        eventId,
        groupId,
        decision: stayLeaveChoice,
      });

      setStep('confirmation');
      playConfirmationAnimation();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to submit decision. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoHome = () => {
    router.replace('/');
  };

  // ---------------------------------------------------------------------------
  // Step Indicator
  // ---------------------------------------------------------------------------

  const renderStepIndicator = () => {
    if (step === 'confirmation') return null;

    const stepIndex = step === 'review' ? 0 : 1;

    return (
      <View style={styles.stepIndicator}>
        {[0, 1].map((i) => (
          <View
            key={i}
            style={[
              styles.stepDot,
              i === stepIndex && styles.stepDotActive,
              i < stepIndex && styles.stepDotCompleted,
            ]}
          />
        ))}
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Step 1: Review
  // ---------------------------------------------------------------------------

  const renderReviewStep = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>How was the meetup?</Text>
        <Text style={styles.stepSubtitle}>
          Your honest feedback helps us improve the experience for everyone.
        </Text>

        {/* Overall Rating */}
        <View style={styles.ratingCard}>
          <StarRating
            value={overallRating}
            onChange={setOverallRating}
            label="Overall Experience *"
            size={36}
          />
        </View>

        {/* Vibe Rating */}
        <View style={styles.ratingCard}>
          <StarRating
            value={vibeRating}
            onChange={setVibeRating}
            label="Group Vibe"
          />
        </View>

        {/* Venue Rating */}
        <View style={styles.ratingCard}>
          <StarRating
            value={venueRating}
            onChange={setVenueRating}
            label="Venue"
          />
        </View>

        {/* Would Return Toggle */}
        <View style={styles.toggleCard}>
          <Text style={styles.toggleLabel}>Would you come back to this venue?</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                wouldReturn === true && styles.toggleButtonActiveYes,
              ]}
              onPress={() => setWouldReturn(wouldReturn === true ? null : true)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="thumbs-up"
                size={20}
                color={wouldReturn === true ? Colors.success : Colors.textTertiary}
              />
              <Text
                style={[
                  styles.toggleButtonText,
                  wouldReturn === true && styles.toggleButtonTextActiveYes,
                ]}
              >
                Yes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                wouldReturn === false && styles.toggleButtonActiveNo,
              ]}
              onPress={() => setWouldReturn(wouldReturn === false ? null : false)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="thumbs-down"
                size={20}
                color={wouldReturn === false ? Colors.error : Colors.textTertiary}
              />
              <Text
                style={[
                  styles.toggleButtonText,
                  wouldReturn === false && styles.toggleButtonTextActiveNo,
                ]}
              >
                No
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Feedback */}
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackLabel}>Anything else you want to share?</Text>
          <TextInput
            style={styles.feedbackInput}
            value={feedback}
            onChangeText={(text) => setFeedback(text.slice(0, 500))}
            placeholder="Optional feedback..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{feedback.length}/500</Text>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, overallRating === 0 && styles.primaryButtonDisabled]}
          onPress={handleNextStep}
          disabled={isSubmitting || overallRating === 0}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color={Colors.textPrimary} size="small" />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>Next</Text>
              <Ionicons name="arrow-forward" size={20} color={Colors.textPrimary} />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ---------------------------------------------------------------------------
  // Step 2: Stay or Leave
  // ---------------------------------------------------------------------------

  const renderStayLeaveStep = () => (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.scrollContentCentered}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.stayLeaveHeader}>
        <Ionicons name="shield-checkmark" size={40} color={Colors.accent} />
        <Text style={styles.stepTitle}>Do you want to stay in this group?</Text>
        <Text style={styles.anonymousNotice}>
          This is completely anonymous. No one in your group will see your choice.
        </Text>
      </View>

      {/* Stay Card */}
      <TouchableOpacity
        style={[
          styles.choiceCard,
          stayLeaveChoice === 'stay' && styles.choiceCardStayActive,
        ]}
        onPress={() => setStayLeaveChoice('stay')}
        activeOpacity={0.7}
      >
        <View style={styles.choiceCardInner}>
          <View
            style={[
              styles.choiceIconCircle,
              stayLeaveChoice === 'stay' && styles.choiceIconCircleStayActive,
            ]}
          >
            <Text style={styles.choiceEmoji}>{'🟢'}</Text>
          </View>
          <View style={styles.choiceTextContainer}>
            <Text
              style={[
                styles.choiceTitle,
                stayLeaveChoice === 'stay' && styles.choiceTitleActive,
              ]}
            >
              Stay
            </Text>
            <Text style={styles.choiceDescription}>
              Keep meeting with this group weekly
            </Text>
          </View>
          {stayLeaveChoice === 'stay' && (
            <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
          )}
        </View>
      </TouchableOpacity>

      {/* Leave Card */}
      <TouchableOpacity
        style={[
          styles.choiceCard,
          stayLeaveChoice === 'leave' && styles.choiceCardLeaveActive,
        ]}
        onPress={() => setStayLeaveChoice('leave')}
        activeOpacity={0.7}
      >
        <View style={styles.choiceCardInner}>
          <View
            style={[
              styles.choiceIconCircle,
              stayLeaveChoice === 'leave' && styles.choiceIconCircleLeaveActive,
            ]}
          >
            <Text style={styles.choiceEmoji}>{'🔴'}</Text>
          </View>
          <View style={styles.choiceTextContainer}>
            <Text
              style={[
                styles.choiceTitle,
                stayLeaveChoice === 'leave' && styles.choiceTitleActive,
              ]}
            >
              Leave
            </Text>
            <Text style={styles.choiceDescription}>
              Exit this group and get matched with new people
            </Text>
          </View>
          {stayLeaveChoice === 'leave' && (
            <Ionicons name="checkmark-circle" size={28} color={Colors.error} />
          )}
        </View>
      </TouchableOpacity>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.primaryButton, !stayLeaveChoice && styles.primaryButtonDisabled]}
        onPress={handleSubmitDecision}
        disabled={isSubmitting || !stayLeaveChoice}
        activeOpacity={0.8}
      >
        {isSubmitting ? (
          <ActivityIndicator color={Colors.textPrimary} size="small" />
        ) : (
          <Text style={styles.primaryButtonText}>Submit</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  // ---------------------------------------------------------------------------
  // Confirmation
  // ---------------------------------------------------------------------------

  const renderConfirmation = () => {
    const isStaying = stayLeaveChoice === 'stay';

    return (
      <View style={styles.confirmationContainer}>
        <Animated.View
          style={[
            styles.confirmationContent,
            {
              transform: [{ scale: confirmScale }],
              opacity: confirmOpacity,
            },
          ]}
        >
          <View
            style={[
              styles.confirmationIconCircle,
              isStaying ? styles.confirmationIconStay : styles.confirmationIconLeave,
            ]}
          >
            <Ionicons
              name={isStaying ? 'heart' : 'rocket'}
              size={48}
              color={isStaying ? Colors.success : Colors.accent}
            />
          </View>

          <Text style={styles.confirmationTitle}>
            {isStaying ? 'Awesome!' : 'Got it!'}
          </Text>

          <Text style={styles.confirmationMessage}>
            {isStaying
              ? "Thanks for your feedback! See you next week."
              : "We'll find you a great new group."}
          </Text>

          <TouchableOpacity
            style={styles.homeButton}
            onPress={handleGoHome}
            activeOpacity={0.8}
          >
            <Ionicons name="home" size={20} color={Colors.textPrimary} />
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      {step !== 'confirmation' && (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (step === 'stay-leave') {
                // Can't go back after submitting review — navigate home instead
                Alert.alert(
                  'Leave Feedback?',
                  'Your review has been saved. Are you sure you want to exit without completing your stay/leave decision?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Exit', style: 'destructive', onPress: handleGoHome },
                  ],
                );
              } else {
                router.back();
              }
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post-Meetup</Text>
          <View style={styles.headerSpacer} />
        </View>
      )}

      {renderStepIndicator()}

      {step === 'review' && renderReviewStep()}
      {step === 'stay-leave' && renderStayLeaveStep()}
      {step === 'confirmation' && renderConfirmation()}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  headerSpacer: {
    width: 28,
  },

  // Step Indicator
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
  },
  stepDotActive: {
    width: 24,
    backgroundColor: Colors.accent,
  },
  stepDotCompleted: {
    backgroundColor: Colors.success,
  },

  // Scroll Content
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  scrollContentCentered: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    flexGrow: 1,
    justifyContent: 'center',
  },

  // Step Header
  stepTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  stepSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },

  // Star Rating
  starRatingContainer: {
    marginBottom: Spacing.sm,
  },
  starRatingLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  starIcon: {
    marginHorizontal: 2,
  },

  // Rating Card
  ratingCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Toggle Card
  toggleCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  toggleButtonActiveYes: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  toggleButtonActiveNo: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  toggleButtonText: {
    ...Typography.h4,
    color: Colors.textTertiary,
  },
  toggleButtonTextActiveYes: {
    color: Colors.success,
  },
  toggleButtonTextActiveNo: {
    color: Colors.error,
  },

  // Feedback
  feedbackCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  feedbackLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  feedbackInput: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  charCount: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },

  // Stay / Leave
  stayLeaveHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  anonymousNotice: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },

  choiceCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  choiceCardStayActive: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  choiceCardLeaveActive: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  choiceCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  choiceIconCircle: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceIconCircleStayActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.25)',
  },
  choiceIconCircleLeaveActive: {
    backgroundColor: 'rgba(244, 67, 54, 0.25)',
  },
  choiceEmoji: {
    fontSize: 24,
  },
  choiceTextContainer: {
    flex: 1,
  },
  choiceTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  choiceTitleActive: {
    color: Colors.textPrimary,
  },
  choiceDescription: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },

  // Buttons
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
  },
  primaryButtonDisabled: {
    backgroundColor: Colors.surfaceElevated,
    opacity: 0.5,
  },
  primaryButtonText: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },

  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorLight,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.error,
    flex: 1,
  },

  // Confirmation
  confirmationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  confirmationContent: {
    alignItems: 'center',
    gap: Spacing.lg,
  },
  confirmationIconCircle: {
    width: 100,
    height: 100,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  confirmationIconStay: {
    backgroundColor: Colors.successLight,
  },
  confirmationIconLeave: {
    backgroundColor: Colors.accentLight,
  },
  confirmationTitle: {
    ...Typography.h1,
    color: Colors.textPrimary,
  },
  confirmationMessage: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.lg,
  },
  homeButtonText: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
});

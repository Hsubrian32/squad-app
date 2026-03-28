import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../store/authStore';
import { saveQuestionnaireAnswer } from '../../lib/api/questionnaire';
import {
  QUESTIONNAIRE_QUESTIONS,
  type Question,
} from '../../constants/questionnaire';
import { Colors, Spacing, Radius, Typography } from '../../constants/theme';
import { OnboardingProgress } from '../../components/onboarding/OnboardingProgress';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Per-question theme map
// ---------------------------------------------------------------------------

type QuestionTheme = { color: string; emoji: string; bg: string };

const QUESTION_THEMES: Record<string, QuestionTheme> = {
  social_energy:       { color: '#818CF8', emoji: '⚡', bg: 'rgba(129,140,248,0.12)' },
  interests:           { color: '#34D399', emoji: '✨', bg: 'rgba(52,211,153,0.12)' },
  group_vibe:          { color: '#F472B6', emoji: '🎉', bg: 'rgba(244,114,182,0.12)' },
  age_range:           { color: '#FB923C', emoji: '🎂', bg: 'rgba(251,146,60,0.12)' },
  activity_preference: { color: '#60A5FA', emoji: '🎲', bg: 'rgba(96,165,250,0.12)' },
  openness:            { color: '#A78BFA', emoji: '🌍', bg: 'rgba(167,139,250,0.12)' },
  goal:                { color: '#FBBF24', emoji: '🎯', bg: 'rgba(251,191,36,0.12)' },
};

const DEFAULT_THEME: QuestionTheme = {
  color: Colors.accent,
  emoji: '💬',
  bg: Colors.accentLight,
};

function getTheme(key: string): QuestionTheme {
  return QUESTION_THEMES[key] ?? DEFAULT_THEME;
}

// Fallback motivational subtitles for questions that have none
const FALLBACK_SUBTITLES: Record<string, string> = {
  social_energy: 'We use this to find your perfect energy match',
  group_vibe:    "Pick all that apply — we'll find your perfect mix",
  openness:      'No wrong answer — this shapes your group diversity',
  goal:          'This helps us curate the right crowd for you',
  age_range:     'Helps us match you with your age group',
};

// Openness scale configuration
const OPENNESS_SCALE: { emoji: string; label: string }[] = [
  { emoji: '🧘', label: 'Just like me' },
  { emoji: '😊', label: 'Mostly similar' },
  { emoji: '🤝', label: 'Mix of both' },
  { emoji: '🌟', label: 'Quite different' },
  { emoji: '🌍', label: 'Very different' },
];

type AnswerMap = Record<string, string | string[] | number>;

export default function QuestionnaireScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [isSaving, setIsSaving] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const totalQuestions = QUESTIONNAIRE_QUESTIONS.length;
  const currentQuestion = QUESTIONNAIRE_QUESTIONS[currentIndex];
  const progress = (currentIndex + 1) / totalQuestions;
  const theme = getTheme(currentQuestion.key);

  // ---------------------------------------------------------------------------
  // Answer helpers
  // ---------------------------------------------------------------------------

  function getCurrentAnswer(): string | string[] | number | undefined {
    return answers[currentQuestion.key];
  }

  function handleSingleSelect(optionKey: string) {
    setAnswers((prev) => ({ ...prev, [currentQuestion.key]: optionKey }));
  }

  function handleMultiSelect(optionKey: string) {
    const current = (answers[currentQuestion.key] as string[] | undefined) ?? [];
    const next = current.includes(optionKey)
      ? current.filter((k) => k !== optionKey)
      : [...current, optionKey];
    setAnswers((prev) => ({ ...prev, [currentQuestion.key]: next }));
  }

  function handleScale(value: number) {
    setAnswers((prev) => ({ ...prev, [currentQuestion.key]: value }));
  }

  function isAnswered(): boolean {
    const answer = getCurrentAnswer();
    if (answer === undefined || answer === null) return false;
    if (Array.isArray(answer)) return answer.length > 0;
    if (typeof answer === 'string') return answer.length > 0;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  function animateTransition(direction: 'forward' | 'back', callback: () => void) {
    const toValue = direction === 'forward' ? -SCREEN_WIDTH : SCREEN_WIDTH;
    Animated.timing(slideAnim, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      slideAnim.setValue(direction === 'forward' ? SCREEN_WIDTH : -SCREEN_WIDTH);
      callback();
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }).start();
    });
  }

  async function handleNext() {
    if (!user) return;
    if (currentQuestion.required && !isAnswered()) return;

    setIsSaving(true);
    const answer = getCurrentAnswer();
    if (answer !== undefined) {
      await saveQuestionnaireAnswer(user.id, currentQuestion.key, answer);
    }
    setIsSaving(false);

    if (currentIndex < totalQuestions - 1) {
      animateTransition('forward', () => {
        setCurrentIndex((i) => i + 1);
      });
    } else {
      router.replace('/(onboarding)/availability');
    }
  }

  async function handleSkip() {
    if (!user) return;
    if (currentIndex < totalQuestions - 1) {
      animateTransition('forward', () => {
        setCurrentIndex((i) => i + 1);
      });
    } else {
      router.replace('/(onboarding)/availability');
    }
  }

  function handleBack() {
    if (currentIndex > 0) {
      animateTransition('back', () => {
        setCurrentIndex((i) => i - 1);
      });
    } else {
      router.back();
    }
  }

  const isNextDisabled = (currentQuestion.required && !isAnswered()) || isSaving;
  const subtitle = currentQuestion.subtitle ?? FALLBACK_SUBTITLES[currentQuestion.key];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>

        {/* Spacer to balance back button */}
        <View style={styles.headerRight} />
      </View>

      {/* Phase progress — phase 3, questions fill 1-7 of 8 total steps */}
      <OnboardingProgress phase={3} stepInPhase={currentIndex + 1} stepsInPhase={8} />

      {/* Per-question progress bar + dot indicators */}
      <View style={styles.progressSection}>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: `${progress * 100}%`,
                backgroundColor: theme.color,
                shadowColor: theme.color,
              },
            ]}
          />
        </View>

        {/* Pagination dots */}
        <View style={styles.dotsRow}>
          {QUESTIONNAIRE_QUESTIONS.map((_, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            const dotTheme = getTheme(QUESTIONNAIRE_QUESTIONS[idx].key);
            return (
              <View
                key={idx}
                style={[
                  styles.dot,
                  isCompleted && { backgroundColor: dotTheme.color, borderColor: dotTheme.color },
                  isCurrent && { backgroundColor: theme.color, borderColor: theme.color, transform: [{ scale: 1.3 }] },
                  !isCompleted && !isCurrent && styles.dotUpcoming,
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* Question card */}
      <Animated.View
        style={[
          styles.questionContainer,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero emoji + colored circle */}
          <View style={styles.heroRow}>
            <View style={[styles.heroCircle, { backgroundColor: `${theme.color}33` }]}>
              <Text style={styles.heroEmoji}>{theme.emoji}</Text>
            </View>
          </View>

          {/* Question text */}
          <Text style={styles.questionText}>{currentQuestion.question}</Text>

          {/* Motivational subtitle */}
          {subtitle ? (
            <Text style={[styles.questionSubtitle, { color: theme.color }]}>
              {subtitle}
            </Text>
          ) : null}

          {/* Options — colored wash background behind them */}
          <View style={[styles.optionsWrapper, { backgroundColor: theme.bg }]}>
            {currentQuestion.type === 'single-select' && (
              <SingleSelectOptions
                question={currentQuestion}
                selected={getCurrentAnswer() as string | undefined}
                onSelect={handleSingleSelect}
                themeColor={theme.color}
              />
            )}
            {currentQuestion.type === 'multi-select' && (
              <MultiSelectOptions
                question={currentQuestion}
                selected={(getCurrentAnswer() as string[] | undefined) ?? []}
                onSelect={handleMultiSelect}
                themeColor={theme.color}
              />
            )}
            {currentQuestion.type === 'scale' && (
              <ScaleOptions
                question={currentQuestion}
                selected={getCurrentAnswer() as number | undefined}
                onSelect={handleScale}
                themeColor={theme.color}
              />
            )}
          </View>

          {/* Skip link for non-required questions */}
          {!currentQuestion.required && (
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.6}>
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </Animated.View>

      {/* Navigation */}
      <View style={styles.navButtons}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            { backgroundColor: theme.color, shadowColor: theme.color },
            isNextDisabled ? styles.nextButtonDisabled : null,
          ]}
          onPress={handleNext}
          disabled={isNextDisabled}
          activeOpacity={0.85}
        >
          <Text style={styles.nextButtonText}>
            {isSaving
              ? 'Saving…'
              : currentIndex === totalQuestions - 1
              ? 'Finish ✓'
              : 'Continue'}
          </Text>
          {!isSaving && currentIndex < totalQuestions - 1 && (
            <Text style={styles.nextButtonArrow}>→</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Single-select — full-width cards with colored left border on selection
// ---------------------------------------------------------------------------

function SingleSelectOptions({
  question,
  selected,
  onSelect,
  themeColor,
}: {
  question: Question;
  selected: string | undefined;
  onSelect: (key: string) => void;
  themeColor: string;
}) {
  return (
    <>
      {(question.options ?? []).map((option) => {
        const isSelected = selected === option.key;
        return (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.optionButton,
              isSelected && {
                borderColor: themeColor,
                backgroundColor: `${themeColor}1A`,
                borderLeftWidth: 4,
                borderLeftColor: themeColor,
                shadowColor: themeColor,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 4,
              },
            ]}
            onPress={() => onSelect(option.key)}
            activeOpacity={0.75}
          >
            {option.emoji ? (
              <Text style={styles.optionEmoji}>{option.emoji}</Text>
            ) : null}
            <Text
              style={[
                styles.optionLabel,
                isSelected && { color: themeColor, fontWeight: '600' },
              ]}
            >
              {option.label}
            </Text>
            <View
              style={[
                styles.optionCheckmark,
                isSelected && { backgroundColor: themeColor, borderColor: themeColor },
              ]}
            >
              {isSelected && (
                <Text style={styles.optionCheckmarkText}>✓</Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Multi-select — colorful chips in a 2-column grid
// ---------------------------------------------------------------------------

function MultiSelectOptions({
  question,
  selected,
  onSelect,
  themeColor,
}: {
  question: Question;
  selected: string[];
  onSelect: (key: string) => void;
  themeColor: string;
}) {
  return (
    <View style={styles.multiGrid}>
      {(question.options ?? []).map((option) => {
        const isSelected = selected.includes(option.key);
        return (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.multiOptionButton,
              isSelected && {
                borderColor: themeColor,
                backgroundColor: `${themeColor}1A`,
                shadowColor: themeColor,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 4,
              },
            ]}
            onPress={() => onSelect(option.key)}
            activeOpacity={0.75}
          >
            {/* Colored selection dot top-right */}
            {isSelected && (
              <View style={[styles.multiOptionCheck, { backgroundColor: themeColor }]}>
                <Text style={styles.multiOptionCheckText}>✓</Text>
              </View>
            )}
            {option.emoji ? (
              <Text style={styles.multiOptionEmoji}>{option.emoji}</Text>
            ) : null}
            <Text
              style={[
                styles.multiOptionLabel,
                isSelected && { color: themeColor, fontWeight: '600' },
              ]}
              numberOfLines={2}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Scale — emoji spectrum for openness, numbered fallback for others
// ---------------------------------------------------------------------------

function ScaleOptions({
  question,
  selected,
  onSelect,
  themeColor,
}: {
  question: Question;
  selected: number | undefined;
  onSelect: (value: number) => void;
  themeColor: string;
}) {
  const isOpenness = question.key === 'openness';
  const min = question.scaleMin ?? 1;
  const max = question.scaleMax ?? 5;
  const values = Array.from({ length: max - min + 1 }, (_, i) => i + min);

  if (isOpenness) {
    return (
      <View>
        <View style={styles.opennessRow}>
          {values.map((val, idx) => {
            const isSelected = selected === val;
            const entry = OPENNESS_SCALE[idx];
            return (
              <TouchableOpacity
                key={val}
                style={[
                  styles.opennessButton,
                  isSelected && {
                    backgroundColor: themeColor,
                    borderColor: themeColor,
                    shadowColor: themeColor,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.4,
                    shadowRadius: 10,
                    elevation: 5,
                  },
                ]}
                onPress={() => onSelect(val)}
                activeOpacity={0.75}
              >
                <Text style={styles.opennessEmoji}>{entry.emoji}</Text>
                <Text
                  style={[
                    styles.opennessLabel,
                    isSelected && { color: '#FFFFFF', fontWeight: '600' },
                  ]}
                  numberOfLines={2}
                >
                  {entry.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  // Generic numeric scale fallback
  return (
    <View>
      <View style={styles.scaleRow}>
        {values.map((val) => {
          const isSelected = selected === val;
          return (
            <TouchableOpacity
              key={val}
              style={[
                styles.scaleButton,
                isSelected && {
                  borderColor: themeColor,
                  backgroundColor: themeColor,
                  shadowColor: themeColor,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                },
              ]}
              onPress={() => onSelect(val)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.scaleButtonText,
                  isSelected && { color: '#FFFFFF', fontWeight: '700' },
                ]}
              >
                {val}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.scaleLabels}>
        <Text style={styles.scaleLabelText}>{question.scaleMinLabel}</Text>
        <Text style={styles.scaleLabelText}>{question.scaleMaxLabel}</Text>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backButtonText: {
    fontSize: 18,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  headerRight: {
    width: 40,
  },

  // Progress section
  progressSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  progressTrack: {
    height: 5,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },

  // Pagination dots
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.textTertiary,
    backgroundColor: 'transparent',
  },
  dotUpcoming: {
    borderColor: Colors.textTertiary,
    backgroundColor: 'transparent',
  },

  // Question container
  questionContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },

  // Hero emoji
  heroRow: {
    marginBottom: Spacing.md,
  },
  heroCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: {
    fontSize: 36,
    lineHeight: 42,
  },

  // Question text
  questionText: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    letterSpacing: -0.5,
  },
  questionSubtitle: {
    ...Typography.body,
    marginBottom: Spacing.lg,
    lineHeight: 22,
    fontWeight: '500',
    opacity: 0.85,
  },

  // Options wrapper — themed wash background
  optionsWrapper: {
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },

  // Skip
  skipButton: {
    alignSelf: 'center',
    marginTop: Spacing.xl,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  skipButtonText: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    textDecorationLine: 'underline',
  },

  // Single select — full-width cards
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.sm,
    // default left border matches general border
    borderLeftWidth: 1.5,
  },
  optionEmoji: {
    fontSize: 22,
  },
  optionLabel: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
  },
  optionCheckmark: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  optionCheckmarkText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // Multi-select chips in 2-column grid
  multiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  multiOptionButton: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 88,
    justifyContent: 'center',
  },
  multiOptionEmoji: {
    fontSize: 28,
  },
  multiOptionLabel: {
    ...Typography.label,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 18,
  },
  multiOptionCheck: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiOptionCheckText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Openness emoji scale
  opennessRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  opennessButton: {
    flex: 1,
    height: 80,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 4,
    gap: 4,
  },
  opennessEmoji: {
    fontSize: 26,
    lineHeight: 32,
  },
  opennessLabel: {
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Generic numeric scale (fallback)
  scaleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  scaleButton: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  scaleButtonText: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
  },
  scaleLabelText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },

  // Nav buttons
  navButtons: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  nextButton: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
    gap: Spacing.sm,
  },
  nextButtonDisabled: {
    opacity: 0.38,
    shadowOpacity: 0,
    elevation: 0,
  },
  nextButtonText: {
    ...Typography.h4,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  nextButtonArrow: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
    lineHeight: 24,
  },
});

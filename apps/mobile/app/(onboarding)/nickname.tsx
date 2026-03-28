import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../store/authStore';
import { checkNicknameAvailable, updateProfile } from '../../lib/api/auth';
import { OnboardingProgress } from '../../components/onboarding/OnboardingProgress';

// ---------------------------------------------------------------------------
// Design tokens — premium dark palette (matches availability.tsx)
// ---------------------------------------------------------------------------

const OB = {
  bg: '#0C0C1A',
  surface: '#13132B',
  surfaceHover: '#1C1C38',
  accent: '#7B6CF6',
  accentLight: 'rgba(123,108,246,0.15)',
  accentBorder: 'rgba(123,108,246,0.35)',
  text: '#FFFFFF',
  textSub: '#9CA3AF',
  textMuted: '#6B7280',
  border: 'rgba(255,255,255,0.07)',
  success: '#34D399',
  successLight: 'rgba(52,211,153,0.15)',
  successBorder: 'rgba(52,211,153,0.35)',
  error: '#F87171',
  errorLight: 'rgba(248,113,113,0.12)',
  errorBorder: 'rgba(248,113,113,0.3)',
  warning: '#FB923C',
  warningLight: 'rgba(251,146,60,0.12)',
  warningBorder: 'rgba(251,146,60,0.3)',
};

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const NICKNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

type ValidationState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'valid'; message: string }
  | { status: 'taken' }
  | { status: 'error'; message: string };

function validateFormat(value: string): string | null {
  if (value.length === 0) return null;
  if (value.length < 3) return 'Too short — minimum 3 characters';
  if (value.length > 20) return 'Too long — maximum 20 characters';
  if (/\s/.test(value)) return 'No spaces allowed';
  if (!NICKNAME_REGEX.test(value)) return 'Only letters, numbers, _ and - allowed';
  return null;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function NicknameScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [nickname, setNickname] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [validation, setValidation] = useState<ValidationState>({ status: 'idle' });
  const [isSaving, setIsSaving] = useState(false);

  // Animated values
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(28)).current;
  const borderPulse = useRef(new Animated.Value(0)).current;
  const borderPulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Debounce timer ref
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.spring(contentY, {
        toValue: 0,
        tension: 60,
        friction: 11,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Border pulse when focused
  useEffect(() => {
    if (isFocused) {
      borderPulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(borderPulse, {
            toValue: 1,
            duration: 900,
            useNativeDriver: false,
          }),
          Animated.timing(borderPulse, {
            toValue: 0,
            duration: 900,
            useNativeDriver: false,
          }),
        ])
      );
      borderPulseLoop.current.start();
    } else {
      borderPulseLoop.current?.stop();
      borderPulse.setValue(0);
    }
    return () => {
      borderPulseLoop.current?.stop();
    };
  }, [isFocused]);

  // Availability check — debounced 600ms
  const runAvailabilityCheck = useCallback(async (value: string) => {
    const formatError = validateFormat(value);
    if (formatError) {
      setValidation({ status: 'error', message: formatError });
      return;
    }

    if (!user) return;

    setValidation({ status: 'checking' });
    const available = await checkNicknameAvailable(value, user.id);

    if (available) {
      setValidation({ status: 'valid', message: `${value} is available!` });
    } else {
      setValidation({ status: 'taken' });
    }
  }, [user]);

  function handleChangeText(value: string) {
    // Strip spaces immediately
    const cleaned = value.replace(/\s/g, '');
    setNickname(cleaned);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (cleaned.length === 0) {
      setValidation({ status: 'idle' });
      return;
    }

    const formatError = validateFormat(cleaned);
    if (formatError) {
      setValidation({ status: 'error', message: formatError });
      return;
    }

    // Valid format — debounce the network check
    setValidation({ status: 'checking' });
    debounceTimer.current = setTimeout(() => {
      runAvailabilityCheck(cleaned);
    }, 600);
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  async function handleContinue() {
    if (!user || validation.status !== 'valid') return;
    setIsSaving(true);
    try {
      await updateProfile(user.id, { nickname: nickname.trim().toLowerCase() });
      router.push('/(onboarding)/intro');
    } finally {
      setIsSaving(false);
    }
  }

  const isCtaEnabled = validation.status === 'valid' && !isSaving;

  // Interpolate border color for pulsing focused state
  const borderColor = borderPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [OB.accentBorder, OB.accent],
  });

  // Derive input border style
  function getInputBorderColor(): string {
    if (!isFocused) return OB.border;
    return OB.accentBorder;
  }

  // ---------------------------------------------------------------------------
  // Validation feedback line
  // ---------------------------------------------------------------------------

  function renderValidation() {
    if (nickname.length === 0) {
      return <Text style={styles.validationIdle}>3–20 characters · letters, numbers, _ –</Text>;
    }
    switch (validation.status) {
      case 'checking':
        return <Text style={styles.validationChecking}>Checking availability…</Text>;
      case 'valid':
        return (
          <Text style={styles.validationValid}>✓ {validation.message}</Text>
        );
      case 'taken':
        return <Text style={styles.validationError}>✗ That nickname is taken</Text>;
      case 'error':
        return <Text style={styles.validationError}>✗ {validation.message}</Text>;
      default:
        return <Text style={styles.validationIdle}>3–20 characters · letters, numbers, _ –</Text>;
    }
  }

  // ---------------------------------------------------------------------------
  // Preview card
  // ---------------------------------------------------------------------------

  function renderPreviewCard() {
    const displayNick = nickname.length > 0 ? `@${nickname}` : '@your_nickname';
    const isPlaceholder = nickname.length === 0;

    return (
      <View style={styles.previewCard}>
        <Text style={styles.previewLabel}>Preview</Text>
        <Text style={[styles.previewNickname, isPlaceholder && styles.previewPlaceholder]}>
          {displayNick}
        </Text>
        <Text style={styles.previewSubtext}>Shown until check-in · first name revealed after</Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Background glow orb */}
      <View style={styles.glowOrb} pointerEvents="none" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
      </View>

      {/* Phase progress */}
      <OnboardingProgress phase={1} stepInPhase={1} stepsInPhase={2} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.body,
              {
                opacity: contentOpacity,
                transform: [{ translateY: contentY }],
              },
            ]}
          >
            {/* Hero */}
            <View style={styles.heroSection}>
              <View style={styles.heroCircle}>
                <Text style={styles.heroEmoji}>🎭</Text>
              </View>
              <Text style={styles.title}>Choose your nickname</Text>
              <Text style={styles.subtitle}>
                Your group sees this until you check in together — then your first name is revealed
              </Text>
            </View>

            {/* Input */}
            <View style={styles.inputSection}>
              <Animated.View
                style={[
                  styles.inputWrapper,
                  isFocused && {
                    borderColor: borderColor,
                    shadowColor: OB.accent,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.25,
                    shadowRadius: 10,
                    elevation: 4,
                  },
                  !isFocused && { borderColor: getInputBorderColor() },
                ]}
              >
                <Text style={styles.inputAtSign}>@</Text>
                <TextInput
                  style={styles.input}
                  value={nickname}
                  onChangeText={handleChangeText}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="e.g. aurora_22"
                  placeholderTextColor={OB.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  maxLength={20}
                  returnKeyType="done"
                />
              </Animated.View>

              {/* Validation feedback */}
              <View style={styles.validationRow}>
                {renderValidation()}
              </View>

              {/* Preview card */}
              {renderPreviewCard()}
            </View>
          </Animated.View>
        </ScrollView>

        {/* Footer CTA */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.ctaButton,
              !isCtaEnabled && styles.ctaButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!isCtaEnabled}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaButtonText}>
              {isSaving ? 'Saving…' : 'Continue'}
            </Text>
            {!isSaving ? (
              <Text style={styles.ctaButtonArrow}>→</Text>
            ) : null}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    backgroundColor: OB.bg,
  },

  // Glow orb
  glowOrb: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: OB.accent,
    opacity: 0.08,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: OB.surface,
    borderWidth: 1,
    borderColor: OB.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 18,
    color: OB.text,
    lineHeight: 22,
  },
  // Scroll
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    flexGrow: 1,
  },

  body: {
    flex: 1,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 36,
  },
  heroCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(123,108,246,0.18)',
    borderWidth: 1,
    borderColor: OB.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  heroEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: OB.text,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: OB.textSub,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },

  // Input section
  inputSection: {
    gap: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: OB.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  inputAtSign: {
    fontSize: 18,
    color: OB.textMuted,
    fontWeight: '600',
    lineHeight: 24,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: OB.text,
    padding: 0,
    letterSpacing: 0.1,
  },

  // Validation
  validationRow: {
    minHeight: 20,
    paddingHorizontal: 4,
  },
  validationIdle: {
    fontSize: 13,
    color: OB.textMuted,
  },
  validationChecking: {
    fontSize: 13,
    color: OB.warning,
    fontWeight: '500',
  },
  validationValid: {
    fontSize: 13,
    color: OB.success,
    fontWeight: '600',
  },
  validationError: {
    fontSize: 13,
    color: OB.error,
    fontWeight: '500',
  },

  // Preview card
  previewCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: OB.border,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: OB.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  previewNickname: {
    fontSize: 22,
    fontWeight: '700',
    color: OB.text,
    letterSpacing: -0.3,
  },
  previewPlaceholder: {
    color: OB.textMuted,
    fontWeight: '400',
  },
  previewSubtext: {
    fontSize: 12,
    color: OB.textMuted,
    marginTop: 2,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: OB.border,
    backgroundColor: OB.bg,
  },
  ctaButton: {
    backgroundColor: OB.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: OB.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaButtonDisabled: {
    opacity: 0.35,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: OB.text,
    letterSpacing: 0.2,
  },
  ctaButtonArrow: {
    fontSize: 17,
    fontWeight: '700',
    color: OB.text,
    marginLeft: 6,
  },
});

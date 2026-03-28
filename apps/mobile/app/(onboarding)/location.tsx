import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../store/authStore';
import { updateProfile } from '../../lib/api/auth';
import { OnboardingProgress } from '../../components/onboarding/OnboardingProgress';

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const OB = {
  bg: '#0C0C1A',
  surface: '#13132B',
  accent: '#7B6CF6',
  accentLight: 'rgba(123,108,246,0.12)',
  accentBorder: 'rgba(123,108,246,0.35)',
  text: '#FFFFFF',
  textSub: '#9CA3AF',
  textMuted: '#6B7280',
  border: 'rgba(255,255,255,0.07)',
  error: '#F87171',
};

// ---------------------------------------------------------------------------
// Travel radius options
// ---------------------------------------------------------------------------

const RADIUS_OPTIONS = [
  { label: '5 km', value: 5 },
  { label: '10 km', value: 10 },
  { label: '15 km', value: 15 },
  { label: '20 km', value: 20 },
  { label: '30 km', value: 30 },
];

const DEFAULT_RADIUS = 10;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function LocationScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [travelRadius, setTravelRadius] = useState<number>(DEFAULT_RADIUS);
  const [cityFocused, setCityFocused] = useState(false);
  const [neighborhoodFocused, setNeighborhoodFocused] = useState(false);
  const [cityError, setCityError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(28)).current;

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

  async function handleContinue() {
    if (!user || isSaving) return;

    if (!city.trim()) {
      setCityError('Please enter your city');
      return;
    }

    setCityError('');
    setIsSaving(true);
    try {
      await updateProfile(user.id, {
        city: city.trim(),
        neighborhood: neighborhood.trim() || null,
        travel_radius_km: travelRadius,
      });
      router.push('/(onboarding)/match-intro');
    } finally {
      setIsSaving(false);
    }
  }

  const canContinue = city.trim().length > 0;

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
      <OnboardingProgress phase={3} stepInPhase={1} stepsInPhase={8} />

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
              { opacity: contentOpacity, transform: [{ translateY: contentY }] },
            ]}
          >
            {/* Hero */}
            <View style={styles.heroSection}>
              <View style={styles.heroCircle}>
                <Text style={styles.heroEmoji}>📍</Text>
              </View>
              <Text style={styles.title}>Where are you based?</Text>
              <Text style={styles.subtitle}>
                We use this to match you with people nearby
              </Text>
            </View>

            {/* City input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Your city</Text>
              <TextInput
                style={[
                  styles.input,
                  cityFocused && styles.inputFocused,
                  !!cityError && styles.inputError,
                ]}
                placeholder="e.g. New York"
                placeholderTextColor={OB.textMuted}
                value={city}
                onChangeText={(text) => {
                  setCity(text);
                  if (cityError) setCityError('');
                }}
                onFocus={() => setCityFocused(true)}
                onBlur={() => setCityFocused(false)}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
              />
              {!!cityError && (
                <Text style={styles.errorText}>{cityError}</Text>
              )}
            </View>

            {/* Neighborhood input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Your neighborhood</Text>
              <TextInput
                style={[
                  styles.input,
                  neighborhoodFocused && styles.inputFocused,
                ]}
                placeholder="e.g. Brooklyn, Lower East Side"
                placeholderTextColor={OB.textMuted}
                value={neighborhood}
                onChangeText={setNeighborhood}
                onFocus={() => setNeighborhoodFocused(true)}
                onBlur={() => setNeighborhoodFocused(false)}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
              />
            </View>

            {/* Travel radius */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>How far are you willing to travel?</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillsRow}
              >
                {RADIUS_OPTIONS.map((option) => {
                  const isSelected = travelRadius === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.pill,
                        isSelected ? styles.pillSelected : styles.pillUnselected,
                      ]}
                      onPress={() => setTravelRadius(option.value)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          isSelected ? styles.pillTextSelected : styles.pillTextUnselected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={styles.radiusNote}>
                We only use this to find nearby venues and people
              </Text>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Footer CTA */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.ctaButton, !canContinue && styles.ctaButtonDisabled]}
            onPress={handleContinue}
            disabled={!canContinue || isSaving}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaButtonText}>
              {isSaving ? 'Saving…' : 'Continue →'}
            </Text>
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
  container: {
    flex: 1,
    backgroundColor: OB.bg,
  },
  flex: {
    flex: 1,
  },

  // Glow orb
  glowOrb: {
    position: 'absolute',
    top: -80,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(123,108,246,0.14)',
    opacity: 1,
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
    paddingTop: 28,
    paddingBottom: 32,
  },
  heroCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: OB.accentLight,
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
    fontSize: 28,
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

  // Form fields
  fieldGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: OB.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: OB.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: OB.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: OB.text,
  },
  inputFocused: {
    borderColor: OB.accent,
  },
  inputError: {
    borderColor: OB.error,
  },
  errorText: {
    fontSize: 13,
    color: OB.error,
    marginTop: 6,
  },

  // Travel radius pills
  pillsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 2,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  pillSelected: {
    backgroundColor: OB.accent,
    borderColor: OB.accent,
  },
  pillUnselected: {
    backgroundColor: OB.surface,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pillTextSelected: {
    color: OB.text,
  },
  pillTextUnselected: {
    color: OB.textSub,
  },
  radiusNote: {
    fontSize: 12,
    color: OB.textMuted,
    marginTop: 10,
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
    shadowColor: OB.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaButtonDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: OB.text,
    letterSpacing: 0.2,
  },
});

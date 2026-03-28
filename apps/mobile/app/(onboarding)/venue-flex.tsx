import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
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
  orange: '#FB923C',
  orangeLight: 'rgba(251,146,60,0.15)',
  orangeBorder: 'rgba(251,146,60,0.3)',
  green: '#34D399',
  greenLight: 'rgba(52,211,153,0.12)',
  greenBorder: 'rgba(52,211,153,0.3)',
  text: '#FFFFFF',
  textSub: '#9CA3AF',
  textMuted: '#6B7280',
  border: 'rgba(255,255,255,0.07)',
};

type VenueFlexOption = 'flexible' | 'prefer_original' | 'strict';

interface OptionCard {
  id: VenueFlexOption;
  icon: string;
  title: string;
  subtitle: string;
  popular?: boolean;
}

const OPTIONS: OptionCard[] = [
  {
    id: 'flexible',
    icon: '🌊',
    title: 'Go with the flow',
    subtitle: 'Happy to switch venues if needed. Surprise me!',
    popular: true,
  },
  {
    id: 'prefer_original',
    icon: '🏠',
    title: 'Prefer the original spot',
    subtitle: "I'd like to stay at the planned venue if possible.",
  },
  {
    id: 'strict',
    icon: '📌',
    title: 'Need to stick to the plan',
    subtitle: 'I have accessibility or other needs that make changes difficult.',
  },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function VenueFlexScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [selected, setSelected] = useState<VenueFlexOption>('flexible');
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
    setIsSaving(true);
    try {
      await updateProfile(user.id, { venue_flexibility: selected });
      router.push('/(onboarding)/location');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Background glow orb — orange tint */}
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
      <OnboardingProgress phase={2} stepInPhase={2} stepsInPhase={2} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
            <Text style={styles.title}>Venue changes — how flexible are you?</Text>
            <Text style={styles.subtitle}>
              Sometimes we need to swap venues last minute
            </Text>
          </View>

          {/* Option cards */}
          <View style={styles.cardsContainer}>
            {OPTIONS.map((option) => {
              const isSelected = selected === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.card,
                    isSelected && styles.cardSelected,
                  ]}
                  onPress={() => setSelected(option.id)}
                  activeOpacity={0.8}
                >
                  {/* Most popular badge */}
                  {option.popular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>Most popular</Text>
                    </View>
                  )}

                  <View style={styles.cardContent}>
                    <View style={styles.cardIconWrapper}>
                      <Text style={styles.cardIcon}>{option.icon}</Text>
                    </View>
                    <View style={styles.cardText}>
                      <Text style={styles.cardTitle}>{option.title}</Text>
                      <Text style={styles.cardSubtitle}>{option.subtitle}</Text>
                    </View>
                  </View>

                  {/* Selection indicator */}
                  <View
                    style={[
                      styles.selectionDot,
                      isSelected && styles.selectionDotActive,
                    ]}
                  >
                    {isSelected && <View style={styles.selectionDotInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleContinue}
          disabled={isSaving}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaButtonText}>
            {isSaving ? 'Saving…' : "Done — let's go! ✦"}
          </Text>
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
    backgroundColor: OB.bg,
  },

  // Glow orb — orange tint
  glowOrb: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(251,146,60,0.18)',
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
    backgroundColor: OB.orangeLight,
    borderWidth: 1,
    borderColor: OB.orangeBorder,
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

  // Cards
  cardsContainer: {
    gap: 12,
  },
  card: {
    backgroundColor: OB.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: OB.border,
    padding: 18,
    position: 'relative',
  },
  cardSelected: {
    borderColor: OB.accent,
    backgroundColor: OB.accentLight,
  },
  popularBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.3)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  popularBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: OB.green,
    letterSpacing: 0.2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingRight: 28,
  },
  cardIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  cardIcon: {
    fontSize: 22,
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: OB.text,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: OB.textSub,
    lineHeight: 19,
  },

  // Selection dot
  selectionDot: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: OB.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionDotActive: {
    borderColor: OB.accent,
    backgroundColor: OB.accentLight,
  },
  selectionDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: OB.accent,
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
  ctaButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: OB.text,
    letterSpacing: 0.2,
  },
});

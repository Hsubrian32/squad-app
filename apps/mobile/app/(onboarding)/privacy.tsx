import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingProgress } from '../../components/onboarding/OnboardingProgress';

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const OB = {
  bg: '#0C0C1A',
  surface: '#13132B',
  accent: '#7B6CF6',
  accentLight: 'rgba(123,108,246,0.12)',
  accentBorder: 'rgba(123,108,246,0.3)',
  pink: '#F472B6',
  pinkLight: 'rgba(244,114,182,0.1)',
  green: '#34D399',
  greenLight: 'rgba(52,211,153,0.1)',
  gold: '#FBBF24',
  goldLight: 'rgba(251,191,36,0.1)',
  text: '#FFFFFF',
  textSub: '#9CA3AF',
  textMuted: '#6B7280',
  border: 'rgba(255,255,255,0.07)',
};

// ---------------------------------------------------------------------------
// The three stages of the reveal
// ---------------------------------------------------------------------------

const STAGES = [
  {
    step: '1',
    icon: '🎭',
    color: OB.accent,
    bg: OB.accentLight,
    border: OB.accentBorder,
    title: 'Before you meet',
    body: 'Your group sees your nickname, age range, neighborhood, vibe tags, and intro — nothing more.',
  },
  {
    step: '2',
    icon: '✅',
    color: OB.green,
    bg: OB.greenLight,
    border: 'rgba(52,211,153,0.25)',
    title: 'Check in at the venue',
    body: 'Your first name is revealed to the group the moment you check in. The mystery unlocks in real time.',
  },
  {
    step: '3',
    icon: '🏛️',
    color: OB.gold,
    bg: OB.goldLight,
    border: 'rgba(251,191,36,0.25)',
    title: 'After the meetup',
    body: 'Your full profile stays visible to that group forever — a memory of everyone you met.',
  },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function PrivacyScreen() {
  const router = useRouter();

  const glowOpacity = useRef(new Animated.Value(0)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(20)).current;
  const stage1Opacity = useRef(new Animated.Value(0)).current;
  const stage1Y = useRef(new Animated.Value(16)).current;
  const stage2Opacity = useRef(new Animated.Value(0)).current;
  const stage2Y = useRef(new Animated.Value(16)).current;
  const stage3Opacity = useRef(new Animated.Value(0)).current;
  const stage3Y = useRef(new Animated.Value(16)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(glowOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(heroY, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(stage1Opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(stage1Y, { toValue: 0, tension: 65, friction: 12, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(stage2Opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(stage2Y, { toValue: 0, tension: 65, friction: 12, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(stage3Opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(stage3Y, { toValue: 0, tension: 65, friction: 12, useNativeDriver: true }),
      ]),
      Animated.timing(ctaOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const stageAnims = [
    { opacity: stage1Opacity, y: stage1Y },
    { opacity: stage2Opacity, y: stage2Y },
    { opacity: stage3Opacity, y: stage3Y },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Background glow */}
      <Animated.View style={[styles.glowOrb, { opacity: glowOpacity }]} pointerEvents="none" />

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
      <OnboardingProgress phase={2} stepInPhase={1} stepsInPhase={2} />

      {/* Hero */}
      <Animated.View
        style={[
          styles.heroSection,
          { opacity: heroOpacity, transform: [{ translateY: heroY }] },
        ]}
      >
        <View style={styles.heroCircle}>
          <Text style={styles.heroEmoji}>🔐</Text>
        </View>
        <Text style={styles.title}>Your identity is{'\n'}your first impression</Text>
        <Text style={styles.subtitle}>
          Everyone starts as a mystery. Here's how it unfolds.
        </Text>
      </Animated.View>

      {/* Timeline stages */}
      <View style={styles.stagesContainer}>
        {STAGES.map((stage, i) => (
          <Animated.View
            key={stage.step}
            style={[
              styles.stageRow,
              {
                opacity: stageAnims[i].opacity,
                transform: [{ translateY: stageAnims[i].y }],
              },
            ]}
          >
            {/* Connector line (not on last item) */}
            {i < STAGES.length - 1 && (
              <View style={styles.connectorLine} />
            )}

            {/* Step circle */}
            <View style={[styles.stepCircle, { backgroundColor: stage.bg, borderColor: stage.border }]}>
              <Text style={styles.stepEmoji}>{stage.icon}</Text>
            </View>

            {/* Text */}
            <View style={styles.stageText}>
              <Text style={[styles.stageTitle, { color: stage.color }]}>{stage.title}</Text>
              <Text style={styles.stageBody}>{stage.body}</Text>
            </View>
          </Animated.View>
        ))}
      </View>

      {/* Footer */}
      <Animated.View style={[styles.footer, { opacity: ctaOpacity }]}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push('/(onboarding)/venue-flex')}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaButtonText}>Got it  →</Text>
        </TouchableOpacity>
      </Animated.View>
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
  glowOrb: {
    position: 'absolute',
    top: -120,
    left: -80,
    width: 340,
    height: 340,
    borderRadius: 170,
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
  // Hero
  heroSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 28,
    paddingHorizontal: 24,
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
    marginBottom: 18,
    shadowColor: OB.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  heroEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: OB.text,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 15,
    color: OB.textSub,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Timeline
  stagesContainer: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 0,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 4,
    position: 'relative',
  },
  connectorLine: {
    position: 'absolute',
    left: 21,
    top: 52,
    width: 2,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.07)',
    zIndex: 0,
  },
  stepCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    zIndex: 1,
    marginTop: 2,
  },
  stepEmoji: {
    fontSize: 20,
  },
  stageText: {
    flex: 1,
    paddingBottom: 24,
  },
  stageTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.1,
  },
  stageBody: {
    fontSize: 13,
    color: OB.textSub,
    lineHeight: 19,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: OB.border,
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

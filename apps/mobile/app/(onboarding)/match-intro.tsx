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
  accentLight: 'rgba(123,108,246,0.15)',
  accentBorder: 'rgba(123,108,246,0.35)',
  text: '#FFFFFF',
  textSub: '#9CA3AF',
  textMuted: '#6B7280',
  border: 'rgba(255,255,255,0.07)',
  pink: '#F472B6',
  gold: '#FBBF24',
  green: '#34D399',
};

// ---------------------------------------------------------------------------
// Feature rows — short, punchy value props
// ---------------------------------------------------------------------------

const FEATURES: { icon: string; text: string }[] = [
  {
    icon: '⚡',
    text: 'Your answers shape your match — no algorithm guesswork',
  },
  {
    icon: '🎯',
    text: '7 quick questions to find your people',
  },
  {
    icon: '✨',
    text: 'Takes about 2 minutes — worth every second',
  },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MatchIntroScreen() {
  const router = useRouter();

  // Staggered entrance animations
  const glow1Opacity   = useRef(new Animated.Value(0)).current;
  const glow2Opacity   = useRef(new Animated.Value(0)).current;
  const badgeOpacity   = useRef(new Animated.Value(0)).current;
  const badgeY         = useRef(new Animated.Value(-10)).current;
  const heroOpacity    = useRef(new Animated.Value(0)).current;
  const heroScale      = useRef(new Animated.Value(0.6)).current;
  const titleOpacity   = useRef(new Animated.Value(0)).current;
  const titleY         = useRef(new Animated.Value(18)).current;
  const bodyOpacity    = useRef(new Animated.Value(0)).current;
  const featuresOpacity = useRef(new Animated.Value(0)).current;
  const ctaOpacity     = useRef(new Animated.Value(0)).current;
  const ctaY           = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    // Glows
    Animated.timing(glow1Opacity, {
      toValue: 1, duration: 800, useNativeDriver: true,
    }).start();
    setTimeout(() => {
      Animated.timing(glow2Opacity, {
        toValue: 1, duration: 600, useNativeDriver: true,
      }).start();
    }, 200);

    // Badge drops in
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(badgeOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.spring(badgeY, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
      ]).start();
    }, 100);

    // Hero icon pops in
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(heroScale, { toValue: 1, tension: 65, friction: 8, useNativeDriver: true }),
      ]).start();
    }, 250);

    // Title slides up
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(titleY, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
      ]).start();
    }, 420);

    // Body text
    setTimeout(() => {
      Animated.timing(bodyOpacity, { toValue: 1, duration: 340, useNativeDriver: true }).start();
    }, 560);

    // Feature list
    setTimeout(() => {
      Animated.timing(featuresOpacity, { toValue: 1, duration: 380, useNativeDriver: true }).start();
    }, 680);

    // CTA rises in
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(ctaOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(ctaY, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
      ]).start();
    }, 800);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container}>
      {/* Atmospheric glow orbs */}
      <Animated.View style={[styles.glow1, { opacity: glow1Opacity }]} pointerEvents="none" />
      <Animated.View style={[styles.glow2, { opacity: glow2Opacity }]} pointerEvents="none" />

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

      {/* Phase progress — entering phase 3 */}
      <OnboardingProgress phase={3} stepInPhase={0} stepsInPhase={8} />

      {/* ── Main content ─────────────────────────────────────────────── */}
      <View style={styles.content}>

        {/* "Phase 3 of 3" badge */}
        <Animated.View
          style={[
            styles.badge,
            { opacity: badgeOpacity, transform: [{ translateY: badgeY }] },
          ]}
        >
          <Text style={styles.badgeText}>✦  Phase 3 of 3</Text>
        </Animated.View>

        {/* Hero sparkle icon */}
        <Animated.View
          style={[
            styles.heroCircle,
            { opacity: heroOpacity, transform: [{ scale: heroScale }] },
          ]}
        >
          <Text style={styles.heroEmoji}>✨</Text>
        </Animated.View>

        {/* Headline */}
        <Animated.Text
          style={[
            styles.headline,
            { opacity: titleOpacity, transform: [{ translateY: titleY }] },
          ]}
        >
          Now, let's make your{'\n'}matches feel like{'\n'}
          <Text style={styles.headlineAccent}>your people.</Text>
        </Animated.Text>

        {/* Sub-copy */}
        <Animated.Text style={[styles.subheadline, { opacity: bodyOpacity }]}>
          A few quick questions help us handpick a group
          that actually fits your energy — not just proximity.
        </Animated.Text>

        {/* Feature bullets */}
        <Animated.View style={[styles.features, { opacity: featuresOpacity }]}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.footer,
          { opacity: ctaOpacity, transform: [{ translateY: ctaY }] },
        ]}
      >
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push('/(onboarding)/questionnaire')}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>Start matching</Text>
          <Text style={styles.ctaArrow}>→</Text>
        </TouchableOpacity>

        <Text style={styles.ctaFootnote}>7 questions · about 2 minutes</Text>
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

  // Glow orbs
  glow1: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: OB.accent,
    opacity: 0.07,
  },
  glow2: {
    position: 'absolute',
    bottom: 60,
    left: -100,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: OB.pink,
    opacity: 0.05,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
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

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    justifyContent: 'center',
  },

  // Phase badge
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: OB.accentLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: OB.accentBorder,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 28,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: OB.accent,
    letterSpacing: 0.3,
  },

  // Hero circle
  heroCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(123,108,246,0.15)',
    borderWidth: 1,
    borderColor: OB.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  heroEmoji: {
    fontSize: 36,
  },

  // Headline
  headline: {
    fontSize: 34,
    fontWeight: '800',
    color: OB.text,
    lineHeight: 42,
    letterSpacing: -0.8,
    marginBottom: 14,
  },
  headlineAccent: {
    color: OB.accent,
  },

  // Sub-copy
  subheadline: {
    fontSize: 15,
    color: OB.textSub,
    lineHeight: 23,
    marginBottom: 32,
    maxWidth: 320,
  },

  // Features
  features: {
    gap: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: OB.surface,
    borderWidth: 1,
    borderColor: OB.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  featureIcon: {
    fontSize: 15,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: OB.textSub,
    lineHeight: 21,
  },

  // Footer / CTA
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: OB.border,
  },
  ctaButton: {
    backgroundColor: OB.accent,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: OB.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 6,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  ctaArrow: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  ctaFootnote: {
    fontSize: 12,
    color: OB.textMuted,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});

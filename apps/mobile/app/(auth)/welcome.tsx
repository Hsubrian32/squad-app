import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width, height } = Dimensions.get('window');

const BG = '#0C0C1A';
const ACCENT = '#7B6CF6';
const ACCENT_GLOW = 'rgba(123, 108, 246, 0.22)';
const ACCENT_SOFT = 'rgba(123, 108, 246, 0.12)';
const ACCENT_BORDER = 'rgba(123, 108, 246, 0.3)';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function WelcomeScreen() {
  const router = useRouter();

  // Entrance animations
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoY = useRef(new Animated.Value(20)).current;
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineY = useRef(new Animated.Value(24)).current;
  const cardsOpacity = useRef(new Animated.Value(0)).current;
  const cardsY = useRef(new Animated.Value(32)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaY = useRef(new Animated.Value(24)).current;

  // Idle glow pulse
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // Glow orb
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(glowScale, { toValue: 1, tension: 30, friction: 10, useNativeDriver: true }),
      ]),
      // Logo mark
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(logoY, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
      ]),
      // Headline
      Animated.parallel([
        Animated.timing(headlineOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.spring(headlineY, { toValue: 0, tension: 55, friction: 10, useNativeDriver: true }),
      ]),
      // Cards
      Animated.parallel([
        Animated.timing(cardsOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.spring(cardsY, { toValue: 0, tension: 55, friction: 10, useNativeDriver: true }),
      ]),
      // CTA
      Animated.parallel([
        Animated.timing(ctaOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(ctaY, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
      ]),
    ]).start(() => {
      // Idle pulse loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.1, duration: 2200, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 2200, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Background glow */}
      <Animated.View
        style={[
          styles.glowOrb,
          {
            opacity: glowOpacity,
            transform: [{ scale: Animated.multiply(glowScale, pulse) }],
          },
        ]}
        pointerEvents="none"
      />
      <Animated.View
        style={[styles.glowOrbSecondary, { opacity: glowOpacity }]}
        pointerEvents="none"
      />

      {/* Content */}
      <View style={styles.content}>
        {/* Logo mark */}
        <Animated.View
          style={[
            styles.logoSection,
            { opacity: logoOpacity, transform: [{ translateY: logoY }] },
          ]}
        >
          <View style={styles.logoMarkOuter}>
            <View style={styles.logoMarkInner}>
              <Text style={styles.logoMarkText}>S</Text>
            </View>
          </View>
          <Text style={styles.appName}>Squad</Text>
          <View style={styles.exclusiveBadge}>
            <Text style={styles.exclusiveBadgeText}>By invite & application</Text>
          </View>
        </Animated.View>

        {/* Headline */}
        <Animated.View
          style={{
            opacity: headlineOpacity,
            transform: [{ translateY: headlineY }],
            alignItems: 'center',
          }}
        >
          <Text style={styles.headline}>
            Real groups.{'\n'}Real nights out.
          </Text>
          <Text style={styles.subheadline}>
            We match you with 5–7 people every week — not an endless feed of strangers.
          </Text>
        </Animated.View>

        {/* Feature cards */}
        <Animated.View
          style={[
            styles.cardsGrid,
            { opacity: cardsOpacity, transform: [{ translateY: cardsY }] },
          ]}
        >
          <FeatureCard
            emoji="🎲"
            title="Curated matches"
            body="Based on vibe, interests & goals"
            accentColor="#7B6CF6"
          />
          <FeatureCard
            emoji="📍"
            title="Perfect venue"
            body="Hand-picked spot, every time"
            accentColor="#E86FC5"
          />
          <FeatureCard
            emoji="🗓️"
            title="Once a week"
            body="No pressure. Just show up."
            accentColor="#F5A623"
          />
          <FeatureCard
            emoji="🔒"
            title="Private by default"
            body="Your profile stays hidden until you check in"
            accentColor="#4ECDC4"
          />
        </Animated.View>
      </View>

      {/* CTA */}
      <Animated.View
        style={[
          styles.footer,
          { opacity: ctaOpacity, transform: [{ translateY: ctaY }] },
        ]}
      >
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(auth)/sign-up')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ghostButton}
          onPress={() => router.push('/(auth)/sign-in')}
          activeOpacity={0.7}
        >
          <Text style={styles.ghostButtonText}>
            Already a member?{'  '}
            <Text style={styles.ghostButtonAccent}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FeatureCard({
  emoji,
  title,
  body,
  accentColor,
}: {
  emoji: string;
  title: string;
  body: string;
  accentColor: string;
}) {
  return (
    <View
      style={[
        styles.featureCard,
        { borderColor: `${accentColor}22` },
      ]}
    >
      <View style={[styles.featureCardIcon, { backgroundColor: `${accentColor}18` }]}>
        <Text style={styles.featureCardEmoji}>{emoji}</Text>
      </View>
      <Text style={styles.featureCardTitle}>{title}</Text>
      <Text style={styles.featureCardBody}>{body}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  // Glow orbs
  glowOrb: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: ACCENT_GLOW,
    top: -100,
    alignSelf: 'center',
  },
  glowOrbSecondary: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(232, 111, 197, 0.12)',
    bottom: 120,
    right: -60,
  },

  // Content
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 32,
  },

  // Logo
  logoSection: {
    alignItems: 'center',
    gap: 10,
  },
  logoMarkOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: ACCENT_SOFT,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  logoMarkInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMarkText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.8,
  },
  exclusiveBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  exclusiveBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Headline
  headline: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 44,
    marginBottom: 12,
  },
  subheadline: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.48)',
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 300,
  },

  // Cards grid
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
  },
  featureCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 6,
  },
  featureCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  featureCardEmoji: {
    fontSize: 18,
  },
  featureCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  featureCardBody: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.42)',
    lineHeight: 17,
  },

  // Footer / CTA
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 10,
    alignItems: 'center',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  ghostButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.38)',
  },
  ghostButtonAccent: {
    color: ACCENT,
    fontWeight: '600',
  },
});

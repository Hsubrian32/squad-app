import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { track } from '../../lib/analytics';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width, height } = Dimensions.get('window');

const BG = '#0C0C1A';
const ACCENT = '#7B6CF6';
const ACCENT_GLOW = 'rgba(123, 108, 246, 0.25)';
const ACCENT_SOFT = 'rgba(123, 108, 246, 0.12)';
const GOLD = '#F5C842';
const GOLD_GLOW = 'rgba(245, 200, 66, 0.2)';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function OnboardingCompleteScreen() {
  const router = useRouter();

  // Fire once when this screen mounts — onboarding is fully complete
  useEffect(() => {
    track('onboarding_completed');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animation refs
  const glowScale = useRef(new Animated.Value(0.6)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(24)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleY = useRef(new Animated.Value(16)).current;
  const pillsOpacity = useRef(new Animated.Value(0)).current;
  const pillsY = useRef(new Animated.Value(20)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaY = useRef(new Animated.Value(24)).current;

  // Pulsing glow loop
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance sequence
    Animated.sequence([
      // 1. Glow orb fades + scales in
      Animated.parallel([
        Animated.spring(glowScale, {
          toValue: 1,
          tension: 40,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // 2. Check / emoji pops in
      Animated.spring(checkScale, {
        toValue: 1,
        tension: 60,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(checkOpacity, {
        toValue: 1,
        duration: 1,
        useNativeDriver: true,
      }),
      // 3. Title slides up
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(titleY, {
          toValue: 0,
          tension: 60,
          friction: 10,
          useNativeDriver: true,
        }),
      ]),
      // 4. Subtitle
      Animated.parallel([
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(subtitleY, {
          toValue: 0,
          tension: 60,
          friction: 10,
          useNativeDriver: true,
        }),
      ]),
      // 5. Pills
      Animated.parallel([
        Animated.timing(pillsOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(pillsY, {
          toValue: 0,
          tension: 60,
          friction: 10,
          useNativeDriver: true,
        }),
      ]),
      // 6. CTA button
      Animated.parallel([
        Animated.timing(ctaOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(ctaY, {
          toValue: 0,
          tension: 60,
          friction: 10,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // Start glow pulse after entrance
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });

    // Also start checkOpacity immediately after checkScale starts
    setTimeout(() => {
      Animated.timing(checkOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, 700);
  }, []);

  function handleContinue() {
    router.replace('/(app)');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Background glow orbs */}
      <Animated.View
        style={[
          styles.glowOrb,
          styles.glowOrbTop,
          {
            opacity: Animated.multiply(glowOpacity, new Animated.Value(0.7)),
            transform: [{ scale: Animated.multiply(glowScale, pulseAnim) }],
          },
        ]}
        pointerEvents="none"
      />
      <Animated.View
        style={[
          styles.glowOrb,
          styles.glowOrbBottom,
          {
            opacity: Animated.multiply(glowOpacity, new Animated.Value(0.4)),
            transform: [{ scale: glowScale }],
          },
        ]}
        pointerEvents="none"
      />

      <View style={styles.content}>
        {/* Hero check circle */}
        <Animated.View
          style={[
            styles.heroCircleOuter,
            {
              opacity: glowOpacity,
              transform: [{ scale: Animated.multiply(glowScale, pulseAnim) }],
            },
          ]}
        >
          <View style={styles.heroCircleInner}>
            <Animated.Text
              style={[
                styles.heroEmoji,
                {
                  opacity: checkOpacity,
                  transform: [{ scale: checkScale }],
                },
              ]}
            >
              ✦
            </Animated.Text>
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleY }],
            alignItems: 'center',
          }}
        >
          <Text style={styles.title}>You're in.</Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View
          style={{
            opacity: subtitleOpacity,
            transform: [{ translateY: subtitleY }],
            alignItems: 'center',
          }}
        >
          <Text style={styles.subtitle}>
            Matching happens every week.{'\n'}We'll notify you when your group is ready.
          </Text>
        </Animated.View>

        {/* Feature pills */}
        <Animated.View
          style={[
            styles.pillsContainer,
            {
              opacity: pillsOpacity,
              transform: [{ translateY: pillsY }],
            },
          ]}
        >
          <InfoPill emoji="📅" text="Every Monday you get your group" />
          <InfoPill emoji="📍" text="A real venue, already picked for you" />
          <InfoPill emoji="🎭" text="6–8 people matched to your vibe" />
        </Animated.View>
      </View>

      {/* CTA */}
      <Animated.View
        style={[
          styles.footer,
          {
            opacity: ctaOpacity,
            transform: [{ translateY: ctaY }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaButtonText}>Go to the app  →</Text>
        </TouchableOpacity>
        <Text style={styles.footerNote}>
          Your first match is on its way. See you there.
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoPill({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillEmoji}>{emoji}</Text>
      <Text style={styles.pillText}>{text}</Text>
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
    borderRadius: 9999,
  },
  glowOrbTop: {
    width: 340,
    height: 340,
    top: -80,
    alignSelf: 'center',
    backgroundColor: ACCENT_GLOW,
  },
  glowOrbBottom: {
    width: 260,
    height: 260,
    bottom: 60,
    right: -80,
    backgroundColor: GOLD_GLOW,
  },

  // Content
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 28,
  },

  // Hero circle
  heroCircleOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: ACCENT_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(123, 108, 246, 0.3)',
  },
  heroCircleInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 16,
  },
  heroEmoji: {
    fontSize: 36,
    color: '#FFFFFF',
  },

  // Title
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1.5,
    textAlign: 'center',
  },

  // Subtitle
  subtitle: {
    fontSize: 17,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 280,
  },

  // Pills
  pillsContainer: {
    width: '100%',
    gap: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 14,
  },
  pillEmoji: {
    fontSize: 20,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
    flex: 1,
  },

  // Footer
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 14,
  },
  ctaButton: {
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
  ctaButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  footerNote: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
  },
});

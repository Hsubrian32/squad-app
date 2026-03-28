import React, { useState, useRef, useEffect } from 'react';
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
import { updateProfile } from '../../lib/api/auth';
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
  accentBorder: 'rgba(123,108,246,0.4)',
  text: '#FFFFFF',
  textSub: '#9CA3AF',
  textMuted: '#6B7280',
  border: 'rgba(255,255,255,0.07)',
  green: '#34D399',
  greenLight: 'rgba(52,211,153,0.15)',
  greenBorder: 'rgba(52,211,153,0.35)',
};

const MAX_INTRO_CHARS = 80;

// ---------------------------------------------------------------------------
// Vibe tags
// ---------------------------------------------------------------------------

interface VibeTag {
  key: string;
  emoji: string;
  label: string;
}

const VIBE_TAGS: VibeTag[] = [
  { key: 'adventurous', emoji: '🚀', label: 'Adventurous' },
  { key: 'bookworm',    emoji: '📚', label: 'Bookworm'    },
  { key: 'foodie',      emoji: '🍜', label: 'Foodie'      },
  { key: 'creative',    emoji: '🎨', label: 'Creative'    },
  { key: 'outdoorsy',   emoji: '🏔️', label: 'Outdoorsy'   },
  { key: 'night_owl',   emoji: '🦉', label: 'Night owl'   },
  { key: 'gamer',       emoji: '🎮', label: 'Gamer'       },
  { key: 'wellness',    emoji: '🧘', label: 'Wellness'    },
  { key: 'music',       emoji: '🎵', label: 'Music'       },
  { key: 'traveler',    emoji: '✈️', label: 'Traveler'    },
  { key: 'sports',      emoji: '🏃', label: 'Sports'      },
  { key: 'chill',       emoji: '😌', label: 'Chill'       },
];

const MAX_TAGS = 3;

// Accent colors for selected vibe tag pills in the preview card
const TAG_PILL_COLORS = [OB.accent, OB.green, '#F472B6', '#FB923C', '#60A5FA'];
function tagPillColor(index: number): string {
  return TAG_PILL_COLORS[index % TAG_PILL_COLORS.length];
}

// ---------------------------------------------------------------------------
// TagChip sub-component
// ---------------------------------------------------------------------------

function TagChip({
  tag,
  selected,
  onPress,
}: {
  tag: VibeTag;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function animatePress() {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: selected ? 0.88 : 1.1,
        tension: 280,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function handlePress() {
    animatePress();
    onPress();
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={1}
      style={styles.chipTouchable}
    >
      <Animated.View
        style={[
          styles.chip,
          selected && styles.chipSelected,
          { transform: [{ scale }] },
        ]}
      >
        <Text style={styles.chipEmoji}>{tag.emoji}</Text>
        <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
          {tag.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function IntroScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [intro, setIntro] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Animated values
  const introSectionOpacity = useRef(new Animated.Value(0)).current;
  const introSectionY = useRef(new Animated.Value(24)).current;
  const tagsSectionOpacity = useRef(new Animated.Value(0)).current;
  const tagsSectionY = useRef(new Animated.Value(24)).current;

  // Shake animation refs for the tag limit warning
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Entrance — staggered fade-in
  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(introSectionOpacity, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.spring(introSectionY, {
          toValue: 0,
          tension: 60,
          friction: 11,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(tagsSectionOpacity, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.spring(tagsSectionY, {
          toValue: 0,
          tension: 60,
          friction: 11,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  function shakeTagGrid() {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0, duration: 40, useNativeDriver: true }),
    ]).start();
  }

  function toggleTag(key: string) {
    if (selectedTags.includes(key)) {
      setSelectedTags((prev) => prev.filter((k) => k !== key));
    } else {
      if (selectedTags.length >= MAX_TAGS) {
        shakeTagGrid();
        return;
      }
      setSelectedTags((prev) => [...prev, key]);
    }
  }

  async function handleContinue() {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateProfile(user.id, {
        intro: intro.trim() || null,
        vibe_tags: selectedTags,
      });
      router.push('/(onboarding)/privacy');
    } finally {
      setIsSaving(false);
    }
  }

  function handleSkip() {
    router.push('/(onboarding)/privacy');
  }

  const displayNickname = profile?.nickname
    ? `@${profile.nickname}`
    : profile?.first_name ?? profile?.display_name ?? 'You';

  const charCount = intro.length;
  const charCountColor =
    charCount >= MAX_INTRO_CHARS
      ? '#F87171'
      : charCount >= MAX_INTRO_CHARS * 0.85
      ? OB.accent
      : OB.textMuted;

  // ---------------------------------------------------------------------------
  // Preview mini-card
  // ---------------------------------------------------------------------------

  function renderPreviewCard() {
    const hasContent = intro.trim().length > 0 || selectedTags.length > 0;

    return (
      <View style={styles.previewCard}>
        <View style={styles.previewHeader}>
          <View style={styles.previewAvatarPlaceholder} />
          <View style={styles.previewMeta}>
            <Text style={styles.previewNickname}>{displayNickname}</Text>
            {!hasContent && (
              <Text style={styles.previewEmpty}>Your intro will appear here</Text>
            )}
          </View>
        </View>

        {intro.trim().length > 0 && (
          <Text style={styles.previewIntro} numberOfLines={2}>
            {intro.trim()}
          </Text>
        )}

        {selectedTags.length > 0 && (
          <View style={styles.previewTagsRow}>
            {selectedTags.map((key, idx) => {
              const tag = VIBE_TAGS.find((t) => t.key === key);
              if (!tag) return null;
              const color = tagPillColor(idx);
              return (
                <View
                  key={key}
                  style={[
                    styles.previewTagPill,
                    {
                      backgroundColor: `${color}18`,
                      borderColor: `${color}40`,
                    },
                  ]}
                >
                  <Text style={styles.previewTagEmoji}>{tag.emoji}</Text>
                  <Text style={[styles.previewTagLabel, { color }]}>
                    {tag.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.previewFooterRow}>
          <Text style={styles.previewFooterNote}>
            What your group sees before the meetup
          </Text>
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Background glow orbs */}
      <View style={styles.glowOrbTop} pointerEvents="none" />
      <View style={styles.glowOrbBottom} pointerEvents="none" />

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
      <OnboardingProgress phase={1} stepInPhase={2} stepsInPhase={2} />

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
          {/* ---- Section 1: Intro one-liner ---- */}
          <Animated.View
            style={[
              styles.section,
              {
                opacity: introSectionOpacity,
                transform: [{ translateY: introSectionY }],
              },
            ]}
          >
            <View style={styles.sectionHeroRow}>
              <View style={[styles.heroCircle, { backgroundColor: 'rgba(52,211,153,0.15)', borderColor: 'rgba(52,211,153,0.35)' }]}>
                <Text style={styles.heroEmoji}>✍️</Text>
              </View>
              <View style={styles.sectionTitles}>
                <Text style={styles.sectionTitle}>One line about you</Text>
                <Text style={styles.sectionSubtitle}>
                  What would you want your group to know?
                </Text>
              </View>
            </View>

            <View style={styles.introInputWrapper}>
              <TextInput
                style={styles.introInput}
                value={intro}
                onChangeText={(text) => {
                  if (text.length <= MAX_INTRO_CHARS) setIntro(text);
                }}
                placeholder="e.g. Love trivia nights and finding hidden gem restaurants"
                placeholderTextColor={OB.textMuted}
                multiline
                maxLength={MAX_INTRO_CHARS}
                returnKeyType="done"
                blurOnSubmit
                textAlignVertical="top"
              />
              <Text style={[styles.charCounter, { color: charCountColor }]}>
                {charCount}/{MAX_INTRO_CHARS}
              </Text>
            </View>
          </Animated.View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* ---- Section 2: Vibe tags ---- */}
          <Animated.View
            style={[
              styles.section,
              {
                opacity: tagsSectionOpacity,
                transform: [{ translateY: tagsSectionY }],
              },
            ]}
          >
            <View style={styles.tagsSectionHeader}>
              <Text style={styles.tagsLabel}>
                <Text style={styles.tagsSpark}>✦ </Text>
                Your vibe
                <Text style={styles.tagsLabelMuted}>  (pick up to 3)</Text>
              </Text>
              <Text style={styles.tagsSubtitle}>
                These show on your pre-meetup card
              </Text>
            </View>

            {/* Selection count badge */}
            {selectedTags.length > 0 && (
              <View style={styles.selectionBadge}>
                <Text style={styles.selectionBadgeText}>
                  {selectedTags.length}/{MAX_TAGS} selected
                </Text>
              </View>
            )}

            {/* Chip grid — shake on limit rejection */}
            <Animated.View
              style={[
                styles.chipsGrid,
                { transform: [{ translateX: shakeAnim }] },
              ]}
            >
              {VIBE_TAGS.map((tag) => (
                <TagChip
                  key={tag.key}
                  tag={tag}
                  selected={selectedTags.includes(tag.key)}
                  onPress={() => toggleTag(tag.key)}
                />
              ))}
            </Animated.View>
          </Animated.View>

          {/* Preview card */}
          <View style={styles.previewSection}>
            {renderPreviewCard()}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.ctaButton, isSaving && styles.ctaButtonDisabled]}
            onPress={handleContinue}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaButtonText}>
              {isSaving ? 'Saving…' : 'Continue →'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            activeOpacity={0.6}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
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

  // Glow orbs
  glowOrbTop: {
    position: 'absolute',
    top: -60,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: OB.accent,
    opacity: 0.07,
  },
  glowOrbBottom: {
    position: 'absolute',
    bottom: 80,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: OB.green,
    opacity: 0.05,
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
    paddingBottom: 24,
  },

  // Sections
  section: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  sectionHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 14,
  },
  heroCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroEmoji: {
    fontSize: 26,
  },
  sectionTitles: {
    flex: 1,
    gap: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: OB.text,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: OB.textSub,
    lineHeight: 18,
  },

  // Intro input
  introInputWrapper: {
    backgroundColor: OB.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: OB.border,
    padding: 14,
    minHeight: 96,
    position: 'relative',
  },
  introInput: {
    fontSize: 15,
    color: OB.text,
    lineHeight: 22,
    minHeight: 64,
    padding: 0,
    paddingBottom: 22,
  },
  charCounter: {
    position: 'absolute',
    bottom: 10,
    right: 14,
    fontSize: 12,
    fontWeight: '500',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: OB.border,
    marginHorizontal: 20,
  },

  // Tags section
  tagsSectionHeader: {
    marginBottom: 16,
    gap: 4,
  },
  tagsLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: OB.text,
  },
  tagsSpark: {
    color: OB.accent,
  },
  tagsLabelMuted: {
    fontSize: 14,
    fontWeight: '400',
    color: OB.textMuted,
  },
  tagsSubtitle: {
    fontSize: 13,
    color: OB.textSub,
  },
  selectionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: OB.accentLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: OB.accentBorder,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 14,
  },
  selectionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: OB.accent,
  },

  // Chip grid — 3 columns
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chipTouchable: {
    width: '30.5%',
  },
  chip: {
    backgroundColor: OB.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: OB.border,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 5,
    minHeight: 72,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: OB.accentBorder,
    backgroundColor: OB.accentLight,
    shadowColor: OB.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  chipEmoji: {
    fontSize: 24,
    lineHeight: 30,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: OB.textSub,
    textAlign: 'center',
    lineHeight: 16,
  },
  chipLabelSelected: {
    color: OB.accent,
    fontWeight: '600',
  },

  // Preview section
  previewSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  previewCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: OB.border,
    padding: 16,
    gap: 10,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: OB.accentLight,
    borderWidth: 1,
    borderColor: OB.accentBorder,
  },
  previewMeta: {
    flex: 1,
    gap: 2,
  },
  previewNickname: {
    fontSize: 15,
    fontWeight: '700',
    color: OB.text,
  },
  previewEmpty: {
    fontSize: 13,
    color: OB.textMuted,
    fontStyle: 'italic',
  },
  previewIntro: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
  },
  previewTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  previewTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  previewTagEmoji: {
    fontSize: 13,
  },
  previewTagLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewFooterRow: {
    borderTopWidth: 1,
    borderTopColor: OB.border,
    paddingTop: 8,
    marginTop: 2,
  },
  previewFooterNote: {
    fontSize: 11,
    color: OB.textMuted,
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: OB.border,
    backgroundColor: OB.bg,
    gap: 10,
    alignItems: 'center',
  },
  ctaButton: {
    width: '100%',
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
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: OB.text,
    letterSpacing: 0.2,
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  skipButtonText: {
    fontSize: 14,
    color: OB.textMuted,
    textDecorationLine: 'underline',
  },
});

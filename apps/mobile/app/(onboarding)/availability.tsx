import React, { useState, useRef } from 'react';
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
import { OnboardingProgress } from '../../components/onboarding/OnboardingProgress';
import { saveAvailabilitySlots } from '../../lib/api/availability';
import { markOnboardingComplete } from '../../lib/api/questionnaire';
import { optInToCurrentCycle } from '../../lib/api/matching';
import type { DayOfWeek, TimeSlot } from '../../constants/types';
import { DAY_NAMES } from '../../constants/types';

// ---------------------------------------------------------------------------
// Design tokens — premium dark palette
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
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun display order

const TIME_SLOTS: { key: TimeSlot; label: string; hours: string }[] = [
  { key: 'morning',   label: 'Morning',   hours: '9am–12pm' },
  { key: 'afternoon', label: 'Afternoon', hours: '12pm–5pm' },
  { key: 'evening',   label: 'Evening',   hours: '5pm–9pm'  },
  { key: 'night',     label: 'Night',     hours: '9pm–12am' },
];

// Weekdays (Mon–Fri) = day indices 1–5
const WEEKDAY_DAYS: DayOfWeek[] = [1, 2, 3, 4, 5];
// Weekend days (Sat=6, Sun=0)
const WEEKEND_DAYS: DayOfWeek[] = [6, 0];

type SlotKey = `${DayOfWeek}-${TimeSlot}`;

function slotKey(day: DayOfWeek, time: TimeSlot): SlotKey {
  return `${day}-${time}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function QuickSelectPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.pill,
        active ? styles.pillActive : null,
      ]}
    >
      <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SlotCell({
  active,
  onPress,
}: {
  active: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scale, {
      toValue: 0.88,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 160,
      friction: 10,
    }).start();
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={styles.slotCellWrapper}
    >
      <Animated.View
        style={[
          styles.slotCell,
          active ? styles.slotCellActive : null,
          { transform: [{ scale }] },
        ]}
      >
        {active ? (
          <Text style={styles.slotCheckmark}>✓</Text>
        ) : null}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function AvailabilityScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [selected, setSelected] = useState<Set<SlotKey>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- slot helpers --------------------------------------------------------

  function toggleSlot(day: DayOfWeek, time: TimeSlot) {
    const key = slotKey(day, time);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function isSelected(day: DayOfWeek, time: TimeSlot): boolean {
    return selected.has(slotKey(day, time));
  }

  // ---- quick-select helpers -----------------------------------------------

  const allWeekdayEveningsSelected = WEEKDAY_DAYS.every((d) =>
    selected.has(slotKey(d, 'evening'))
  );

  const allWeekendMorningsSelected = WEEKEND_DAYS.every((d) =>
    selected.has(slotKey(d, 'morning'))
  );

  function handleSelectWeekdayEvenings() {
    setSelected((prev) => {
      const next = new Set(prev);
      const allAdded = WEEKDAY_DAYS.every((d) => next.has(slotKey(d, 'evening')));
      if (allAdded) {
        WEEKDAY_DAYS.forEach((d) => next.delete(slotKey(d, 'evening')));
      } else {
        WEEKDAY_DAYS.forEach((d) => next.add(slotKey(d, 'evening')));
      }
      return next;
    });
  }

  function handleSelectWeekendMornings() {
    setSelected((prev) => {
      const next = new Set(prev);
      const allAdded = WEEKEND_DAYS.every((d) => next.has(slotKey(d, 'morning')));
      if (allAdded) {
        WEEKEND_DAYS.forEach((d) => next.delete(slotKey(d, 'morning')));
      } else {
        WEEKEND_DAYS.forEach((d) => next.add(slotKey(d, 'morning')));
      }
      return next;
    });
  }

  function handleClearAll() {
    setSelected(new Set());
  }

  // ---- save ----------------------------------------------------------------

  async function handleSave() {
    if (!user) return;

    if (selected.size === 0) {
      setError('Please select at least one time slot so we can match you with a group.');
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const slots = Array.from(selected).map((key) => {
        const [dayStr, timeSlot] = key.split('-') as [string, TimeSlot];
        return {
          day_of_week: parseInt(dayStr, 10) as DayOfWeek,
          time_slot: timeSlot,
        };
      });

      const { error: slotsError } = await saveAvailabilitySlots(user.id, slots);
      if (slotsError) {
        setError(slotsError);
        return;
      }

      const { error: onboardingError } = await markOnboardingComplete(user.id);
      if (onboardingError) {
        setError(onboardingError);
        return;
      }

      // Opt user into the current match cycle — sets matching_status to
      // 'waiting_for_match' so they appear in the matching pool.
      const { error: optInError } = await optInToCurrentCycle(user.id);
      if (optInError) {
        // Retry once before giving up — this is critical for user experience
        const { error: retryError } = await optInToCurrentCycle(user.id);
        if (retryError) {
          console.warn('[availability] opt-in failed after retry:', retryError);
        }
      }

      await refreshProfile();
      router.replace('/(onboarding)/complete');
    } finally {
      setIsSaving(false);
    }
  }

  const selectedCount = selected.size;

  // ---- render --------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container}>
      {/* Background glow orb — top-right */}
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

      {/* Phase progress — final step, completes phase 3 */}
      <OnboardingProgress phase={3} stepInPhase={8} stepsInPhase={8} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header section */}
        <View style={styles.headerSection}>
          {/* Hero icon */}
          <View style={styles.heroCircle}>
            <Text style={styles.heroEmoji}>📅</Text>
          </View>

          <Text style={styles.title}>When do you go out?</Text>
          <Text style={styles.subtitle}>
            Pick your typical free windows each week
          </Text>
          <Text style={styles.note}>
            We use this to match you with groups that fit your schedule
          </Text>
        </View>

        {/* Quick select pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
          style={styles.pillsScroll}
        >
          <QuickSelectPill
            label="Weekday evenings"
            active={allWeekdayEveningsSelected}
            onPress={handleSelectWeekdayEvenings}
          />
          <QuickSelectPill
            label="Weekend mornings"
            active={allWeekendMorningsSelected}
            onPress={handleSelectWeekendMornings}
          />
          <QuickSelectPill
            label="Clear all"
            active={false}
            onPress={handleClearAll}
          />
        </ScrollView>

        {/* Availability grid */}
        <View style={styles.gridContainer}>
          {/* Grid header — day columns */}
          <View style={styles.gridHeader}>
            {/* Time label spacer */}
            <View style={styles.timeColumnSpacer} />

            {DAYS.map((day) => (
              <View key={day} style={styles.dayHeaderCell}>
                <Text style={styles.dayHeaderName}>
                  {DAY_NAMES[day]}
                </Text>
              </View>
            ))}
          </View>

          {/* Divider under headers */}
          <View style={styles.gridDivider} />

          {/* Time slot rows */}
          {TIME_SLOTS.map((timeSlot, rowIdx) => (
            <View
              key={timeSlot.key}
              style={[
                styles.gridRow,
                rowIdx < TIME_SLOTS.length - 1 ? styles.gridRowBorder : null,
              ]}
            >
              {/* Time label */}
              <View style={styles.timeLabel}>
                <Text style={styles.timeLabelName}>{timeSlot.label}</Text>
                <Text style={styles.timeLabelHours}>{timeSlot.hours}</Text>
              </View>

              {/* Slot cells */}
              {DAYS.map((day) => (
                <View key={day} style={styles.slotCellColumn}>
                  <SlotCell
                    active={isSelected(day, timeSlot.key)}
                    onPress={() => toggleSlot(day, timeSlot.key)}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Selection summary */}
        <View style={styles.summaryRow}>
          {selectedCount > 0 ? (
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>
                {selectedCount} slot{selectedCount !== 1 ? 's' : ''} selected
              </Text>
            </View>
          ) : (
            <Text style={styles.summaryEmpty}>No slots selected yet</Text>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.ctaButton,
            (isSaving || selectedCount === 0) ? styles.ctaButtonDisabled : null,
          ]}
          onPress={handleSave}
          disabled={isSaving || selectedCount === 0}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaButtonText}>
            {isSaving ? 'Saving…' : "Let's go"}
          </Text>
          {!isSaving ? (
            <Text style={styles.ctaButtonArrow}>→</Text>
          ) : null}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const TIME_LABEL_WIDTH = 72;
const CELL_SIZE = 36;

const styles = StyleSheet.create({
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
    paddingBottom: 32,
  },

  // Header section
  headerSection: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 28,
  },
  heroCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(123,108,246,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: OB.accentBorder,
  },
  heroEmoji: {
    fontSize: 28,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: OB.text,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: OB.textSub,
    textAlign: 'center',
    marginBottom: 6,
  },
  note: {
    fontSize: 13,
    color: OB.textMuted,
    textAlign: 'center',
  },

  // Quick-select pills
  pillsScroll: {
    marginBottom: 24,
    flexGrow: 0,
  },
  pillsRow: {
    flexDirection: 'row',
    paddingRight: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: OB.border,
    backgroundColor: 'transparent',
    marginRight: 8,
  },
  pillActive: {
    borderColor: OB.accent,
    backgroundColor: OB.accentLight,
  },
  pillText: {
    fontSize: 13,
    color: OB.textSub,
    fontWeight: '500',
  },
  pillTextActive: {
    color: OB.accent,
  },

  // Grid
  gridContainer: {
    backgroundColor: OB.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: OB.border,
    overflow: 'hidden',
    marginBottom: 20,
  },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 10,
  },
  timeColumnSpacer: {
    width: TIME_LABEL_WIDTH,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayHeaderName: {
    fontSize: 12,
    fontWeight: '600',
    color: OB.text,
    textAlign: 'center',
  },
  gridDivider: {
    height: 1,
    backgroundColor: OB.border,
    marginHorizontal: 12,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  gridRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: OB.border,
  },

  // Time label
  timeLabel: {
    width: TIME_LABEL_WIDTH,
    paddingRight: 8,
  },
  timeLabelName: {
    fontSize: 12,
    fontWeight: '600',
    color: OB.text,
    lineHeight: 16,
  },
  timeLabelHours: {
    fontSize: 10,
    color: OB.textMuted,
    lineHeight: 14,
    marginTop: 1,
  },

  // Slot cells
  slotCellColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotCellWrapper: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 8,
    backgroundColor: OB.bg,
    borderWidth: 1,
    borderColor: OB.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotCellActive: {
    backgroundColor: OB.accent,
    borderColor: OB.accent,
    shadowColor: OB.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  slotCheckmark: {
    fontSize: 11,
    fontWeight: '700',
    color: OB.text,
    lineHeight: 14,
  },

  // Summary
  summaryRow: {
    alignItems: 'center',
    minHeight: 32,
    justifyContent: 'center',
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: OB.accentLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: OB.accentBorder,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  summaryBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: OB.accent,
  },
  summaryEmpty: {
    fontSize: 13,
    color: OB.textMuted,
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
  errorBanner: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    padding: 12,
    marginBottom: 12,
  },
  errorBannerText: {
    fontSize: 13,
    color: '#FCA5A5',
    textAlign: 'center',
    lineHeight: 18,
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

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
import { saveAvailabilitySlots, getAvailabilitySlots } from '../../lib/api/availability';
import type { DayOfWeek, TimeSlot } from '../../constants/types';
import { DAY_NAMES } from '../../constants/types';

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const C = {
  bg: '#0C0C1A',
  surface: '#13132B',
  accent: '#7B6CF6',
  accentLight: 'rgba(123,108,246,0.15)',
  accentBorder: 'rgba(123,108,246,0.35)',
  text: '#FFFFFF',
  textSub: '#9CA3AF',
  textMuted: '#6B7280',
  border: 'rgba(255,255,255,0.07)',
  success: '#34D399',
  successLight: 'rgba(52,211,153,0.12)',
  error: '#F87171',
  errorLight: 'rgba(248,113,113,0.12)',
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun

const TIME_SLOTS: { key: TimeSlot; label: string; hours: string }[] = [
  { key: 'morning',   label: 'Morning',   hours: '9am–12pm' },
  { key: 'afternoon', label: 'Afternoon', hours: '12pm–5pm' },
  { key: 'evening',   label: 'Evening',   hours: '5pm–9pm'  },
  { key: 'night',     label: 'Night',     hours: '9pm–12am' },
];

const WEEKDAY_DAYS: DayOfWeek[] = [1, 2, 3, 4, 5];
const WEEKEND_DAYS: DayOfWeek[] = [6, 0];

type SlotKey = `${DayOfWeek}-${TimeSlot}`;

function slotKey(day: DayOfWeek, time: TimeSlot): SlotKey {
  return `${day}-${time}`;
}

// ---------------------------------------------------------------------------
// Slot cell sub-component
// ---------------------------------------------------------------------------

function SlotCell({
  active,
  onPress,
}: {
  active: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, tension: 200, friction: 10 }).start();
  }
  function handlePressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 160, friction: 10 }).start();
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={styles.cellWrapper}
    >
      <Animated.View
        style={[
          styles.cell,
          active && styles.cellActive,
          { transform: [{ scale }] },
        ]}
      >
        {active && <Text style={styles.cellCheck}>✓</Text>}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Quick-select pill
// ---------------------------------------------------------------------------

function QuickPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function AvailabilityEditScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [selected, setSelected]   = useState<Set<SlotKey>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving]   = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // ── Load existing slots ──────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    (async () => {
      setIsLoading(true);
      const { data } = await getAvailabilitySlots(user.id);
      if (data) {
        const TIME_SLOT_MAP: Record<string, TimeSlot> = {
          '09:00': 'morning',
          '12:00': 'afternoon',
          '17:00': 'evening',
          '21:00': 'night',
        };
        const keys = new Set<SlotKey>();
        for (const row of data) {
          const ts = TIME_SLOT_MAP[row.start_time?.slice(0, 5) ?? ''];
          if (ts) keys.add(slotKey(row.day_of_week as DayOfWeek, ts));
        }
        setSelected(keys);
      }
      setIsLoading(false);
    })();
  }, [user]);

  // ── Slot helpers ─────────────────────────────────────────────────────────

  function toggleSlot(day: DayOfWeek, time: TimeSlot) {
    const key = slotKey(day, time);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    setSaved(false);
  }

  function isActive(day: DayOfWeek, time: TimeSlot) {
    return selected.has(slotKey(day, time));
  }

  // Quick-selects
  const allWeekdayEvenings = WEEKDAY_DAYS.every((d) => selected.has(slotKey(d, 'evening')));
  const allWeekendSlots    = WEEKEND_DAYS.every((d) =>
    TIME_SLOTS.some((t) => selected.has(slotKey(d, t.key)))
  );

  function toggleWeekdayEvenings() {
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = WEEKDAY_DAYS.every((d) => next.has(slotKey(d, 'evening')));
      WEEKDAY_DAYS.forEach((d) =>
        allOn ? next.delete(slotKey(d, 'evening')) : next.add(slotKey(d, 'evening'))
      );
      return next;
    });
    setSaved(false);
  }

  function clearAll() {
    setSelected(new Set());
    setSaved(false);
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!user) return;
    if (selected.size === 0) {
      setError('Select at least one time window so we can match you.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const slots = Array.from(selected).map((key) => {
        const [dayStr, timeSlot] = key.split('-') as [string, TimeSlot];
        return { day_of_week: parseInt(dayStr, 10) as DayOfWeek, time_slot: timeSlot };
      });
      const { error: saveErr } = await saveAvailabilitySlots(user.id, slots);
      if (saveErr) { setError(saveErr); return; }
      setSaved(true);
      // Brief success flash then pop
      setTimeout(() => router.back(), 800);
    } finally {
      setIsSaving(false);
    }
  }

  const selectedCount = selected.size;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* Glow */}
      <View style={styles.glow} pointerEvents="none" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Availability</Text>
        <View style={styles.topRight} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerEmoji}>📅</Text>
          </View>
          <Text style={styles.headerTitle}>When do you go out?</Text>
          <Text style={styles.headerSub}>
            Your typical free windows each week — used to match you with groups that fit your schedule.
          </Text>
        </View>

        {/* Quick-select pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
          style={styles.pillsScroll}
        >
          <QuickPill
            label="Weekday evenings"
            active={allWeekdayEvenings}
            onPress={toggleWeekdayEvenings}
          />
          <QuickPill
            label="Clear all"
            active={false}
            onPress={clearAll}
          />
        </ScrollView>

        {/* Grid */}
        {isLoading ? (
          <View style={styles.loadingRow}>
            <Text style={styles.loadingText}>Loading your schedule…</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {/* Day headers */}
            <View style={styles.gridHeader}>
              <View style={styles.timeSpacer} />
              {DAYS.map((day) => (
                <View key={day} style={styles.dayHeaderCell}>
                  <Text style={styles.dayHeaderText}>{DAY_NAMES[day]}</Text>
                </View>
              ))}
            </View>

            <View style={styles.gridDivider} />

            {/* Rows */}
            {TIME_SLOTS.map((ts, rowIdx) => (
              <View
                key={ts.key}
                style={[styles.gridRow, rowIdx < TIME_SLOTS.length - 1 && styles.gridRowBorder]}
              >
                <View style={styles.timeLabel}>
                  <Text style={styles.timeLabelName}>{ts.label}</Text>
                  <Text style={styles.timeLabelHours}>{ts.hours}</Text>
                </View>
                {DAYS.map((day) => (
                  <View key={day} style={styles.cellColumn}>
                    <SlotCell
                      active={isActive(day, ts.key)}
                      onPress={() => toggleSlot(day, ts.key)}
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Selection count */}
        <View style={styles.countRow}>
          {selectedCount > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {selectedCount} slot{selectedCount !== 1 ? 's' : ''} selected
              </Text>
            </View>
          ) : (
            <Text style={styles.countEmpty}>No slots selected</Text>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.saveBtn,
            saved && styles.saveBtnSuccess,
            (isSaving || selectedCount === 0) && !saved && styles.saveBtnDisabled,
          ]}
          onPress={handleSave}
          disabled={isSaving || selectedCount === 0}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>
            {isSaving ? 'Saving…' : saved ? '✓ Saved!' : 'Save changes'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const TIME_LABEL_W = 64;
const CELL_SZ     = 36;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  glow: {
    position: 'absolute',
    top: -80, right: -80,
    width: 260, height: 260,
    borderRadius: 130,
    backgroundColor: C.accent,
    opacity: 0.07,
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
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { fontSize: 18, color: C.text, lineHeight: 22 },
  topTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  topRight: { width: 40 },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 24,
  },
  headerIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: C.accentLight,
    borderWidth: 1, borderColor: C.accentBorder,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  headerEmoji: { fontSize: 26 },
  headerTitle: {
    fontSize: 24, fontWeight: '800', color: C.text,
    letterSpacing: -0.4, marginBottom: 8, textAlign: 'center',
  },
  headerSub: {
    fontSize: 14, color: C.textSub, textAlign: 'center',
    lineHeight: 21, maxWidth: 300,
  },

  // Pills
  pillsScroll: { marginBottom: 20, flexGrow: 0 },
  pillsRow: { flexDirection: 'row', paddingRight: 8 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
    borderColor: C.border, marginRight: 8,
  },
  pillActive: { borderColor: C.accent, backgroundColor: C.accentLight },
  pillText: { fontSize: 13, color: C.textSub, fontWeight: '500' },
  pillTextActive: { color: C.accent },

  // Loading
  loadingRow: { alignItems: 'center', paddingVertical: 32 },
  loadingText: { fontSize: 14, color: C.textMuted },

  // Grid
  grid: {
    backgroundColor: C.surface,
    borderRadius: 16, borderWidth: 1,
    borderColor: C.border, overflow: 'hidden',
    marginBottom: 20,
  },
  gridHeader: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingTop: 14, paddingBottom: 10,
  },
  timeSpacer: { width: TIME_LABEL_W },
  dayHeaderCell: { flex: 1, alignItems: 'center' },
  dayHeaderText: {
    fontSize: 12, fontWeight: '600', color: C.text, textAlign: 'center',
  },
  gridDivider: { height: 1, backgroundColor: C.border, marginHorizontal: 12 },
  gridRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  gridRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  timeLabel: { width: TIME_LABEL_W, paddingRight: 8 },
  timeLabelName: { fontSize: 12, fontWeight: '600', color: C.text, lineHeight: 16 },
  timeLabelHours: { fontSize: 10, color: C.textMuted, lineHeight: 14, marginTop: 1 },
  cellColumn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cellWrapper: { width: CELL_SZ, height: CELL_SZ, alignItems: 'center', justifyContent: 'center' },
  cell: {
    width: CELL_SZ, height: CELL_SZ, borderRadius: 8,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cellActive: {
    backgroundColor: C.accent, borderColor: C.accent,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6,
    elevation: 4,
  },
  cellCheck: { fontSize: 11, fontWeight: '700', color: C.text, lineHeight: 14 },

  // Count
  countRow: { alignItems: 'center', minHeight: 32, justifyContent: 'center' },
  countBadge: {
    backgroundColor: C.accentLight,
    borderRadius: 20, borderWidth: 1, borderColor: C.accentBorder,
    paddingHorizontal: 16, paddingVertical: 7,
  },
  countText: { fontSize: 13, fontWeight: '600', color: C.accent },
  countEmpty: { fontSize: 13, color: C.textMuted },

  // Footer
  footer: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24,
    borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  errorBanner: {
    backgroundColor: C.errorLight,
    borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
    padding: 12, marginBottom: 12,
  },
  errorText: { fontSize: 13, color: '#FCA5A5', textAlign: 'center' },
  saveBtn: {
    backgroundColor: C.accent, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 14,
    elevation: 6,
  },
  saveBtnDisabled: { opacity: 0.35, shadowOpacity: 0, elevation: 0 },
  saveBtnSuccess: { backgroundColor: '#34D399', shadowColor: '#34D399' },
  saveBtnText: { fontSize: 17, fontWeight: '700', color: C.text, letterSpacing: 0.2 },
});

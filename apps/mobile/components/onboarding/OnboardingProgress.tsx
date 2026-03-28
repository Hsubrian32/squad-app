import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// ---------------------------------------------------------------------------
// Shared 3-phase progress bar used across all onboarding screens.
//
// Shows three labelled segments, where:
//   • completed phases are filled with dim accent
//   • the current phase fills proportionally based on step
//   • future phases are empty
// ---------------------------------------------------------------------------

const PHASES = [
  { label: 'Profile' },
  { label: 'Your Vibe' },
  { label: 'Matching' },
];

const ACCENT      = '#7B6CF6';
const ACCENT_DONE = 'rgba(123,108,246,0.4)';
const TRACK_BG    = 'rgba(255,255,255,0.07)';
const TEXT_FUTURE = 'rgba(255,255,255,0.2)';
const TEXT_DONE   = 'rgba(123,108,246,0.55)';
const TEXT_NOW    = '#7B6CF6';

interface Props {
  /** Which phase we're currently in (1, 2, or 3) */
  phase: 1 | 2 | 3;
  /** 1-based step within the current phase (use 0 to show phase as "starting") */
  stepInPhase: number;
  /** Total steps in the current phase */
  stepsInPhase: number;
}

export function OnboardingProgress({ phase, stepInPhase, stepsInPhase }: Props) {
  return (
    <View style={styles.container}>
      {PHASES.map((p, idx) => {
        const n          = (idx + 1) as 1 | 2 | 3;
        const isPast     = n < phase;
        const isCurrent  = n === phase;
        const fillPct    = isCurrent && stepsInPhase > 0
          ? Math.min((stepInPhase / stepsInPhase) * 100, 100)
          : isPast
          ? 100
          : 0;

        return (
          <React.Fragment key={idx}>
            <View style={styles.segment}>
              {/* Progress track */}
              <View style={styles.track}>
                {fillPct > 0 && (
                  <View
                    style={[
                      styles.fill,
                      {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        width: `${fillPct}%` as any,
                        backgroundColor: isPast ? ACCENT_DONE : ACCENT,
                      },
                    ]}
                  />
                )}
              </View>
              {/* Phase label */}
              <Text
                style={[
                  styles.label,
                  isPast    && styles.labelDone,
                  isCurrent && styles.labelNow,
                ]}
              >
                {p.label}
              </Text>
            </View>
            {idx < PHASES.length - 1 && <View style={styles.gap} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
  },
  segment: {
    flex: 1,
  },
  gap: {
    width: 6,
  },
  track: {
    height: 4,
    backgroundColor: TRACK_BG,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 5,
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_FUTURE,
    letterSpacing: 0.2,
  },
  labelDone: {
    color: TEXT_DONE,
  },
  labelNow: {
    color: TEXT_NOW,
  },
});

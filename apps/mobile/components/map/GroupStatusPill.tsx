import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { GroupArrivalStats } from '../../constants/mapTypes';

interface Props {
  stats: GroupArrivalStats;
}

export function GroupStatusPill({ stats }: Props) {
  const { arrived_count, on_the_way_count, running_late_count, total_count } = stats;
  const missing = total_count - arrived_count - on_the_way_count - running_late_count;

  return (
    <View style={styles.pill}>
      {arrived_count > 0 && (
        <Text style={[styles.seg, { color: '#34D399' }]}>
          ✅ {arrived_count}
        </Text>
      )}
      {on_the_way_count > 0 && (
        <Text style={[styles.seg, { color: '#60A5FA' }]}>
          🚶 {on_the_way_count}
        </Text>
      )}
      {running_late_count > 0 && (
        <Text style={[styles.seg, { color: '#FBBF24' }]}>
          ⏰ {running_late_count}
        </Text>
      )}
      {missing > 0 && (
        <Text style={[styles.seg, { color: '#6B7280' }]}>
          ○ {missing}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(13,13,27,0.88)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  seg: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

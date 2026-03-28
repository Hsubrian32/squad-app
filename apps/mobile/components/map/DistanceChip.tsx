import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatDistance, bearingToLabel } from '../../lib/utils/location';

interface Props {
  distanceMeters: number;
  bearing: number;
  withinRadius: boolean;
}

export function DistanceChip({ distanceMeters, bearing, withinRadius }: Props) {
  const label = withinRadius ? "You're here! ✅" : formatDistance(distanceMeters);
  const dir = withinRadius ? '' : ` · ${bearingToLabel(bearing)}`;

  return (
    <View style={[styles.chip, withinRadius && styles.chipGreen]}>
      <Text style={[styles.text, withinRadius && styles.textGreen]}>
        {label}{dir}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: 'rgba(13,13,27,0.88)',
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipGreen: {
    backgroundColor: 'rgba(52,211,153,0.15)',
    borderColor: 'rgba(52,211,153,0.4)',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E5E7EB',
    letterSpacing: 0.1,
  },
  textGreen: {
    color: '#34D399',
  },
});

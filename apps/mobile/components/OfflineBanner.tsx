/**
 * OfflineBanner — a slim sticky banner shown when the device has no internet.
 *
 * Usage (add to any screen that makes network calls):
 *   const { isOnline } = useNetworkState();
 *   ...
 *   <OfflineBanner visible={!isOnline} />
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
}

export function OfflineBanner({ visible }: Props) {
  const translateY = useRef(new Animated.Value(-48)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : -48,
      tension: 70,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY }] }]}>
      <Ionicons name="cloud-offline-outline" size={14} color="#FCD34D" />
      <Text style={styles.text}>No internet connection — some features may be unavailable</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(30, 22, 0, 0.96)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(252, 211, 77, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FCD34D',
    flexShrink: 1,
  },
});

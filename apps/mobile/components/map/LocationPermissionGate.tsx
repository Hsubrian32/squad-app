import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  onRequest: () => void;
  denied?: boolean;
}

export function LocationPermissionGate({ onRequest, denied = false }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.inner}>
        <View style={styles.iconCircle}>
          <Ionicons name="location-outline" size={40} color="#7B6CF6" />
        </View>
        <Text style={styles.title}>
          {denied ? 'Location access denied' : 'Enable location'}
        </Text>
        <Text style={styles.body}>
          {denied
            ? 'Squad needs location access to show you the map and enable check-in. Open Settings to allow it.'
            : 'Squad uses your location to show the meetup map, track who\'s arrived, and let you check in when you\'re at the venue.'}
        </Text>

        {denied ? (
          <TouchableOpacity
            style={styles.button}
            onPress={() => Linking.openSettings()}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Open Settings</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.button}
            onPress={onRequest}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Allow Location</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C1A',
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(123,108,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(123,108,246,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 21,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#7B6CF6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});

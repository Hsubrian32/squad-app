import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getNearbyVenuesFromDB } from '../../lib/api/meetup';
import { formatDistance } from '../../lib/utils/location';
import type { NearbyVenue } from '../../constants/mapTypes';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (venue: NearbyVenue) => void;
  originLat: number;
  originLng: number;
}

export function VenueSuggestionsSheet({ visible, onClose, onSelect, originLat, originLng }: Props) {
  const [venues, setVenues] = useState<NearbyVenue[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    getNearbyVenuesFromDB(originLat, originLng).then((r) => {
      setVenues(r.data ?? []);
      setLoading(false);
    });
  }, [visible, originLat, originLng]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>Nearby venues</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#7B6CF6" style={{ marginVertical: 24 }} />
        ) : venues.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No venues found within 2km</Text>
          </View>
        ) : (
          <FlatList
            data={venues}
            keyExtractor={(v, i) => v.id ?? `venue-${i}`}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.venueRow}
                onPress={() => onSelect(item)}
                activeOpacity={0.8}
              >
                <View style={styles.venueIcon}>
                  <Ionicons name="location-outline" size={18} color="#7B6CF6" />
                </View>
                <View style={styles.venueText}>
                  <Text style={styles.venueName}>{item.name}</Text>
                  <Text style={styles.venueAddress} numberOfLines={1}>
                    {item.address}
                  </Text>
                </View>
                <Text style={styles.venueDistance}>
                  {formatDistance(item.distanceMeters)}
                </Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#13132B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    maxHeight: '70%',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  venueIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(123,108,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  venueText: {
    flex: 1,
  },
  venueName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  venueAddress: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  venueDistance: {
    fontSize: 12,
    color: '#7B6CF6',
    fontWeight: '600',
    flexShrink: 0,
  },
  sep: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});

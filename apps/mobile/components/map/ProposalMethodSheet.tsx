import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectNearby: () => void;
  onDropPin: () => void;
}

export function ProposalMethodSheet({ visible, onClose, onSelectNearby, onDropPin }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Propose a new location</Text>
        <Text style={styles.subtitle}>
          Choose a nearby venue from our list, or drop a pin anywhere on the map.
        </Text>

        <TouchableOpacity style={styles.option} onPress={onSelectNearby} activeOpacity={0.8}>
          <View style={[styles.optionIcon, { backgroundColor: 'rgba(123,108,246,0.12)' }]}>
            <Ionicons name="list-outline" size={22} color="#7B6CF6" />
          </View>
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>Browse nearby venues</Text>
            <Text style={styles.optionSub}>Pick from places within 2km</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#6B7280" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.option} onPress={onDropPin} activeOpacity={0.8}>
          <View style={[styles.optionIcon, { backgroundColor: 'rgba(244,114,182,0.12)' }]}>
            <Ionicons name="location-outline" size={22} color="#F472B6" />
          </View>
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>Drop a pin</Text>
            <Text style={styles.optionSub}>Tap anywhere on the map</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#6B7280" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#13132B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 12,
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
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 19,
    marginBottom: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  optionSub: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  cancelText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
});

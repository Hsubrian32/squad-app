import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LatLng } from '../../constants/mapTypes';

interface Props {
  visible: boolean;
  pinnedLocation: LatLng | null;
  onClose: () => void;
  onConfirm: (location: LatLng, name: string, reason: string) => void;
}

export function DropPinSheet({ visible, pinnedLocation, onClose, onConfirm }: Props) {
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (!pinnedLocation || !name.trim()) return;
    onConfirm(pinnedLocation, name.trim(), reason.trim());
    setName('');
    setReason('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.title}>Dropped pin</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {pinnedLocation ? (
            <View style={styles.coordRow}>
              <Ionicons name="location" size={14} color="#7B6CF6" />
              <Text style={styles.coordText}>
                {pinnedLocation.lat.toFixed(5)}, {pinnedLocation.lng.toFixed(5)}
              </Text>
            </View>
          ) : (
            <Text style={styles.hint}>Tap anywhere on the map to drop a pin</Text>
          )}

          <TextInput
            style={styles.input}
            placeholder="Give it a name (e.g. 'the park bench')"
            placeholderTextColor="#6B7280"
            value={name}
            onChangeText={setName}
            maxLength={60}
          />
          <TextInput
            style={[styles.input, styles.inputMulti]}
            placeholder="Why switch? (optional)"
            placeholderTextColor="#6B7280"
            value={reason}
            onChangeText={setReason}
            maxLength={120}
            multiline
          />

          <TouchableOpacity
            style={[
              styles.confirmBtn,
              (!pinnedLocation || !name.trim()) && styles.confirmBtnDisabled,
            ]}
            onPress={handleConfirm}
            activeOpacity={0.8}
            disabled={!pinnedLocation || !name.trim()}
          >
            <Text style={styles.confirmBtnText}>Propose this location →</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(123,108,246,0.1)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  coordText: {
    fontSize: 12,
    color: '#7B6CF6',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hint: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 14,
  },
  inputMulti: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  confirmBtn: {
    backgroundColor: '#7B6CF6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});

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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ProposedPlace {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  venueId?: string;
}

interface Props {
  visible: boolean;
  place: ProposedPlace | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function ProposalConfirmSheet({ visible, place, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!place || loading) return;
    setLoading(true);
    await onConfirm(reason.trim());
    setLoading(false);
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
            <Text style={styles.title}>Confirm proposal</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {place && (
            <View style={styles.placeCard}>
              <View style={styles.placeIcon}>
                <Ionicons name="location" size={20} color="#7B6CF6" />
              </View>
              <View style={styles.placeDetails}>
                <Text style={styles.placeName}>{place.name}</Text>
                {place.address && (
                  <Text style={styles.placeAddress}>{place.address}</Text>
                )}
              </View>
            </View>
          )}

          <Text style={styles.reasonLabel}>Reason (optional)</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            placeholder={'"The other bar has a private room" · "It\'s raining, let\'s go indoors"'}
            placeholderTextColor="#6B7280"
            value={reason}
            onChangeText={setReason}
            maxLength={120}
            multiline
          />

          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={14} color="#6B7280" />
            <Text style={styles.noteText}>
              Your group has 15 minutes to vote. 2/3 majority needed.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.confirmBtnText}>Send vote to group →</Text>
            )}
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
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(123,108,246,0.1)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(123,108,246,0.25)',
  },
  placeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(123,108,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  placeDetails: {
    flex: 1,
  },
  placeName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  placeAddress: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
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
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noteText: {
    fontSize: 11,
    color: '#6B7280',
    flex: 1,
    lineHeight: 16,
  },
  confirmBtn: {
    backgroundColor: '#7B6CF6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});

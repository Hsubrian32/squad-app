import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useLocation } from '../../hooks/useLocation';
import { useMeetupMap } from '../../hooks/useMeetupMap';
import { useAuth } from '../../store/authStore';
import { useGroup } from '../../store/groupStore';

import { MeetupMapView } from '../../components/map/MeetupMapView';
import { VenueBottomSheet } from '../../components/map/VenueBottomSheet';
import { DistanceChip } from '../../components/map/DistanceChip';
import { LocationPermissionGate } from '../../components/map/LocationPermissionGate';
import { ProposalMethodSheet } from '../../components/map/ProposalMethodSheet';
import { VenueSuggestionsSheet } from '../../components/map/VenueSuggestionsSheet';
import { DropPinSheet } from '../../components/map/DropPinSheet';
import { ProposalConfirmSheet } from '../../components/map/ProposalConfirmSheet';

import { checkInWithLocation, createSwitchProposal } from '../../lib/api/meetup';
import { checkSwitchEligibility, PROPOSAL_MAX_DISTANCE_METERS } from '../../lib/api/venue-switch';
import { updateArrivalStatus } from '../../lib/api/groups';
import { checkProximity, validateProposedLocation } from '../../lib/utils/location';

import type { LatLng, NearbyVenue, CheckInEligibility } from '../../constants/mapTypes';
import type { ArrivalStatus } from '../../constants/types';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MeetupMapScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentGroup } = useGroup();

  // Derive the current user's GroupMember record from the group's members array
  const currentMember = currentGroup?.members?.find((m) => m.user_id === user?.id) ?? null;

  // ── Location ──
  const { location, permissionStatus, requestPermission } = useLocation(true);

  // ── Map data (Realtime) ──
  const {
    meetupLocation,
    arrivalStats,
    openProposal,
    myVote,
    loading,
    refetch,
  } = useMeetupMap({
    groupId: currentGroup?.id ?? '',
    userId: user?.id ?? '',
  });

  // ── Local UI state ──
  const [checkingIn, setCheckingIn] = useState(false);
  const [isPinDropMode, setIsPinDropMode] = useState(false);
  const [pinnedLocation, setPinnedLocation] = useState<LatLng | null>(null);

  // Sheet visibility
  const [showMethodSheet, setShowMethodSheet] = useState(false);
  const [showSuggestionsSheet, setShowSuggestionsSheet] = useState(false);
  const [showDropPinSheet, setShowDropPinSheet] = useState(false);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [pendingPlace, setPendingPlace] = useState<{
    name: string; address?: string; lat: number; lng: number; venueId?: string;
  } | null>(null);

  // ── Derived ──
  const proximity =
    location != null && meetupLocation != null
      ? checkProximity(location, meetupLocation.lat, meetupLocation.lng)
      : null;

  const checkInEligibility: CheckInEligibility | null =
    currentMember?.checked_in
      ? { eligible: false, distanceMeters: 0, reason: 'already_checked_in' }
      : proximity == null
      ? { eligible: false, distanceMeters: 0, reason: 'no_location' }
      : proximity.withinRadius
      ? { eligible: true, distanceMeters: proximity.distanceMeters, reason: 'within_radius' }
      : { eligible: false, distanceMeters: proximity.distanceMeters, reason: 'too_far' };

  // ── Handlers ──

  const handleCheckIn = useCallback(async () => {
    if (!user || !currentGroup || !location || checkInEligibility?.eligible !== true) return;
    setCheckingIn(true);
    const { error } = await checkInWithLocation(
      currentGroup.id,
      user.id,
      location.lat,
      location.lng,
    );
    setCheckingIn(false);
    if (error) {
      Alert.alert('Check-in failed', error);
    } else {
      refetch();
    }
  }, [user, currentGroup, location, checkInEligibility, refetch]);

  const handleArrivalStatus = useCallback(async (status: ArrivalStatus) => {
    if (!user || !currentGroup) return;
    await updateArrivalStatus(currentGroup.id, user.id, status);
    refetch();
  }, [user, currentGroup, refetch]);

  const handleProposeSwitch = useCallback(async () => {
    if (!currentGroup) return;
    const { data: eligibility } = await checkSwitchEligibility(currentGroup.id);
    if (!eligibility?.allowed) {
      Alert.alert('Can\'t propose a switch', eligibility?.reason ?? 'Not allowed right now.');
      return;
    }
    setShowMethodSheet(true);
  }, [currentGroup]);

  const handleSelectNearby = () => {
    setShowMethodSheet(false);
    setTimeout(() => setShowSuggestionsSheet(true), 300);
  };

  const handleDropPin = () => {
    setShowMethodSheet(false);
    setIsPinDropMode(true);
    setShowDropPinSheet(true);
  };

  const handleMapPress = (coord: LatLng) => {
    if (!isPinDropMode) return;
    if (!meetupLocation) return;

    const validation = validateProposedLocation(
      coord,
      { lat: meetupLocation.lat, lng: meetupLocation.lng },
      PROPOSAL_MAX_DISTANCE_METERS,
    );
    if (!validation.valid) {
      Alert.alert('Too far', validation.reason ?? 'Location is too far from original venue.');
      return;
    }
    setPinnedLocation(coord);
  };

  const handleDropPinConfirm = (loc: LatLng, name: string, reason: string) => {
    setShowDropPinSheet(false);
    setIsPinDropMode(false);
    setPendingPlace({ name, lat: loc.lat, lng: loc.lng, address: undefined });
    setTimeout(() => setShowConfirmSheet(true), 300);
  };

  const handleVenueSelect = (venue: NearbyVenue) => {
    setShowSuggestionsSheet(false);
    setPendingPlace({
      name: venue.name,
      address: venue.address,
      lat: venue.lat,
      lng: venue.lng,
      venueId: venue.id ?? undefined,
    });
    setTimeout(() => setShowConfirmSheet(true), 300);
  };

  const handleProposalConfirm = async (reason: string) => {
    if (!pendingPlace || !currentGroup || !user) return;
    const { error } = await createSwitchProposal({
      groupId: currentGroup.id,
      proposedBy: user.id,
      name: pendingPlace.name,
      address: pendingPlace.address,
      lat: pendingPlace.lat,
      lng: pendingPlace.lng,
      venueId: pendingPlace.venueId,
      reason: reason || undefined,
    });
    setShowConfirmSheet(false);
    setPendingPlace(null);
    setPinnedLocation(null);
    if (error) {
      Alert.alert('Failed to propose', error);
    } else {
      refetch();
    }
  };

  // ── Permission gate ──
  if (permissionStatus === 'denied') {
    return <LocationPermissionGate onRequest={requestPermission} denied />;
  }
  if (permissionStatus === 'undetermined') {
    return <LocationPermissionGate onRequest={requestPermission} />;
  }

  // ── No active group / meetup location ──
  if (!currentGroup || !meetupLocation) {
    return (
      <SafeAreaView style={styles.placeholder} edges={['top', 'bottom']}>
        <Ionicons name="map-outline" size={48} color="#4B5563" />
        <Text style={styles.placeholderText}>
          {loading ? 'Loading map…' : 'No active meetup location yet'}
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Full-screen map ── */}
      <MeetupMapView
        meetupLocation={meetupLocation}
        userLocation={location}
        pinnedLocation={pinnedLocation}
        isPinDropMode={isPinDropMode}
        onMapPress={handleMapPress}
      />

      {/* ── Top overlay: back button + distance chip ── */}
      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backCircle} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {proximity != null && (
            <DistanceChip
              distanceMeters={proximity.distanceMeters}
              bearing={proximity.bearing}
              withinRadius={proximity.withinRadius}
            />
          )}

          {isPinDropMode && (
            <TouchableOpacity
              style={styles.cancelPinBtn}
              onPress={() => {
                setIsPinDropMode(false);
                setPinnedLocation(null);
                setShowDropPinSheet(false);
              }}
            >
              <Text style={styles.cancelPinText}>Cancel pin</Text>
            </TouchableOpacity>
          )}
        </View>

        {isPinDropMode && (
          <View style={styles.pinModeHint}>
            <Text style={styles.pinModeHintText}>Tap on the map to place a pin</Text>
          </View>
        )}
      </SafeAreaView>

      {/* ── Bottom sheet ── */}
      <VenueBottomSheet
        meetupLocation={meetupLocation}
        arrivalStats={arrivalStats}
        openProposal={openProposal}
        myVote={myVote}
        userId={user?.id ?? ''}
        myArrivalStatus={currentMember?.arrival_status ?? null}
        checkInEligibility={checkInEligibility}
        checkingIn={checkingIn}
        onArrivalStatusChange={handleArrivalStatus}
        onCheckIn={handleCheckIn}
        onProposeSwitch={handleProposeSwitch}
        onVoted={refetch}
      />

      {/* ── Proposal flow sheets ── */}
      <ProposalMethodSheet
        visible={showMethodSheet}
        onClose={() => setShowMethodSheet(false)}
        onSelectNearby={handleSelectNearby}
        onDropPin={handleDropPin}
      />

      <VenueSuggestionsSheet
        visible={showSuggestionsSheet}
        onClose={() => setShowSuggestionsSheet(false)}
        onSelect={handleVenueSelect}
        originLat={meetupLocation.lat}
        originLng={meetupLocation.lng}
      />

      <DropPinSheet
        visible={showDropPinSheet}
        pinnedLocation={pinnedLocation}
        onClose={() => {
          setShowDropPinSheet(false);
          setIsPinDropMode(false);
          setPinnedLocation(null);
        }}
        onConfirm={handleDropPinConfirm}
      />

      <ProposalConfirmSheet
        visible={showConfirmSheet}
        place={pendingPlace}
        onClose={() => {
          setShowConfirmSheet(false);
          setPendingPlace(null);
        }}
        onConfirm={handleProposalConfirm}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C1A',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(13,13,27,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPinBtn: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(248,113,113,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  cancelPinText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F87171',
  },
  pinModeHint: {
    alignSelf: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(13,13,27,0.88)',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(244,114,182,0.3)',
  },
  pinModeHintText: {
    fontSize: 13,
    color: '#F472B6',
    fontWeight: '600',
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#0C0C1A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  placeholderText: {
    fontSize: 15,
    color: '#6B7280',
  },
  backBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
  },
  backBtnText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});

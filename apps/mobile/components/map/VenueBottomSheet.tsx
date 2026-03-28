import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VoteCard } from './VoteCard';
import { GroupStatusPill } from './GroupStatusPill';
import type {
  MeetupLocation,
  GroupArrivalStats,
  VenueSwitchProposal,
  VenueSwitchVote,
  CheckInEligibility,
} from '../../constants/mapTypes';
import type { ArrivalStatus } from '../../constants/types';

// ---------------------------------------------------------------------------
// Sheet snap points (height from bottom)
// ---------------------------------------------------------------------------
const SNAP_COLLAPSED = 110;
const SNAP_HALF      = 320;
const SNAP_FULL      = 540;

// ---------------------------------------------------------------------------
// Arrival grid config
// ---------------------------------------------------------------------------
const ARRIVAL_OPTIONS: {
  status: ArrivalStatus;
  icon: string;
  label: string;
  color: string;
  bg: string;
}[] = [
  { status: 'on_the_way',   icon: '🚶', label: 'On my way',     color: '#60A5FA', bg: 'rgba(96,165,250,0.12)'  },
  { status: 'arrived',      icon: '✅', label: "I'm here",      color: '#34D399', bg: 'rgba(52,211,153,0.12)'  },
  { status: 'running_late', icon: '⏰', label: 'Running late',  color: '#FBBF24', bg: 'rgba(251,191,36,0.12)'  },
  { status: 'cant_make_it', icon: '❌', label: "Can't make it", color: '#F87171', bg: 'rgba(248,113,113,0.12)' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  meetupLocation: MeetupLocation;
  arrivalStats: GroupArrivalStats | null;
  openProposal: VenueSwitchProposal | null;
  myVote: VenueSwitchVote | null;
  userId: string;
  myArrivalStatus: ArrivalStatus | null;
  checkInEligibility: CheckInEligibility | null;
  checkingIn: boolean;
  onArrivalStatusChange: (status: ArrivalStatus) => void;
  onCheckIn: () => void;
  onProposeSwitch: () => void;
  onVoted: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function VenueBottomSheet({
  meetupLocation,
  arrivalStats,
  openProposal,
  myVote,
  userId,
  myArrivalStatus,
  checkInEligibility,
  checkingIn,
  onArrivalStatusChange,
  onCheckIn,
  onProposeSwitch,
  onVoted,
}: Props) {
  const sheetH = useRef(new Animated.Value(SNAP_HALF)).current;
  const lastH  = useRef(SNAP_HALF);

  useEffect(() => {
    snapTo(SNAP_HALF);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snapTo = (h: number) => {
    lastH.current = h;
    Animated.spring(sheetH, { toValue: h, tension: 65, friction: 11, useNativeDriver: false }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
      onPanResponderMove: (_, g) => {
        const newH = lastH.current - g.dy; // drag up = increase height
        sheetH.setValue(Math.max(SNAP_COLLAPSED, Math.min(SNAP_FULL, newH)));
      },
      onPanResponderRelease: (_, g) => {
        const newH = lastH.current - g.dy;
        if (newH < (SNAP_COLLAPSED + SNAP_HALF) / 2) snapTo(SNAP_COLLAPSED);
        else if (newH < (SNAP_HALF + SNAP_FULL) / 2) snapTo(SNAP_HALF);
        else snapTo(SNAP_FULL);
      },
    }),
  ).current;

  const isArrived = myArrivalStatus === 'arrived';
  const canCheckIn =
    checkInEligibility?.eligible === true &&
    !checkingIn &&
    !isArrived;

  const checkInLabel = () => {
    if (isArrived) return "You're checked in! 🎉";
    if (checkInEligibility?.reason === 'too_far') return 'Check in (get within 200m)';
    if (checkInEligibility?.reason === 'no_location') return 'Waiting for location…';
    return 'Check in at venue';
  };

  return (
    <Animated.View style={[styles.sheet, { height: sheetH }]}>
      {/* Drag handle area */}
      <View style={styles.dragArea} {...panResponder.panHandlers}>
        <View style={styles.handle} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Venue header ── */}
        <View style={styles.venueHeader}>
          <View style={styles.venueInfo}>
            <Text style={styles.venueName} numberOfLines={1}>
              {meetupLocation.name}
            </Text>
            {meetupLocation.address != null && (
              <Text style={styles.venueAddress} numberOfLines={1}>
                {meetupLocation.address}
              </Text>
            )}
            {meetupLocation.is_switch && (
              <View style={styles.switchedBadge}>
                <Text style={styles.switchedBadgeText}>📍 Location switched</Text>
              </View>
            )}
          </View>
          {arrivalStats != null && <GroupStatusPill stats={arrivalStats} />}
        </View>

        {/* ── Arrival grid ── */}
        <View style={styles.arrivalGrid}>
          {ARRIVAL_OPTIONS.map((opt) => {
            const selected = myArrivalStatus === opt.status;
            return (
              <TouchableOpacity
                key={opt.status}
                style={[
                  styles.arrivalBtn,
                  { backgroundColor: opt.bg },
                  selected && { borderColor: opt.color, borderWidth: 1.5 },
                ]}
                onPress={() => onArrivalStatusChange(opt.status)}
                activeOpacity={0.8}
              >
                <Text style={styles.arrivalIcon}>{opt.icon}</Text>
                <Text style={[styles.arrivalLabel, { color: opt.color }]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Check-in button / arrived banner ── */}
        {isArrived ? (
          <View style={styles.arrivedBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#34D399" />
            <Text style={styles.arrivedText}>{checkInLabel()}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.checkInBtn, !canCheckIn && styles.checkInBtnDisabled]}
            onPress={onCheckIn}
            activeOpacity={0.85}
            disabled={!canCheckIn}
          >
            {checkingIn ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.checkInBtnText}>{checkInLabel()}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* ── Open vote card ── */}
        {openProposal != null && (
          <VoteCard
            proposal={openProposal}
            myVote={myVote}
            userId={userId}
            totalMembers={arrivalStats?.total_count ?? 6}
            onVoted={onVoted}
          />
        )}

        {/* ── Propose switch link (only when no open vote) ── */}
        {openProposal == null && (
          <TouchableOpacity style={styles.switchLink} onPress={onProposeSwitch} activeOpacity={0.7}>
            <Ionicons name="swap-horizontal-outline" size={16} color="#7B6CF6" />
            <Text style={styles.switchLinkText}>Propose a venue switch</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0E0E1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  dragArea: {
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 14,
  },

  // Venue header
  venueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  venueInfo: {
    flex: 1,
    gap: 3,
  },
  venueName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  venueAddress: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  switchedBadge: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
    marginTop: 2,
  },
  switchedBadgeText: {
    fontSize: 11,
    color: '#FBBF24',
    fontWeight: '600',
  },

  // Arrival grid
  arrivalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  arrivalBtn: {
    width: '47.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  arrivalIcon: {
    fontSize: 18,
  },
  arrivalLabel: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },

  // Check-in
  checkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7B6CF6',
    borderRadius: 14,
    paddingVertical: 15,
    shadowColor: '#7B6CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  checkInBtnDisabled: {
    backgroundColor: 'rgba(123,108,246,0.4)',
    shadowOpacity: 0,
    elevation: 0,
  },
  checkInBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  arrivedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderRadius: 14,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.3)',
  },
  arrivedText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#34D399',
  },

  // Propose switch
  switchLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  switchLinkText: {
    fontSize: 13,
    color: '#7B6CF6',
    fontWeight: '500',
  },
});

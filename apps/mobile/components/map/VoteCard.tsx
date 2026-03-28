import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { VenueSwitchProposal, VenueSwitchVote } from '../../constants/mapTypes';
import { submitVote } from '../../lib/api/meetup';

interface Props {
  proposal: VenueSwitchProposal;
  myVote: VenueSwitchVote | null;
  userId: string;
  totalMembers: number;
  onVoted?: () => void;
}

export function VoteCard({ proposal, myVote, userId, totalMembers, onVoted }: Props) {
  const [timeLeft, setTimeLeft] = useState('');
  const [voting, setVoting] = useState(false);

  // Countdown timer
  useEffect(() => {
    const tick = () => {
      const ms = new Date(proposal.expires_at).getTime() - Date.now();
      if (ms <= 0) {
        setTimeLeft('Expired');
        return;
      }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [proposal.expires_at]);

  const handleVote = async (vote: boolean) => {
    if (voting) return;
    setVoting(true);
    await submitVote(proposal.id, userId, vote);
    setVoting(false);
    onVoted?.();
  };

  const yesRatio = totalMembers > 0 ? proposal.votes_yes / totalMembers : 0;
  const needRatio = 2 / 3;
  const progressPct = Math.min(yesRatio / needRatio, 1) * 100;

  const hasVoted = myVote !== null;
  const votedYes = myVote?.vote === true;
  const isExpired = new Date(proposal.expires_at) <= new Date();
  const isResolved = proposal.status !== 'open';

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.label}>🗳 Venue switch proposed</Text>
        <View style={styles.timerBadge}>
          <Text style={styles.timerText}>{timeLeft}</Text>
        </View>
      </View>

      {/* Proposed venue */}
      <Text style={styles.venueName}>{proposal.name}</Text>
      {proposal.address && (
        <Text style={styles.venueAddress}>{proposal.address}</Text>
      )}
      {proposal.reason && (
        <Text style={styles.reason}>"{proposal.reason}"</Text>
      )}

      {/* Progress bar */}
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          <View style={[styles.progressNeedLine, { left: `${(needRatio * 100)}%` }]} />
        </View>
        <Text style={styles.progressLabel}>
          {proposal.votes_yes}/{totalMembers} yes needed
        </Text>
      </View>

      {/* Vote buttons */}
      {!isExpired && !isResolved && (
        <View style={styles.voteRow}>
          {voting ? (
            <ActivityIndicator color="#7B6CF6" />
          ) : (
            <>
              <TouchableOpacity
                style={[styles.voteBtn, styles.voteBtnYes, hasVoted && votedYes && styles.voteBtnActive]}
                onPress={() => handleVote(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.voteBtnText}>👍 Switch</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.voteBtn, styles.voteBtnNo, hasVoted && !votedYes && styles.voteBtnActiveNo]}
                onPress={() => handleVote(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.voteBtnText}>👎 Stay</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {isResolved && (
        <View style={styles.resolvedBadge}>
          <Text style={styles.resolvedText}>
            {proposal.status === 'accepted' ? '✅ Switch accepted!' : '❌ Vote didn\'t pass'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(19,19,43,0.95)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(123,108,246,0.3)',
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7B6CF6',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  timerBadge: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
  },
  timerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FBBF24',
    fontVariant: ['tabular-nums'],
  },
  venueName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  venueAddress: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  reason: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  progressRow: {
    gap: 4,
    marginTop: 4,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'visible',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7B6CF6',
    borderRadius: 3,
  },
  progressNeedLine: {
    position: 'absolute',
    top: -2,
    width: 2,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 1,
  },
  progressLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  voteRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  voteBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  voteBtnYes: {
    backgroundColor: 'rgba(123,108,246,0.1)',
    borderColor: 'rgba(123,108,246,0.3)',
  },
  voteBtnNo: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  voteBtnActive: {
    backgroundColor: 'rgba(123,108,246,0.25)',
    borderColor: '#7B6CF6',
  },
  voteBtnActiveNo: {
    backgroundColor: 'rgba(248,113,113,0.15)',
    borderColor: 'rgba(248,113,113,0.4)',
  },
  voteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E5E7EB',
  },
  resolvedBadge: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  resolvedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
  },
});

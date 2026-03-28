import { useEffect, useState, type CSSProperties } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  getGroupDetail,
  getGroupsForCycle,
  removeUserFromGroup,
  moveUserToGroup,
  type GroupDetail,
  type GroupMember,
  type Message,
  type Group,
} from '../lib/api'
import Badge from '../components/Badge'

const MIN_GROUP_SIZE = 5
const MAX_GROUP_SIZE = 8

// ─── Move Modal ───────────────────────────────────────────────────────────────

interface MoveModalProps {
  member: GroupMember
  currentGroupId: string
  cycleId: string
  onMove: (toGroupId: string) => Promise<void>
  onClose: () => void
}

function MoveModal({ member, currentGroupId, cycleId, onMove, onClose }: MoveModalProps) {
  const [siblings, setSiblings] = useState<Array<Group & { member_count: number }>>([])
  const [loading, setLoading] = useState(true)
  const [movingTo, setMovingTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGroupsForCycle(cycleId, currentGroupId)
      .then(setSiblings)
      .catch((e: unknown) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [cycleId, currentGroupId])

  async function handleMove(toGroupId: string) {
    setMovingTo(toGroupId)
    setError(null)
    try {
      await onMove(toGroupId)
      onClose()
    } catch (e: unknown) {
      setError((e as Error).message)
      setMovingTo(null)
    }
  }

  const name = member.profile?.first_name || member.profile?.display_name || member.user_id.slice(0, 8)

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: '24px 28px',
          width: 420,
          maxWidth: '90vw',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>
            Move member to another group
          </div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Moving <strong>{name}</strong> — their RSVP will reset to pending in the new group.
          </div>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 8, padding: '10px 14px',
            fontSize: 13, color: '#dc2626', marginBottom: 14,
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
            Loading groups…
          </div>
        ) : siblings.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
            No other groups in this cycle.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
            {siblings.map((g) => {
              const full = g.member_count >= MAX_GROUP_SIZE
              const isMoving = movingTo === g.id
              return (
                <div
                  key={g.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: full ? '#f9fafb' : '#f0eeff',
                    border: `1px solid ${full ? '#e5e7eb' : '#c4b9ff'}`,
                    borderRadius: 8,
                    opacity: full ? 0.6 : 1,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14, color: '#1a1a2e' }}>
                      {g.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      {g.member_count} / {MAX_GROUP_SIZE} members
                      {g.venue ? ` · ${g.venue.name}` : ''}
                    </div>
                  </div>
                  <button
                    disabled={full || !!movingTo}
                    onClick={() => handleMove(g.id)}
                    style={{
                      background: full ? '#e5e7eb' : '#6C63FF',
                      color: full ? '#9ca3af' : '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 14px',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: full || movingTo ? 'not-allowed' : 'pointer',
                      minWidth: 68,
                    }}
                  >
                    {isMoving ? '…' : full ? 'Full' : 'Move →'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid #e5e7eb',
              borderRadius: 6, padding: '7px 16px',
              fontSize: 13, fontWeight: 500,
              color: '#374151', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [detail, setDetail] = useState<GroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Manage-mode state
  const [editMode, setEditMode] = useState(false)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [moveTarget, setMoveTarget] = useState<GroupMember | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function load() {
    if (!id) return
    try {
      const d = await getGroupDetail(id)
      setDetail(d)
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? JSON.stringify(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleRemove(member: GroupMember) {
    if (!id) return
    setActionLoading(member.user_id)
    setActionError(null)
    try {
      await removeUserFromGroup(id, member.user_id)
      setConfirmRemoveId(null)
      await load()
    } catch (e: unknown) {
      setActionError((e as Error).message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleMove(toGroupId: string) {
    if (!id || !moveTarget) return
    await moveUserToGroup(moveTarget.user_id, id, toGroupId)
    await load()
  }

  const sectionStyle: CSSProperties = {
    background: '#fff',
    borderRadius: 12,
    padding: '20px 24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
    marginBottom: 20,
  }

  const sectionTitleStyle: CSSProperties = {
    fontSize: 15,
    fontWeight: 600,
    color: '#1a1a2e',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottom: '1px solid #f3f4f6',
  }

  const rowStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '7px 0',
    borderBottom: '1px solid #f9fafb',
    fontSize: 14,
  }

  if (loading) {
    return <div style={{ padding: 40, color: '#9ca3af', textAlign: 'center' }}>Loading group…</div>
  }

  if (error || !detail) {
    return <div style={{ padding: 40, color: '#dc2626' }}>{error ?? 'Group not found.'}</div>
  }

  const { group, members, messages, feedbackSummary, feedbacks } = detail
  const memberCount = members.length
  const sizeTooSmall = memberCount < MIN_GROUP_SIZE
  const sizeTooLarge = memberCount > MAX_GROUP_SIZE
  const sizeOk = !sizeTooSmall && !sizeTooLarge

  return (
    <div>
      {/* Move modal */}
      {moveTarget && (
        <MoveModal
          member={moveTarget}
          currentGroupId={group.id}
          cycleId={group.cycle_id}
          onMove={handleMove}
          onClose={() => setMoveTarget(null)}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          style={{ background: 'none', border: 'none', color: '#6C63FF', cursor: 'pointer', fontSize: 14, padding: 0, fontWeight: 500 }}
          onClick={() => navigate('/groups')}
        >
          ← Back to Groups
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', flex: 1 }}>
          {group.name}
        </h1>
        <Badge variant={group.status} />
      </div>

      {/* Group Info */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Group Info</div>
        {[
          { label: 'Group ID', value: group.id },
          { label: 'Cycle ID', value: group.cycle_id },
          { label: 'Venue', value: group.venue ? `${group.venue.name} · ${group.venue.neighborhood}` : '—' },
          { label: 'Scheduled', value: group.scheduled_time ? format(new Date(group.scheduled_time), 'EEEE, MMMM d, yyyy h:mm a') : '—' },
          { label: 'Created', value: format(new Date(group.created_at), 'MMMM d, yyyy') },
          { label: 'Members', value: memberCount },
        ].map(({ label, value }) => (
          <div key={label} style={rowStyle}>
            <span style={{ color: '#6b7280', fontWeight: 500, minWidth: 140 }}>{label}</span>
            <span style={{ color: '#1a1a2e', textAlign: 'right' }}>{String(value ?? '—')}</span>
          </div>
        ))}
      </div>

      {/* Feedback Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Avg Rating', value: feedbackSummary.avgRating !== null ? `${feedbackSummary.avgRating.toFixed(1)} / 5` : '—', icon: '⭐' },
          { label: 'Avg Vibe Score', value: feedbackSummary.avgVibeScore !== null ? `${feedbackSummary.avgVibeScore.toFixed(1)} / 5` : '—', icon: '✨' },
          { label: 'Would Meet Again', value: feedbackSummary.wouldMeetAgainPercent !== null ? `${feedbackSummary.wouldMeetAgainPercent.toFixed(0)}%` : '—', icon: '🤝' },
          { label: 'Responses', value: feedbackSummary.totalResponses, icon: '📝' },
        ].map(({ label, value, icon }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Members ──────────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>

        {/* Section header with Manage toggle */}
        <div style={{ ...sectionTitleStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Members ({memberCount})</span>
          <button
            onClick={() => { setEditMode((v) => !v); setConfirmRemoveId(null); setActionError(null) }}
            style={{
              background: editMode ? '#1a1a2e' : '#f3f4f6',
              color: editMode ? '#fff' : '#374151',
              border: 'none',
              borderRadius: 6,
              padding: '5px 13px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: 0.3,
            }}
          >
            {editMode ? '✓ Done' : '✏️ Manage'}
          </button>
        </div>

        {/* Size warning strip */}
        {editMode && !sizeOk && (
          <div style={{
            background: sizeTooLarge ? '#fef2f2' : '#fffbeb',
            border: `1px solid ${sizeTooLarge ? '#fecaca' : '#fde68a'}`,
            borderRadius: 8,
            padding: '9px 14px',
            fontSize: 13,
            color: sizeTooLarge ? '#dc2626' : '#92400e',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>{sizeTooLarge ? '🚨' : '⚠️'}</span>
            <span>
              {sizeTooLarge
                ? `Group exceeds maximum size (${memberCount} / ${MAX_GROUP_SIZE}). Remove members to comply.`
                : `Group is below minimum size (${memberCount} / ${MIN_GROUP_SIZE}). Move members in or this group may be dissolved.`}
            </span>
          </div>
        )}

        {/* Action error */}
        {actionError && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 8, padding: '9px 14px',
            fontSize: 13, color: '#dc2626', marginBottom: 14,
          }}>
            {actionError}
          </div>
        )}

        {members.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 14 }}>No members.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map((member: GroupMember) => {
              const isConfirmingRemove = confirmRemoveId === member.user_id
              const isActing = actionLoading === member.user_id
              const displayName = member.profile?.first_name || member.profile?.display_name || member.user_id

              return (
                <div
                  key={member.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: isConfirmingRemove ? '#fef2f2' : '#f9fafb',
                    border: `1px solid ${isConfirmingRemove ? '#fecaca' : 'transparent'}`,
                    borderRadius: 8,
                    flexWrap: 'wrap',
                    gap: 8,
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Avatar + name — only navigate on click when NOT in edit mode */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: editMode ? 'default' : 'pointer', flex: 1, minWidth: 0 }}
                    onClick={() => { if (!editMode) navigate(`/users/${member.user_id}`) }}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: '#E0DCFF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, color: '#6C63FF', fontSize: 13, flexShrink: 0,
                    }}>
                      {(member.profile?.first_name || member.profile?.display_name || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {displayName}
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>
                        {member.user_id?.slice(0, 8)}…
                      </div>
                    </div>
                  </div>

                  {/* Right side */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    {/* RSVP + stay badges (always shown) */}
                    {!isConfirmingRemove && (
                      <>
                        <Badge
                          variant={member.rsvp_status === 'confirmed' ? 'confirmed' : member.rsvp_status === 'declined' ? 'cancelled' : 'pending'}
                          label={member.rsvp_status === 'confirmed' ? 'RSVP ✓' : member.rsvp_status === 'declined' ? 'Declined' : 'Pending'}
                        />
                        {member.stay_vote !== null && (
                          <Badge
                            variant={member.stay_vote ? 'success' : 'warning'}
                            label={member.stay_vote ? 'Stay ✓' : 'No Stay'}
                          />
                        )}
                      </>
                    )}

                    {/* Edit mode actions */}
                    {editMode && (
                      isConfirmingRemove ? (
                        // Inline remove confirmation
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>
                            Remove {(member.profile?.first_name || member.profile?.display_name)?.split(' ')[0] ?? 'member'}?
                          </span>
                          <button
                            disabled={isActing}
                            onClick={() => handleRemove(member)}
                            style={{
                              background: '#dc2626', color: '#fff',
                              border: 'none', borderRadius: 5,
                              padding: '5px 11px', fontSize: 12, fontWeight: 600,
                              cursor: isActing ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {isActing ? '…' : 'Yes, remove'}
                          </button>
                          <button
                            disabled={isActing}
                            onClick={() => setConfirmRemoveId(null)}
                            style={{
                              background: 'none', color: '#374151',
                              border: '1px solid #d1d5db', borderRadius: 5,
                              padding: '5px 11px', fontSize: 12, fontWeight: 500,
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        // Normal edit buttons
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            disabled={!!actionLoading}
                            onClick={() => { setMoveTarget(member); setActionError(null) }}
                            style={{
                              background: '#f0eeff', color: '#6C63FF',
                              border: '1px solid #c4b9ff', borderRadius: 5,
                              padding: '5px 11px', fontSize: 12, fontWeight: 500,
                              cursor: actionLoading ? 'not-allowed' : 'pointer',
                              opacity: actionLoading ? 0.5 : 1,
                            }}
                          >
                            Move →
                          </button>
                          <button
                            disabled={!!actionLoading}
                            onClick={() => { setConfirmRemoveId(member.user_id); setActionError(null) }}
                            style={{
                              background: '#fef2f2', color: '#dc2626',
                              border: '1px solid #fecaca', borderRadius: 5,
                              padding: '5px 11px', fontSize: 12, fontWeight: 500,
                              cursor: actionLoading ? 'not-allowed' : 'pointer',
                              opacity: actionLoading ? 0.5 : 1,
                            }}
                          >
                            Remove ✕
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Message Thread */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Recent Messages (last {Math.min(messages.length, 10)})</div>
        {messages.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 14 }}>No messages yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((msg: Message) => (
              <div key={msg.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: '#E0DCFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, color: '#6C63FF', fontSize: 11, flexShrink: 0,
                }}>
                  {(msg.profile?.first_name || msg.profile?.display_name || '?').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      {(msg.profile?.first_name || msg.profile?.display_name) ?? 'Unknown'}
                    </span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>
                      {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 13, color: '#374151', lineHeight: 1.5,
                    background: '#f9fafb', padding: '8px 12px', borderRadius: 8,
                  }}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Individual Feedback */}
      {feedbacks.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>All Feedback ({feedbacks.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {feedbacks.map((f) => (
              <div key={f.id} style={{ padding: '12px 14px', background: '#f9fafb', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>
                    {(f.profile?.first_name || f.profile?.display_name) ?? 'Unknown'}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    {format(new Date(f.created_at), 'MMM d, yyyy')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6b7280', flexWrap: 'wrap' }}>
                  <span>⭐ {f.rating}/5</span>
                  {f.vibe_score !== null && f.vibe_score !== undefined && <span>✨ Vibe {f.vibe_score}/5</span>}
                  {f.would_meet_again !== null && (
                    <span>🤝 {f.would_meet_again ? 'Would meet again' : 'Would not meet again'}</span>
                  )}
                </div>
                {f.notes && (
                  <div style={{ marginTop: 6, fontSize: 13, color: '#374151' }}>"{f.notes}"</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

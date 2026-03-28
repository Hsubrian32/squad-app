import { useEffect, useState, type CSSProperties } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  getUserDetail,
  updateUserStatus,
  type UserDetail,
  type Availability,
} from '../lib/api'
import Badge from '../components/Badge'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const SLOTS = ['Morning', 'Afternoon', 'Evening', 'Night']

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [banLoading, setBanLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    let mounted = true
    async function load() {
      try {
        const d = await getUserDetail(id!)
        if (mounted) setDetail(d)
      } catch (err) {
        if (mounted) setError(String(err))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id])

  async function handleBanToggle() {
    if (!detail) return
    const newStatus = detail.profile.status === 'banned' ? 'active' : 'banned'
    setBanLoading(true)
    try {
      await updateUserStatus(detail.profile.id, newStatus)
      setDetail((prev) =>
        prev ? { ...prev, profile: { ...prev.profile, status: newStatus } } : prev
      )
    } catch (err) {
      alert(`Failed: ${String(err)}`)
    } finally {
      setBanLoading(false)
    }
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

  const labelStyle: CSSProperties = {
    color: '#6b7280',
    fontWeight: 500,
    minWidth: 160,
    flexShrink: 0,
  }

  const valueStyle: CSSProperties = {
    color: '#1a1a2e',
    textAlign: 'right',
    wordBreak: 'break-word',
  }

  if (loading) {
    return (
      <div style={{ padding: 40, color: '#9ca3af', textAlign: 'center' }}>
        Loading user…
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div style={{ padding: 40, color: '#dc2626' }}>
        {error ?? 'User not found.'}
      </div>
    )
  }

  const { profile, questionnaireAnswers, availability, groupHistory, feedbackGiven, feedbackReceived } = detail

  // Build availability map for grid
  const availMap: Record<string, Set<string>> = {}
  availability.forEach((a: Availability) => {
    availMap[a.day] = new Set(a.slots)
  })

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        <button
          style={{
            background: 'none',
            border: 'none',
            color: '#6C63FF',
            cursor: 'pointer',
            fontSize: 14,
            padding: 0,
            fontWeight: 500,
          }}
          onClick={() => navigate('/users')}
        >
          ← Back to Users
        </button>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#1a1a2e',
            flex: 1,
          }}
        >
          {profile.first_name || profile.display_name || profile.email}
        </h1>
        <Badge variant={profile.status} />
        <button
          style={{
            padding: '8px 18px',
            background: profile.status === 'banned' ? '#15803d' : '#dc2626',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            cursor: banLoading ? 'not-allowed' : 'pointer',
            opacity: banLoading ? 0.7 : 1,
          }}
          onClick={handleBanToggle}
          disabled={banLoading}
        >
          {banLoading
            ? '…'
            : profile.status === 'banned'
            ? 'Unban User'
            : 'Ban User'}
        </button>
      </div>

      {/* Profile Info */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Profile</div>
        {[
          { label: 'User ID', value: profile.id },
          { label: 'First Name', value: profile.first_name || '—' },
          { label: 'Display Name', value: profile.display_name || '—' },
          { label: 'Email', value: profile.email },
          { label: 'Neighborhood', value: profile.neighborhood || '—' },
          { label: 'Age', value: profile.age ?? '—' },
          { label: 'Bio', value: profile.bio || '—' },
          {
            label: 'Onboarding',
            value: <Badge variant={profile.onboarding_complete ? 'complete' : 'incomplete'} />,
          },
          {
            label: 'Joined',
            value: format(new Date(profile.created_at), 'MMMM d, yyyy'),
          },
          {
            label: 'Last Updated',
            value: format(new Date(profile.updated_at), 'MMMM d, yyyy'),
          },
        ].map(({ label, value }) => (
          <div key={label} style={rowStyle}>
            <span style={labelStyle}>{label}</span>
            <span style={valueStyle}>{value as React.ReactNode}</span>
          </div>
        ))}
      </div>

      {/* Feedback Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 16,
          marginBottom: 20,
        }}
      >
        {[
          { label: 'Groups Joined', value: groupHistory.length },
          { label: 'Feedback Given', value: feedbackGiven.length },
          { label: 'Feedback Received', value: feedbackReceived },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '16px 20px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
              textAlign: 'center',
            }}
          >
            <div
              style={{ fontSize: 28, fontWeight: 700, color: '#6C63FF', marginBottom: 4 }}
            >
              {value}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Questionnaire Answers */}
      {questionnaireAnswers.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Questionnaire Answers</div>
          {questionnaireAnswers.map((qa) => (
            <div key={qa.id} style={rowStyle}>
              <span style={labelStyle}>{qa.question_label || qa.question_key}</span>
              <span style={valueStyle}>
                {Array.isArray(qa.answer) ? qa.answer.join(', ') : String(qa.answer)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Availability Grid */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Availability</div>
        {availability.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 14 }}>No availability set.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th
                    style={{
                      padding: '6px 10px',
                      textAlign: 'left',
                      color: '#9ca3af',
                      fontWeight: 500,
                    }}
                  >
                    Day
                  </th>
                  {SLOTS.map((slot) => (
                    <th
                      key={slot}
                      style={{
                        padding: '6px 10px',
                        textAlign: 'center',
                        color: '#9ca3af',
                        fontWeight: 500,
                        minWidth: 80,
                      }}
                    >
                      {slot}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => (
                  <tr key={day}>
                    <td
                      style={{
                        padding: '6px 10px',
                        color: '#374151',
                        fontWeight: 500,
                      }}
                    >
                      {day}
                    </td>
                    {SLOTS.map((slot) => {
                      const available = availMap[day]?.has(slot)
                      return (
                        <td
                          key={slot}
                          style={{ padding: '6px 10px', textAlign: 'center' }}
                        >
                          <span
                            style={{
                              display: 'inline-block',
                              width: 22,
                              height: 22,
                              borderRadius: 6,
                              background: available ? '#6C63FF' : '#f3f4f6',
                              border: available
                                ? '2px solid #5a52e0'
                                : '2px solid #e5e7eb',
                            }}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Group History */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Group History</div>
        {groupHistory.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 14 }}>No groups yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groupHistory.map((g) => (
              <div
                key={g.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#f9fafb',
                  borderRadius: 8,
                  cursor: 'pointer',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
                onClick={() => navigate(`/groups/${g.id}`)}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{g.name}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    {g.scheduled_time
                      ? format(new Date(g.scheduled_time), 'MMM d, yyyy h:mm a')
                      : format(new Date(g.created_at), 'MMM d, yyyy')}
                    {g.venue ? ` · ${g.venue.name}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>
                    {g.members?.length ?? 0} members
                  </span>
                  <Badge variant={g.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feedback Given */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Feedback Given ({feedbackGiven.length})</div>
        {feedbackGiven.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 14 }}>No feedback submitted.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {feedbackGiven.map((f) => (
              <div
                key={f.id}
                style={{
                  padding: '10px 14px',
                  background: '#f9fafb',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                    flexWrap: 'wrap',
                    gap: 6,
                  }}
                >
                  <div style={{ fontWeight: 500 }}>
                    Rating: {f.rating}/5
                    {f.vibe_score !== null && f.vibe_score !== undefined
                      ? ` · Vibe: ${f.vibe_score}/5`
                      : ''}
                    {f.would_meet_again !== null
                      ? ` · Meet again: ${f.would_meet_again ? 'Yes' : 'No'}`
                      : ''}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    {format(new Date(f.created_at), 'MMM d, yyyy')}
                  </div>
                </div>
                {f.notes && (
                  <div style={{ color: '#6b7280', fontSize: 13 }}>{f.notes}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import { useEffect, useState, type CSSProperties } from 'react'
import { format } from 'date-fns'
import { getFeedback, getCycles, type Feedback as FeedbackType, type Cycle } from '../lib/api'

export default function Feedback() {
  const [feedbacks, setFeedbacks] = useState<FeedbackType[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cycleFilter, setCycleFilter] = useState('')
  const [ratingFilter, setRatingFilter] = useState('')

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [f, c] = await Promise.all([getFeedback(), getCycles()])
        if (mounted) {
          setFeedbacks(f)
          setCycles(c)
        }
      } catch (err) {
        if (mounted) setError(String(err))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  // Filter feedbacks
  const filtered = feedbacks.filter((f) => {
    if (cycleFilter && f.group?.cycle_id !== cycleFilter) return false
    if (ratingFilter) {
      const minRating = Number(ratingFilter)
      if (f.rating < minRating) return false
    }
    return true
  })

  // Aggregate stats
  const totalResponses = filtered.length
  const avgRating =
    totalResponses > 0
      ? filtered.reduce((s, f) => s + f.rating, 0) / totalResponses
      : null
  const vibeItems = filtered.filter((f) => f.vibe_score !== null)
  const avgVibe =
    vibeItems.length > 0
      ? vibeItems.reduce((s, f) => s + (f.vibe_score ?? 0), 0) / vibeItems.length
      : null
  const meetItems = filtered.filter((f) => f.would_meet_again !== null)
  const wouldMeetPct =
    meetItems.length > 0
      ? (meetItems.filter((f) => f.would_meet_again).length / meetItems.length) * 100
      : null

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 12,
  }

  const titleStyle: CSSProperties = {
    fontSize: 24,
    fontWeight: 700,
    color: '#1a1a2e',
    letterSpacing: '-0.02em',
  }

  const statsGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 16,
    marginBottom: 24,
  }

  const statCardStyle: CSSProperties = {
    background: '#fff',
    borderRadius: 12,
    padding: '16px 20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
    textAlign: 'center',
  }

  const toolbarStyle: CSSProperties = {
    display: 'flex',
    gap: 10,
    marginBottom: 16,
    flexWrap: 'wrap',
  }

  const selectStyle: CSSProperties = {
    padding: '8px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontSize: 14,
    background: '#fff',
    outline: 'none',
    cursor: 'pointer',
  }

  const tableCardStyle: CSSProperties = {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
    overflow: 'hidden',
  }

  const thStyle: CSSProperties = {
    padding: '10px 16px',
    background: '#f8f9fa',
    color: '#6b7280',
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    borderBottom: '1px solid #e5e7eb',
    textAlign: 'left' as const,
    whiteSpace: 'nowrap' as const,
  }

  const tdStyle: CSSProperties = {
    padding: '12px 16px',
    borderBottom: '1px solid #f3f4f6',
    fontSize: 14,
    color: '#1a1a2e',
    verticalAlign: 'middle',
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
        Loading feedback…
      </div>
    )
  }

  if (error) {
    return <div style={{ padding: 40, color: '#dc2626' }}>Error: {error}</div>
  }

  function renderStars(rating: number) {
    return (
      <span>
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            style={{ color: i <= rating ? '#f59e0b' : '#d1d5db', fontSize: 13 }}
          >
            ★
          </span>
        ))}
        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>
          {rating}/5
        </span>
      </span>
    )
  }

  return (
    <div>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Feedback</h1>
        <span style={{ color: '#9ca3af', fontSize: 14 }}>
          {totalResponses} response{totalResponses !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Aggregate Stats */}
      <div style={statsGridStyle}>
        <div style={statCardStyle}>
          <div
            style={{ fontSize: 28, fontWeight: 700, color: '#6C63FF', marginBottom: 4 }}
          >
            {totalResponses}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>Total Responses</div>
        </div>
        <div style={statCardStyle}>
          <div
            style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}
          >
            {avgRating !== null ? avgRating.toFixed(1) : '—'}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>Avg Rating</div>
        </div>
        <div style={statCardStyle}>
          <div
            style={{ fontSize: 28, fontWeight: 700, color: '#8b5cf6', marginBottom: 4 }}
          >
            {avgVibe !== null ? avgVibe.toFixed(1) : '—'}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>Avg Vibe Score</div>
        </div>
        <div style={statCardStyle}>
          <div
            style={{ fontSize: 28, fontWeight: 700, color: '#10b981', marginBottom: 4 }}
          >
            {wouldMeetPct !== null ? `${wouldMeetPct.toFixed(0)}%` : '—'}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>Would Meet Again</div>
        </div>
      </div>

      {/* Filters */}
      <div style={toolbarStyle}>
        <select
          style={selectStyle}
          value={cycleFilter}
          onChange={(e) => setCycleFilter(e.target.value)}
        >
          <option value="">All Cycles</option>
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {format(new Date(c.week_start), 'MMM d')} –{' '}
              {format(new Date(c.week_end), 'MMM d, yyyy')}
            </option>
          ))}
        </select>
        <select
          style={selectStyle}
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value)}
        >
          <option value="">All Ratings</option>
          <option value="5">5 Stars Only</option>
          <option value="4">4+ Stars</option>
          <option value="3">3+ Stars</option>
          <option value="2">2+ Stars</option>
          <option value="1">1+ Stars</option>
        </select>
      </div>

      {/* Table */}
      <div style={tableCardStyle}>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: 14,
            }}
          >
            No feedback found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Group</th>
                  <th style={thStyle}>Rating</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Vibe</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Meet Again</th>
                  <th style={thStyle}>Notes</th>
                  <th style={thStyle}>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <FeedbackRow key={f.id} feedback={f} tdStyle={tdStyle} renderStars={renderStars} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

interface FeedbackRowProps {
  feedback: FeedbackType
  tdStyle: CSSProperties
  renderStars: (rating: number) => React.ReactNode
}

function FeedbackRow({ feedback: f, tdStyle, renderStars }: FeedbackRowProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <tr
      style={{
        background: hovered ? '#f9f8ff' : '#fff',
        transition: 'background 0.1s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td style={tdStyle}>
        <div style={{ fontWeight: 500 }}>
          {(f.profile?.first_name || f.profile?.display_name) ?? '—'}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>
          {(f.profile?.first_name || f.profile?.display_name) ? '' : f.user_id?.slice(0, 8) ?? ''}
        </div>
      </td>
      <td style={tdStyle}>
        <div style={{ fontSize: 13 }}>{f.group?.name ?? '—'}</div>
        {f.group?.cycle_id && (
          <div
            style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}
          >
            {f.group.cycle_id.slice(0, 8)}…
          </div>
        )}
      </td>
      <td style={tdStyle}>{renderStars(f.rating)}</td>
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        {f.vibe_score !== null && f.vibe_score !== undefined ? (
          <span style={{ fontWeight: 600, color: '#8b5cf6' }}>
            {f.vibe_score}/5
          </span>
        ) : (
          <span style={{ color: '#d1d5db' }}>—</span>
        )}
      </td>
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        {f.would_meet_again === null ? (
          <span style={{ color: '#d1d5db' }}>—</span>
        ) : f.would_meet_again ? (
          <span style={{ color: '#15803d', fontWeight: 600 }}>✓ Yes</span>
        ) : (
          <span style={{ color: '#dc2626', fontWeight: 600 }}>✗ No</span>
        )}
      </td>
      <td style={{ ...tdStyle, maxWidth: 220 }}>
        {f.notes ? (
          <span
            style={{
              fontSize: 13,
              color: '#374151',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
              overflow: 'hidden',
            }}
          >
            {f.notes}
          </span>
        ) : (
          <span style={{ color: '#d1d5db' }}>—</span>
        )}
      </td>
      <td style={tdStyle}>
        <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>
          {format(new Date(f.created_at), 'MMM d, yyyy')}
        </span>
      </td>
    </tr>
  )
}


import { useEffect, useState, type CSSProperties } from 'react'
import { format } from 'date-fns'
import {
  getDashboardStats,
  getRecentActivity,
  getCurrentCycle,
  triggerMatching,
  type DashboardStats,
  type RecentActivity,
  type Cycle,
} from '../lib/api'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activity, setActivity] = useState<RecentActivity | null>(null)
  const [currentCycle, setCurrentCycle] = useState<Cycle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showMatchModal, setShowMatchModal] = useState(false)
  const [matchLoading, setMatchLoading] = useState(false)
  const [matchResult, setMatchResult] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [s, a, c] = await Promise.all([
          getDashboardStats(),
          getRecentActivity(),
          getCurrentCycle(),
        ])
        if (!mounted) return
        setStats(s)
        setActivity(a)
        setCurrentCycle(c)
      } catch (err) {
        if (mounted) setError(String(err))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  async function handleTriggerMatching() {
    setMatchLoading(true)
    setMatchResult(null)
    try {
      const result = await triggerMatching()
      setMatchResult(result.message ?? 'Matching triggered successfully.')
    } catch (err) {
      setMatchResult(`Error: ${String(err)}`)
    } finally {
      setMatchLoading(false)
    }
  }

  const pageStyle: CSSProperties = { width: '100%' }

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
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 16,
    marginBottom: 28,
  }

  const twoColStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 20,
  }

  const cardStyle: CSSProperties = {
    background: '#fff',
    borderRadius: 12,
    padding: '20px 24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
  }

  const cardTitleStyle: CSSProperties = {
    fontSize: 15,
    fontWeight: 600,
    color: '#1a1a2e',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: '1px solid #f3f4f6',
  }

  const runBtnStyle: CSSProperties = {
    padding: '9px 20px',
    background: '#6C63FF',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    letterSpacing: '0.01em',
  }

  const activityItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 0',
    borderBottom: '1px solid #f3f4f6',
  }

  const dotStyle = (color: string): CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
  })

  const cycleRowStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #f3f4f6',
    fontSize: 14,
  }

  const modalOverlay: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  }

  const modalBox: CSSProperties = {
    background: '#fff',
    borderRadius: 14,
    padding: '32px 28px',
    maxWidth: 420,
    width: '90%',
    boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
  }

  if (loading) {
    return (
      <div style={{ padding: 40, color: '#9ca3af', textAlign: 'center' }}>
        Loading dashboard…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 40, color: '#dc2626' }}>
        Error loading dashboard: {error}
      </div>
    )
  }

  const fmtRating = (v: number | null | undefined) =>
    v !== null && v !== undefined ? v.toFixed(1) : '—'
  const fmtPct = (v: number | null | undefined) =>
    v !== null && v !== undefined ? `${v.toFixed(0)}%` : '—'

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Dashboard</h1>
        <button
          style={runBtnStyle}
          onClick={() => setShowMatchModal(true)}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = '#5a52e0'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = '#6C63FF'
          }}
        >
          ▶ Run Matching
        </button>
      </div>

      {/* Stats */}
      <div style={statsGridStyle}>
        <StatCard
          icon="👥"
          label="Total Users"
          value={stats?.totalUsers ?? '—'}
        />
        <StatCard
          icon="🫂"
          label="Active Groups"
          value={stats?.activeGroups ?? '—'}
        />
        <StatCard
          icon="⭐"
          label="Avg Feedback Rating"
          value={fmtRating(stats?.avgFeedbackRating)}
        />
        <StatCard
          icon="✅"
          label="Completion Rate"
          value={fmtPct(stats?.completionRate)}
        />
      </div>

      {/* Two columns */}
      <div style={twoColStyle}>
        {/* Current Cycle */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Current Cycle</div>
          {currentCycle ? (
            <div>
              <div style={cycleRowStyle}>
                <span style={{ color: '#6b7280', fontSize: 13 }}>Status</span>
                <Badge variant={currentCycle.status} />
              </div>
              <div style={cycleRowStyle}>
                <span style={{ color: '#6b7280', fontSize: 13 }}>Week Start</span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  {format(new Date(currentCycle.week_start), 'MMM d, yyyy')}
                </span>
              </div>
              <div style={cycleRowStyle}>
                <span style={{ color: '#6b7280', fontSize: 13 }}>Week End</span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  {format(new Date(currentCycle.week_end), 'MMM d, yyyy')}
                </span>
              </div>
              <div style={{ ...cycleRowStyle, borderBottom: 'none' }}>
                <span style={{ color: '#6b7280', fontSize: 13 }}>Cycle ID</span>
                <span
                  style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}
                >
                  {currentCycle.id.slice(0, 8)}…
                </span>
              </div>
            </div>
          ) : (
            <div style={{ color: '#9ca3af', fontSize: 14 }}>No active cycle.</div>
          )}
        </div>

        {/* Recent Activity */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Recent Activity</div>
          <div>
            {activity?.recentSignups.slice(0, 3).map((u) => (
              <div key={u.id} style={activityItemStyle}>
                <div style={dotStyle('#6C63FF')} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {u.first_name || u.display_name || u.email} signed up
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
                    {format(new Date(u.created_at), 'MMM d, h:mm a')}
                  </div>
                </div>
              </div>
            ))}
            {activity?.recentGroups.slice(0, 3).map((g) => (
              <div key={g.id} style={activityItemStyle}>
                <div style={dotStyle('#10b981')} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Group "{g.name}" formed
                    {g.venue ? ` @ ${g.venue.name}` : ''}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
                    {format(new Date(g.created_at), 'MMM d, h:mm a')}
                  </div>
                </div>
                <Badge variant={g.status} />
              </div>
            ))}
            {!activity?.recentSignups.length && !activity?.recentGroups.length && (
              <div style={{ color: '#9ca3af', fontSize: 14 }}>No recent activity.</div>
            )}
          </div>
        </div>
      </div>

      {/* Run Matching Modal */}
      {showMatchModal && (
        <div style={modalOverlay} onClick={() => !matchLoading && setShowMatchModal(false)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 10,
                color: '#1a1a2e',
              }}
            >
              Run Matching
            </h2>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
              This will trigger the matching algorithm for the current cycle and form
              new groups. This action cannot be undone. Are you sure?
            </p>

            {matchResult && (
              <div
                style={{
                  background: matchResult.startsWith('Error')
                    ? '#FEF2F2'
                    : '#F0FDF4',
                  border: `1px solid ${matchResult.startsWith('Error') ? '#FECACA' : '#BBF7D0'}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 13,
                  color: matchResult.startsWith('Error') ? '#DC2626' : '#15803D',
                  marginBottom: 18,
                }}
              >
                {matchResult}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                style={{
                  padding: '9px 18px',
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: 8,
                  color: '#374151',
                  fontWeight: 500,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setShowMatchModal(false)
                  setMatchResult(null)
                }}
                disabled={matchLoading}
              >
                Cancel
              </button>
              <button
                style={{
                  padding: '9px 18px',
                  background: matchLoading ? '#a5b4fc' : '#6C63FF',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: matchLoading ? 'not-allowed' : 'pointer',
                }}
                onClick={handleTriggerMatching}
                disabled={matchLoading}
              >
                {matchLoading ? 'Running…' : 'Confirm & Run'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

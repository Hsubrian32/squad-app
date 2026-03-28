import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { getCycles, type Cycle } from '../lib/api'
import Badge from '../components/Badge'

export default function Cycles() {
  const navigate = useNavigate()
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const data = await getCycles()
        if (mounted) setCycles(data)
      } catch (err) {
        if (mounted) setError(String(err))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

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

  const tableWrapStyle: CSSProperties = {
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
    padding: '14px 16px',
    borderBottom: '1px solid #f3f4f6',
    fontSize: 14,
    color: '#1a1a2e',
    verticalAlign: 'middle',
  }

  if (loading) {
    return (
      <div style={{ padding: 40, color: '#9ca3af', textAlign: 'center' }}>
        Loading cycles…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 40, color: '#dc2626' }}>
        Error: {error}
      </div>
    )
  }

  return (
    <div>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Match Cycles</h1>
        <span style={{ color: '#9ca3af', fontSize: 14 }}>
          {cycles.length} cycle{cycles.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={tableWrapStyle}>
        {cycles.length === 0 ? (
          <div
            style={{ padding: '48px 24px', textAlign: 'center', color: '#9ca3af' }}
          >
            No cycles found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Week</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Groups</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Members</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Completion</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Avg Rating</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cycles.map((cycle) => (
                  <CycleRow
                    key={cycle.id}
                    cycle={cycle}
                    tdStyle={tdStyle}
                    onViewGroups={() =>
                      navigate(`/groups?cycle=${cycle.id}`)
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

interface CycleRowProps {
  cycle: Cycle
  tdStyle: CSSProperties
  onViewGroups: () => void
}

function CycleRow({ cycle, tdStyle, onViewGroups }: CycleRowProps) {
  const [hovered, setHovered] = useState(false)

  const rowStyle: CSSProperties = {
    background: hovered ? '#f9f8ff' : '#fff',
    transition: 'background 0.1s',
  }

  const pctStyle = (pct: number | null | undefined): CSSProperties => {
    if (pct === null || pct === undefined) return { color: '#9ca3af' }
    if (pct >= 80) return { color: '#15803d', fontWeight: 600 }
    if (pct >= 50) return { color: '#b45309', fontWeight: 600 }
    return { color: '#dc2626', fontWeight: 600 }
  }

  return (
    <tr
      style={rowStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td style={tdStyle}>
        <div style={{ fontWeight: 600 }}>
          {format(new Date(cycle.week_start), 'MMM d')} –{' '}
          {format(new Date(cycle.week_end), 'MMM d, yyyy')}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>
          {cycle.id.slice(0, 8)}…
        </div>
      </td>
      <td style={tdStyle}>
        <Badge variant={cycle.status} />
      </td>
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <span style={{ fontWeight: 600, color: '#6C63FF' }}>
          {cycle.total_groups ?? '—'}
        </span>
      </td>
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <span style={{ fontWeight: 600 }}>
          {cycle.total_members ?? '—'}
        </span>
      </td>
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <span style={pctStyle(cycle.completion_rate)}>
          {cycle.completion_rate !== null && cycle.completion_rate !== undefined
            ? `${cycle.completion_rate.toFixed(0)}%`
            : '—'}
        </span>
      </td>
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        {cycle.avg_feedback !== null && cycle.avg_feedback !== undefined ? (
          <span style={{ fontWeight: 600 }}>
            ⭐ {cycle.avg_feedback.toFixed(1)}
          </span>
        ) : (
          <span style={{ color: '#d1d5db' }}>—</span>
        )}
      </td>
      <td style={tdStyle}>
        <button
          style={{
            padding: '5px 14px',
            background: '#6C63FF',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          onClick={onViewGroups}
        >
          View Groups
        </button>
      </td>
    </tr>
  )
}


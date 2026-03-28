import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { getGroups, getCycles, type Group, type Cycle } from '../lib/api'
import DataTable, { type Column } from '../components/DataTable'
import Badge from '../components/Badge'

export default function Groups() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [groups, setGroups] = useState<Group[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [loading, setLoading] = useState(true)

  const cycleFilter = searchParams.get('cycle') ?? ''
  const statusFilter = searchParams.get('status') ?? ''

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const [g, c] = await Promise.all([
          getGroups(cycleFilter || undefined),
          getCycles(),
        ])
        if (!mounted) return
        setGroups(g)
        setCycles(c)
      } catch (err) {
        console.error(err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [cycleFilter])

  const filtered = statusFilter
    ? groups.filter((g) => g.status === statusFilter)
    : groups

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'name',
      label: 'Group Name',
      render: (_, row) => {
        const g = row as unknown as Group
        return (
          <div style={{ fontWeight: 500, fontSize: 14, color: '#1a1a2e' }}>
            {g.name}
          </div>
        )
      },
    },
    {
      key: 'cycle_id',
      label: 'Cycle',
      render: (v) => (
        <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#9ca3af' }}>
          {String(v ?? '—').slice(0, 8)}…
        </span>
      ),
    },
    {
      key: 'venue',
      label: 'Venue',
      render: (_, row) => {
        const g = row as unknown as Group
        return (
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>
              {g.venue?.name ?? '—'}
            </div>
            {g.venue?.neighborhood && (
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                {g.venue.neighborhood}
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'member_count',
      label: 'Members',
      align: 'center',
      render: (v) => (
        <span
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: '#6C63FF',
          }}
        >
          {String(v ?? '0')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <Badge variant={String(v ?? 'forming') as Group['status']} />,
    },
    {
      key: 'scheduled_time',
      label: 'Scheduled',
      render: (v) =>
        v ? format(new Date(String(v)), 'MMM d, yyyy h:mm a') : '—',
    },
    {
      key: 'avg_feedback',
      label: 'Avg Rating',
      align: 'center',
      render: (v) => {
        if (v === null || v === undefined) return <span style={{ color: '#d1d5db' }}>—</span>
        return (
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            ⭐ {Number(v).toFixed(1)}
          </span>
        )
      },
    },
  ]

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

  return (
    <div>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Groups</h1>
        <span style={{ color: '#9ca3af', fontSize: 14 }}>
          {filtered.length} group{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={toolbarStyle}>
        <select
          style={selectStyle}
          value={cycleFilter}
          onChange={(e) => {
            const params: Record<string, string> = {}
            if (e.target.value) params.cycle = e.target.value
            if (statusFilter) params.status = statusFilter
            setSearchParams(params)
          }}
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
          value={statusFilter}
          onChange={(e) => {
            const params: Record<string, string> = {}
            if (cycleFilter) params.cycle = cycleFilter
            if (e.target.value) params.status = e.target.value
            setSearchParams(params)
          }}
        >
          <option value="">All Statuses</option>
          <option value="forming">Forming</option>
          <option value="confirmed">Confirmed</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div style={tableCardStyle}>
        <DataTable
          columns={columns}
          data={filtered as unknown as Record<string, unknown>[]}
          loading={loading}
          emptyMessage="No groups found."
          onRowClick={(row) => {
            const g = row as unknown as Group
            navigate(`/groups/${g.id}`)
          }}
          keyExtractor={(row) => String(row.id)}
        />
      </div>
    </div>
  )
}

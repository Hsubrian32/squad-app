import { useEffect, useState, type CSSProperties, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { getUsers, updateUserStatus, type UserProfile } from '../lib/api'
import DataTable, { type Column } from '../components/DataTable'
import Badge from '../components/Badge'

export default function Users() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [onboardingFilter, setOnboardingFilter] = useState<boolean | undefined>(undefined)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const LIMIT = 20

  async function load(p = page, s = search, ob = onboardingFilter) {
    setLoading(true)
    try {
      const result = await getUsers(p, LIMIT, s || undefined, ob)
      setUsers(result.data)
      setTotal(result.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, search, onboardingFilter]) // eslint-disable-line

  function handleSearch() {
    setPage(1)
    setSearch(searchInput)
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch()
  }

  async function handleBanToggle(user: UserProfile) {
    const newStatus = user.status === 'banned' ? 'active' : 'banned'
    setActionLoading(user.id)
    try {
      await updateUserStatus(user.id, newStatus)
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
      )
    } catch (err) {
      alert(`Failed to update status: ${String(err)}`)
    } finally {
      setActionLoading(null)
    }
  }

  const totalPages = Math.ceil(total / LIMIT)

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'display_name',
      label: 'Name',
      render: (_, row) => {
        const user = row as unknown as UserProfile
        return (
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>
              {user.first_name || user.display_name || '—'}
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>{user.email}</div>
          </div>
        )
      },
    },
    {
      key: 'created_at',
      label: 'Joined',
      render: (v) =>
        v ? format(new Date(String(v)), 'MMM d, yyyy') : '—',
    },
    {
      key: 'onboarding_complete',
      label: 'Onboarding',
      render: (v) => (
        <Badge variant={v ? 'complete' : 'incomplete'} />
      ),
    },
    {
      key: 'neighborhood',
      label: 'Neighborhood',
      render: (v) => (
        <span style={{ fontSize: 13, color: '#6b7280' }}>{String(v ?? '—')}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => {
        const status = String(v ?? 'active') as UserProfile['status']
        return <Badge variant={status} />
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => {
        const user = row as unknown as UserProfile
        const isLoading = actionLoading === user.id
        return (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={actionBtnStyle('#6C63FF', '#fff')}
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/users/${user.id}`)
              }}
            >
              View
            </button>
            <button
              style={actionBtnStyle(
                user.status === 'banned' ? '#15803d' : '#dc2626',
                '#fff'
              )}
              onClick={(e) => {
                e.stopPropagation()
                handleBanToggle(user)
              }}
              disabled={isLoading}
            >
              {isLoading ? '…' : user.status === 'banned' ? 'Unban' : 'Ban'}
            </button>
          </div>
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
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 16,
  }

  const searchInputStyle: CSSProperties = {
    padding: '8px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    width: 240,
    background: '#fff',
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

  const paginationStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderTop: '1px solid #f3f4f6',
    fontSize: 13,
    color: '#6b7280',
  }

  const pageBtnStyle = (disabled: boolean): CSSProperties => ({
    padding: '6px 14px',
    background: disabled ? '#f3f4f6' : '#6C63FF',
    color: disabled ? '#9ca3af' : '#fff',
    border: 'none',
    borderRadius: 6,
    fontWeight: 500,
    fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer',
  })

  return (
    <div>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Users</h1>
        <span style={{ color: '#9ca3af', fontSize: 14 }}>
          {total.toLocaleString()} total
        </span>
      </div>

      <div style={toolbarStyle}>
        <input
          type="text"
          placeholder="Search by name or email…"
          value={searchInput}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setSearchInput(e.target.value)
          }
          onKeyDown={handleSearchKeyDown}
          style={searchInputStyle}
        />
        <button
          style={{
            padding: '8px 16px',
            background: '#6C63FF',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
          onClick={handleSearch}
        >
          Search
        </button>
        <select
          style={selectStyle}
          value={
            onboardingFilter === undefined
              ? 'all'
              : onboardingFilter
              ? 'complete'
              : 'incomplete'
          }
          onChange={(e) => {
            setPage(1)
            if (e.target.value === 'all') setOnboardingFilter(undefined)
            else setOnboardingFilter(e.target.value === 'complete')
          }}
        >
          <option value="all">All Onboarding</option>
          <option value="complete">Onboarding Complete</option>
          <option value="incomplete">Onboarding Incomplete</option>
        </select>
      </div>

      <div style={tableCardStyle}>
        <DataTable
          columns={columns}
          data={users as unknown as Record<string, unknown>[]}
          loading={loading}
          emptyMessage="No users found."
          onRowClick={(row) => {
            const user = row as unknown as UserProfile
            navigate(`/users/${user.id}`)
          }}
          keyExtractor={(row) => String(row.id)}
        />
        <div style={paginationStyle}>
          <span>
            Page {page} of {totalPages || 1}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={pageBtnStyle(page <= 1)}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              ← Prev
            </button>
            <button
              style={pageBtnStyle(page >= totalPages)}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function actionBtnStyle(bg: string, color: string): CSSProperties {
  return {
    padding: '5px 12px',
    background: bg,
    border: 'none',
    borderRadius: 6,
    color,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  }
}

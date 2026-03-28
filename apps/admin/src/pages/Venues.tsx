import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { getVenues, createVenue, updateVenueStatus, type Venue } from '../lib/api'
import Badge from '../components/Badge'

const EMPTY_FORM: Omit<Venue, 'id' | 'created_at'> = {
  name: '',
  neighborhood: '',
  category: '',
  address: '',
  capacity: null,
  active: true,
  notes: null,
}

export default function Venues() {
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState<Omit<Venue, 'id' | 'created_at'>>(EMPTY_FORM)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function loadVenues() {
    setLoading(true)
    try {
      const data = await getVenues()
      setVenues(data)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadVenues() }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormLoading(true)
    setFormError(null)
    try {
      const newVenue = await createVenue(formData)
      setVenues((prev) => [newVenue, ...prev])
      setShowModal(false)
      setFormData(EMPTY_FORM)
    } catch (err) {
      setFormError(String(err))
    } finally {
      setFormLoading(false)
    }
  }

  async function handleToggleActive(venue: Venue) {
    setTogglingId(venue.id)
    try {
      await updateVenueStatus(venue.id, !venue.active)
      setVenues((prev) =>
        prev.map((v) => (v.id === venue.id ? { ...v, active: !v.active } : v))
      )
    } catch (err) {
      alert(`Failed: ${String(err)}`)
    } finally {
      setTogglingId(null)
    }
  }

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

  const addBtnStyle: CSSProperties = {
    padding: '9px 18px',
    background: '#6C63FF',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
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
    padding: '14px 16px',
    borderBottom: '1px solid #f3f4f6',
    fontSize: 14,
    color: '#1a1a2e',
    verticalAlign: 'middle',
  }

  const modalOverlay: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: 16,
  }

  const modalBox: CSSProperties = {
    background: '#fff',
    borderRadius: 14,
    padding: '28px 28px',
    maxWidth: 500,
    width: '100%',
    boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
    maxHeight: '90vh',
    overflowY: 'auto',
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: 7,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    color: '#1a1a2e',
  }

  const fieldStyle: CSSProperties = {
    marginBottom: 14,
  }

  const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: '#374151',
    marginBottom: 5,
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
        Loading venues…
      </div>
    )
  }

  if (error) {
    return <div style={{ padding: 40, color: '#dc2626' }}>Error: {error}</div>
  }

  return (
    <div>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Venues</h1>
        <button
          style={addBtnStyle}
          onClick={() => setShowModal(true)}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = '#5a52e0'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = '#6C63FF'
          }}
        >
          + Add Venue
        </button>
      </div>

      <div style={tableCardStyle}>
        {venues.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: 14,
            }}
          >
            No venues yet. Add one to get started.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Neighborhood</th>
                  <th style={thStyle}>Category</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Capacity</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Notes</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {venues.map((venue) => (
                  <VenueRow
                    key={venue.id}
                    venue={venue}
                    tdStyle={tdStyle}
                    toggling={togglingId === venue.id}
                    onToggle={() => handleToggleActive(venue)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Venue Modal */}
      {showModal && (
        <div
          style={modalOverlay}
          onClick={() => !formLoading && setShowModal(false)}
        >
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 20,
                color: '#1a1a2e',
              }}
            >
              Add New Venue
            </h2>

            {formError && (
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: '#DC2626',
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Name *</label>
                <input
                  style={inputStyle}
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, name: e.target.value }))
                  }
                  required
                  placeholder="e.g. The Golden Keg"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Neighborhood *</label>
                  <input
                    style={inputStyle}
                    value={formData.neighborhood}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, neighborhood: e.target.value }))
                    }
                    required
                    placeholder="e.g. Lower East Side"
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Category *</label>
                  <input
                    style={inputStyle}
                    value={formData.category}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, category: e.target.value }))
                    }
                    required
                    placeholder="e.g. Bar, Restaurant, Cafe"
                  />
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Address</label>
                <input
                  style={inputStyle}
                  value={formData.address}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, address: e.target.value }))
                  }
                  placeholder="Street address"
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Capacity</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={formData.capacity ?? ''}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      capacity: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  placeholder="Max group size"
                  min={1}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Notes</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
                  value={formData.notes ?? ''}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      notes: e.target.value || null,
                    }))
                  }
                  placeholder="Any notes about this venue…"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, active: e.target.checked }))
                  }
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <label
                  htmlFor="active"
                  style={{ fontSize: 14, color: '#374151', cursor: 'pointer' }}
                >
                  Active (available for matching)
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
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
                    setShowModal(false)
                    setFormData(EMPTY_FORM)
                    setFormError(null)
                  }}
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '9px 18px',
                    background: formLoading ? '#a5b4fc' : '#6C63FF',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: formLoading ? 'not-allowed' : 'pointer',
                  }}
                  disabled={formLoading}
                >
                  {formLoading ? 'Saving…' : 'Add Venue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

interface VenueRowProps {
  venue: Venue
  tdStyle: CSSProperties
  toggling: boolean
  onToggle: () => void
}

function VenueRow({ venue, tdStyle, toggling, onToggle }: VenueRowProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <tr
      style={{ background: hovered ? '#f9f8ff' : '#fff', transition: 'background 0.1s' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td style={tdStyle}>
        <div style={{ fontWeight: 500 }}>{venue.name}</div>
        <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>
          {venue.id.slice(0, 8)}…
        </div>
      </td>
      <td style={tdStyle}>
        <span style={{ fontSize: 13 }}>{venue.neighborhood}</span>
      </td>
      <td style={tdStyle}>
        <span
          style={{
            fontSize: 12,
            background: '#f3f4f6',
            padding: '3px 8px',
            borderRadius: 6,
            color: '#374151',
          }}
        >
          {venue.category}
        </span>
      </td>
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        {venue.capacity ?? '—'}
      </td>
      <td style={tdStyle}>
        <Badge
          variant={venue.active ? 'active' : 'cancelled'}
          label={venue.active ? 'Active' : 'Inactive'}
        />
      </td>
      <td style={{ ...tdStyle, maxWidth: 200 }}>
        <span
          style={{
            fontSize: 12,
            color: '#9ca3af',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'block',
            whiteSpace: 'nowrap',
          }}
        >
          {venue.notes ?? '—'}
        </span>
      </td>
      <td style={tdStyle}>
        <button
          style={{
            padding: '5px 14px',
            background: venue.active ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${venue.active ? '#FECACA' : '#BBF7D0'}`,
            borderRadius: 6,
            color: venue.active ? '#DC2626' : '#15803D',
            fontSize: 12,
            fontWeight: 500,
            cursor: toggling ? 'not-allowed' : 'pointer',
            opacity: toggling ? 0.6 : 1,
            whiteSpace: 'nowrap',
          }}
          onClick={onToggle}
          disabled={toggling}
        >
          {toggling ? '…' : venue.active ? 'Deactivate' : 'Activate'}
        </button>
      </td>
    </tr>
  )
}


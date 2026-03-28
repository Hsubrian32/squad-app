import type { CSSProperties, ReactNode } from 'react'

export interface Column<T> {
  key: string
  label: string
  render?: (value: unknown, row: T) => ReactNode
  width?: string | number
  align?: 'left' | 'center' | 'right'
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
  keyExtractor?: (row: T) => string
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data found.',
  onRowClick,
  keyExtractor,
}: DataTableProps<T>) {
  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  }

  const thStyle: CSSProperties = {
    textAlign: 'left',
    padding: '10px 16px',
    background: '#f8f9fa',
    color: '#6b7280',
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    borderBottom: '1px solid #e5e7eb',
    whiteSpace: 'nowrap',
  }

  const tdStyle: CSSProperties = {
    padding: '12px 16px',
    borderBottom: '1px solid #f3f4f6',
    color: '#1a1a2e',
    verticalAlign: 'middle',
  }

  const trStyle: CSSProperties = {
    transition: 'background 0.1s',
  }

  const trHoverStyle: CSSProperties = {
    ...trStyle,
    background: '#f9f8ff',
    cursor: onRowClick ? 'pointer' : 'default',
  }

  if (loading) {
    return (
      <div
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: 14,
        }}
      >
        <div style={{ marginBottom: 8, fontSize: 24 }}>⟳</div>
        Loading…
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: 14,
        }}
      >
        <div style={{ marginBottom: 8, fontSize: 32 }}>📭</div>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  ...thStyle,
                  width: col.width,
                  textAlign: col.align ?? 'left',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => {
            const key = keyExtractor
              ? keyExtractor(row)
              : (row.id as string) ?? String(rowIndex)

            return (
              <HoverRow
                key={key}
                style={trStyle}
                hoverStyle={trHoverStyle}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => {
                  const rawValue = row[col.key]
                  const cellContent = col.render
                    ? col.render(rawValue, row)
                    : rawValue === null || rawValue === undefined
                    ? '—'
                    : String(rawValue)

                  return (
                    <td
                      key={col.key}
                      style={{ ...tdStyle, textAlign: col.align ?? 'left' }}
                    >
                      {cellContent as ReactNode}
                    </td>
                  )
                })}
              </HoverRow>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── HoverRow helper ──────────────────────────────────────────────────────────

import { useState } from 'react'

interface HoverRowProps {
  children: ReactNode
  style: CSSProperties
  hoverStyle: CSSProperties
  onClick?: () => void
}

function HoverRow({ children, style, hoverStyle, onClick }: HoverRowProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <tr
      style={hovered ? hoverStyle : style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

import type { CSSProperties, ReactNode } from 'react'

interface StatCardProps {
  icon: ReactNode
  label: string
  value: string | number | null | undefined
  trend?: {
    value: number
    label?: string
  }
  style?: CSSProperties
}

export default function StatCard({ icon, label, value, trend, style }: StatCardProps) {
  const cardStyle: CSSProperties = {
    background: '#fff',
    borderRadius: 12,
    padding: '20px 24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minWidth: 0,
    ...style,
  }

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  }

  const iconWrapStyle: CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: '#F0EFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    flexShrink: 0,
  }

  const labelStyle: CSSProperties = {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: 500,
    letterSpacing: '0.01em',
  }

  const valueStyle: CSSProperties = {
    fontSize: 28,
    fontWeight: 700,
    color: '#1a1a2e',
    lineHeight: 1.1,
  }

  const trendStyle: CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    color: trend && trend.value >= 0 ? '#15803d' : '#dc2626',
    display: 'flex',
    alignItems: 'center',
    gap: 3,
  }

  const displayValue = value === null || value === undefined ? '—' : value

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={iconWrapStyle}>{icon}</div>
        <span style={labelStyle}>{label}</span>
      </div>
      <div style={valueStyle}>{displayValue}</div>
      {trend !== undefined && (
        <div style={trendStyle}>
          <span>{trend.value >= 0 ? '▲' : '▼'}</span>
          <span>
            {Math.abs(trend.value)}%{trend.label ? ` ${trend.label}` : ''}
          </span>
        </div>
      )}
    </div>
  )
}

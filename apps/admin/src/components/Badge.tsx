import type { CSSProperties } from 'react'
import type { GroupStatus, CycleStatus, OnboardingStatus, UserStatus } from '../lib/api'

type BadgeVariant =
  | GroupStatus
  | CycleStatus
  | OnboardingStatus
  | UserStatus
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'

interface BadgeProps {
  variant: BadgeVariant
  label?: string
  style?: CSSProperties
}

const variantStyles: Record<string, CSSProperties> = {
  // Group statuses
  forming: { background: '#FFF3CD', color: '#856404', border: '1px solid #FFE69C' },
  confirmed: { background: '#D1ECF1', color: '#0C5460', border: '1px solid #BEE5EB' },
  active: { background: '#D4EDDA', color: '#155724', border: '1px solid #C3E6CB' },
  completed: { background: '#E2E3E5', color: '#383D41', border: '1px solid #D6D8DB' },
  cancelled: { background: '#F8D7DA', color: '#721C24', border: '1px solid #F5C6CB' },

  // Cycle statuses
  pending: { background: '#FFF3CD', color: '#856404', border: '1px solid #FFE69C' },
  matching: { background: '#CCE5FF', color: '#004085', border: '1px solid #B8DAFF' },
  // 'active' already defined above
  // 'completed' already defined above

  // Onboarding
  complete: { background: '#D4EDDA', color: '#155724', border: '1px solid #C3E6CB' },
  incomplete: { background: '#F8D7DA', color: '#721C24', border: '1px solid #F5C6CB' },
  // 'pending' already defined above

  // User statuses
  banned: { background: '#F8D7DA', color: '#721C24', border: '1px solid #F5C6CB' },
  suspended: { background: '#FFF3CD', color: '#856404', border: '1px solid #FFE69C' },

  // Generic
  default: { background: '#E2E3E5', color: '#383D41', border: '1px solid #D6D8DB' },
  success: { background: '#D4EDDA', color: '#155724', border: '1px solid #C3E6CB' },
  warning: { background: '#FFF3CD', color: '#856404', border: '1px solid #FFE69C' },
  error: { background: '#F8D7DA', color: '#721C24', border: '1px solid #F5C6CB' },
  info: { background: '#D1ECF1', color: '#0C5460', border: '1px solid #BEE5EB' },
}

const variantLabels: Record<string, string> = {
  forming: 'Forming',
  confirmed: 'Confirmed',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
  pending: 'Pending',
  matching: 'Matching',
  complete: 'Complete',
  incomplete: 'Incomplete',
  banned: 'Banned',
  suspended: 'Suspended',
  default: 'Unknown',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
  info: 'Info',
}

export default function Badge({ variant, label, style }: BadgeProps) {
  const baseStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
    ...(variantStyles[variant] ?? variantStyles.default),
    ...style,
  }

  const displayLabel = label ?? variantLabels[variant] ?? variant

  return <span style={baseStyle}>{displayLabel}</span>
}

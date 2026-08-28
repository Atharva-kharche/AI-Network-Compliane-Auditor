import { CheckCircle, XCircle, AlertTriangle, MinusCircle } from 'lucide-react'

const statusConfig = {
  pass: { label: 'Pass', class: 'badge-pass', Icon: CheckCircle },
  fail: { label: 'Fail', class: 'badge-fail', Icon: XCircle },
  warning: { label: 'Warning', class: 'badge-warning', Icon: AlertTriangle },
  not_applicable: { label: 'N/A', class: 'badge-na', Icon: MinusCircle },
}

const severityConfig = {
  critical: 'badge-critical',
  high: 'badge-high',
  medium: 'badge-medium',
  low: 'badge-low',
  info: 'badge-info',
}

export function StatusBadge({ status }) {
  const cfg = statusConfig[status] || statusConfig.not_applicable
  const { label, class: cls, Icon } = cfg
  return (
    <span className={`badge ${cls}`}>
      <Icon size={12} />
      {label}
    </span>
  )
}

export function SeverityBadge({ severity }) {
  const cls = severityConfig[severity] || 'badge-info'
  return (
    <span className={`badge ${cls}`}>
      {severity?.toUpperCase() || 'INFO'}
    </span>
  )
}

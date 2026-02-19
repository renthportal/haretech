import { PROJECT_STATUS_LABELS, CRANE_STATUS_LABELS, ROLE_LABELS } from '@/types'
import { getStatusColor } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  type?: 'project' | 'crane' | 'role' | 'component' | 'activity'
}

const COMPONENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  in_progress: 'Devam Ediyor',
  completed: 'Tamamlandı',
}

const ACTIVITY_STATUS_LABELS: Record<string, string> = {
  planned: 'Planlandı',
  ready: 'Hazır',
  in_progress: 'Devam Ediyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
  weather_hold: 'Hava Bekleme',
}

export function StatusBadge({ status, type = 'component' }: StatusBadgeProps) {
  let label = status

  switch (type) {
    case 'project':
      label = PROJECT_STATUS_LABELS[status as keyof typeof PROJECT_STATUS_LABELS] || status
      break
    case 'crane':
      label = CRANE_STATUS_LABELS[status as keyof typeof CRANE_STATUS_LABELS] || status
      break
    case 'role':
      label = ROLE_LABELS[status as keyof typeof ROLE_LABELS] || status
      break
    case 'component':
      label = COMPONENT_STATUS_LABELS[status] || status
      break
    case 'activity':
      label = ACTIVITY_STATUS_LABELS[status] || status
      break
  }

  return <span className={getStatusColor(status)}>{label}</span>
}

import { type ClassValue, clsx } from 'clsx'

// Simple clsx implementation (no external dep needed)
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}

// Turkish number formatting
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// Format MW value
export function formatMW(value: number): string {
  return `${formatNumber(value, 1)} MW`
}

// Format weight in tons
export function formatTons(value: number): string {
  return `${formatNumber(value, 0)}t`
}

// Format meters
export function formatMeters(value: number): string {
  return `${formatNumber(value, 0)}m`
}

// Format wind speed
export function formatWindSpeed(value: number): string {
  return `${formatNumber(value, 1)} m/s`
}

// Turkish date formatting
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Percentage calculation
export function calcPercentage(completed: number, total: number): number {
  if (total === 0) return 0
  return Math.round((completed / total) * 100)
}

// Status color mapping
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    // Project statuses
    planning: 'badge-blue',
    mobilization: 'badge-yellow',
    active: 'badge-green',
    completing: 'badge-yellow',
    completed: 'badge-green',
    on_hold: 'badge-red',
    // Component statuses
    pending: 'badge-gray',
    in_progress: 'badge-yellow',
    // Activity statuses
    planned: 'badge-blue',
    ready: 'badge-yellow',
    cancelled: 'badge-red',
    weather_hold: 'badge-red',
    // Crane statuses
    available: 'badge-green',
    mobilizing: 'badge-yellow',
    on_site: 'badge-blue',
    working: 'badge-green',
    demobilizing: 'badge-yellow',
    maintenance: 'badge-red',
  }
  return colors[status] || 'badge-gray'
}

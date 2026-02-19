'use client'

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-10 w-10',
  }

  return (
    <div
      className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-wind-700/30 border-t-wind-500`}
    />
  )
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-gray-400">Yükleniyor...</p>
      </div>
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="card space-y-3">
      <div className="skeleton h-4 w-3/4" />
      <div className="skeleton h-3 w-1/2" />
      <div className="skeleton h-8 w-full" />
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="skeleton h-10 flex-1" />
          <div className="skeleton h-10 w-24" />
          <div className="skeleton h-10 w-32" />
        </div>
      ))}
    </div>
  )
}

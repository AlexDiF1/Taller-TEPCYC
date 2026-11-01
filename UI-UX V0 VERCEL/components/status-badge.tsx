import { STATUS_MAP, STATUSES, statusIndex } from '@/lib/status'
import type { OrderStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const meta = STATUS_MAP[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        meta.bg,
        meta.text,
        meta.ring,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden="true" />
      {meta.label}
    </span>
  )
}

export function StatusProgress({ status }: { status: OrderStatus }) {
  const current = statusIndex(status)
  const meta = STATUS_MAP[status]
  return (
    <div
      className="flex gap-1"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={STATUSES.length}
      aria-valuenow={current + 1}
      aria-valuetext={meta.label}
    >
      {STATUSES.map((s, i) => (
        <span
          key={s.value}
          className={cn('h-1 flex-1 rounded-full', i <= current ? meta.dot : 'bg-muted')}
        />
      ))}
    </div>
  )
}

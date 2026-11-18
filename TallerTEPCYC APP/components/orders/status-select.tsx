'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { STATUSES, STATUS_MAP } from '@/lib/status'
import type { OrderStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const ITEMS = STATUSES.map((s) => ({ label: s.label, value: s.value }))

export function StatusSelect({
  value,
  onChange,
  disabled,
  id,
  compact = false,
}: {
  value: OrderStatus
  onChange: (status: OrderStatus) => void
  disabled?: boolean
  id?: string
  /** Píldora pequeña para listas compactas. */
  compact?: boolean
}) {
  const meta = STATUS_MAP[value] ?? STATUS_MAP.pendiente
  return (
    <Select
      items={ITEMS}
      value={value}
      onValueChange={(v) => v && v !== value && onChange(v as OrderStatus)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-label="Cambiar estado de la orden"
        className={cn(
          'h-9 w-full rounded-lg border-0 font-medium ring-1 ring-inset',
          meta.bg,
          meta.text,
          meta.ring,
          compact && 'h-auto w-auto shrink-0 gap-1.5 rounded-full px-2.5 py-1 text-[11px] leading-none',
        )}
      >
        <span className={cn('size-2 shrink-0 rounded-full', meta.dot)} aria-hidden="true" />
        {compact ? meta.short : <SelectValue />}
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => {
          const Icon = s.icon
          return (
            <SelectItem key={s.value} value={s.value}>
              <Icon className={cn('size-4', s.text)} aria-hidden="true" />
              {s.label}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

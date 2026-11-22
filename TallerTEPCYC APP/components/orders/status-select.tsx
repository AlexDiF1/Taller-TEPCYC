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
  /** Píldora para listas. */
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
          'h-11 w-full rounded-xl border-0 font-semibold',
          meta.bg,
          meta.text,
          compact && 'h-9 w-auto shrink-0 gap-2 rounded-full px-3 text-[13px] data-[size=default]:h-9',
        )}
      >
        <span className={cn('size-2.5 shrink-0 rounded-full', meta.dot)} aria-hidden="true" />
        {compact ? meta.short : <SelectValue />}
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => {
          const Icon = s.icon
          return (
            <SelectItem key={s.value} value={s.value}>
              <Icon className={cn('size-[18px]', s.text)} aria-hidden="true" />
              {s.label}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

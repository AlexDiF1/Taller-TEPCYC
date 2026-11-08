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
}: {
  value: OrderStatus
  onChange: (status: OrderStatus) => void
  disabled?: boolean
  id?: string
}) {
  const meta = STATUS_MAP[value]
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
        className={cn('h-9 w-full rounded-lg border-0 font-medium ring-1 ring-inset', meta.bg, meta.text, meta.ring)}
      >
        <span className={cn('size-2 shrink-0 rounded-full', meta.dot)} aria-hidden="true" />
        <SelectValue />
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

'use client'

import { useState } from 'react'
import { ExternalLink, History } from 'lucide-react'
import { formatDate } from '@/lib/business'
import { STATUS_MAP, deviceLabel } from '@/lib/status'
import type { CustomerHistory } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * Cliente que ya vino antes: su nombre y sus órdenes anteriores, debajo del teléfono.
 * Las órdenes se abren en otra pestaña para no perder lo que va del ingreso.
 */
export function CustomerHistoryCard({
  history,
  currentName,
  onUseName,
  className,
}: {
  history: CustomerHistory
  currentName: string
  onUseName: (name: string) => void
  className?: string
}) {
  const [all, setAll] = useState(false)
  const customer = history.customer
  if (!customer) return null
  const otherName = currentName.trim() && currentName.trim().toLowerCase() !== customer.name.trim().toLowerCase()
  const visibles = all ? history.orders : history.orders.slice(0, 3)

  return (
    <section
      aria-label="Cliente conocido"
      className={cn('min-w-0 rounded-2xl border border-status-done/40 bg-status-done/8 p-3.5', className)}
    >
      <p className="flex items-center gap-2 text-[14px] font-bold">
        <History className="size-[18px] shrink-0 text-status-done" aria-hidden="true" />
        <span className="min-w-0">
          Ya vino antes: {history.total} orden{history.total === 1 ? '' : 'es'}
        </span>
      </p>
      {otherName && (
        <p className="mt-1.5 text-[13.5px] text-muted-foreground">
          Antes se registró como <b className="font-semibold text-foreground">{customer.name}</b>.{' '}
          <button
            type="button"
            onClick={() => onUseName(customer.name)}
            className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-2"
          >
            Usar ese nombre
          </button>
        </p>
      )}
      <ul className="mt-2 flex flex-col divide-y divide-border/70">
        {visibles.map((o) => {
          const meta = STATUS_MAP[o.status] ?? STATUS_MAP.pendiente
          return (
            <li key={o.id}>
              <a
                href={`/orden/${encodeURIComponent(o.id)}`}
                target="_blank"
                rel="noopener"
                className="flex min-h-11 items-center gap-2 py-1.5 text-[13.5px]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{deviceLabel(o.device) || 'Equipo'}</span>
                  <span className="block truncate text-[12.5px] text-muted-foreground">
                    <span className="font-mono">{o.id}</span> · {formatDate(o.createdAt)}
                    {o.reportedFault && <> · {o.reportedFault}</>}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold',
                    o.deliveredAt ? 'bg-muted text-muted-foreground' : cn(meta.bg, meta.text),
                  )}
                >
                  {o.deliveredAt ? 'Entregada' : meta.short}
                </span>
                <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </a>
            </li>
          )
        })}
      </ul>
      {history.orders.length > 3 && !all && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="mt-1 min-h-11 text-[13.5px] font-semibold text-primary"
        >
          Ver las {history.orders.length}
        </button>
      )}
    </section>
  )
}

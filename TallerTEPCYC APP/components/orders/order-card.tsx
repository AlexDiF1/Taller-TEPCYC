'use client'

import Link from 'next/link'
import { Clock, ReceiptText, UserRound, Images } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusProgress } from '@/components/status-badge'
import { StatusSelect } from './status-select'
import { WhatsAppButton } from './whatsapp-button'
import { DEVICE_ICON, STATUS_MAP } from '@/lib/status'
import type { Order, OrderStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

function daysSince(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  return `Hace ${days} días`
}

export function OrderCard({
  order,
  onStatusChange,
  onOpen,
}: {
  order: Order
  onStatusChange: (order: Order, status: OrderStatus) => void
  onOpen: (order: Order) => void
}) {
  const Icon = DEVICE_ICON[order.device.type]
  const status = STATUS_MAP[order.status]
  const receiptType = order.status === 'completada' ? 'entrega' : 'recepcion'

  return (
    <article className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border-2 border-border bg-card p-4 pt-5 shadow-lg shadow-black/30 ring-1 ring-white/5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-xl hover:shadow-primary/10">
      <span className={cn('absolute inset-x-0 top-0 h-1', status.dot)} aria-hidden="true" />
      <button
        type="button"
        onClick={() => onOpen(order)}
        className="-m-1 flex flex-1 flex-col gap-3 rounded-xl p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Ver detalle de la orden ${order.id}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-bold tracking-wider text-primary">{order.id}</span>
          <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
            <Clock className="size-3" aria-hidden="true" />
            {daysSince(order.createdAt)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary/80 ring-1 ring-border/60 transition-colors group-hover:bg-secondary">
            <Icon className="size-5 text-foreground" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold leading-tight text-foreground group-hover:text-primary transition-colors">
              {order.device.brand} {order.device.model}
            </h3>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <UserRound className="size-3 shrink-0" aria-hidden="true" />
              {order.customer.name}
            </p>
          </div>
        </div>

        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground/90">{order.reportedFault}</p>

        <div className="mt-auto pt-2 flex items-center justify-between text-xs text-muted-foreground">
          {order.photos.length > 0 ? (
            <span className="flex items-center gap-1 font-mono text-[11px]">
              <Images className="size-3.5 text-primary" aria-hidden="true" />
              {order.photos.length} foto{order.photos.length === 1 ? '' : 's'}
            </span>
          ) : <span />}
        </div>

        <div className="w-full">
          <StatusProgress status={order.status} />
        </div>
      </button>

      <div className="mt-4 pt-3 border-t border-border/50 flex flex-col gap-2">
        <StatusSelect value={order.status} onChange={(s) => onStatusChange(order, s)} id={`status-${order.id}`} />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <WhatsAppButton order={order} className="w-full h-8 text-xs font-semibold rounded-lg" />
          <Button
            variant="outline"
            className="h-8 rounded-lg text-xs"
            nativeButton={false}
            render={<Link href={`/comprobantes?orden=${order.id}&tipo=${receiptType}`} />}
            aria-label={`Comprobante de la orden ${order.id}`}
          >
            <ReceiptText data-icon="inline-start" className="size-3.5" />
            <span className="hidden sm:inline">Comprobante</span>
          </Button>
        </div>
      </div>
    </article>
  )
}

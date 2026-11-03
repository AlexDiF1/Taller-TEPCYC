'use client'

import Link from 'next/link'
import { Clock, ReceiptText, UserRound, Wrench, Images } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusProgress } from '@/components/status-badge'
import { StatusSelect } from './status-select'
import { WhatsAppButton } from './whatsapp-button'
import { DEVICE_ICON } from '@/lib/status'
import type { Order, OrderStatus } from '@/lib/types'

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
  const receiptType = order.status === 'completada' ? 'entrega' : 'recepcion'

  return (
    <article className="group flex flex-col rounded-2xl border border-border bg-card/90 p-4 transition-colors hover:border-foreground/20 md:p-5">
      <button
        type="button"
        onClick={() => onOpen(order)}
        className="-m-1 flex flex-col gap-3 rounded-xl p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Ver detalle de la orden ${order.id}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-semibold tracking-wider text-primary">{order.id}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" aria-hidden="true" />
            {daysSince(order.createdAt)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary ring-1 ring-border">
            <Icon className="size-5.5 text-foreground" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-semibold leading-tight">
              {order.device.brand} {order.device.model}
            </h3>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
              <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
              {order.customer.name}
            </p>
          </div>
        </div>

        <p className="line-clamp-2 min-h-10 text-pretty text-sm text-muted-foreground">{order.reportedFault}</p>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {order.photos.length > 0 && (
            <span className="flex items-center gap-1">
              <Images className="size-3.5" aria-hidden="true" />
              {order.photos.length}
            </span>
          )}
        </div>

        <StatusProgress status={order.status} />
      </button>

      <div className="mt-4 flex flex-col gap-2">
        <StatusSelect value={order.status} onChange={(s) => onStatusChange(order, s)} id={`status-${order.id}`} />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <WhatsAppButton order={order} className="w-full" />
          <Button
            variant="outline"
            className="h-9"
            nativeButton={false}
            render={<Link href={`/comprobantes?orden=${order.id}&tipo=${receiptType}`} />}
            aria-label={`Comprobante de la orden ${order.id}`}
          >
            <ReceiptText data-icon="inline-start" />
            <span className="hidden sm:inline">Comprobante</span>
          </Button>
        </div>
      </div>
    </article>
  )
}

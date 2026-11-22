'use client'

import { Camera } from 'lucide-react'
import { DEVICE_ICON, STATUS_MAP, deviceLabel, isClosed } from '@/lib/status'
import { formatMoney } from '@/lib/business'
import type { Order, OrderStatus } from '@/lib/types'
import { StatusSelect } from './status-select'
import { cn } from '@/lib/utils'

/** «hace 3 h», «ayer», «hace 6 días». */
export function timeAgo(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'ayer' : `hace ${d} días`
}

export function orderTotal(order: Order) {
  return order.items.reduce((s, i) => s + i.price, 0) || order.estimatedCost || 0
}

export function orderBalance(order: Order) {
  return Math.max(orderTotal(order) - (order.deposit || 0), 0)
}

/**
 * Tarjeta de la lista de órdenes. Tocar la tarjeta abre el detalle;
 * la píldora de estado lo cambia sin abrirla.
 */
export function OrderCard({
  order,
  onStatusChange,
  onOpen,
  onOpenPhotos,
}: {
  order: Order
  onStatusChange: (order: Order, status: OrderStatus) => void
  onOpen: (order: Order) => void
  /** Abre el visor de fotos; si no se indica, la miniatura abre el detalle. */
  onOpenPhotos?: (order: Order) => void
}) {
  const Icon = DEVICE_ICON[order.device.type]
  const meta = STATUS_MAP[order.status] ?? STATUS_MAP.pendiente
  const photo = order.photos[0]?.url
  const closed = isClosed(order.status)
  const days = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 86400000)
  const old = !closed && days >= 7
  const balance = orderBalance(order)

  return (
    <article
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-foreground/20',
        closed && 'bg-card/60',
      )}
    >
      <span className={cn('absolute inset-y-3 left-0 w-1 rounded-r-full', meta.dot)} aria-hidden="true" />

      <div className="flex items-start gap-3 p-3 pl-4">
        <button
          type="button"
          onClick={() => (photo && onOpenPhotos ? onOpenPhotos(order) : onOpen(order))}
          className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={
            photo
              ? `Ver las ${order.photos.length} foto${order.photos.length === 1 ? '' : 's'} de la orden ${order.id}`
              : `Ver detalle de la orden ${order.id}`
          }
        >
          {photo ? (
            <>
              <img src={photo} alt="" className="size-full object-cover" />
              {order.photos.length > 1 && (
                <span className="absolute right-1 bottom-1 flex items-center gap-0.5 rounded-md bg-black/65 px-1 py-0.5 text-[10px] font-bold text-white">
                  <Camera className="size-2.5" aria-hidden="true" />
                  {order.photos.length}
                </span>
              )}
            </>
          ) : (
            <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onOpen(order)}
          className="min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Ver detalle de la orden ${order.id}`}
        >
          <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span className="font-mono font-semibold">{order.id}</span>
            <span aria-hidden="true">·</span>
            <span className={cn(old && 'font-semibold text-status-review')}>{timeAgo(order.createdAt)}</span>
          </p>
          <h3 className={cn('mt-0.5 truncate text-[16.5px] leading-snug font-bold', closed && 'text-muted-foreground')}>
            {deviceLabel(order.device)}
          </h3>
          <p className="truncate text-[14px] text-muted-foreground">
            {order.customer.name}
            {order.reportedFault && !closed && (
              <>
                <span aria-hidden="true"> · </span>
                <span className="text-foreground/80">{order.reportedFault}</span>
              </>
            )}
          </p>
        </button>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/70 px-3 py-2 pl-4">
        <StatusSelect compact value={order.status} onChange={(s) => onStatusChange(order, s)} id={`status-${order.id}`} />
        {balance > 0 ? (
          <span className="text-right leading-tight">
            <span className="block text-[11px] text-muted-foreground">{closed ? 'Total' : 'Saldo'}</span>
            <span className="tabular text-[14px] font-bold">{formatMoney(closed ? orderTotal(order) : balance)}</span>
          </span>
        ) : order.technician ? (
          <span className="truncate text-[12px] text-muted-foreground">{order.technician}</span>
        ) : null}
      </div>
    </article>
  )
}

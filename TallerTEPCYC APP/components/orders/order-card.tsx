'use client'

import { DEVICE_ICON, deviceLabel } from '@/lib/status'
import type { Order, OrderStatus } from '@/lib/types'
import { StatusSelect } from './status-select'

/** «16 nov · 09:56» sin segundos ni año: la lista es de trabajo diario. */
const SHORT_DATE = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function shortDate(iso: string) {
  const parts = SHORT_DATE.formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('day')} ${get('month')} · ${get('hour')}:${get('minute')}`
}

/**
 * Fila compacta de la lista de órdenes: foto, código, cliente, equipo y
 * "técnico · fecha". Tocar la fila abre el detalle; la píldora cambia el estado.
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
  const photo = order.photos[0]?.url
  const technician = order.technician?.trim()
  const meta = [technician, shortDate(order.createdAt)].filter(Boolean).join(' · ')

  return (
    <article className="glass group relative h-full rounded-2xl p-2.5 transition-all duration-300 hover:border-white/25">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => (photo && onOpenPhotos ? onOpenPhotos(order) : onOpen(order))}
          className="group/img grid size-14 shrink-0 place-items-center overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={
            photo
              ? `Ver las ${order.photos.length} foto${order.photos.length === 1 ? '' : 's'} de la orden ${order.id}`
              : `Ver detalle de la orden ${order.id}`
          }
          title={photo ? 'Ver fotos' : undefined}
        >
          {photo ? (
            <img
              src={photo}
              alt=""
              className="size-full object-cover opacity-90 transition-all group-hover/img:scale-105 group-hover/img:opacity-100"
            />
          ) : (
            <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] leading-none tracking-wide text-muted-foreground">
              {order.id}
            </span>
            <StatusSelect
              compact
              value={order.status}
              onChange={(s) => onStatusChange(order, s)}
              id={`status-${order.id}`}
            />
          </div>

          <button
            type="button"
            onClick={() => onOpen(order)}
            className="mt-1 block w-full min-w-0 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Ver detalle de la orden ${order.id}`}
          >
            <h3 className="truncate text-[15px] font-semibold leading-tight text-foreground">
              {order.customer.name}
            </h3>
            <p className="mt-0.5 truncate text-[13px] leading-tight text-muted-foreground">
              {deviceLabel(order.device)}
            </p>
            <p className="mt-1.5 truncate font-mono text-[10px] tracking-tight text-muted-foreground/75">
              {meta}
            </p>
          </button>
        </div>
      </div>
    </article>
  )
}

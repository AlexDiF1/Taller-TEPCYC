'use client'

import Link from 'next/link'
import { Camera, MessageCircle } from 'lucide-react'
import { DEVICE_ICON, STATUS_MAP, deviceLabel, isClosed } from '@/lib/status'
import { formatMoney } from '@/lib/business'
import { chatUrl } from '@/lib/notify'
import type { Order } from '@/lib/types'
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
 * Tarjeta de la lista: tocarla abre la ficha de la orden.
 * El único atajo es el botón verde, que abre el chat del cliente.
 */
export function OrderCard({ order }: { order: Order }) {
  const Icon = DEVICE_ICON[order.device.type]
  const meta = STATUS_MAP[order.status] ?? STATUS_MAP.pendiente
  const photo = order.photos[0]?.url
  const closed = isClosed(order.status)
  const days = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 86400000)
  const old = !closed && days >= 7
  const balance = orderBalance(order)
  const hasPhone = order.customer.phone.replace(/\D/g, '').length >= 7

  return (
    <article className={cn('relative flex overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-foreground/20', closed && 'bg-card/60')}>
      <span className={cn('absolute inset-y-3 left-0 w-1 rounded-r-full', meta.dot)} aria-hidden="true" />

      <Link
        href={`/orden/${encodeURIComponent(order.id)}`}
        className="flex min-w-0 flex-1 items-start gap-3 p-3 pl-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Abrir la orden ${order.id} de ${order.customer.name}`}
      >
        <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2">
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
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span className="font-mono font-semibold">{order.id}</span>
            <span aria-hidden="true">·</span>
            <span className={cn(old && 'font-semibold text-status-review')}>{timeAgo(order.createdAt)}</span>
          </span>
          <span className={cn('mt-0.5 block truncate text-[16.5px] leading-snug font-bold', closed && 'text-muted-foreground')}>
            {deviceLabel(order.device)}
          </span>
          <span className="block truncate text-[14px] text-muted-foreground">
            {order.customer.name}
            {order.reportedFault && !closed && <span className="text-foreground/80"> · {order.reportedFault}</span>}
          </span>
          <span className="mt-2 flex items-center justify-between gap-2">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-bold', meta.bg, meta.text)}>
              <span className={cn('size-2 rounded-full', meta.dot)} aria-hidden="true" />
              {meta.short}
            </span>
            {balance > 0 && (
              <span className="tabular text-[13.5px] font-bold">
                <span className="mr-1 text-[11.5px] font-semibold text-muted-foreground">{closed ? 'Total' : 'Saldo'}</span>
                {formatMoney(closed ? orderTotal(order) : balance)}
              </span>
            )}
          </span>
        </span>
      </Link>

      {hasPhone && (
        <a
          href={chatUrl(order.customer.phone)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir el chat de WhatsApp de ${order.customer.name}`}
          title="Abrir chat de WhatsApp"
          className="mt-3 mr-3 grid size-9 shrink-0 place-items-center rounded-full bg-whatsapp/10 text-whatsapp transition-colors hover:bg-whatsapp/20"
        >
          <MessageCircle className="size-[18px]" aria-hidden="true" />
        </a>
      )}
    </article>
  )
}

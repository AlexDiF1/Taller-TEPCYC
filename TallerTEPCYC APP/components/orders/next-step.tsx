'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Loader2, MessageCircle, PackageCheck, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { STATUS_MAP } from '@/lib/status'
import { BUSINESS, addDays, formatDate } from '@/lib/business'
import { notifyStatus } from '@/lib/notify'
import type { Order, OrderPatch, OrderStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

type Move = { to: OrderStatus; label: string }

/** Botón para avisar por WhatsApp el estado actual, en cualquier momento. */
const NOTIFY_LABEL: Record<OrderStatus, string> = {
  pendiente: 'Avisar que el equipo ingresó',
  enRevision: 'Avisar que está en revisión',
  esperandoConfirmacion: 'Reenviar el presupuesto',
  completada: 'Avisar que está listo para recoger',
  rechazada: 'Avisar al cliente',
  fallida: 'Avisar al cliente',
}

/** El flujo del taller: qué toca hacer en cada estado. */
const FLOW: Record<OrderStatus, { text: string; primary?: Move; others?: Move[]; deliver?: boolean }> = {
  pendiente: {
    text: 'El equipo está en fila. Cuando lo tomes, empieza la revisión.',
    primary: { to: 'enRevision', label: 'Empezar revisión' },
  },
  enRevision: {
    text: 'Cuando tengas el diagnóstico, confirma el valor y envía el presupuesto al cliente.',
    primary: { to: 'esperandoConfirmacion', label: 'Enviar presupuesto' },
    others: [{ to: 'fallida', label: 'No se pudo reparar' }],
  },
  esperandoConfirmacion: {
    text: 'Si el cliente acepta, repara el equipo y márcalo como listo: le avisamos que ya puede recogerlo.',
    primary: { to: 'completada', label: 'Listo para recoger' },
    others: [
      { to: 'rechazada', label: 'El cliente no aceptó' },
      { to: 'fallida', label: 'No se pudo reparar' },
    ],
  },
  completada: {
    text: 'Reparado y esperando al cliente. Cuando venga, cobra el saldo y entrégale el equipo: la garantía empieza ese día.',
    deliver: true,
  },
  rechazada: { text: 'El cliente no autorizó la reparación. El equipo se devuelve con el cobro de revisión.', deliver: true },
  fallida: { text: 'No se pudo reparar. El equipo queda listo para devolver.', deliver: true },
}

export function NextStep({
  order,
  onMove,
  onSave,
  onInvoice,
  onDeliver,
}: {
  order: Order
  onMove: (status: OrderStatus) => Promise<Order>
  onSave: (patch: OrderPatch) => Promise<Order>
  onInvoice: () => void
  /** Abre el diálogo de entrega (cobro del saldo). */
  onDeliver: () => void
}) {
  const delivered = Boolean(order.deliveredAt)
  const warrantyDays = order.warrantyDays ?? BUSINESS.warrantyDays
  const flow = delivered
    ? {
        text:
          order.status === 'completada'
            ? `Entregada el ${formatDate(order.deliveredAt!)}. Garantía hasta el ${formatDate(addDays(order.deliveredAt!, warrantyDays))}.`
            : `Equipo devuelto al cliente el ${formatDate(order.deliveredAt!)}.`,
        primary: undefined,
        others: undefined,
        deliver: false,
      }
    : FLOW[order.status]
  const meta = STATUS_MAP[order.status] ?? STATUS_MAP.pendiente
  const [notify, setNotify] = useState(true)
  const [withPhotos, setWithPhotos] = useState(false)
  const [busy, setBusy] = useState<OrderStatus | null>(null)
  const [sending, setSending] = useState(false)
  const [cost, setCost] = useState(String(order.estimatedCost || ''))
  const needsCost = flow.primary?.to === 'esperandoConfirmacion'

  useEffect(() => setCost(String(order.estimatedCost || '')), [order.id, order.estimatedCost])

  async function move(to: OrderStatus) {
    if (busy) return
    if (to === 'esperandoConfirmacion' && !(Number(cost) > 0)) {
      toast.error('Escribe el valor de la reparación antes de enviar el presupuesto.')
      document.getElementById('next-cost')?.focus()
      return
    }
    setBusy(to)
    try {
      if (to === 'esperandoConfirmacion' && Number(cost) !== order.estimatedCost) {
        await onSave({ estimatedCost: Number(cost) })
      }
      const updated = await onMove(to)
      if (notify) await notifyStatus(updated, { includePhotos: withPhotos })
      else toast.success(`${updated.id} → ${STATUS_MAP[to].label}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cambiar el estado.')
    } finally {
      setBusy(null)
    }
  }

  async function sendNow() {
    if (sending) return
    setSending(true)
    try {
      await notifyStatus(order, { includePhotos: withPhotos })
    } finally {
      setSending(false)
    }
  }

  const PrimaryIcon = flow.primary ? STATUS_MAP[flow.primary.to].icon : null

  return (
    <section aria-label="Siguiente paso" className={cn('rounded-3xl border p-4', meta.bg, 'border-transparent')}>
      <p className={cn('flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.08em]', meta.text)}>
        <span className={cn('size-2.5 rounded-full', meta.dot)} aria-hidden="true" />
        {meta.label}
        {delivered && <span className="text-muted-foreground"> · Entregada</span>}
      </p>
      <p className="mt-1.5 text-[14.5px] leading-snug text-foreground/85">{flow.text}</p>

      {needsCost && (
        <div className="mt-3">
          <label htmlFor="next-cost" className="text-[13px] font-semibold text-foreground/80">
            Valor de la reparación
          </label>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-semibold text-muted-foreground">$</span>
            <Input
              id="next-cost"
              inputMode="numeric"
              value={cost ? Number(cost).toLocaleString(BUSINESS.locale) : ''}
              onChange={(e) => setCost(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
              className="tabular pl-7 text-[17px] font-bold"
            />
          </div>
        </div>
      )}

      {flow.primary && (
        <Button size="lg" className="mt-3 h-13 w-full text-[16px] font-extrabold" onClick={() => move(flow.primary!.to)} disabled={!!busy}>
          {busy === flow.primary.to ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            PrimaryIcon && <PrimaryIcon data-icon="inline-start" />
          )}
          {flow.primary.label}
          <ArrowRight data-icon="inline-end" />
        </Button>
      )}

      {flow.deliver && (
        <Button size="lg" className="mt-3 h-13 w-full text-[16px] font-extrabold" onClick={onDeliver}>
          <PackageCheck data-icon="inline-start" />
          Entregar equipo
        </Button>
      )}

      {delivered && order.status === 'completada' && (
        <Button variant="outline" size="lg" className="mt-3 w-full bg-surface" onClick={onInvoice}>
          <ReceiptText data-icon="inline-start" />
          Factura de entrega
        </Button>
      )}

      {flow.others && (
        <div className="mt-2 flex flex-wrap gap-2">
          {flow.others.map((m) => (
            <Button key={m.to} variant="outline" className="flex-1" onClick={() => move(m.to)} disabled={!!busy}>
              {busy === m.to && <Loader2 data-icon="inline-start" className="animate-spin" />}
              {m.label}
            </Button>
          ))}
        </div>
      )}

      {(flow.primary || flow.others) && (
        <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-[14px] font-semibold">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="size-5 accent-[var(--whatsapp)]" />
          Al cambiar de paso, avisar al cliente
        </label>
      )}

      {/* Avisar el estado actual cuando se quiera (p. ej. el ingreso, si no se avisó al registrar). */}
      {!delivered && (
      <div className="mt-3 border-t border-foreground/10 pt-3">
        <Button
          variant="outline"
          className="w-full border-whatsapp/40 bg-surface text-[14.5px] text-foreground"
          onClick={sendNow}
          disabled={sending || !!busy}
        >
          {sending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <MessageCircle data-icon="inline-start" className="text-whatsapp" />}
          {NOTIFY_LABEL[order.status]}
        </Button>
        {order.photos.length > 0 && (
          <label className="mt-2 flex cursor-pointer items-center gap-2.5 text-[13.5px] text-muted-foreground">
            <input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} className="size-4 accent-[var(--whatsapp)]" />
            Incluir las {order.photos.length} fotos del equipo en los avisos
          </label>
        )}
      </div>
      )}
    </section>
  )
}

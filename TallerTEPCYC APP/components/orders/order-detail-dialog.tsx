'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Phone,
  Hash,
  ReceiptText,
  ImageOff,
  Loader2,
  FileDown,
  Pencil,
  Trash2,
  Palette,
  CalendarClock,
  Wrench,
  Plus,
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { WhatsAppButton } from './whatsapp-button'
import { orderTotal, timeAgo } from './order-card'
import { DEVICE_ICON, STATUS_MAP, deviceLabel } from '@/lib/status'
import { formatDate, formatMoney } from '@/lib/business'
import { downloadReceiptPdf, prepareReceiptDelivery, type ReceiptDelivery } from '@/lib/receipt-pdf'
import type { Order } from '@/lib/types'
import { cn } from '@/lib/utils'

export function OrderDetailDialog({
  order,
  onClose,
  onEdit,
  onDelete,
  onComment,
}: {
  order: Order | null
  onClose: () => void
  onEdit: (order: Order) => void
  onDelete: (order: Order) => Promise<void>
  onComment: (id: string, text: string) => Promise<Order>
}) {
  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 pb-0 sm:max-w-2xl sm:pb-0">
        {order && <Detail order={order} onEdit={onEdit} onDelete={onDelete} onComment={onComment} />}
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn('flex flex-col gap-2', className)}>
      <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function Detail({
  order,
  onEdit,
  onDelete,
  onComment,
}: {
  order: Order
  onEdit: (order: Order) => void
  onDelete: (order: Order) => Promise<void>
  onComment: (id: string, text: string) => Promise<Order>
}) {
  const Icon = DEVICE_ICON[order.device.type]
  const meta = STATUS_MAP[order.status] ?? STATUS_MAP.pendiente
  const total = orderTotal(order)
  const saldo = Math.max(total - (order.deposit || 0), 0)
  const receiptType = order.status === 'completada' ? 'entrega' : 'recepcion'
  const [delivery, setDelivery] = useState<ReceiptDelivery | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [withPhotos, setWithPhotos] = useState(false)
  const [comment, setComment] = useState('')
  const [savingComment, setSavingComment] = useState(false)

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    const text = comment.trim()
    if (!text || savingComment) return
    setSavingComment(true)
    try {
      await onComment(order.id, text)
      setComment('')
      toast.success('Comentario agregado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo agregar el comentario.')
    } finally {
      setSavingComment(false)
    }
  }

  const itemsKey = JSON.stringify(order.items)
  const phoneDigits = order.customer.phone.replace(/\D/g, '')

  async function handleDelete() {
    setDeleting(true)
    try {
      await onDelete(order)
      toast.success(`Registro ${order.id} eliminado.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el registro.')
      setDeleting(false)
    }
  }

  // El PDF se genera al abrir el detalle: así el clic puede descargar y navegar
  // a WhatsApp de inmediato, sin perder el gesto de usuario en el móvil.
  useEffect(() => {
    let alive = true
    setDelivery(null)
    prepareReceiptDelivery(order, receiptType, order.items)
      .then((next) => {
        if (alive) setDelivery(next)
      })
      .catch(() => {
        if (alive) toast.error('No se pudo generar el comprobante en PDF.')
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, receiptType, itemsKey])

  function sendReceipt(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!delivery) {
      event.preventDefault()
      toast.info('Generando el comprobante, inténtalo en un segundo…')
      return
    }
    downloadReceiptPdf(delivery)
    toast.info('PDF descargado: adjúntalo en el chat de WhatsApp.')
  }

  return (
    <>
      <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted sm:hidden" aria-hidden="true" />

      {/* ---------- cabecera ---------- */}
      <header className="flex shrink-0 gap-3.5 px-5 pt-4 pb-4 pr-14">
        <span className={cn('grid size-14 shrink-0 place-items-center rounded-2xl', meta.bg)}>
          <Icon className={cn('size-7', meta.text)} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
            <span className="font-mono font-bold text-foreground">{order.id}</span>
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-bold', meta.bg, meta.text)}>
              <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden="true" />
              {meta.label}
            </span>
          </p>
          <DialogTitle className="mt-1 text-[21px] leading-tight font-extrabold">{deviceLabel(order.device)}</DialogTitle>
          <DialogDescription className="mt-0.5 text-[13.5px]">
            Ingresó {timeAgo(order.createdAt)} · {formatDate(order.createdAt, true)}
          </DialogDescription>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
        <div className="flex flex-col gap-5">
          {/* ---------- cliente ---------- */}
          <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-background text-[15px] font-extrabold text-muted-foreground">
              {order.customer.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase())
                .join('')}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15.5px] font-bold">{order.customer.name}</p>
              <p className="tabular text-[13.5px] text-muted-foreground">{order.customer.phone}</p>
            </div>
            {phoneDigits && (
              <a
                href={`tel:${phoneDigits}`}
                aria-label={`Llamar a ${order.customer.name}`}
                className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-surface text-foreground"
              >
                <Phone className="size-5" aria-hidden="true" />
              </a>
            )}
          </div>

          {/* ---------- dinero ---------- */}
          <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-border">
            <Money label="Total" value={total} />
            <Money label="Abono" value={order.deposit || 0} className="border-x border-border" />
            <Money label="Saldo" value={saldo} strong />
          </div>

          {/* ---------- falla ---------- */}
          <Section title="Falla reportada">
            <p className="text-pretty text-[15px] leading-relaxed">{order.reportedFault || 'Sin descripción.'}</p>
            {order.faultTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {order.faultTags.map((t, i) => (
                  <span key={`${t}-${i}`} className="rounded-full bg-surface-2 px-2.5 py-1 text-[13px] font-medium">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </Section>

          {/* ---------- datos del equipo ---------- */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[14px]">
            {order.device.serial && <Fact icon={Hash} label="Serial" value={order.device.serial} mono />}
            {order.device.color && <Fact icon={Palette} label="Color" value={order.device.color} />}
            {order.estimatedDate && <Fact icon={CalendarClock} label="Entrega estimada" value={formatDate(order.estimatedDate)} />}
            {order.technician && <Fact icon={Wrench} label="Técnico" value={order.technician} />}
          </div>

          <Section title="Accesorios recibidos">
            {order.accessories.length ? (
              <div className="flex flex-wrap gap-1.5">
                {order.accessories.map((a) => (
                  <span key={a} className="rounded-full border border-border px-2.5 py-1 text-[13px] font-medium">
                    {a}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[14px] text-muted-foreground">Sin accesorios</p>
            )}
          </Section>

          {/* ---------- fotos ---------- */}
          <Section title="Estado físico al ingreso">
            {order.physicalNotes && <p className="text-[14px] text-muted-foreground">{order.physicalNotes}</p>}
            {order.photos.length ? (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {order.photos.map((p, i) => (
                  <li key={p.id} className="aspect-square overflow-hidden rounded-xl bg-muted">
                    <img src={p.url || '/placeholder.svg'} alt={`Foto de ingreso ${i + 1}`} className="size-full object-cover" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3.5 text-[14px] text-muted-foreground">
                <ImageOff className="size-4" aria-hidden="true" />
                Sin fotos registradas
              </p>
            )}
          </Section>

          {/* ---------- historial ---------- */}
          <Section title="Historial">
            <ol className="flex flex-col">
              {[...order.history].reverse().map((h, i, list) => {
                const m = STATUS_MAP[h.status] ?? STATUS_MAP.pendiente
                return (
                  <li key={`${h.status}-${i}`} className="relative flex gap-3 pb-3.5 last:pb-0">
                    {i < list.length - 1 && (
                      <span className="absolute top-4 bottom-0 left-[5px] w-px bg-border" aria-hidden="true" />
                    )}
                    <span className={cn('relative mt-1.5 size-[11px] shrink-0 rounded-full', m.dot)} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold">{m.label}</p>
                      <p className="text-[12.5px] text-muted-foreground">
                        {formatDate(h.at, true)}
                        {h.note ? ` · ${h.note}` : ''}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </Section>

          <Section title="Comentarios internos">
            <form onSubmit={handleComment} className="flex flex-col gap-2 sm:flex-row">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ej. se llamó al cliente, no contesta."
                maxLength={1000}
                aria-label="Nuevo comentario"
                className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-secondary/40 px-3 text-[15px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button type="submit" className="h-11 shrink-0" disabled={savingComment || !comment.trim()}>
                {savingComment ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Plus data-icon="inline-start" />
                )}
                Agregar
              </Button>
            </form>
            {order.comments?.length ? (
              <ul className="flex flex-col gap-2">
                {[...order.comments].reverse().map((c) => (
                  <li key={c.id} className="rounded-xl border border-border bg-secondary/30 px-3 py-2">
                    <p className="text-[14px] break-words text-pretty">{c.text}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {formatDate(c.at, true)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-muted-foreground">Sin comentarios todavía.</p>
            )}
          </Section>

          {/* ---------- acciones secundarias ---------- */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-11" onClick={() => onEdit(order)}>
              <Pencil data-icon="inline-start" />
              Editar
            </Button>
            <Button
              variant="outline"
              className="h-11"
              nativeButton={false}
              render={<Link href={`/comprobantes?orden=${order.id}&tipo=${receiptType}`} />}
            >
              <ReceiptText data-icon="inline-start" />
              Comprobante
            </Button>
          </div>

          {confirming ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/8 p-4">
              <p className="text-[14px] text-pretty">
                <strong>¿Eliminar {order.id}?</strong> Se borran el equipo, el historial, los comprobantes y las fotos. No se
                puede deshacer.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-11" onClick={() => setConfirming(false)} disabled={deleting}>
                  Cancelar
                </Button>
                <Button className="h-11 bg-destructive text-white hover:bg-destructive/90" onClick={handleDelete} disabled={deleting}>
                  <Trash2 data-icon="inline-start" />
                  {deleting ? 'Eliminando…' : 'Eliminar'}
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mx-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-[14px] font-semibold text-destructive hover:bg-destructive/8"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Eliminar orden
            </button>
          )}
        </div>
      </div>

      {/* ---------- acciones principales (fijas) ---------- */}
      <footer className="flex shrink-0 flex-col gap-2 border-t border-border bg-popover px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
        {order.photos.length > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={withPhotos}
              onChange={(e) => setWithPhotos(e.target.checked)}
              className="size-4 accent-primary"
            />
            Adjuntar las {order.photos.length} fotos al aviso
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={delivery?.url ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!delivery}
            onClick={sendReceipt}
            className={cn(buttonVariants({ variant: 'outline' }), 'h-11', !delivery && 'pointer-events-none opacity-60')}
          >
            {delivery ? <FileDown data-icon="inline-start" /> : <Loader2 data-icon="inline-start" className="animate-spin" />}
            {delivery ? 'Enviar recibo' : 'Generando…'}
          </a>
          <WhatsAppButton order={order} label="Avisar estado" includePhotos={withPhotos} />
        </div>
      </footer>
    </>
  )
}

function Money({ label, value, strong, className }: { label: string; value: number; strong?: boolean; className?: string }) {
  return (
    <div className={cn('px-3 py-2.5', strong && 'bg-primary/8', className)}>
      <p className="text-[12px] font-semibold text-muted-foreground">{label}</p>
      <p className={cn('tabular truncate text-[16px] font-bold', strong && 'text-primary')}>{formatMoney(value)}</p>
    </div>
  )
}

function Fact({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[12px] text-muted-foreground">{label}</p>
        <p className={cn('truncate font-semibold', mono && 'font-mono')}>{value}</p>
      </div>
    </div>
  )
}

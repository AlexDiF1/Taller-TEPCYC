'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Phone, Hash, Package, ReceiptText, ImageOff, Loader2, MessageCircle, Pencil, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { WhatsAppButton } from './whatsapp-button'
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
}: {
  order: Order | null
  onClose: () => void
  onEdit: (order: Order) => void
  onDelete: (order: Order) => Promise<void>
}) {
  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-0 sm:max-w-2xl">
        {order && <Detail order={order} onEdit={onEdit} onDelete={onDelete} />}
      </DialogContent>
    </Dialog>
  )
}

function Detail({
  order,
  onEdit,
  onDelete,
}: {
  order: Order
  onEdit: (order: Order) => void
  onDelete: (order: Order) => Promise<void>
}) {
  const Icon = DEVICE_ICON[order.device.type]
  const total = order.items.reduce((s, i) => s + i.price, 0) || order.estimatedCost
  const receiptType = order.status === 'completada' ? 'entrega' : 'recepcion'
  const [delivery, setDelivery] = useState<ReceiptDelivery | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [withPhotos, setWithPhotos] = useState(false)
  const itemsKey = JSON.stringify(order.items)

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
      toast.info('Generando el comprobante, inténtalo en un segundo...')
      return
    }
    downloadReceiptPdf(delivery)
    toast.info('PDF descargado: adjúntalo en el chat de WhatsApp.')
  }

  return (
    <>
      <div className="border-b border-border bg-secondary/40 p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-primary">{order.id}</span>
          <StatusBadge status={order.status} />
        </div>
        <div className="mt-4 flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-background ring-1 ring-border">
            <Icon className="size-7 text-primary" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold tracking-tight">
              {deviceLabel(order.device)}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Ingresó el {formatDate(order.createdAt, true)}
            </DialogDescription>
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-2 md:p-6">
        <section aria-label="Cliente" className="flex flex-col gap-2">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Cliente</h3>
          <p className="font-semibold">{order.customer.name}</p>
          <p className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
            <Phone className="size-3.5" aria-hidden="true" />
            {order.customer.phone}
          </p>
          {order.device.serial && (
            <p className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
              <Hash className="size-3.5" aria-hidden="true" />
              {order.device.serial}
            </p>
          )}
        </section>

        <section aria-label="Costos" className="flex flex-col gap-2">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Costos</h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Total</dt>
            <dd className="text-right font-mono">{formatMoney(total)}</dd>
            <dt className="text-muted-foreground">Abono</dt>
            <dd className="text-right font-mono">{formatMoney(order.deposit)}</dd>
            <dt className="font-medium">Saldo</dt>
            <dd className="text-right font-mono font-bold text-primary">{formatMoney(Math.max(total - order.deposit, 0))}</dd>
          </dl>
        </section>

        <section aria-label="Falla reportada" className="flex flex-col gap-2 md:col-span-2">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Falla reportada</h3>
          <p className="text-pretty text-sm">{order.reportedFault}</p>
          {order.faultTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {order.faultTags.map((t, i) => (
                <span key={`${t}-${i}`} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Accesorios" className="flex flex-col gap-2">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Accesorios</h3>
          {order.accessories.length ? (
            <ul className="flex flex-col gap-1.5 text-sm">
              {order.accessories.map((a) => (
                <li key={a} className="flex items-center gap-2">
                  <Package className="size-3.5 text-primary" aria-hidden="true" />
                  {a}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin accesorios</p>
          )}
        </section>

        <section aria-label="Historial" className="flex flex-col gap-2">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Historial</h3>
          <ol className="relative flex flex-col gap-3 border-l border-border pl-4">
            {order.history.map((h, i) => {
              const meta = STATUS_MAP[h.status] ?? STATUS_MAP.pendiente
              return (
                <li key={`${h.status}-${i}`} className="relative">
                  <span
                    className={cn('absolute -left-[21px] top-1.5 size-2.5 rounded-full ring-4 ring-popover', meta.dot)}
                    aria-hidden="true"
                  />
                  <p className={cn('text-sm font-medium', meta.text)}>{meta.label}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(h.at, true)}</p>
                </li>
              )
            })}
          </ol>
        </section>

        <section aria-label="Fotos de ingreso" className="flex flex-col gap-2 md:col-span-2">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Estado físico al ingreso
          </h3>
          {order.physicalNotes && <p className="text-sm text-muted-foreground">{order.physicalNotes}</p>}
          {order.photos.length ? (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {order.photos.map((p, i) => (
                <li key={p.id} className="aspect-square overflow-hidden rounded-lg ring-1 ring-border">
                  <img src={p.url || '/placeholder.svg'} alt={`Foto de ingreso ${i + 1}`} className="size-full object-cover" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              <ImageOff className="size-4" aria-hidden="true" />
              Sin fotos registradas
            </p>
          )}
        </section>
      </div>

      {confirming ? (
        <div className="sticky bottom-0 flex flex-col gap-3 border-t border-destructive/40 bg-destructive/10 p-4 backdrop-blur">
          <p className="text-sm text-pretty">
            <strong>¿Eliminar {order.id}?</strong> Se borran el equipo, el historial, los comprobantes y las fotos
            asociadas. Esta acción no se puede deshacer.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="h-9" onClick={() => setConfirming(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" className="h-9" onClick={handleDelete} disabled={deleting}>
              <Trash2 data-icon="inline-start" />
              {deleting ? 'Eliminando...' : 'Eliminar definitivamente'}
            </Button>
          </div>
        </div>
      ) : (
      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-popover/95 p-4 backdrop-blur sm:flex-row sm:flex-wrap sm:justify-end">
        <Button variant="outline" className="h-9" onClick={() => onEdit(order)}>
          <Pencil data-icon="inline-start" />
          Editar registro
        </Button>
        <Button
          variant="outline"
          className="h-9"
          nativeButton={false}
          render={<Link href={`/comprobantes?orden=${order.id}&tipo=${receiptType}`} />}
        >
          <ReceiptText data-icon="inline-start" />
          Comprobante de recepción
        </Button>
        <a
          href={delivery?.url ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!delivery}
          onClick={sendReceipt}
          className={cn(
            buttonVariants(),
            'h-9 bg-whatsapp font-semibold text-black hover:bg-whatsapp/85',
            !delivery && 'pointer-events-none opacity-50',
          )}
        >
          {delivery ? (
            <MessageCircle data-icon="inline-start" />
          ) : (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          )}
          {delivery ? 'Enviar comprobante PDF' : 'Generando PDF...'}
        </a>
        {order.photos.length > 0 && (
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-xs text-muted-foreground transition-colors hover:text-foreground">
            <input
              type="checkbox"
              checked={withPhotos}
              onChange={(e) => setWithPhotos(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            Adjuntar fotos ({order.photos.length})
          </label>
        )}
        <WhatsAppButton order={order} label="Enviar estado por WhatsApp" includePhotos={withPhotos} />
        <Button
          variant="destructive"
          className="h-9 sm:mr-auto"
          onClick={() => setConfirming(true)}
          aria-label={`Eliminar el registro ${order.id}`}
        >
          <Trash2 data-icon="inline-start" />
          Eliminar
        </Button>
      </div>
      )}
    </>
  )
}

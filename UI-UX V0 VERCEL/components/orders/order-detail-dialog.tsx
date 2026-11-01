'use client'

import Link from 'next/link'
import { Phone, Hash, Package, ReceiptText, ImageOff } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { WhatsAppButton } from './whatsapp-button'
import { DEVICE_ICON, STATUS_MAP } from '@/lib/status'
import { formatDate, formatMoney } from '@/lib/business'
import type { Order } from '@/lib/types'
import { cn } from '@/lib/utils'

export function OrderDetailDialog({ order, onClose }: { order: Order | null; onClose: () => void }) {
  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-0 sm:max-w-2xl">
        {order && <Detail order={order} />}
      </DialogContent>
    </Dialog>
  )
}

function Detail({ order }: { order: Order }) {
  const Icon = DEVICE_ICON[order.device.type]
  const total = order.items.reduce((s, i) => s + i.price, 0) || order.estimatedCost

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
              {order.device.brand} {order.device.model}
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
              {order.faultTags.map((t) => (
                <span key={t} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
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
              const meta = STATUS_MAP[h.status]
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

      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-popover/95 p-4 backdrop-blur sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          className="h-9"
          nativeButton={false}
          render={<Link href={`/comprobantes?orden=${order.id}&tipo=recepcion`} />}
        >
          <ReceiptText data-icon="inline-start" />
          Comprobante de recepción
        </Button>
        <WhatsAppButton order={order} label="Enviar estado por WhatsApp" />
      </div>
    </>
  )
}

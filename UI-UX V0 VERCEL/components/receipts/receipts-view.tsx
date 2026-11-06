'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Printer, ClipboardList, ShieldCheck, Save, FileX, Loader2, MessageCircle, Send } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TallerHeader } from '@/components/orders/taller-header'
import { StatusBadge } from '@/components/status-badge'
import { WhatsAppButton } from '@/components/orders/whatsapp-button'
import { ReceiptDocument, type ReceiptType } from './receipt-document'
import { ItemsEditor } from './items-editor'
import { useOrders } from '@/hooks/use-orders'
import { downloadReceiptPdf, prepareReceiptDelivery, type ReceiptDelivery } from '@/lib/receipt-pdf'
import { buildReceiptMessage } from '@/lib/whatsapp'
import { WaOfflineError, WaThrottleError, blobToDataUrl, waSendDocument } from '@/lib/wa'
import type { Order, ServiceItem } from '@/lib/types'
import { cn } from '@/lib/utils'

const TYPES: { value: ReceiptType; label: string; description: string; icon: typeof Printer }[] = [
  { value: 'recepcion', label: 'Recepción', description: 'Al ingresar el equipo', icon: ClipboardList },
  { value: 'entrega', label: 'Entrega + garantía', description: 'Factura final', icon: ShieldCheck },
]

export function ReceiptsView({ initialOrderId, initialType }: { initialOrderId?: string; initialType?: ReceiptType }) {
  const router = useRouter()
  const { orders, isLoading, setItems } = useOrders()
  const [type, setType] = useState<ReceiptType>(initialType ?? 'recepcion')
  const [delivery, setDelivery] = useState<ReceiptDelivery | null>(null)
  const [sendingPdf, setSendingPdf] = useState(false)
  const orderId = initialOrderId ?? orders[0]?.id
  const order = orders.find((o) => o.id === orderId)
  const itemsKey = JSON.stringify(order?.items ?? [])

  // El PDF se genera antes del clic: el manejador del clic descarga y navega a
  // WhatsApp de inmediato, sin perder el gesto de usuario en el móvil.
  useEffect(() => {
    let alive = true
    setDelivery(null)
    if (!order) return
    prepareReceiptDelivery(order, type, order.items)
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
  }, [order?.id, type, itemsKey])

  function sendReceiptByWhatsApp(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!delivery) {
      event.preventDefault()
      toast.info('Generando el comprobante, inténtalo en un segundo...')
      return
    }
    downloadReceiptPdf(delivery)
    toast.info('PDF descargado: adjúntalo en el chat de WhatsApp.')
  }

  /** Envío automático: el PDF sale desde el WhatsApp vinculado del taller. */
  async function sendReceiptAutomatically() {
    if (!delivery || !order) return
    setSendingPdf(true)
    try {
      await waSendDocument({
        phone: order.customer.phone,
        fileName: delivery.fileName,
        dataUrl: await blobToDataUrl(delivery.blob),
        caption: buildReceiptMessage(order, type),
      })
      toast.success(`Comprobante enviado por WhatsApp a ${order.customer.name.split(' ')[0]}.`)
    } catch (error) {
      if (error instanceof WaOfflineError) {
        downloadReceiptPdf(delivery)
        toast.info('WhatsApp no está conectado: se descargó el PDF para adjuntarlo a mano.')
      } else if (error instanceof WaThrottleError) {
        downloadReceiptPdf(delivery)
        toast.info(`${error.message} Se descargó el PDF para enviarlo a mano.`)
      } else {
        toast.error(error instanceof Error ? error.message : 'No se pudo enviar el comprobante.')
      }
    } finally {
      setSendingPdf(false)
    }
  }

  function selectOrder(id: string) {
    router.replace(`/comprobantes?orden=${id}&tipo=${type}`, { scroll: false })
  }

  function selectType(next: ReceiptType) {
    setType(next)
    if (orderId) router.replace(`/comprobantes?orden=${orderId}&tipo=${next}`, { scroll: false })
  }

  const orderItems = orders.map((o) => ({ label: `${o.id} · ${o.customer.name}`, value: o.id }))

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8 print:max-w-none print:p-0">
      <TallerHeader activeTab="comprobantes" />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr] print:block">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start print:hidden" aria-label="Opciones del comprobante">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/90 p-4">
            <label htmlFor="receipt-order" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Orden
            </label>
            <Select items={orderItems} value={orderId ?? null} onValueChange={(v) => v && selectOrder(String(v))} disabled={isLoading}>
              <SelectTrigger id="receipt-order" className="h-10 w-full">
                <SelectValue placeholder={isLoading ? 'Cargando...' : 'Selecciona una orden'} />
              </SelectTrigger>
              <SelectContent>
                {orderItems.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {order && (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-muted-foreground">
                  {order.device.brand} {order.device.model}
                </span>
                <StatusBadge status={order.status} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/90 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Tipo de documento</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de documento">
              {TYPES.map(({ value, label, description, icon: Icon }) => {
                const active = type === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => selectType(value)}
                    className={cn(
                      'flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all',
                      active ? 'border-primary bg-primary/10' : 'border-border bg-secondary/30 hover:border-foreground/25',
                    )}
                  >
                    <Icon className={cn('size-5', active ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                    <span className="text-sm font-semibold leading-tight">{label}</span>
                    <span className="text-xs text-muted-foreground">{description}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {order && type === 'entrega' && (
            <DeliveryItems key={order.id} order={order} onSave={(items) => setItems(order.id, items)} />
          )}

          {order && (
            <div className="flex flex-col gap-2">
              <Button size="lg" className="h-11 font-semibold" onClick={() => window.print()}>
                <Printer data-icon="inline-start" />
                Imprimir / Guardar PDF
              </Button>
              <a
                href={delivery?.url ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!delivery}
                onClick={sendReceiptByWhatsApp}
                className={cn(
                  buttonVariants({ variant: 'default', size: 'lg' }),
                  'h-11 bg-whatsapp font-semibold text-black hover:bg-whatsapp/85',
                  !delivery && 'pointer-events-none opacity-50',
                )}
              >
                {delivery ? (
                  <MessageCircle data-icon="inline-start" />
                ) : (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                )}
                {delivery ? 'Descargar PDF y abrir chat (manual)' : 'Generando PDF...'}
              </a>
              <Button
                type="button"
                size="lg"
                className="h-11 bg-whatsapp font-semibold text-black hover:bg-whatsapp/85"
                onClick={sendReceiptAutomatically}
                disabled={!delivery || sendingPdf}
              >
                {sendingPdf ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Send data-icon="inline-start" />}
                {sendingPdf ? 'Enviando comprobante...' : 'Enviar comprobante automático'}
              </Button>
              <WhatsAppButton order={order} label="Enviar estado por WhatsApp" className="h-11" />
            </div>
          )}
        </aside>

        <section aria-label="Vista previa del documento" className="min-w-0">
          {isLoading ? (
            <div className="mx-auto aspect-[8.5/11] w-full max-w-[816px] animate-pulse rounded-xl bg-card" />
          ) : order ? (
            <ReceiptPreview order={order} type={type} />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-20 text-center">
              <FileX className="size-10 text-muted-foreground" aria-hidden="true" />
              <p className="font-semibold">Orden no encontrada</p>
              <p className="text-sm text-muted-foreground">Selecciona una orden de la lista para generar su comprobante.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function ReceiptPreview({ order, type }: { order: Order; type: ReceiptType }) {
  return (
    <div className="rounded-2xl bg-secondary/30 p-3 ring-1 ring-border sm:p-6 print:bg-transparent print:p-0 print:ring-0">
      <ReceiptDocument order={order} type={type} items={order.items} />
    </div>
  )
}

function DeliveryItems({ order, onSave }: { order: Order; onSave: (items: ServiceItem[]) => Promise<Order> }) {
  const [items, setItemsDraft] = useState<ServiceItem[]>(order.items)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(items) !== JSON.stringify(order.items)

  async function save() {
    setSaving(true)
    try {
      await onSave(items)
      toast.success('Detalle de factura guardado')
    } catch {
      toast.error('No se pudo guardar el detalle.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/90 p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Detalle facturado</p>
        {dirty && <span className="text-[10px] font-medium text-status-review">Sin guardar</span>}
      </div>
      <ItemsEditor items={items} onChange={setItemsDraft} />
      <Button variant="secondary" onClick={save} disabled={!dirty || saving}>
        <Save data-icon="inline-start" />
        {saving ? 'Guardando...' : 'Guardar detalle'}
      </Button>
    </div>
  )
}

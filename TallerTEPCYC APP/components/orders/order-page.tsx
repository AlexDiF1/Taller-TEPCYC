'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Camera,
  Check,
  HandCoins,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  PackageX,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Field } from '@/components/intake/form-section'
import { ItemsEditor } from '@/components/receipts/items-editor'
import type { ReceiptType } from '@/components/receipts/receipt-document'
import { NextStep } from './next-step'
import { DeliverDialog, PaymentDialog } from './payment-dialogs'
import { ReceiptSheet } from './receipt-sheet'
import { PhotoViewer } from './photo-viewer'
import { StatusSelect } from './status-select'
import { orderBalance, orderTotal, timeAgo } from './order-card'
import { useOrder, useOrderActions } from '@/hooks/use-orders'
import { BRANDS, DEVICE_ICON, DEVICE_TYPES, STATUS_MAP, deviceLabel } from '@/lib/status'
import { BUSINESS, formatDate, formatMoney } from '@/lib/business'
import { PAYMENT_MAP } from '@/lib/ventas'
import { chatUrl } from '@/lib/notify'
import type { DeviceType, Order, OrderPatch, OrderPayment, OrderStatus, PaymentMethod, ServiceItem } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Ficha única de una orden: todo lo que se hace con ella está aquí. */
export function OrderPage({ id }: { id: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const {
    setStatus,
    updateOrder,
    setItems,
    addComment,
    archiveOrder,
    restoreOrder,
    deleteOrder,
    addPayment,
    deletePayment,
    deliverOrder,
    undeliverOrder,
  } = useOrderActions()
  const { order, isLoading, error } = useOrder(id)

  const [receipt, setReceipt] = useState<ReceiptType | null>(null)
  const [photoIndex, setPhotoIndex] = useState<number | null>(null)
  const [fixStatus, setFixStatus] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [deliverOpen, setDeliverOpen] = useState(false)

  // Al llegar desde el ingreso se abre el recibo de recepción.
  const pedido = params.get('recibo')
  useEffect(() => {
    if (order && (pedido === 'recepcion' || pedido === 'entrega')) {
      setReceipt(pedido)
      router.replace(`/orden/${encodeURIComponent(order.id)}`, { scroll: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, pedido])

  if (error) return <Empty title="No se pudo cargar la orden" text={error instanceof Error ? error.message : String(error)} />
  if (isLoading && !order) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4" aria-busy="true">
        {[80, 140, 120, 200].map((h, i) => (
          <div key={i} className="animate-pulse rounded-3xl bg-muted" style={{ height: h }} />
        ))}
      </div>
    )
  }
  if (!order) return <Empty title="Orden no encontrada" text={`No existe la orden ${id} o fue eliminada.`} />

  const Icon = DEVICE_ICON[order.device.type]
  const meta = STATUS_MAP[order.status] ?? STATUS_MAP.pendiente
  const save = (patch: OrderPatch) => updateOrder(order.id, patch)

  async function handleRestore(orderId: string) {
    try {
      await restoreOrder(orderId)
      toast.success(`Orden ${orderId} restaurada.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo restaurar la orden.')
    }
  }

  async function handleArchive() {
    const orderId = order!.id
    try {
      await archiveOrder(orderId)
      toast.success(`Orden ${orderId} archivada.`, {
        description: 'Está en el filtro «Archivadas».',
        action: { label: 'Deshacer', onClick: () => void handleRestore(orderId) },
      })
      router.push('/')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo archivar la orden.')
    }
  }

  async function handleDeliver(payment?: { amount: number; method: PaymentMethod }) {
    const updated = await deliverOrder(order!.id, payment)
    toast.success(`${updated.id} entregada`, {
      description: payment ? `Cobrado ${formatMoney(payment.amount)} en ${PAYMENT_MAP[payment.method].label}.` : undefined,
    })
    // Con la entrega va la factura con la garantía (solo si se reparó).
    if (updated.status === 'completada') setReceipt('entrega')
  }

  async function handleUndeliver() {
    try {
      await undeliverOrder(order!.id)
      toast.success('Entrega deshecha: la orden vuelve a estar por entregar.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo deshacer la entrega.')
    }
  }

  async function handleDelete() {
    try {
      await deleteOrder(order!.id)
      toast.success(`Orden ${order!.id} eliminada definitivamente.`)
      router.push('/')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar la orden.')
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-3 pb-8 md:px-8 md:pt-8">
      {/* ---------- barra de la ficha ---------- */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/" aria-label="Volver a las órdenes" />}>
          <ArrowLeft className="size-5" />
        </Button>
        <p className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
          <span className="font-mono font-bold text-foreground">{order.id}</span> · ingresó {timeAgo(order.createdAt)}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Más opciones" />}>
            <MoreHorizontal className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 p-1.5">
            <DropdownMenuItem className="min-h-11 px-2.5 text-[15px]" onClick={() => setReceipt(order.status === 'completada' ? 'entrega' : 'recepcion')}>
              <ReceiptText /> Recibo
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-11 px-2.5 text-[15px]" onClick={() => setFixStatus(true)}>
              <RotateCcw /> Corregir estado (sin avisar)
            </DropdownMenuItem>
            {order.deliveredAt && (
              <DropdownMenuItem className="min-h-11 px-2.5 text-[15px]" onClick={handleUndeliver}>
                <PackageX /> Deshacer entrega
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {order.archivedAt ? (
              <>
                <DropdownMenuItem className="min-h-11 px-2.5 text-[15px]" onClick={() => handleRestore(order.id)}>
                  <ArchiveRestore /> Restaurar orden
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" className="min-h-11 px-2.5 text-[15px]" onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Eliminar definitivamente
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem className="min-h-11 px-2.5 text-[15px]" onClick={handleArchive}>
                <Archive /> Archivar orden
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ---------- aviso de archivada ---------- */}
      {order.archivedAt && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3.5 py-3">
          <Archive className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[14px] leading-snug">
            <span className="font-bold">Orden archivada</span>
            <span className="block text-muted-foreground">El {formatDate(order.archivedAt)}. No sale en la lista.</span>
          </p>
          <Button variant="outline" size="lg" onClick={() => handleRestore(order.id)}>
            <ArchiveRestore data-icon="inline-start" />
            Restaurar
          </Button>
        </div>
      )}

      {/* ---------- equipo ---------- */}
      <header className="flex items-center gap-3.5">
        <span className={cn('grid size-14 shrink-0 place-items-center rounded-2xl', meta.bg)}>
          <Icon className={cn('size-7', meta.text)} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[24px] leading-tight font-extrabold tracking-tight">{deviceLabel(order.device)}</h1>
          <p className="truncate text-[14.5px] text-muted-foreground">{order.reportedFault}</p>
        </div>
      </header>

      {/* ---------- cliente + chat ---------- */}
      <CustomerBlock order={order} onSave={save} />

      {/* ---------- siguiente paso ---------- */}
      <NextStep
        order={order}
        onMove={(to) => setStatus(order.id, to)}
        onSave={save}
        onInvoice={() => setReceipt('entrega')}
        onDeliver={() => setDeliverOpen(true)}
      />

      {/* ---------- cobro ---------- */}
      <MoneyBlock
        order={order}
        onSave={save}
        onItems={(items) => setItems(order.id, items)}
        onReceipt={() => setReceipt(order.status === 'completada' ? 'entrega' : 'recepcion')}
        onPay={() => setPayOpen(true)}
        onDeletePayment={(paymentId) => deletePayment(order.id, paymentId)}
      />

      {/* ---------- equipo y falla ---------- */}
      <DeviceBlock order={order} onSave={save} onPhoto={setPhotoIndex} />

      {/* ---------- historial y comentarios ---------- */}
      <ActivityBlock order={order} onComment={(text) => addComment(order.id, text)} />

      {/* ---------- ventanas ---------- */}
      <ReceiptSheet order={order} open={receipt !== null} initialType={receipt ?? 'recepcion'} onClose={() => setReceipt(null)} />
      <PaymentDialog order={order} open={payOpen} onClose={() => setPayOpen(false)} onSave={(p) => addPayment(order.id, p)} />
      <DeliverDialog order={order} open={deliverOpen} onClose={() => setDeliverOpen(false)} onDeliver={handleDeliver} />
      <PhotoViewer photos={order.photos} open={photoIndex !== null} startIndex={photoIndex ?? 0} label={order.id} onClose={() => setPhotoIndex(null)} />

      <Dialog open={fixStatus} onOpenChange={setFixStatus}>
        <DialogContent>
          <DialogTitle>Corregir estado</DialogTitle>
          <DialogDescription>Cambia el estado sin enviar ningún mensaje al cliente. Úsalo solo para corregir errores.</DialogDescription>
          <StatusSelect
            value={order.status}
            onChange={async (s: OrderStatus) => {
              try {
                await setStatus(order.id, s)
                toast.success(`Estado corregido: ${STATUS_MAP[s].label}`)
                setFixStatus(false)
              } catch {
                toast.error('No se pudo cambiar el estado.')
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogTitle>¿Eliminar {order.id} para siempre?</DialogTitle>
          <DialogDescription>
            Se borran el equipo, el historial, los comprobantes y las fotos del servidor. No se puede deshacer. Si solo quieres
            quitarla de la lista, déjala archivada.
          </DialogDescription>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button size="lg" className="bg-destructive text-white hover:bg-destructive/90" onClick={handleDelete}>
              <Trash2 data-icon="inline-start" />
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ============================== bloques ============================== */

function Block({
  title,
  editing,
  onEdit,
  children,
  action,
}: {
  title: string
  editing?: boolean
  onEdit?: () => void
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section aria-label={title} className="rounded-3xl border border-border bg-card p-4">
      <div className="mb-3 flex min-h-8 items-center justify-between gap-2">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{title}</h2>
        {action}
        {onEdit && !editing && (
          <button
            type="button"
            onClick={onEdit}
            className="-mr-1.5 flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13.5px] font-bold text-primary hover:bg-primary/8"
          >
            <Pencil className="size-4" aria-hidden="true" />
            Editar
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

function SaveBar({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={saving}>
        <X data-icon="inline-start" />
        Cancelar
      </Button>
      <Button type="submit" size="lg" disabled={saving}>
        {saving ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Check data-icon="inline-start" />}
        Guardar
      </Button>
    </div>
  )
}

async function withToast(promise: Promise<unknown>, ok: string) {
  try {
    await promise
    toast.success(ok)
    return true
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'No se pudo guardar.')
    return false
  }
}

/* ---------- cliente ---------- */

function CustomerBlock({ order, onSave }: { order: Order; onSave: (p: OrderPatch) => Promise<Order> }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState(() => ({ ...order.customer }))
  const phone = order.customer.phone.replace(/\D/g, '')

  function start() {
    setF({ ...order.customer })
    setEditing(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (f.name.trim().length < 2 || f.phone.replace(/\D/g, '').length < 7) {
      toast.error('Revisa el nombre y el WhatsApp del cliente.')
      return
    }
    setSaving(true)
    const ok = await withToast(
      onSave({ customer: { name: f.name.trim(), phone: f.phone.trim(), documentId: f.documentId?.trim() || undefined, email: f.email?.trim() || undefined } }),
      'Cliente actualizado.',
    )
    setSaving(false)
    if (ok) setEditing(false)
  }

  if (editing) {
    return (
      <Block title="Cliente" editing>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="c-name">
            <Input id="c-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="WhatsApp" htmlFor="c-phone">
            <Input id="c-phone" type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="tabular" />
          </Field>
          <Field label="Documento" htmlFor="c-doc">
            <Input id="c-doc" value={f.documentId ?? ''} onChange={(e) => setF({ ...f, documentId: e.target.value })} />
          </Field>
          <Field label="Correo" htmlFor="c-mail">
            <Input id="c-mail" type="email" value={f.email ?? ''} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <SaveBar saving={saving} onCancel={() => setEditing(false)} />
          </div>
        </form>
      </Block>
    )
  }

  return (
    <Block title="Cliente" onEdit={start}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold">{order.customer.name}</p>
          <p className="tabular text-[14px] text-muted-foreground">
            {order.customer.phone}
            {order.customer.documentId ? ` · ${order.customer.documentId}` : ''}
          </p>
        </div>
        {phone && (
          <>
            <a
              href={`tel:${phone}`}
              aria-label={`Llamar a ${order.customer.name}`}
              title="Llamar"
              className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-surface"
            >
              <Phone className="size-[18px]" aria-hidden="true" />
            </a>
            <a
              href={chatUrl(order.customer.phone)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Abrir el chat de WhatsApp de ${order.customer.name}`}
              title="Abrir chat de WhatsApp"
              className="grid size-10 shrink-0 place-items-center rounded-full border border-whatsapp/40 bg-whatsapp/10 text-whatsapp"
            >
              <MessageCircle className="size-[18px]" aria-hidden="true" />
            </a>
          </>
        )}
      </div>
    </Block>
  )
}

/* ---------- cobro ---------- */

function MoneyBlock({
  order,
  onSave,
  onItems,
  onReceipt,
  onPay,
  onDeletePayment,
}: {
  order: Order
  onSave: (p: OrderPatch) => Promise<Order>
  onItems: (items: ServiceItem[]) => Promise<Order>
  onReceipt: () => void
  onPay: () => void
  onDeletePayment: (paymentId: string) => Promise<Order>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [items, setItemsDraft] = useState<ServiceItem[]>(order.items)
  const [cost, setCost] = useState(String(order.estimatedCost || ''))
  const [days, setDays] = useState(order.warrantyDays ? String(order.warrantyDays) : '')
  const [screenExcluded, setScreenExcluded] = useState(order.warrantyScreenExcluded ?? false)
  const [noAfterReview, setNoAfterReview] = useState(order.warrantyNoAfterReview ?? true)

  const total = orderTotal(order)
  const saldo = orderBalance(order)
  const [removing, setRemoving] = useState<OrderPayment | null>(null)

  function start() {
    setItemsDraft(order.items)
    setCost(String(order.estimatedCost || ''))
    setDays(order.warrantyDays ? String(order.warrantyDays) : '')
    setScreenExcluded(order.warrantyScreenExcluded ?? false)
    setNoAfterReview(order.warrantyNoAfterReview ?? true)
    setEditing(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const tasks: Promise<unknown>[] = [
      onSave({
        estimatedCost: Number(cost) || 0,
        warrantyDays: days.trim() === '' ? null : Number(days),
        warrantyScreenExcluded: screenExcluded,
        warrantyNoAfterReview: noAfterReview,
      }),
    ]
    const clean = items.filter((i) => i.description.trim() || i.price)
    if (JSON.stringify(clean) !== JSON.stringify(order.items)) tasks.push(onItems(clean))
    const ok = await withToast(Promise.all(tasks), 'Cobro actualizado.')
    setSaving(false)
    if (ok) setEditing(false)
  }

  if (editing) {
    return (
      <Block title="Cobro y garantía" editing>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Valor estimado" htmlFor="m-cost" hint="Los pagos se registran aparte, con «Registrar pago».">
            <MoneyInput id="m-cost" value={cost} onChange={setCost} />
          </Field>
          <div>
            <p className="mb-2 text-[13.5px] font-semibold text-foreground/85">Lo que se cobra (servicios y repuestos)</p>
            <ItemsEditor items={items} onChange={setItemsDraft} />
            <p className="mt-2 text-[12.5px] text-muted-foreground">Si no agregas nada, se cobra el valor estimado.</p>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
            <Field label="Días de garantía" htmlFor="m-days" hint={`Vacío = ${BUSINESS.warrantyDays} días`}>
              <Input id="m-days" inputMode="numeric" placeholder={String(BUSINESS.warrantyDays)} value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} />
            </Field>
            {order.device.type === 'celular' && (
              <label className="flex items-start gap-2.5 text-[13.5px]">
                <input type="checkbox" checked={screenExcluded} onChange={(e) => setScreenExcluded(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
                Sin garantía por pantallas cambiadas
              </label>
            )}
            <label className="flex items-start gap-2.5 text-[13.5px]">
              <input type="checkbox" checked={noAfterReview} onChange={(e) => setNoAfterReview(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
              Sin garantía después de la entrega y revisión del cliente
            </label>
          </div>
          <SaveBar saving={saving} onCancel={() => setEditing(false)} />
        </form>
      </Block>
    )
  }

  return (
    <Block title="Cobro y garantía" onEdit={start}>
      <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-border">
        <Money label="Total" value={total} />
        <Money label="Pagado" value={order.deposit || 0} className="border-x border-border" />
        <Money label="Saldo" value={saldo} strong />
      </div>
      {order.items.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 text-[14px]">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">
                <span className="mr-1.5 text-[11px] font-bold uppercase text-muted-foreground">{i.kind}</span>
                {i.description || 'Sin descripción'}
              </span>
              <span className="tabular shrink-0 font-semibold">{formatMoney(i.price)}</span>
            </li>
          ))}
        </ul>
      )}
      <PaymentsList payments={order.payments ?? []} onRemove={setRemoving} />
      <p className="mt-3 text-[13px] text-muted-foreground">
        Garantía: {order.warrantyDays ?? BUSINESS.warrantyDays} días{order.deliveredAt ? ' desde la entrega' : ' (empieza al entregar)'}
        {order.estimatedDate ? ` · Entrega estimada ${formatDate(order.estimatedDate)}` : ''}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" size="lg" onClick={onPay}>
          <HandCoins data-icon="inline-start" />
          Registrar pago
        </Button>
        <Button variant="outline" size="lg" onClick={onReceipt}>
          <ReceiptText data-icon="inline-start" />
          Recibo
        </Button>
      </div>

      <Dialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent>
          <DialogTitle>¿Borrar este pago?</DialogTitle>
          <DialogDescription>
            {removing
              ? `${formatMoney(removing.amount)} en ${PAYMENT_MAP[removing.method]?.label ?? removing.method} del ${formatDate(removing.paidAt, true)}. Úsalo solo si se registró por error: también sale de la caja.`
              : ''}
          </DialogDescription>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" onClick={() => setRemoving(null)}>
              Cancelar
            </Button>
            <Button
              size="lg"
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                const p = removing
                setRemoving(null)
                if (p) await withToast(onDeletePayment(p.id), 'Pago borrado.')
              }}
            >
              <Trash2 data-icon="inline-start" />
              Borrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Block>
  )
}

function PaymentsList({ payments, onRemove }: { payments: OrderPayment[]; onRemove: (p: OrderPayment) => void }) {
  if (payments.length === 0) return <p className="mt-3 text-[13.5px] text-muted-foreground">Sin pagos registrados.</p>
  return (
    <div className="mt-3">
      <p className="text-[13px] font-semibold text-muted-foreground">Pagos</p>
      <ul className="mt-1.5 flex flex-col divide-y divide-border rounded-2xl border border-border">
        {payments.map((p) => {
          const m = PAYMENT_MAP[p.method]
          const Icon = m?.icon
          return (
            <li key={p.id} className="flex items-center gap-2.5 py-1.5 pr-1 pl-3">
              {Icon && (
                <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', m.bg, m.text)}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">
                  {m?.label ?? p.method}
                  {p.note ? <span className="font-normal text-muted-foreground"> · {p.note}</span> : null}
                </span>
                <span className="block text-[12px] text-muted-foreground">{formatDate(p.paidAt, true)}</span>
              </span>
              <span className="tabular shrink-0 text-[14.5px] font-bold">{formatMoney(p.amount)}</span>
              <button
                type="button"
                onClick={() => onRemove(p)}
                aria-label={`Borrar el pago de ${formatMoney(p.amount)}`}
                className="grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
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

function MoneyInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-semibold text-muted-foreground">$</span>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="0"
        value={value ? Number(value).toLocaleString(BUSINESS.locale) : ''}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        className="tabular pl-7 font-semibold"
      />
    </div>
  )
}

/* ---------- equipo y falla ---------- */

function DeviceBlock({ order, onSave, onPhoto }: { order: Order; onSave: (p: OrderPatch) => Promise<Order>; onPhoto: (i: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const initial = () => ({
    type: order.device.type as DeviceType,
    brand: order.device.brand,
    model: order.device.model,
    serial: order.device.serial ?? '',
    color: order.device.color ?? '',
    fault: order.reportedFault,
    notes: order.physicalNotes ?? '',
    accessories: order.accessories.join(', '),
    technician: order.technician ?? '',
    date: order.estimatedDate ? order.estimatedDate.slice(0, 10) : '',
  })
  const [f, setF] = useState(initial)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.model.trim() || !f.fault.trim()) {
      toast.error('El modelo y la falla no pueden quedar vacíos.')
      return
    }
    setSaving(true)
    const ok = await withToast(
      onSave({
        device: { type: f.type, brand: f.brand.trim(), model: f.model.trim(), serial: f.serial.trim() || undefined, color: f.color.trim() || undefined },
        reportedFault: f.fault.trim(),
        physicalNotes: f.notes.trim() || undefined,
        accessories: f.accessories.split(',').map((a) => a.trim()).filter(Boolean),
        technician: f.technician.trim() || undefined,
        estimatedDate: f.date || undefined,
      }),
      'Equipo actualizado.',
    )
    setSaving(false)
    if (ok) setEditing(false)
  }

  if (editing) {
    const custom = f.type === 'celular' || f.type === 'accesorio'
    return (
      <Block title="Equipo y falla" editing>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo" htmlFor="d-type" className="sm:col-span-2">
            <div id="d-type" className="flex flex-wrap gap-1.5">
              {DEVICE_TYPES.map((t) => (
                <Pill key={t.value} active={f.type === t.value} onClick={() => setF({ ...f, type: t.value })}>
                  {t.label}
                </Pill>
              ))}
            </div>
          </Field>
          <Field label="Marca" htmlFor="d-brand">
            {custom ? (
              <Input id="d-brand" value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} />
            ) : (
              <div id="d-brand" className="flex flex-wrap gap-1.5">
                {BRANDS.map((b) => (
                  <Pill key={b} active={f.brand === b} onClick={() => setF({ ...f, brand: b })}>
                    {b}
                  </Pill>
                ))}
              </div>
            )}
          </Field>
          <Field label="Modelo" htmlFor="d-model">
            <Input id="d-model" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} />
          </Field>
          <Field label="Serial" htmlFor="d-serial">
            <Input id="d-serial" value={f.serial} onChange={(e) => setF({ ...f, serial: e.target.value })} className="font-mono uppercase" />
          </Field>
          <Field label="Color" htmlFor="d-color">
            <Input id="d-color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} />
          </Field>
          <Field label="Falla" htmlFor="d-fault" className="sm:col-span-2">
            <Textarea id="d-fault" rows={3} value={f.fault} onChange={(e) => setF({ ...f, fault: e.target.value })} />
          </Field>
          <Field label="Accesorios" htmlFor="d-acc" hint="Separados por comas" className="sm:col-span-2">
            <Input id="d-acc" value={f.accessories} onChange={(e) => setF({ ...f, accessories: e.target.value })} />
          </Field>
          <Field label="Estado físico" htmlFor="d-notes" className="sm:col-span-2">
            <Textarea id="d-notes" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
          <Field label="Técnico" htmlFor="d-tech">
            <Input id="d-tech" value={f.technician} onChange={(e) => setF({ ...f, technician: e.target.value })} />
          </Field>
          <Field label="Entrega estimada" htmlFor="d-date">
            <Input id="d-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <SaveBar saving={saving} onCancel={() => setEditing(false)} />
          </div>
        </form>
      </Block>
    )
  }

  return (
    <Block
      title="Equipo y falla"
      onEdit={() => {
        setF(initial())
        setEditing(true)
      }}
    >
      <p className="text-pretty text-[15px] leading-relaxed">{order.reportedFault || 'Sin descripción.'}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[14px]">
        <Fact label="Tipo" value={DEVICE_TYPES.find((t) => t.value === order.device.type)?.label} />
        <Fact label="Serial" value={order.device.serial} mono />
        <Fact label="Color" value={order.device.color} />
        <Fact label="Técnico" value={order.technician} />
      </dl>
      <p className="mt-3 text-[13px] font-semibold text-muted-foreground">Accesorios</p>
      <p className="text-[14px]">{order.accessories.length ? order.accessories.join(', ') : 'Sin accesorios'}</p>
      {order.physicalNotes && (
        <>
          <p className="mt-3 text-[13px] font-semibold text-muted-foreground">Estado físico</p>
          <p className="text-[14px]">{order.physicalNotes}</p>
        </>
      )}
      {order.photos.length > 0 ? (
        <ul className="mt-3 grid grid-cols-4 gap-2">
          {order.photos.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPhoto(i)}
                aria-label={`Ver foto ${i + 1}`}
                className="block aspect-square w-full overflow-hidden rounded-xl bg-muted"
              >
                <img src={p.url || '/placeholder.svg'} alt="" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-[13.5px] text-muted-foreground">
          <Camera className="size-4" aria-hidden="true" /> Sin fotos de ingreso
        </p>
      )}
    </Block>
  )
}

function Fact({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className={cn('truncate font-semibold', mono && 'font-mono', !value && 'font-normal text-muted-foreground')}>{value || '—'}</dd>
    </div>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-9 rounded-full border px-3 text-[13.5px] font-semibold transition-colors',
        active ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-foreground/80',
      )}
    >
      {children}
    </button>
  )
}

/* ---------- historial y comentarios ---------- */

function ActivityBlock({ order, onComment }: { order: Order; onComment: (text: string) => Promise<Order> }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t || saving) return
    setSaving(true)
    const ok = await withToast(onComment(t), 'Comentario agregado.')
    setSaving(false)
    if (ok) setText('')
  }

  // Estados y comentarios en una sola línea de tiempo, lo más reciente arriba.
  const events = [
    ...order.history.map((h) => ({ at: h.at, kind: 'estado' as const, status: h.status, text: h.note })),
    ...(order.comments ?? []).map((c) => ({ at: c.at, kind: 'nota' as const, status: undefined, text: c.text })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <Block title="Historial y notas">
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="new-comment" className="sr-only">
          Nueva nota interna
        </label>
        <Input
          id="new-comment"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nota interna (el cliente no la ve)"
          maxLength={1000}
          enterKeyHint="send"
        />
        <Button type="submit" size="icon" className="size-11 shrink-0" disabled={saving || !text.trim()} aria-label="Agregar nota">
          {saving ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
        </Button>
      </form>
      <ol className="mt-4 flex flex-col">
        {events.map((ev, i) => {
          const m = ev.status ? STATUS_MAP[ev.status] ?? STATUS_MAP.pendiente : null
          return (
            <li key={`${ev.at}-${i}`} className="relative flex gap-3 pb-3.5 last:pb-0">
              {i < events.length - 1 && <span className="absolute top-4 bottom-0 left-[5px] w-px bg-border" aria-hidden="true" />}
              <span
                className={cn('relative mt-1.5 size-[11px] shrink-0 rounded-full', m ? m.dot : 'border-2 border-muted-foreground bg-card')}
                aria-hidden="true"
              />
              <div className="min-w-0">
                {m ? (
                  <p className="text-[14px] font-semibold">{m.label}</p>
                ) : (
                  <p className="text-[14px] break-words text-pretty">{ev.text}</p>
                )}
                <p className="text-[12.5px] text-muted-foreground">
                  {formatDate(ev.at, true)}
                  {m && ev.text ? ` · ${ev.text}` : ''}
                  {!m ? ' · nota interna' : ''}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </Block>
  )
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-20 text-center">
      <p className="text-[18px] font-extrabold">{title}</p>
      <p className="text-[14px] text-muted-foreground">{text}</p>
      <Button nativeButton={false} render={<Link href="/" />}>
        <ArrowLeft data-icon="inline-start" />
        Volver a las órdenes
      </Button>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Receipt,
  MessageCircle,
  FileDown,
  Loader2,
  UserRound,
  PackagePlus,
  Banknote,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatMoney } from '@/lib/business'
import { buildWhatsAppUrl } from '@/lib/whatsapp'
import {
  PAYMENT_METHODS,
  PAYMENT_MAP,
  buildSaleMessage,
  buildSaleReceiptPdf,
  createVenta,
  type NewVentaInput,
  type PaymentMethod,
  type Venta,
} from '@/lib/ventas'
import { cn } from '@/lib/utils'

interface DraftItem {
  key: string
  name: string
  price: number
  cost: number
  quantity: number
}

interface Delivery {
  url: string
  blobUrl: string
  fileName: string
}

function money(value: number) {
  return formatMoney(value)
}

export function SaleForm({ onCreated }: { onCreated: () => void }) {
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [itemCost, setItemCost] = useState('')
  const [itemQuantity, setItemQuantity] = useState('1')
  const [items, setItems] = useState<DraftItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('')
  const [saving, setSaving] = useState(false)
  const [sale, setSale] = useState<Venta | null>(null)
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const totals = useMemo(() => {
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const totalCost = items.reduce((sum, i) => sum + i.cost * i.quantity, 0)
    const units = items.reduce((sum, i) => sum + i.quantity, 0)
    return { total, totalCost, profit: total - totalCost, units }
  }, [items])

  // Prepara el PDF y el enlace de WhatsApp en cuanto aparece el recibo,
  // para que los clics posteriores no pierdan el gesto de usuario.
  useEffect(() => {
    if (!sale) {
      setDelivery(null)
      return
    }
    let cancelled = false
    let objectUrl = ''
    buildSaleReceiptPdf(sale)
      .then(({ blob, filename }) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setDelivery({
          blobUrl: objectUrl,
          fileName: filename,
          url: sale.customerPhone ? buildWhatsAppUrl(sale.customerPhone, buildSaleMessage(sale)) : '',
        })
      })
      .catch(() => {
        if (!cancelled) toast.error('No se pudo preparar el recibo en PDF.')
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [sale])

  function addItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = itemName.trim()
    const price = Number(itemPrice)
    const cost = Number(itemCost)
    const quantity = Math.trunc(Number(itemQuantity))

    if (!name) return toast.error('Escribe el nombre del artículo.')
    if (!Number.isFinite(price) || price <= 0) return toast.error('El valor de venta debe ser mayor a cero.')
    if (!Number.isFinite(cost) || cost < 0) return toast.error('El valor de compra no es válido.')
    if (!Number.isFinite(quantity) || quantity < 1) return toast.error('La cantidad debe ser mínimo 1.')

    const existing = items.find((i) => i.name.toLowerCase() === name.toLowerCase() && i.price === price && i.cost === cost)
    if (existing) {
      setItems((prev) =>
        prev.map((i) => (i.key === existing.key ? { ...i, quantity: Math.min(999, i.quantity + quantity) } : i)),
      )
      toast.success(`${name} sumado al carrito.`)
    } else {
      setItems((prev) => [
        ...prev,
        { key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, price, cost, quantity },
      ])
      toast.success(`${name} agregado al carrito.`)
    }

    // Limpia el formulario de artículo para seguir agregando.
    setItemName('')
    setItemPrice('')
    setItemCost('')
    setItemQuantity('1')
    nameRef.current?.focus()
  }

  function changeQuantity(key: string, next: number) {
    const quantity = Math.max(1, Math.min(999, Math.trunc(next) || 1))
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, quantity } : i)))
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key))
  }

  function resetSale() {
    setSale(null)
    setDelivery(null)
    setItems([])
    setCustomerName('')
    setCustomerPhone('')
    setPaymentMethod('')
    setItemName('')
    setItemPrice('')
    setItemCost('')
    setItemQuantity('1')
    nameRef.current?.focus()
  }

  async function registerSale() {
    if (items.length === 0) return toast.error('Agrega al menos un artículo al carrito.')
    if (!paymentMethod) return toast.error('Elige el método de pago.')

    const input: NewVentaInput = {
      items: items.map(({ name, price, cost, quantity }) => ({ name, price, cost, quantity })),
      paymentMethod,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
    }

    setSaving(true)
    try {
      const created = await createVenta(input)
      setSale(created)
      onCreated()
      toast.success(`Venta ${created.id} registrada por ${money(created.total)}.`, {
        description: 'Puedes descargar el recibo o enviarlo por WhatsApp.',
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la venta.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
      {/* ---------------------------- entrada de datos ---------------------------- */}
      <div className="flex flex-col gap-4">
        <section className="rounded-2xl border border-border bg-card/70 p-4 ring-1 ring-foreground/5 md:p-5">
          <header className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-primary/12 text-primary">
              <UserRound className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Datos del cliente</h2>
              <p className="text-xs text-muted-foreground">Opcional. Sirve para enviar el recibo por WhatsApp.</p>
            </div>
          </header>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sale-customer-name" className="text-xs text-muted-foreground">
                Nombre del cliente
              </Label>
              <Input
                id="sale-customer-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ej. Andrés Gómez"
                className="h-11 rounded-xl bg-background/40 text-base"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sale-customer-phone" className="text-xs text-muted-foreground">
                Teléfono / WhatsApp
              </Label>
              <Input
                id="sale-customer-phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Ej. 300 123 4567"
                inputMode="tel"
                className="h-11 rounded-xl bg-background/40 text-base"
                autoComplete="off"
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card/70 p-4 ring-1 ring-foreground/5 md:p-5">
          <header className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-status-pending/12 text-status-pending">
              <PackagePlus className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Agregar artículo</h2>
              <p className="text-xs text-muted-foreground">Nombre, precio de venta, costo interno y cantidad.</p>
            </div>
          </header>

          <form onSubmit={addItem} className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sale-item-name" className="text-xs text-muted-foreground">
                Nombre del artículo
              </Label>
              <Input
                ref={nameRef}
                id="sale-item-name"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Ej. Control PS5, audífonos, cable HDMI..."
                className="h-11 rounded-xl bg-background/40 text-base"
                autoComplete="off"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sale-item-price" className="text-xs text-muted-foreground">
                  Valor venta
                </Label>
                <Input
                  id="sale-item-price"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="0"
                  inputMode="numeric"
                  className="h-11 rounded-xl bg-background/40 font-mono text-base tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sale-item-cost" className="text-xs text-muted-foreground">
                  Valor compra
                </Label>
                <Input
                  id="sale-item-cost"
                  value={itemCost}
                  onChange={(e) => setItemCost(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="0"
                  inputMode="numeric"
                  className="h-11 rounded-xl bg-background/40 font-mono text-base tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sale-item-quantity" className="text-xs text-muted-foreground">
                  Cantidad
                </Label>
                <Input
                  id="sale-item-quantity"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(e.target.value.replace(/[^\d]/g, ''))}
                  inputMode="numeric"
                  className="h-11 rounded-xl bg-background/40 font-mono text-base tabular-nums"
                />
              </div>
            </div>

            <Button type="submit" variant="secondary" className="h-11 w-full rounded-xl text-sm font-semibold">
              <Plus className="size-4" aria-hidden="true" />
              Agregar al carrito
            </Button>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card/70 p-4 ring-1 ring-foreground/5 md:p-5">
          <header className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-status-review/12 text-status-review">
              <Banknote className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Método de pago</h2>
              <p className="text-xs text-muted-foreground">Toca el medio por el que entró el dinero.</p>
            </div>
          </header>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PAYMENT_METHODS.map((method) => {
              const active = paymentMethod === method.value
              const Icon = method.icon
              return (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setPaymentMethod(method.value)}
                  aria-pressed={active}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all',
                    active
                      ? 'border-primary/60 bg-primary/10 ring-1 ring-primary/40'
                      : 'border-border bg-background/40 hover:bg-card hover:border-foreground/20',
                  )}
                >
                  <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', method.bg, method.text)}>
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className={cn('block truncate text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>
                      {method.label}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">{method.hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {!paymentMethod && <p className="mt-3 text-xs text-muted-foreground">Selecciona un método para habilitar el registro.</p>}
        </section>
      </div>

      {/* -------------------------------- carrito -------------------------------- */}
      <aside className="flex flex-col gap-3 rounded-2xl border border-border bg-card/80 ring-1 ring-foreground/10 lg:sticky lg:top-6">
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold">Carrito</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
              {totals.units}
            </span>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setItems([])}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
            >
              Vaciar
            </button>
          )}
        </header>

        <div className="max-h-[42vh] overflow-y-auto px-2 lg:max-h-[46vh]">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <ShoppingCart className="size-8 text-muted-foreground/60" aria-hidden="true" />
              <p className="text-sm font-medium">El carrito está vacío</p>
              <p className="text-xs text-muted-foreground">Agrega artículos desde el formulario.</p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {items.map((item) => (
                <li key={item.key} className="border-b border-border/60 px-2 py-3 last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {money(item.price)} c/u · costo {money(item.cost)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      aria-label={`Quitar ${item.name}`}
                      className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Disminuir cantidad de ${item.name}`}
                        onClick={() => changeQuantity(item.key, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="size-7 rounded-lg"
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={item.quantity}
                        onChange={(e) => changeQuantity(item.key, Number(e.target.value))}
                        aria-label={`Cantidad de ${item.name}`}
                        className="h-7 w-12 rounded-lg border border-input bg-background/40 text-center font-mono text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Aumentar cantidad de ${item.name}`}
                        onClick={() => changeQuantity(item.key, item.quantity + 1)}
                        disabled={item.quantity >= 999}
                        className="size-7 rounded-lg"
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                    <p className="font-mono text-sm font-semibold tabular-nums">{money(item.price * item.quantity)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Artículos</span>
            <span className="font-mono tabular-nums">{totals.units}</span>
          </div>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-sm font-medium text-muted-foreground">Total a pagar</span>
            <span className="font-mono text-2xl font-bold tabular-nums tracking-tight">{money(totals.total)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-lg bg-muted/40 px-2.5 py-2">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Ganancia de la venta</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-status-done">{money(totals.profit)}</span>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">La ganancia es interna y no se muestra en el recibo.</p>

          <Button
            type="button"
            onClick={registerSale}
            disabled={saving || items.length === 0 || !paymentMethod}
            className="mt-3 h-12 w-full rounded-xl text-base font-semibold"
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Receipt className="size-4" aria-hidden="true" />}
            {saving ? 'Registrando...' : 'Registrar venta'}
          </Button>
        </div>
      </aside>

      <SaleSuccessDialog
        sale={sale}
        delivery={delivery}
        onClose={() => setSale(null)}
        onNewSale={resetSale}
      />
    </div>
  )
}

function SaleSuccessDialog({
  sale,
  delivery,
  onClose,
  onNewSale,
}: {
  sale: Venta | null
  delivery: Delivery | null
  onClose: () => void
  onNewSale: () => void
}) {
  return (
    <Dialog open={sale !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {sale && (
          <>
            <DialogHeader>
              <div className="grid size-11 place-items-center rounded-full bg-status-done/15 text-status-done">
                <Receipt className="size-5" aria-hidden="true" />
              </div>
              <DialogTitle className="text-lg font-bold tracking-tight">Venta registrada</DialogTitle>
              <DialogDescription>
                {sale.id} · {money(sale.total)} · {PAYMENT_MAP[sale.paymentMethod]?.label ?? sale.paymentMethod}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-border bg-background/40 p-3">
              <ul className="flex flex-col gap-1.5 text-sm">
                {sale.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {item.quantity} × {item.name}
                    </span>
                    <span className="font-mono tabular-nums">{money(item.subtotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span className="text-sm font-semibold">Total</span>
                <span className="font-mono text-lg font-bold tabular-nums">{money(sale.total)}</span>
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              {delivery ? (
                <a
                  href={delivery.blobUrl}
                  download={delivery.fileName}
                  className={buttonVariants({ variant: 'default', className: 'h-10 w-full rounded-xl' })}
                >
                  <FileDown className="size-4" aria-hidden="true" />
                  Descargar recibo PDF
                </a>
              ) : (
                <Button type="button" disabled className="h-10 w-full rounded-xl">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Preparando recibo...
                </Button>
              )}

              {delivery?.url && (
                <a
                  href={delivery.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({
                    variant: 'outline',
                    className: 'h-10 w-full rounded-xl border-whatsapp/40 text-whatsapp hover:bg-whatsapp/10',
                  })}
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                  Enviar por WhatsApp
                </a>
              )}

              <p className="text-center text-[11px] text-muted-foreground">
                {delivery?.url
                  ? 'Descarga el PDF y adjúntalo con el botón + en el chat de WhatsApp.'
                  : 'Sin teléfono del cliente: solo se puede descargar el recibo.'}
              </p>

              <div className="flex w-full gap-2">
                <Button type="button" variant="ghost" onClick={onClose} className="h-10 flex-1 rounded-xl">
                  Cerrar
                </Button>
                <Button type="button" variant="secondary" onClick={onNewSale} className="h-10 flex-1 rounded-xl">
                  <ShoppingCart className="size-4" aria-hidden="true" />
                  Nueva venta
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Save, Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { formatMoney } from '@/lib/business'
import { PAYMENT_METHODS, type PaymentMethod, type Venta, type VentaPatch } from '@/lib/ventas'
import { cn } from '@/lib/utils'

interface DraftItem {
  key: string
  name: string
  price: string
  cost: string
  quantity: string
}

function toDraft(venta: Venta): DraftItem[] {
  return venta.items.map((item) => ({
    key: item.id ?? `${item.name}-${Math.random().toString(36).slice(2, 7)}`,
    name: item.name,
    price: String(item.price),
    cost: String(item.cost),
    quantity: String(item.quantity),
  }))
}

export function SaleEditDialog({
  venta,
  onClose,
  onSave,
}: {
  venta: Venta | null
  onClose: () => void
  onSave: (id: string | number, patch: VentaPatch) => Promise<Venta>
}) {
  return (
    <Dialog open={venta !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        {venta && <Editor key={venta.id} venta={venta} onClose={onClose} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  )
}

function Editor({
  venta,
  onClose,
  onSave,
}: {
  venta: Venta
  onClose: () => void
  onSave: (id: string | number, patch: VentaPatch) => Promise<Venta>
}) {
  const [customerName, setCustomerName] = useState(venta.customerName ?? '')
  const [customerPhone, setCustomerPhone] = useState(venta.customerPhone ?? '')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(venta.paymentMethod)
  const [notes, setNotes] = useState(venta.notes ?? '')
  const [items, setItems] = useState<DraftItem[]>(toDraft(venta))
  const [saving, setSaving] = useState(false)

  const totals = useMemo(() => {
    const total = items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0)
    const totalCost = items.reduce((sum, i) => sum + (Number(i.cost) || 0) * (Number(i.quantity) || 0), 0)
    return { total, totalCost, profit: total - totalCost }
  }, [items])

  function update(key: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  function addRow() {
    setItems((prev) => [...prev, { key: Math.random().toString(36).slice(2, 9), name: '', price: '', cost: '', quantity: '1' }])
  }

  function removeRow(key: string) {
    setItems((prev) => prev.filter((item) => item.key !== key))
  }

  async function save() {
    if (items.length === 0) return toast.error('La venta necesita al menos un artículo.')
    for (const [index, item] of items.entries()) {
      if (!item.name.trim()) return toast.error(`El artículo #${index + 1} no tiene nombre.`)
      if (!(Number(item.price) > 0)) return toast.error(`El valor de venta del artículo #${index + 1} debe ser mayor a cero.`)
      if (!Number.isFinite(Number(item.cost)) || Number(item.cost) < 0) {
        return toast.error(`El valor de compra del artículo #${index + 1} no es válido.`)
      }
      if (!(Number(item.quantity) >= 1)) return toast.error(`La cantidad del artículo #${index + 1} debe ser mínimo 1.`)
    }

    const patch: VentaPatch = {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      paymentMethod,
      notes: notes.trim(),
      items: items.map((item) => ({
        name: item.name.trim(),
        price: Math.round(Number(item.price) || 0),
        cost: Math.round(Number(item.cost) || 0),
        quantity: Math.max(1, Math.trunc(Number(item.quantity) || 1)),
      })),
    }

    setSaving(true)
    try {
      await onSave(venta.id, patch)
      toast.success(`Venta ${venta.id} actualizada.`)
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la venta.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 px-4 pt-4 sm:px-0 sm:pt-0">
        <span className="grid size-9 place-items-center rounded-lg bg-primary/12 text-primary">
          <Pencil className="size-4" aria-hidden="true" />
        </span>
        <div>
          <DialogTitle className="text-lg font-bold tracking-tight">Editar venta {venta.id}</DialogTitle>
          <DialogDescription>
            Corrige el cliente, el método de pago o los artículos. Los totales y la ganancia se recalculan solos.
          </DialogDescription>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name" className="text-xs text-muted-foreground">
              Nombre del cliente
            </Label>
            <Input
              id="edit-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Cliente ocasional"
              className="h-11 rounded-xl bg-background/40 text-base"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-phone" className="text-xs text-muted-foreground">
              Teléfono / WhatsApp
            </Label>
            <Input
              id="edit-phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Ej. 300 123 4567"
              inputMode="tel"
              className="h-11 rounded-xl bg-background/40 text-base"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">Método de pago</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                    'flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all',
                    active
                      ? 'border-primary/60 bg-primary/10 ring-1 ring-primary/40'
                      : 'border-border bg-background/40 hover:border-foreground/20 hover:bg-card',
                  )}
                >
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', method.bg, method.text)}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className={cn('truncate text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>
                    {method.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Artículos</Label>
            <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg" onClick={addRow}>
              <Plus className="size-3.5" aria-hidden="true" />
              Agregar artículo
            </Button>
          </div>

          <ul className="flex flex-col gap-2">
            {items.map((item, index) => (
              <li key={item.key} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={item.name}
                    onChange={(e) => update(item.key, { name: e.target.value })}
                    placeholder={`Artículo #${index + 1}`}
                    aria-label={`Nombre del artículo #${index + 1}`}
                    className="h-10 flex-1 rounded-lg bg-background/60 text-base"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(item.key)}
                    aria-label={`Quitar artículo #${index + 1}`}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] text-muted-foreground">Valor venta</Label>
                    <Input
                      value={item.price}
                      onChange={(e) => update(item.key, { price: e.target.value.replace(/[^\d]/g, '') })}
                      inputMode="numeric"
                      aria-label={`Valor de venta del artículo #${index + 1}`}
                      className="h-10 rounded-lg bg-background/60 font-mono text-base tabular-nums"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] text-muted-foreground">Valor compra</Label>
                    <Input
                      value={item.cost}
                      onChange={(e) => update(item.key, { cost: e.target.value.replace(/[^\d]/g, '') })}
                      inputMode="numeric"
                      aria-label={`Valor de compra del artículo #${index + 1}`}
                      className="h-10 rounded-lg bg-background/60 font-mono text-base tabular-nums"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] text-muted-foreground">Cantidad</Label>
                    <Input
                      value={item.quantity}
                      onChange={(e) => update(item.key, { quantity: e.target.value.replace(/[^\d]/g, '') })}
                      inputMode="numeric"
                      aria-label={`Cantidad del artículo #${index + 1}`}
                      className="h-10 rounded-lg bg-background/60 font-mono text-base tabular-nums"
                    />
                  </div>
                </div>
                <p className="mt-1.5 text-right font-mono text-xs text-muted-foreground tabular-nums">
                  Subtotal {formatMoney((Number(item.price) || 0) * (Number(item.quantity) || 0))}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-notes" className="text-xs text-muted-foreground">
            Nota interna (opcional)
          </Label>
          <Textarea
            id="edit-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 400))}
            rows={2}
            placeholder="Ej. pagó con transferencia a la llave del negocio"
            className="rounded-xl bg-background/40 text-base"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Total</p>
            <p className="font-mono text-base font-bold tabular-nums">{formatMoney(totals.total)}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Costo</p>
            <p className="font-mono text-base font-semibold tabular-nums">{formatMoney(totals.totalCost)}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Ganancia</p>
            <p className="font-mono text-base font-semibold tabular-nums text-status-done">{formatMoney(totals.profit)}</p>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-4 flex flex-col gap-2 border-t border-border bg-popover/95 p-4 backdrop-blur sm:-mx-0 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" className="h-10 rounded-xl" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button type="button" className="h-10 rounded-xl font-semibold" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </>
  )
}

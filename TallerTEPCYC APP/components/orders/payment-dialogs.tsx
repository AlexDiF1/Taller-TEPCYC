'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, HandCoins, Loader2, PackageCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { PAYMENT_METHODS } from '@/lib/ventas'
import { BUSINESS, addDays, formatDate, formatMoney } from '@/lib/business'
import type { Order, PaymentMethod } from '@/lib/types'
import { cn } from '@/lib/utils'
import { orderBalance } from './order-card'

/** Botones de método de pago (los mismos de Ventas), en rejilla de 2 o 3 columnas. */
export function MethodPicker({
  value,
  onChange,
  idPrefix = 'pm',
}: {
  value: PaymentMethod | ''
  onChange: (m: PaymentMethod) => void
  idPrefix?: string
}) {
  return (
    <div role="radiogroup" aria-label="Método de pago" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {PAYMENT_METHODS.map((method) => {
        const active = value === method.value
        const Icon = method.icon
        return (
          <button
            key={method.value}
            id={`${idPrefix}-${method.value}`}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(method.value)}
            className={cn(
              'flex min-h-12 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors',
              active ? 'border-foreground bg-foreground/5 ring-1 ring-foreground' : 'border-border bg-surface hover:border-foreground/25',
            )}
          >
            <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', method.bg, method.text)}>
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className={cn('truncate text-[14px] font-bold', active ? 'text-foreground' : 'text-foreground/80')}>{method.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function AmountInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-semibold text-muted-foreground">$</span>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="0"
        value={value ? Number(value).toLocaleString(BUSINESS.locale) : ''}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 9))}
        className="tabular pl-7 text-[18px] font-bold"
      />
    </div>
  )
}

/** Registrar un pago en cualquier momento (abono extra, repuesto, saldo…). */
export function PaymentDialog({
  order,
  open,
  onClose,
  onSave,
}: {
  order: Order
  open: boolean
  onClose: () => void
  onSave: (p: { amount: number; method: PaymentMethod; note?: string }) => Promise<unknown>
}) {
  const balance = orderBalance(order)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setAmount(balance > 0 ? String(balance) : '')
    setMethod('')
    setNote('')
  }, [open, balance])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!(Number(amount) > 0)) return toast.error('Escribe el valor que pagó el cliente.')
    if (!method) return toast.error('Elige cómo pagó.')
    setSaving(true)
    try {
      await onSave({ amount: Number(amount), method, note: note.trim() || undefined })
      toast.success(`Pago de ${formatMoney(Number(amount))} registrado.`)
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el pago.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Registrar pago</DialogTitle>
        <DialogDescription>
          {balance > 0 ? `Saldo pendiente: ${formatMoney(balance)}.` : 'Esta orden no tiene saldo pendiente.'}
        </DialogDescription>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <label htmlFor="pay-amount" className="text-[13.5px] font-semibold text-foreground/85">
              Valor
            </label>
            <div className="mt-1">
              <AmountInput id="pay-amount" value={amount} onChange={setAmount} />
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[13.5px] font-semibold text-foreground/85">Método</p>
            <MethodPicker value={method} onChange={setMethod} idPrefix="pay" />
          </div>
          <div>
            <label htmlFor="pay-note" className="text-[13.5px] font-semibold text-foreground/85">
              Nota <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <Input id="pay-note" className="mt-1" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: abono para el repuesto" />
          </div>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <HandCoins data-icon="inline-start" />}
              Registrar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Entregar el equipo: cobra el saldo (si hay) con su método y marca la entrega. */
export function DeliverDialog({
  order,
  open,
  onClose,
  onDeliver,
}: {
  order: Order
  open: boolean
  onClose: () => void
  onDeliver: (payment?: { amount: number; method: PaymentMethod }) => Promise<unknown>
}) {
  const balance = orderBalance(order)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [saving, setSaving] = useState(false)
  const warrantyDays = order.warrantyDays ?? BUSINESS.warrantyDays
  const repaired = order.status === 'completada'

  useEffect(() => {
    if (!open) return
    setAmount(balance > 0 ? String(balance) : '')
    setMethod('')
  }, [open, balance])

  const charge = Number(amount) || 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (charge > 0 && !method) return toast.error('Elige cómo pagó el saldo.')
    setSaving(true)
    try {
      await onDeliver(charge > 0 && method ? { amount: charge, method } : undefined)
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo marcar la entrega.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Entregar el equipo</DialogTitle>
        <DialogDescription>
          {repaired
            ? `La garantía de ${warrantyDays} días empieza hoy (hasta el ${formatDate(addDays(new Date().toISOString(), warrantyDays))}).`
            : 'Se devuelve el equipo al cliente.'}
        </DialogDescription>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border text-center">
            <div className="px-3 py-2.5">
              <p className="text-[12px] font-semibold text-muted-foreground">Ya pagó</p>
              <p className="tabular text-[16px] font-bold">{formatMoney(order.deposit || 0)}</p>
            </div>
            <div className="border-l border-border bg-primary/8 px-3 py-2.5">
              <p className="text-[12px] font-semibold text-muted-foreground">Saldo</p>
              <p className="tabular text-[16px] font-bold text-primary">{formatMoney(balance)}</p>
            </div>
          </div>
          <div>
            <label htmlFor="deliver-amount" className="text-[13.5px] font-semibold text-foreground/85">
              Cobra ahora
            </label>
            <div className="mt-1">
              <AmountInput id="deliver-amount" value={amount} onChange={setAmount} />
            </div>
            {!repaired && balance === 0 && (
              <p className="mt-1 text-[12.5px] text-muted-foreground">Si cobras la revisión, escribe el valor aquí.</p>
            )}
            {charge > 0 && charge < balance && (
              <p className="mt-1 text-[12.5px] text-status-review">Quedará debiendo {formatMoney(balance - charge)}.</p>
            )}
          </div>
          {charge > 0 && (
            <div>
              <p className="mb-1.5 text-[13.5px] font-semibold text-foreground/85">¿Cómo pagó?</p>
              <MethodPicker value={method} onChange={setMethod} idPrefix="deliver" />
            </div>
          )}
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? <Loader2 data-icon="inline-start" className="animate-spin" /> : charge > 0 ? <Check data-icon="inline-start" /> : <PackageCheck data-icon="inline-start" />}
              {charge > 0 ? `Cobrar y entregar` : 'Entregar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

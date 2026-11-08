'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Save } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field } from '@/components/intake/form-section'
import { StatusSelect } from './status-select'
import { BRANDS, DEVICE_TYPES, STATUS_MAP } from '@/lib/status'
import type { DeviceType, Order, OrderPatch } from '@/lib/types'

const BRAND_ITEMS = BRANDS.map((b) => ({ label: b, value: b }))
const TYPE_ITEMS = DEVICE_TYPES.map((d) => ({ label: d.label, value: d.value }))

export function OrderEditDialog({
  order,
  onClose,
  onSave,
}: {
  order: Order | null
  onClose: () => void
  onSave: (id: string, patch: OrderPatch) => Promise<Order>
}) {
  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto p-0 sm:max-w-2xl">
        {order && <EditForm key={order.id} order={order} onClose={onClose} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  )
}

function EditForm({
  order,
  onClose,
  onSave,
}: {
  order: Order
  onClose: () => void
  onSave: (id: string, patch: OrderPatch) => Promise<Order>
}) {
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    name: order.customer.name,
    phone: order.customer.phone,
    documentId: order.customer.documentId ?? '',
    email: order.customer.email ?? '',
    type: order.device.type as DeviceType,
    brand: order.device.brand,
    model: order.device.model,
    serial: order.device.serial ?? '',
    color: order.device.color ?? '',
    reportedFault: order.reportedFault,
    physicalNotes: order.physicalNotes ?? '',
    estimatedCost: String(order.estimatedCost ?? 0),
    deposit: String(order.deposit ?? 0),
    estimatedDate: order.estimatedDate ? order.estimatedDate.slice(0, 10) : '',
    technician: order.technician ?? '',
    status: order.status,
  })

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!form.name.trim()) nextErrors.name = 'Escribe el nombre del cliente.'
    if (!form.phone.trim()) nextErrors.phone = 'Escribe el WhatsApp del cliente.'
    if (!form.model.trim()) nextErrors.model = 'Escribe el modelo del equipo.'
    if (!form.reportedFault.trim()) nextErrors.reportedFault = 'Describe la falla reportada.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    const patch: OrderPatch = {
      customer: {
        name: form.name.trim(),
        phone: form.phone.trim(),
        documentId: form.documentId.trim() || undefined,
        email: form.email.trim() || undefined,
      },
      device: {
        type: form.type,
        brand: form.brand.trim(),
        model: form.model.trim(),
        serial: form.serial.trim() || undefined,
        color: form.color.trim() || undefined,
      },
      reportedFault: form.reportedFault.trim(),
      physicalNotes: form.physicalNotes.trim() || undefined,
      estimatedCost: Number(form.estimatedCost) || 0,
      deposit: Number(form.deposit) || 0,
      estimatedDate: form.estimatedDate || undefined,
      technician: form.technician.trim() || undefined,
      status: form.status,
    }

    setSaving(true)
    const promise = onSave(order.id, patch)
    toast.promise(promise, {
      loading: 'Guardando cambios...',
      success: 'Registro actualizado.',
      error: (e) => (e instanceof Error ? e.message : 'No se pudo guardar el registro.'),
    })
    try {
      await promise
      onClose()
    } catch {
      /* el toast ya muestra el error */
    } finally {
      setSaving(false)
    }
  }

  const typeMeta = DEVICE_TYPES.find((d) => d.value === form.type)
  const customBrand = form.type === 'celular' || form.type === 'accesorio'

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col">
      <div className="border-b border-border bg-secondary/40 p-5 md:p-6">
        <div className="flex items-center gap-2 text-primary">
          <Pencil className="size-4" aria-hidden="true" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Editar registro</span>
        </div>
        <DialogTitle className="mt-2 text-xl font-bold tracking-tight">{order.id}</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Corrige los datos del cliente, del equipo, los costos o el estado. Los cambios quedan en el
          historial y regeneran los comprobantes.
        </DialogDescription>
      </div>

      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground md:col-span-2">
          Cliente
        </h3>
        <Field label="Nombre completo" htmlFor="edit-name" required error={errors.name}>
          <Input id="edit-name" value={form.name} onChange={(e) => set('name', e.target.value)} className="h-10" />
        </Field>
        <Field label="WhatsApp" htmlFor="edit-phone" required error={errors.phone}>
          <Input
            id="edit-phone"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            className="h-10 font-mono"
          />
        </Field>
        <Field label="Documento" htmlFor="edit-document">
          <Input
            id="edit-document"
            value={form.documentId}
            onChange={(e) => set('documentId', e.target.value)}
            className="h-10"
          />
        </Field>
        <Field label="Correo" htmlFor="edit-email">
          <Input
            id="edit-email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className="h-10"
          />
        </Field>

        <h3 className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground md:col-span-2">
          Equipo
        </h3>
        <Field label="Tipo" htmlFor="edit-type">
          <Select items={TYPE_ITEMS} value={form.type} onValueChange={(v) => v && set('type', v as DeviceType)}>
            <SelectTrigger id="edit-type" className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEVICE_TYPES.map((d) => {
                const Icon = d.icon
                return (
                  <SelectItem key={d.value} value={d.value}>
                    <Icon className="size-4" aria-hidden="true" />
                    {d.label}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Marca" htmlFor="edit-brand">
          {customBrand ? (
            <Input id="edit-brand" value={form.brand} onChange={(e) => set('brand', e.target.value)} className="h-10" />
          ) : (
            <Select items={BRAND_ITEMS} value={form.brand} onValueChange={(v) => v && set('brand', String(v))}>
              <SelectTrigger id="edit-brand" className="h-10 w-full">
                <SelectValue placeholder="Selecciona la marca" />
              </SelectTrigger>
              <SelectContent>
                {BRANDS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label="Modelo" htmlFor="edit-model" required error={errors.model}>
          <Input id="edit-model" value={form.model} onChange={(e) => set('model', e.target.value)} className="h-10" />
        </Field>
        <Field label="Serial" htmlFor="edit-serial">
          <Input
            id="edit-serial"
            value={form.serial}
            onChange={(e) => set('serial', e.target.value)}
            className="h-10 font-mono"
          />
        </Field>
        <Field label="Color" htmlFor="edit-color">
          <Input id="edit-color" value={form.color} onChange={(e) => set('color', e.target.value)} className="h-10" />
        </Field>

        <h3 className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground md:col-span-2">
          Servicio
        </h3>
        <Field label="Falla reportada" htmlFor="edit-fault" required error={errors.reportedFault} className="md:col-span-2">
          <Textarea
            id="edit-fault"
            value={form.reportedFault}
            onChange={(e) => set('reportedFault', e.target.value)}
            rows={3}
          />
        </Field>
        <Field label="Notas del estado físico" htmlFor="edit-notes" className="md:col-span-2">
          <Textarea
            id="edit-notes"
            value={form.physicalNotes}
            onChange={(e) => set('physicalNotes', e.target.value)}
            rows={2}
          />
        </Field>
        <Field label="Costo estimado" htmlFor="edit-cost">
          <Input
            id="edit-cost"
            inputMode="numeric"
            value={form.estimatedCost}
            onChange={(e) => set('estimatedCost', e.target.value.replace(/[^\d]/g, ''))}
            className="h-10 font-mono"
          />
        </Field>
        <Field label="Abono" htmlFor="edit-deposit">
          <Input
            id="edit-deposit"
            inputMode="numeric"
            value={form.deposit}
            onChange={(e) => set('deposit', e.target.value.replace(/[^\d]/g, ''))}
            className="h-10 font-mono"
          />
        </Field>
        <Field label="Fecha estimada" htmlFor="edit-date">
          <Input
            id="edit-date"
            type="date"
            value={form.estimatedDate}
            onChange={(e) => set('estimatedDate', e.target.value)}
            className="h-10"
          />
        </Field>
        <Field label="Técnico" htmlFor="edit-technician">
          <Input
            id="edit-technician"
            value={form.technician}
            onChange={(e) => set('technician', e.target.value)}
            className="h-10"
          />
        </Field>
        <Field label="Estado" htmlFor="edit-status" hint={`Actual: ${STATUS_MAP[order.status].label}`}>
          <StatusSelect id="edit-status" value={form.status} onChange={(s) => set('status', s)} />
        </Field>
        <p className="text-xs text-muted-foreground md:col-span-2">
          {typeMeta ? `${typeMeta.label} · ` : ''}
          Si cambias el estado, se añade una entrada al historial y se avisa en el comprobante.
        </p>
      </div>

      <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-border bg-popover/95 p-4 backdrop-blur sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="h-9" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" className="h-9" disabled={saving}>
          <Save data-icon="inline-start" />
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}

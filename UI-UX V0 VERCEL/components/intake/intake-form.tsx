'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  UserRound,
  Gamepad,
  AlertTriangle,
  Package,
  Camera,
  Calculator,
  Loader2,
  ArrowRight,
  Plus,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormSection, ChipToggle, Field } from './form-section'
import { PhotoCapture } from './photo-capture'
import { IntakeSummary } from './intake-summary'
import { useOrders } from '@/hooks/use-orders'
import { ACCESSORIES, BRANDS, COMMON_FAULTS, DEVICE_TYPES } from '@/lib/status'
import { BUSINESS } from '@/lib/business'
import { openWhatsApp } from '@/lib/whatsapp'
import type { DeviceType, IntakePhoto, NewOrderInput } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface IntakeDraft {
  name: string
  phone: string
  documentId: string
  email: string
  deviceType: DeviceType
  brand: string
  model: string
  serial: string
  color: string
  reportedFault: string
  faultTags: string[]
  accessories: string[]
  physicalNotes: string
  photos: IntakePhoto[]
  estimatedCost: string
  deposit: string
  estimatedDate: string
  technician: string
  acceptedTerms: boolean
}

const EMPTY: IntakeDraft = {
  name: '',
  phone: '',
  documentId: '',
  email: '',
  deviceType: 'consola',
  brand: 'PlayStation',
  model: '',
  serial: '',
  color: '',
  reportedFault: '',
  faultTags: [],
  accessories: [],
  physicalNotes: '',
  photos: [],
  estimatedCost: '',
  deposit: '',
  estimatedDate: '',
  technician: BUSINESS.technicians[0],
  acceptedTerms: false,
}

type Errors = Partial<Record<keyof IntakeDraft, string>>

function validate(d: IntakeDraft): Errors {
  const errors: Errors = {}
  if (d.name.trim().length < 3) errors.name = 'Ingresa el nombre completo del cliente.'
  if (d.phone.replace(/\D/g, '').length < 7) errors.phone = 'Ingresa un número de WhatsApp válido.'
  if (!d.model.trim()) errors.model = 'Indica el modelo del equipo.'
  if (!d.reportedFault.trim() && d.faultTags.length === 0) errors.reportedFault = 'Describe la falla reportada.'
  if (!d.acceptedTerms) errors.acceptedTerms = 'El cliente debe aceptar las condiciones del servicio.'
  return errors
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

const BRAND_ITEMS = BRANDS.map((b) => ({ label: b, value: b }))
const TECH_ITEMS = BUSINESS.technicians.map((t) => ({ label: t, value: t }))

export function IntakeForm() {
  const router = useRouter()
  const { createOrder } = useOrders()
  const [draft, setDraft] = useState<IntakeDraft>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const [customAccessory, setCustomAccessory] = useState('')

  function set<K extends keyof IntakeDraft>(key: K, value: IntakeDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function addCustomAccessory() {
    const value = customAccessory.trim()
    if (!value || draft.accessories.includes(value)) return
    set('accessories', [...draft.accessories, value])
    setCustomAccessory('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const found = validate(draft)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      toast.error('Revisa los campos marcados antes de registrar.')
      document.getElementById(Object.keys(found)[0])?.focus()
      return
    }

    setSubmitting(true)
    const payload: NewOrderInput = {
      customer: {
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        documentId: draft.documentId.trim() || undefined,
        email: draft.email.trim() || undefined,
      },
      device: {
        type: draft.deviceType,
        brand: draft.brand,
        model: draft.model.trim(),
        serial: draft.serial.trim() || undefined,
        color: draft.color.trim() || undefined,
      },
      reportedFault: draft.reportedFault.trim() || draft.faultTags.join(', '),
      faultTags: draft.faultTags,
      accessories: draft.accessories,
      physicalNotes: draft.physicalNotes.trim() || undefined,
      photos: draft.photos,
      estimatedCost: Number(draft.estimatedCost) || 0,
      deposit: Number(draft.deposit) || 0,
      estimatedDate: draft.estimatedDate ? new Date(draft.estimatedDate).toISOString() : undefined,
      technician: draft.technician,
    }

    try {
      const order = await createOrder(payload)
      toast.success(`Orden ${order.id} registrada`, {
        description: `${order.device.brand} ${order.device.model} · ${order.customer.name}`,
        action: { label: 'Avisar por WhatsApp', onClick: () => openWhatsApp(order) },
        duration: 8000,
      })
      router.push(`/comprobantes?orden=${order.id}&tipo=recepcion`)
    } catch {
      toast.error('No se pudo registrar la orden. Intenta de nuevo.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        <FormSection step={1} icon={UserRound} title="Datos del cliente" description="A este número llegarán las notificaciones.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre completo" htmlFor="name" required error={errors.name}>
              <Input
                id="name"
                autoComplete="name"
                placeholder="Ej. Laura Martínez"
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                aria-invalid={!!errors.name}
                className="h-10"
              />
            </Field>
            <Field label="WhatsApp" htmlFor="phone" required error={errors.phone} hint={`Se usará el indicativo +${BUSINESS.countryCode}`}>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-sm text-muted-foreground">
                  +{BUSINESS.countryCode}
                </span>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="300 123 4567"
                  value={draft.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  aria-invalid={!!errors.phone}
                  className="h-10 pl-12 font-mono"
                />
              </div>
            </Field>
            <Field label="Documento" htmlFor="documentId">
              <Input
                id="documentId"
                inputMode="numeric"
                placeholder="C.C. / NIT"
                value={draft.documentId}
                onChange={(e) => set('documentId', e.target.value)}
                className="h-10"
              />
            </Field>
            <Field label="Correo" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="opcional@correo.com"
                value={draft.email}
                onChange={(e) => set('email', e.target.value)}
                className="h-10"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection step={2} icon={Gamepad} title="Equipo" description="Consola, control o accesorio que ingresa.">
          <fieldset className="mb-5">
            <legend className="mb-2 text-sm font-medium">Tipo de equipo</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DEVICE_TYPES.map(({ value, label, icon: Icon }) => {
                const active = draft.deviceType === value
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => set('deviceType', value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm font-medium transition-all',
                      active
                        ? 'border-primary bg-primary/10 text-foreground shadow-[0_0_0_1px] shadow-primary/40'
                        : 'border-border bg-secondary/30 text-muted-foreground hover:border-foreground/25 hover:text-foreground',
                    )}
                  >
                    <Icon className={cn('size-6', active && 'text-primary')} aria-hidden="true" />
                    {label}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Marca" htmlFor="brand" required>
              <Select items={BRAND_ITEMS} value={draft.brand} onValueChange={(v) => set('brand', String(v))}>
                <SelectTrigger id="brand" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRAND_ITEMS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Modelo" htmlFor="model" required error={errors.model}>
              <Input
                id="model"
                placeholder="Ej. PS5 Slim, DualSense, Switch OLED"
                value={draft.model}
                onChange={(e) => set('model', e.target.value)}
                aria-invalid={!!errors.model}
                className="h-10"
              />
            </Field>
            <Field label="Número de serie" htmlFor="serial">
              <Input
                id="serial"
                placeholder="S/N"
                value={draft.serial}
                onChange={(e) => set('serial', e.target.value)}
                className="h-10 font-mono uppercase"
              />
            </Field>
            <Field label="Color / edición" htmlFor="color">
              <Input
                id="color"
                placeholder="Ej. Blanco, Midnight Black"
                value={draft.color}
                onChange={(e) => set('color', e.target.value)}
                className="h-10"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection step={3} icon={AlertTriangle} title="Falla reportada" description="Toca las fallas comunes o descríbela con tus palabras.">
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Fallas comunes">
            {COMMON_FAULTS.map((fault) => (
              <ChipToggle
                key={fault}
                label={fault}
                selected={draft.faultTags.includes(fault)}
                onToggle={() => set('faultTags', toggle(draft.faultTags, fault))}
              />
            ))}
          </div>
          <Field label="Descripción del cliente" htmlFor="reportedFault" error={errors.reportedFault}>
            <Textarea
              id="reportedFault"
              rows={4}
              placeholder="¿Qué pasa con el equipo? ¿Desde cuándo? ¿Sufrió golpes o humedad?"
              value={draft.reportedFault}
              onChange={(e) => set('reportedFault', e.target.value)}
              aria-invalid={!!errors.reportedFault}
            />
          </Field>
        </FormSection>

        <FormSection step={4} icon={Package} title="Accesorios que deja" description="Todo lo que queda en custodia del taller.">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Accesorios">
            {[...ACCESSORIES, ...draft.accessories.filter((a) => !ACCESSORIES.includes(a))].map((item) => (
              <ChipToggle
                key={item}
                label={item}
                selected={draft.accessories.includes(item)}
                onToggle={() => set('accessories', toggle(draft.accessories, item))}
              />
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <label htmlFor="customAccessory" className="sr-only">
              Otro accesorio
            </label>
            <Input
              id="customAccessory"
              placeholder="Otro accesorio..."
              value={customAccessory}
              onChange={(e) => setCustomAccessory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return
                  e.preventDefault()
                  addCustomAccessory()
                }
              }}
              className="h-10"
            />
            <Button type="button" variant="outline" className="h-10" onClick={addCustomAccessory}>
              <Plus data-icon="inline-start" />
              Agregar
            </Button>
          </div>
          {draft.accessories.length === 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <X className="size-3.5" aria-hidden="true" />
              Sin accesorios: el equipo ingresa solo.
            </p>
          )}
        </FormSection>

        <FormSection step={5} icon={Camera} title="Estado físico" description="Fotografía rayones, golpes, sellos y puertos al recibir.">
          <PhotoCapture photos={draft.photos} onChange={(photos) => set('photos', photos)} />
          <Field label="Observaciones físicas" htmlFor="physicalNotes" className="mt-5">
            <Textarea
              id="physicalNotes"
              rows={3}
              placeholder="Ej. Rayón en tapa superior, falta tornillo trasero, sello de garantía roto."
              value={draft.physicalNotes}
              onChange={(e) => set('physicalNotes', e.target.value)}
            />
          </Field>
        </FormSection>

        <FormSection step={6} icon={Calculator} title="Presupuesto y asignación">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Costo estimado" htmlFor="estimatedCost" hint="Sujeto a diagnóstico">
              <MoneyInput id="estimatedCost" value={draft.estimatedCost} onChange={(v) => set('estimatedCost', v)} />
            </Field>
            <Field label="Abono recibido" htmlFor="deposit">
              <MoneyInput id="deposit" value={draft.deposit} onChange={(v) => set('deposit', v)} />
            </Field>
            <Field label="Entrega estimada" htmlFor="estimatedDate">
              <Input
                id="estimatedDate"
                type="date"
                value={draft.estimatedDate}
                onChange={(e) => set('estimatedDate', e.target.value)}
                className="h-10 [color-scheme:dark]"
              />
            </Field>
            <Field label="Técnico asignado" htmlFor="technician">
              <Select items={TECH_ITEMS} value={draft.technician} onValueChange={(v) => set('technician', String(v))}>
                <SelectTrigger id="technician" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TECH_ITEMS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div
            className={cn(
              'mt-5 flex items-start gap-3 rounded-xl border p-4',
              errors.acceptedTerms ? 'border-destructive/60 bg-destructive/5' : 'border-border bg-secondary/30',
            )}
          >
            <Checkbox
              id="acceptedTerms"
              checked={draft.acceptedTerms}
              onCheckedChange={(checked) => set('acceptedTerms', checked === true)}
              aria-invalid={!!errors.acceptedTerms}
              className="mt-0.5"
            />
            <label htmlFor="acceptedTerms" className="text-sm leading-relaxed text-muted-foreground">
              El cliente acepta las condiciones del servicio: el diagnóstico puede modificar el costo estimado y los
              equipos no reclamados en 60 días podrán generar cobro por bodegaje.
            </label>
          </div>
        </FormSection>
      </div>

      <IntakeSummary draft={draft} submitting={submitting}>
        <Button type="submit" size="lg" disabled={submitting} className="h-12 w-full text-base font-semibold">
          {submitting ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : null}
          {submitting ? 'Registrando...' : 'Registrar ingreso'}
          {!submitting && <ArrowRight data-icon="inline-end" />}
        </Button>
      </IntakeSummary>
    </form>
  )
}

function MoneyInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">$</span>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="0"
        value={value ? Number(value).toLocaleString(BUSINESS.locale) : ''}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        className="h-10 pl-7 font-mono"
      />
    </div>
  )
}

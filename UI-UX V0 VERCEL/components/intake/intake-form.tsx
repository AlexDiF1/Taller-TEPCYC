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
import { uploadPhoto } from '@/lib/api'
import { ACCESSORIES, BRANDS, CONSOLE_MODELS, CUSTOM_DEVICE_TYPES, DEVICE_TYPES } from '@/lib/status'
import { BUSINESS } from '@/lib/business'
import { openWhatsApp } from '@/lib/whatsapp'
import type { DeviceType, IntakePhoto, NewOrderInput } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface IntakeDraft {
  name: string
  phone: string
  documentId: string
  deviceType: DeviceType
  brand: string
  model: string
  serial: string
  color: string
  reportedFault: string
  accessories: string[]
  physicalNotes: string
  photos: IntakePhoto[]
  estimatedCost: string
  deposit: string
  estimatedDate: string
  acceptedTerms: boolean
}

const EMPTY: IntakeDraft = {
  name: '',
  phone: '',
  documentId: '',
  deviceType: 'consola',
  brand: 'PlayStation',
  model: '',
  serial: '',
  color: '',
  reportedFault: '',
  accessories: [],
  physicalNotes: '',
  photos: [],
  estimatedCost: '',
  deposit: '',
  estimatedDate: '',
  acceptedTerms: false,
}

type Errors = Partial<Record<keyof IntakeDraft, string>>

function isCustomDevice(type: DeviceType) {
  return CUSTOM_DEVICE_TYPES.includes(type)
}

function validate(d: IntakeDraft): Errors {
  const errors: Errors = {}
  if (d.name.trim().length < 3) errors.name = 'Ingresa el nombre completo del cliente.'
  if (d.phone.replace(/\D/g, '').length < 7) errors.phone = 'Ingresa un número de WhatsApp válido.'
  if (!d.brand.trim()) errors.brand = 'Indica la marca del equipo.'
  if (!d.model.trim()) errors.model = 'Indica el modelo del equipo.'
  if (!d.reportedFault.trim()) errors.reportedFault = 'Describe la falla reportada.'
  if (!d.acceptedTerms) errors.acceptedTerms = 'El cliente debe aceptar las condiciones del servicio.'
  return errors
}

const BRAND_ITEMS = BRANDS.map((b) => ({ label: b, value: b }))

export function IntakeForm() {
  const router = useRouter()
  const { createOrder } = useOrders()
  const [draft, setDraft] = useState<IntakeDraft>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const [customAccessory, setCustomAccessory] = useState('')
  const [freeModel, setFreeModel] = useState(false)

  const customDevice = isCustomDevice(draft.deviceType)
  const models = CONSOLE_MODELS[draft.brand] ?? []
  const useModelSelect = !customDevice && !freeModel && models.length > 0

  function set<K extends keyof IntakeDraft>(key: K, value: IntakeDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function selectDeviceType(type: DeviceType) {
    setFreeModel(false)
    setDraft((d) => ({
      ...d,
      deviceType: type,
      brand: isCustomDevice(type) ? '' : CONSOLE_MODELS[d.brand] ? d.brand : BRANDS[0],
      model: '',
    }))
  }

  function selectBrand(brand: string) {
    setFreeModel(false)
    setDraft((d) => ({ ...d, brand, model: '' }))
    if (errors.brand) setErrors((e) => ({ ...e, brand: undefined }))
  }

  /** «Nada» es un accesorio más de la lista: se activa y se desactiva con el chip. */
  function toggleAccessory(item: string) {
    const selected = draft.accessories.includes(item)
    set('accessories', selected ? draft.accessories.filter((a) => a !== item) : [...draft.accessories, item])
  }

  function addCustomAccessory() {
    const value = customAccessory.trim()
    if (!value || draft.accessories.includes(value)) return
    // Un accesorio real descarta «Nada»: no pueden coexistir.
    set('accessories', [...draft.accessories.filter((a) => !ACCESSORIES.includes(a)), value])
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
      },
      device: {
        type: draft.deviceType,
        brand: draft.brand.trim(),
        model: draft.model.trim(),
        serial: draft.serial.trim() || undefined,
        color: draft.color.trim() || undefined,
      },
      reportedFault: draft.reportedFault.trim(),
      faultTags: [],
      accessories: draft.accessories,
      physicalNotes: draft.physicalNotes.trim() || undefined,
      photos: [],
      estimatedCost: Number(draft.estimatedCost) || 0,
      deposit: Number(draft.deposit) || 0,
      estimatedDate: draft.estimatedDate ? new Date(draft.estimatedDate).toISOString() : undefined,
    }

    try {
      const photos = await Promise.all(
        draft.photos.map(async (photo) => ({ ...photo, url: await uploadPhoto(photo.url) })),
      )
      const order = await createOrder({ ...payload, photos })
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
    <form onSubmit={handleSubmit} noValidate className="grid gap-6 xl:grid-cols-12">
      {/* Columna Izquierda / Principal: Datos del cliente y del equipo */}
      <div className="flex min-w-0 flex-col gap-6 xl:col-span-7">
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
                className="h-10 rounded-xl"
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
                  className="h-10 rounded-xl pl-12 font-mono"
                />
              </div>
            </Field>
            <Field label="Documento" htmlFor="documentId" className="sm:col-span-2 sm:max-w-[50%]">
              <Input
                id="documentId"
                inputMode="numeric"
                placeholder="C.C. / NIT"
                value={draft.documentId}
                onChange={(e) => set('documentId', e.target.value)}
                className="h-10 rounded-xl"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection step={2} icon={Gamepad} title="Equipo" description="Consola, control, celular o accesorio que ingresa.">
          <fieldset className="mb-5">
            <legend className="mb-2 text-sm font-medium">Tipo de equipo</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {DEVICE_TYPES.map(({ value, label, icon: Icon }) => {
                const active = draft.deviceType === value
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectDeviceType(value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-all duration-200',
                      active
                        ? 'border-primary bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/40'
                        : 'border-border/80 bg-background/40 text-muted-foreground hover:border-foreground/20 hover:text-foreground',
                    )}
                  >
                    <Icon className={cn('size-5', active ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                    {label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            {customDevice ? (
              <Field label="Marca" htmlFor="brand" required error={errors.brand} hint="Escríbela tú mismo">
                <Input
                  id="brand"
                  placeholder="Ej. Samsung, Xiaomi, Genérico"
                  value={draft.brand}
                  onChange={(e) => selectBrand(e.target.value)}
                  aria-invalid={!!errors.brand}
                  className="h-10 rounded-xl"
                />
              </Field>
            ) : (
              <Field label="Marca" htmlFor="brand" required error={errors.brand}>
                <Select items={BRAND_ITEMS} value={draft.brand} onValueChange={(v) => v && selectBrand(String(v))}>
                  <SelectTrigger id="brand" className="h-10 w-full rounded-xl">
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
            )}

            <Field
              label="Modelo"
              htmlFor="model"
              required
              error={errors.model}
              hint={customDevice ? 'Escríbelo tú mismo' : undefined}
            >
              {useModelSelect ? (
                <Select
                  items={models.map((m) => ({ label: m, value: m }))}
                  value={models.includes(draft.model) ? draft.model : null}
                  onValueChange={(v) => {
                    if (String(v) === '__otro__') {
                      set('model', '')
                      setFreeModel(true)
                      return
                    }
                    set('model', String(v))
                  }}
                >
                  <SelectTrigger id="model" className="h-10 w-full rounded-xl">
                    <SelectValue placeholder="Selecciona el modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                    <SelectItem value="__otro__">Otro modelo…</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="model"
                  placeholder={customDevice ? 'Ej. Galaxy A54, Redmi Note 12' : 'Ej. Xbox Series X, Switch OLED'}
                  value={draft.model}
                  onChange={(e) => set('model', e.target.value)}
                  aria-invalid={!!errors.model}
                  className="h-10 rounded-xl"
                />
              )}
            </Field>

            <Field label="Número de serie" htmlFor="serial">
              <Input
                id="serial"
                placeholder="S/N"
                value={draft.serial}
                onChange={(e) => set('serial', e.target.value)}
                className="h-10 rounded-xl font-mono uppercase"
              />
            </Field>
            <Field label="Color / edición" htmlFor="color">
              <Input
                id="color"
                placeholder="Ej. Blanco, Midnight Black"
                value={draft.color}
                onChange={(e) => set('color', e.target.value)}
                className="h-10 rounded-xl"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection step={3} icon={AlertTriangle} title="Falla reportada" description="Describe con tus palabras qué presenta el equipo.">
          <Field label="Descripción del cliente" htmlFor="reportedFault" required error={errors.reportedFault}>
            <Textarea
              id="reportedFault"
              rows={3}
              placeholder="¿Qué pasa con el equipo? ¿Desde cuándo? ¿Sufrió golpes o humedad?"
              value={draft.reportedFault}
              onChange={(e) => set('reportedFault', e.target.value)}
              aria-invalid={!!errors.reportedFault}
              className="rounded-xl"
            />
          </Field>
        </FormSection>

        <FormSection step={4} icon={Package} title="Accesorios que deja" description="Escribe cada accesorio que queda en custodia del taller.">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Accesorios">
            {ACCESSORIES.map((item) => (
              <ChipToggle
                key={item}
                label={item}
                selected={draft.accessories.includes(item)}
                onToggle={() => toggleAccessory(item)}
              />
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <label htmlFor="customAccessory" className="sr-only">
              Accesorio
            </label>
            <Input
              id="customAccessory"
              placeholder="Escribe un accesorio y presiona Agregar"
              value={customAccessory}
              onChange={(e) => setCustomAccessory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return
                  e.preventDefault()
                  addCustomAccessory()
                }
              }}
              className="h-10 rounded-xl"
            />
            <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={addCustomAccessory}>
              <Plus data-icon="inline-start" />
              Agregar
            </Button>
          </div>
          {draft.accessories.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {draft.accessories.map((item) => (
                <li
                  key={item}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/60 bg-primary/12 px-3 py-1 text-xs text-primary"
                >
                  {item}
                  <button
                    type="button"
                    className="text-primary/70 transition-colors hover:text-primary"
                    onClick={() => set('accessories', draft.accessories.filter((a) => a !== item))}
                    aria-label={`Quitar ${item}`}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </FormSection>

        <FormSection step={6} icon={Calculator} title="Presupuesto">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Costo estimado" htmlFor="estimatedCost" hint="Sujeto a diagnóstico">
              <MoneyInput id="estimatedCost" value={draft.estimatedCost} onChange={(v) => set('estimatedCost', v)} />
            </Field>
            <Field label="Abono recibido" htmlFor="deposit">
              <MoneyInput id="deposit" value={draft.deposit} onChange={(v) => set('deposit', v)} />
            </Field>
            <Field label="Entrega estimada" htmlFor="estimatedDate" className="sm:col-span-2">
              <Input
                id="estimatedDate"
                type="date"
                value={draft.estimatedDate}
                onChange={(e) => set('estimatedDate', e.target.value)}
                className="h-10 rounded-xl [color-scheme:dark]"
              />
            </Field>
          </div>

          <div
            className={cn(
              'mt-5 flex items-start gap-3 rounded-xl border p-4 transition-colors',
              errors.acceptedTerms ? 'border-destructive/60 bg-destructive/5' : 'border-border/80 bg-background/40',
            )}
          >
            <Checkbox
              id="acceptedTerms"
              checked={draft.acceptedTerms}
              onCheckedChange={(checked) => set('acceptedTerms', checked === true)}
              aria-invalid={!!errors.acceptedTerms}
              className="mt-0.5 rounded-md"
            />
            <label htmlFor="acceptedTerms" className="text-xs leading-relaxed text-muted-foreground">
              El cliente acepta las condiciones del servicio: el diagnóstico puede modificar el costo estimado y los
              equipos no reclamados en 60 días podrán generar cobro por bodegaje.
            </label>
          </div>
        </FormSection>
      </div>

      {/* Columna Derecha / Cámara + Panel de Resumen Fijo */}
      <div className="flex flex-col gap-6 xl:col-span-5">
        <FormSection step={5} icon={Camera} title="Estado físico" description="Fotografía rayones, golpes, sellos y puertos al recibir.">
          <PhotoCapture photos={draft.photos} onChange={(photos) => set('photos', photos)} />
          <Field label="Observaciones físicas" htmlFor="physicalNotes" className="mt-5">
            <Textarea
              id="physicalNotes"
              rows={2}
              placeholder="Ej. Rayón en tapa superior, falta tornillo trasero, sello de garantía roto."
              value={draft.physicalNotes}
              onChange={(e) => set('physicalNotes', e.target.value)}
              className="rounded-xl"
            />
          </Field>
        </FormSection>

        <IntakeSummary draft={draft} submitting={submitting}>
          <Button type="submit" size="lg" disabled={submitting} className="h-11 w-full rounded-xl text-sm font-semibold shadow-md">
            {submitting ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : null}
            {submitting ? 'Registrando...' : 'Registrar ingreso'}
            {!submitting && <ArrowRight data-icon="inline-end" className="size-4" />}
          </Button>
        </IntakeSummary>
      </div>
    </form>
  )
}

function MoneyInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-sm text-muted-foreground">$</span>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="0"
        value={value ? Number(value).toLocaleString(BUSINESS.locale) : ''}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        className="h-10 rounded-xl pl-7 font-mono"
      />
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
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
  Inbox,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormSection, ChipToggle, Field } from './form-section'
import { PhotoCapture } from './photo-capture'
import { MethodPicker } from '@/components/orders/payment-dialogs'
import { IntakeSummary } from './intake-summary'
import { CustomerHistoryCard } from './customer-history'
import { useOrderActions } from '@/hooks/use-orders'
import { findCustomer, getSolicitud, uploadPhoto } from '@/lib/api'
import { deviceFromSolicitud, localPhone } from '@/lib/solicitudes'
import { ACCESSORIES, BRANDS, CONSOLE_MODELS, CUSTOM_DEVICE_TYPES, DEVICE_TYPES, deviceLabel } from '@/lib/status'
import { BUSINESS, formatMoney } from '@/lib/business'
import { openWhatsApp } from '@/lib/whatsapp'
import type { CustomerHistory, DeviceType, IntakePhoto, NewOrderInput, PaymentMethod, Solicitud } from '@/lib/types'
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
  /** Cómo pagó el abono: queda como el primer pago de la orden. */
  depositMethod: PaymentMethod | ''
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
  depositMethod: '',
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
  if (Number(d.deposit) > 0 && !d.depositMethod) errors.depositMethod = 'Elige cómo pagó el abono.'
  if (!d.acceptedTerms) errors.acceptedTerms = 'El cliente debe aceptar las condiciones del servicio.'
  return errors
}

const BRAND_ITEMS = BRANDS.map((b) => ({ label: b, value: b }))

export function IntakeForm({ solicitudId }: { solicitudId?: number } = {}) {
  const router = useRouter()
  const { createOrder } = useOrderActions()
  const [draft, setDraft] = useState<IntakeDraft>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const [customAccessory, setCustomAccessory] = useState('')
  const [freeModel, setFreeModel] = useState(false)
  /** Solicitud de la web que se está convirtiendo en orden. */
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null)
  /** Cliente que ya vino antes con ese teléfono. */
  const [history, setHistory] = useState<CustomerHistory | null>(null)
  /** Lo que puso la búsqueda por teléfono (para cambiarlo si cambian el número). */
  const autoFilled = useRef({ name: '', documentId: '' })

  // «Convertir en orden»: se rellena el ingreso con lo que el cliente escribió en la web.
  useEffect(() => {
    if (!solicitudId) return
    let vigente = true
    getSolicitud(solicitudId)
      .then((s) => {
        if (!vigente) return
        if (s.status === 'convertida') {
          toast.info(`Esa solicitud ya es la orden ${s.orderId}.`)
          return
        }
        const equipo = deviceFromSolicitud(s.device, s.model)
        setSolicitud(s)
        setFreeModel(equipo.freeModel)
        setDraft((d) => ({
          ...d,
          name: s.name || d.name,
          phone: s.phone ? localPhone(s.phone) : d.phone,
          deviceType: equipo.deviceType,
          brand: equipo.brand,
          model: equipo.model,
          reportedFault: [s.fault, s.since ? `(Falla desde: ${s.since})` : ''].filter(Boolean).join(' '),
        }))
      })
      .catch(() => vigente && toast.error('No se encontró la solicitud de la web.'))
    return () => {
      vigente = false
    }
  }, [solicitudId])

  // Clientes recurrentes: con el número completo se buscan sus órdenes anteriores.
  const phoneDigits = draft.phone.replace(/\D/g, '')
  useEffect(() => {
    if (phoneDigits.length < 10) {
      setHistory(null)
      return
    }
    let vigente = true
    const timer = setTimeout(() => {
      findCustomer(phoneDigits)
        .then((found) => {
          if (!vigente) return
          setHistory(found.customer ? found : null)
          // Si el nombre está vacío (o lo puso esta búsqueda con otro número) se pone el que ya
          // tenía; si lo escribieron a mano, se respeta.
          const auto = autoFilled.current
          const name = found.customer?.name ?? ''
          const documentId = found.customer?.documentId ?? ''
          const replace = (value: string, previous: string) => !value.trim() || (previous !== '' && value === previous)
          setDraft((d) => ({
            ...d,
            name: replace(d.name, auto.name) ? name : d.name,
            documentId: replace(d.documentId, auto.documentId) ? documentId : d.documentId,
          }))
          autoFilled.current = { name, documentId }
        })
        .catch(() => vigente && setHistory(null))
    }, 400)
    return () => {
      vigente = false
      clearTimeout(timer)
    }
  }, [phoneDigits])

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
    if (submitting) return
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
      depositMethod: Number(draft.deposit) > 0 && draft.depositMethod ? draft.depositMethod : undefined,
      estimatedDate: draft.estimatedDate ? new Date(draft.estimatedDate).toISOString() : undefined,
      solicitudId: solicitud?.id,
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
      router.push(`/orden/${encodeURIComponent(order.id)}?recibo=recepcion`)
    } catch (error) {
      const detail = error instanceof Error && /solicitud/i.test(error.message) ? error.message : 'Intenta de nuevo.'
      toast.error('No se pudo registrar la orden.', { description: detail })
      setSubmitting(false)
    }
  }

  const cost = Number(draft.estimatedCost) || 0
  const saldo = Math.max(cost - (Number(draft.deposit) || 0), 0)
  const deviceText = deviceLabel({ brand: draft.brand, model: draft.model })

  const submitButton = (className?: string) => (
    <Button type="submit" size="lg" disabled={submitting} className={cn('h-12 rounded-xl text-[15px] font-bold', className)}>
      {submitting ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
      {submitting ? 'Registrando…' : 'Registrar ingreso'}
      {!submitting && <ArrowRight data-icon="inline-end" className="size-4" />}
    </Button>
  )

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4 md:gap-6 xl:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-4 md:gap-6 xl:col-span-7">
        {solicitud && (
          <div className="flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/8 p-3.5">
            <Inbox className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-[14px] leading-snug">
              <b className="font-bold">Desde la solicitud {solicitud.ref} de la web.</b>{' '}
              <span className="text-muted-foreground">
                Revisa los datos con el equipo en la mano{solicitud.phone ? '' : ' y escribe su WhatsApp'}.
              </span>
            </p>
            <button
              type="button"
              onClick={() => setSolicitud(null)}
              className="-m-1.5 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"
              aria-label="No marcar la solicitud como convertida"
              title="Registrar sin marcar la solicitud"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
        {/* ---------- 1. Cliente ---------- */}
        <FormSection step={1} icon={UserRound} title="Cliente" description="A su WhatsApp llegan los avisos de la orden.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre completo" htmlFor="name" required error={errors.name}>
              <Input
                id="name"
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                placeholder="Ej. Laura Martínez"
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                aria-invalid={!!errors.name}
              />
            </Field>
            <Field label="WhatsApp" htmlFor="phone" required error={errors.phone}>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[15px] font-semibold text-muted-foreground">
                  +{BUSINESS.countryCode}
                </span>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  enterKeyHint="next"
                  placeholder="300 123 4567"
                  value={draft.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  aria-invalid={!!errors.phone}
                  className="tabular pl-13"
                />
              </div>
            </Field>
            {history && (
              <CustomerHistoryCard
                history={history}
                currentName={draft.name}
                onUseName={(name) => set('name', name)}
                className="sm:col-span-2"
              />
            )}
            <Field label="Documento" htmlFor="documentId" hint="Opcional" className="sm:col-span-2 sm:max-w-[50%]">
              <Input
                id="documentId"
                inputMode="numeric"
                placeholder="C.C. / NIT"
                value={draft.documentId}
                onChange={(e) => set('documentId', e.target.value)}
              />
            </Field>
          </div>
        </FormSection>

        {/* ---------- 2. Equipo ---------- */}
        <FormSection step={2} icon={Gamepad} title="Equipo" description="Qué deja el cliente en el taller.">
          <fieldset className="mb-5">
            <legend className="sr-only">Tipo de equipo</legend>
            <div className="grid grid-cols-5 gap-1">
              {DEVICE_TYPES.map(({ value, label, icon: Icon }) => {
                const active = draft.deviceType === value
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectDeviceType(value)}
                    className={cn(
                      'flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border px-0.5 py-3 text-[11px] font-bold tracking-tight transition-colors',
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-surface text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="size-6" aria-hidden="true" />
                    <span className="max-w-full truncate">{label}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-4">
            {customDevice ? (
              <Field label="Marca" htmlFor="brand" required error={errors.brand}>
                <Input
                  id="brand"
                  placeholder="Ej. Samsung, Xiaomi, Genérico"
                  value={draft.brand}
                  onChange={(e) => selectBrand(e.target.value)}
                  aria-invalid={!!errors.brand}
                />
              </Field>
            ) : (
              <div className="flex flex-col gap-1.5">
                <span id="brand-label" className="text-[13.5px] font-semibold text-foreground/85">
                  Marca <span className="text-primary">*</span>
                </span>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="brand-label">
                  {BRAND_ITEMS.map((b) => (
                    <ChipToggle
                      key={b.value}
                      label={b.label}
                      selected={draft.brand === b.value}
                      onToggle={() => selectBrand(b.value)}
                    />
                  ))}
                </div>
                {errors.brand && <p className="text-[13px] font-medium text-destructive">{errors.brand}</p>}
              </div>
            )}

            {useModelSelect ? (
              <div className="flex flex-col gap-1.5">
                <span id="model-label" className="text-[13.5px] font-semibold text-foreground/85">
                  Modelo <span className="text-primary">*</span>
                </span>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="model-label">
                  {models.map((m) => (
                    <ChipToggle key={m} label={m} selected={draft.model === m} onToggle={() => set('model', m)} />
                  ))}
                  <ChipToggle
                    label="Otro…"
                    selected={false}
                    onToggle={() => {
                      set('model', '')
                      setFreeModel(true)
                      setTimeout(() => document.getElementById('model')?.focus(), 30)
                    }}
                    className="border-dashed"
                  />
                </div>
                {/* ancla para el foco de la validación */}
                <input id="model" className="sr-only" tabIndex={-1} readOnly value={draft.model} aria-hidden="true" />
                {errors.model && <p className="text-[13px] font-medium text-destructive">{errors.model}</p>}
              </div>
            ) : (
              <Field label="Modelo" htmlFor="model" required error={errors.model}>
                <Input
                  id="model"
                  placeholder={customDevice ? 'Ej. Galaxy A54, Redmi Note 12' : 'Escribe el modelo'}
                  value={draft.model}
                  onChange={(e) => set('model', e.target.value)}
                  aria-invalid={!!errors.model}
                />
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Serial" htmlFor="serial" hint="Opcional">
                <Input
                  id="serial"
                  placeholder="S/N"
                  autoCapitalize="characters"
                  value={draft.serial}
                  onChange={(e) => set('serial', e.target.value)}
                  className="font-mono uppercase"
                />
              </Field>
              <Field label="Color / edición" htmlFor="color" hint="Opcional">
                <Input id="color" placeholder="Ej. Blanco" value={draft.color} onChange={(e) => set('color', e.target.value)} />
              </Field>
            </div>
          </div>
        </FormSection>

        {/* ---------- 3. Falla ---------- */}
        <FormSection step={3} icon={AlertTriangle} title="Falla" description="Lo que el cliente dice que tiene el equipo.">
          <Field label="Descripción" htmlFor="reportedFault" required error={errors.reportedFault}>
            <Textarea
              id="reportedFault"
              rows={3}
              placeholder="¿Qué pasa? ¿Desde cuándo? ¿Golpes o humedad?"
              value={draft.reportedFault}
              onChange={(e) => set('reportedFault', e.target.value)}
              aria-invalid={!!errors.reportedFault}
            />
          </Field>
        </FormSection>

        {/* ---------- 4. Fotos ---------- */}
        {photosSection()}

        {/* ---------- 5. Accesorios ---------- */}
        <FormSection step={5} icon={Package} title="Accesorios" description="Lo que queda en custodia del taller.">
          <div className="flex gap-2">
            <label htmlFor="customAccessory" className="sr-only">
              Accesorio
            </label>
            <Input
              id="customAccessory"
              placeholder="Ej. Cable HDMI, control, estuche"
              enterKeyHint="done"
              value={customAccessory}
              onChange={(e) => setCustomAccessory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return
                  e.preventDefault()
                  addCustomAccessory()
                }
              }}
            />
            <Button type="button" variant="outline" className="h-11 shrink-0 px-3.5" onClick={addCustomAccessory} aria-label="Agregar accesorio">
              <Plus className="size-5" />
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Accesorios">
            {ACCESSORIES.filter((item) => !draft.accessories.includes(item)).map((item) => (
              <ChipToggle key={item} label={`Sin accesorios (${item})`} selected={false} onToggle={() => toggleAccessory(item)} />
            ))}
            {draft.accessories.map((item) => (
              <span
                key={item}
                className="inline-flex h-10 items-center gap-1 rounded-full bg-foreground pr-1.5 pl-3.5 text-[14px] font-semibold text-background"
              >
                {item}
                <button
                  type="button"
                  className="grid size-7 place-items-center rounded-full opacity-70 transition-opacity hover:opacity-100"
                  onClick={() => set('accessories', draft.accessories.filter((a) => a !== item))}
                  aria-label={`Quitar ${item}`}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        </FormSection>

        {/* ---------- 6. Presupuesto ---------- */}
        <FormSection step={6} icon={Calculator} title="Presupuesto" description="Sujeto a diagnóstico.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Costo estimado" htmlFor="estimatedCost">
              <MoneyInput id="estimatedCost" value={draft.estimatedCost} onChange={(v) => set('estimatedCost', v)} />
            </Field>
            <Field label="Abono" htmlFor="deposit">
              <MoneyInput id="deposit" value={draft.deposit} onChange={(v) => set('deposit', v)} />
            </Field>
            {Number(draft.deposit) > 0 && (
              <Field label="¿Cómo pagó el abono?" htmlFor="dep-efectivo" className="col-span-2" required error={errors.depositMethod}>
                <MethodPicker value={draft.depositMethod} onChange={(m) => set('depositMethod', m)} idPrefix="dep" />
              </Field>
            )}
            <Field label="Entrega estimada" htmlFor="estimatedDate" className="col-span-2">
              <Input
                id="estimatedDate"
                type="date"
                value={draft.estimatedDate}
                onChange={(e) => set('estimatedDate', e.target.value)}
              />
            </Field>
          </div>

          <label
            htmlFor="acceptedTerms"
            className={cn(
              'mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors',
              errors.acceptedTerms ? 'border-destructive/60 bg-destructive/6' : 'border-border bg-surface-2',
              draft.acceptedTerms && 'border-status-done/50 bg-status-done/8',
            )}
          >
            <Checkbox
              id="acceptedTerms"
              checked={draft.acceptedTerms}
              onCheckedChange={(checked) => set('acceptedTerms', checked === true)}
              aria-invalid={!!errors.acceptedTerms}
              className="mt-0.5 size-5 rounded-md"
            />
            <span className="text-[13.5px] leading-relaxed text-foreground/85">
              <b className="font-bold">El cliente acepta las condiciones:</b> el diagnóstico puede cambiar el costo estimado
              y los equipos no reclamados en 60 días pueden generar cobro por bodegaje.
            </span>
          </label>
          {errors.acceptedTerms && <p className="mt-2 text-[13px] font-medium text-destructive">{errors.acceptedTerms}</p>}
        </FormSection>
      </div>

      {/* ---------- escritorio: resumen fijo ---------- */}
      <div className="hidden flex-col gap-6 xl:col-span-5 xl:flex">
        <IntakeSummary draft={draft} submitting={submitting}>
          {submitButton('w-full')}
        </IntakeSummary>
      </div>

      {/* ---------- móvil: barra fija para registrar ---------- */}
      <div className="fixed inset-x-0 bottom-[calc(66px+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background/95 px-4 py-2.5 backdrop-blur-md lg:bottom-0 xl:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[14px] font-bold">{deviceText || 'Equipo sin definir'}</p>
            <p className="truncate text-[12.5px] text-muted-foreground">
              {cost ? `Saldo ${formatMoney(saldo)}` : draft.name || 'Completa los datos'}
              {draft.photos.length > 0 && ` · ${draft.photos.length} foto${draft.photos.length === 1 ? '' : 's'}`}
            </p>
          </div>
          {submitButton('shrink-0 px-5')}
        </div>
      </div>
    </form>
  )

  function photosSection() {
    return (
      <FormSection step={4} icon={Camera} title="Estado físico" description="Fotos de rayones, golpes, sellos y puertos.">
        <PhotoCapture photos={draft.photos} onChange={(photos) => set('photos', photos)} />
        <Field label="Observaciones" htmlFor="physicalNotes" className="mt-4">
          <Textarea
            id="physicalNotes"
            rows={2}
            placeholder="Ej. Rayón en tapa superior, falta tornillo trasero."
            value={draft.physicalNotes}
            onChange={(e) => set('physicalNotes', e.target.value)}
          />
        </Field>
      </FormSection>
    )
  }
}

function MoneyInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[15px] font-semibold text-muted-foreground">
        $
      </span>
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

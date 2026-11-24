'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { ChevronRight, Inbox, ShoppingBag, TriangleAlert, Wrench } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { getCashSummary, type CashMovement } from '@/lib/api'
import { PAYMENT_METHODS, PAYMENT_MAP } from '@/lib/ventas'
import { BUSINESS, formatMoney } from '@/lib/business'
import { cn } from '@/lib/utils'

type Preset = 'hoy' | 'ayer' | 'semana' | 'mes' | 'rango'

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'ayer', label: 'Ayer' },
  { value: 'semana', label: '7 días' },
  { value: 'mes', label: 'Este mes' },
  { value: 'rango', label: 'Elegir fechas' },
]

/** «2026-11-23» en la hora del teléfono (no en UTC). */
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOf(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

function endOf(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999)
}

/** Días [desde, hasta] (en la hora local) de cada atajo. */
function presetDays(preset: Preset, custom: { from: string; to: string }) {
  const today = new Date()
  const shift = (n: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() + n)
    return ymd(d)
  }
  switch (preset) {
    case 'hoy':
      return { from: ymd(today), to: ymd(today) }
    case 'ayer':
      return { from: shift(-1), to: shift(-1) }
    case 'semana':
      return { from: shift(-6), to: ymd(today) }
    case 'mes':
      return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(today) }
    default:
      return custom
  }
}

function dayLabel(day: string) {
  return new Intl.DateTimeFormat(BUSINESS.locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(startOf(day))
}

function timeLabel(iso: string, withDay: boolean) {
  return new Intl.DateTimeFormat(BUSINESS.locale, {
    ...(withDay ? { day: 'numeric', month: 'short' } : {}),
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function CajaDashboard() {
  const [preset, setPreset] = useState<Preset>('hoy')
  const [custom, setCustom] = useState(() => ({ from: ymd(new Date()), to: ymd(new Date()) }))
  const days = presetDays(preset, custom)
  const valid = Boolean(days.from && days.to && days.from <= days.to)
  const range = useMemo(
    () => (valid ? { from: startOf(days.from).toISOString(), to: endOf(days.to).toISOString() } : null),
    [valid, days.from, days.to],
  )
  const { data, error, isLoading } = useSWR(range ? ['caja', range.from, range.to] : null, () =>
    getCashSummary(range!.from, range!.to),
  )
  const oneDay = days.from === days.to
  const title = oneDay ? (preset === 'hoy' ? 'Hoy' : dayLabel(days.from)) : `${dayLabel(days.from)} – ${dayLabel(days.to)}`
  const maxMethod = Math.max(1, ...Object.values(data?.byMethod ?? {}))

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-4 md:px-8 md:py-8">
      <div className="hidden lg:block">
        <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-primary">Negocio</p>
        <h1 className="mt-1 text-[32px] font-extrabold tracking-tight">Caja del día</h1>
        <p className="mt-1 text-[14.5px] text-muted-foreground">Lo que entró: ventas y pagos de reparaciones, por método de pago.</p>
      </div>

      {/* ---------- rango ---------- */}
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Periodo">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={preset === p.value}
            onClick={() => setPreset(p.value)}
            className={cn(
              'h-10 shrink-0 rounded-full border px-4 text-[14px] font-semibold transition-colors',
              preset === p.value ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-foreground/80',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'rango' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-foreground/80">
            Desde
            <Input type="date" value={custom.from} max={custom.to || undefined} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-foreground/80">
            Hasta
            <Input type="date" value={custom.to} min={custom.from || undefined} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
          </label>
          {!valid && <p className="col-span-2 text-[13px] text-destructive">La fecha «desde» debe ser anterior o igual a «hasta».</p>}
        </div>
      )}

      {error ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
          <TriangleAlert className="size-8 text-destructive" aria-hidden="true" />
          <p className="font-bold">No se pudo cargar la caja</p>
          <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
        </div>
      ) : !data || isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[150, 260, 200].map((h, i) => (
            <div key={i} className="animate-pulse rounded-3xl bg-muted" style={{ height: h }} />
          ))}
        </div>
      ) : (
        <>
          {/* ---------- total ---------- */}
          <section aria-label="Total" className="rounded-3xl border border-border bg-card p-4">
            <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Entró · {title}</p>
            <p className="font-display tabular mt-1 text-[44px] leading-none">{formatMoney(data.total)}</p>
            <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-2xl border border-border">
              <Part icon={Wrench} label="Reparaciones" value={data.reparaciones.total} detail={`${data.reparaciones.count} pago${data.reparaciones.count === 1 ? '' : 's'}`} />
              <Part
                icon={ShoppingBag}
                label="Ventas"
                value={data.ventas.total}
                detail={`${data.ventas.count} venta${data.ventas.count === 1 ? '' : 's'}`}
                className="border-l border-border"
              />
            </div>
          </section>

          {/* ---------- por método ---------- */}
          <section aria-label="Por método de pago" className="rounded-3xl border border-border bg-card p-4">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Por método de pago</h2>
            <ul className="mt-3 flex flex-col gap-3">
              {PAYMENT_METHODS.map((m) => {
                const value = data.byMethod[m.value] ?? 0
                const Icon = m.icon
                return (
                  <li key={m.value} className={cn('flex items-center gap-3', value === 0 && 'opacity-55')}>
                    <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', m.bg, m.text)}>
                      <Icon className="size-[18px]" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[14.5px] font-bold">
                          {m.label}
                          {m.value === 'efectivo' && value > 0 && (
                            <span className="ml-1.5 text-[12px] font-semibold text-muted-foreground">debe estar en caja</span>
                          )}
                        </span>
                        <span className="tabular shrink-0 text-[15px] font-bold">{formatMoney(value)}</span>
                      </span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <span className={cn('block h-full rounded-full', m.dot)} style={{ width: `${(value / maxMethod) * 100}%` }} />
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          {/* ---------- movimientos ---------- */}
          <section aria-label="Movimientos" className="rounded-3xl border border-border bg-card p-4">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Movimientos <span className="tabular">({data.movimientos.length})</span>
            </h2>
            {data.movimientos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Inbox className="size-9 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
                <p className="font-bold">No entró dinero en este periodo</p>
                <p className="max-w-xs text-sm text-muted-foreground">Aquí salen las ventas y los pagos que registres en las órdenes (abonos y saldos).</p>
              </div>
            ) : (
              <ul className="mt-2 flex flex-col divide-y divide-border">
                {data.movimientos.map((mv) => (
                  <Movement key={mv.id} mv={mv} withDay={!oneDay} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function Part({
  icon: Icon,
  label,
  value,
  detail,
  className,
}: {
  icon: typeof Wrench
  label: string
  value: number
  detail: string
  className?: string
}) {
  return (
    <div className={cn('min-w-0 px-3 py-2.5', className)}>
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </p>
      <p className="tabular truncate text-[17px] font-bold">{formatMoney(value)}</p>
      <p className="text-[12px] text-muted-foreground">{detail}</p>
    </div>
  )
}

function Movement({ mv, withDay }: { mv: CashMovement; withDay: boolean }) {
  const m = PAYMENT_MAP[mv.method]
  const Icon = mv.kind === 'pago' ? Wrench : ShoppingBag
  const body = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted-foreground">
        <Icon className="size-[17px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold">{mv.label || mv.ref}</span>
        <span className="block truncate text-[12.5px] text-muted-foreground">
          <span className="font-mono">{mv.ref}</span> · {timeLabel(mv.at, withDay)}
          {mv.note ? ` · ${mv.note}` : ''}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="tabular text-[15px] font-bold">{formatMoney(mv.amount)}</span>
        <span className={cn('rounded-full px-2 py-0.5 text-[11.5px] font-bold', m?.bg, m?.text)}>{m?.label ?? mv.method}</span>
      </span>
    </>
  )
  return (
    <li>
      {mv.kind === 'pago' ? (
        <Link href={`/orden/${encodeURIComponent(mv.ref)}`} className="-mx-2 flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
          {body}
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      ) : (
        <div className="flex min-h-14 items-center gap-3 py-2">{body}</div>
      )}
    </li>
  )
}

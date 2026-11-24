'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { toast } from 'sonner'
import { BellRing, CheckCircle2, Clock, Loader2, TriangleAlert } from 'lucide-react'
import { getReminders, setReminders, type ReminderKind, type ReminderPending, type RemindersSummary } from '@/lib/api'
import { formatDate } from '@/lib/business'
import { cn } from '@/lib/utils'

const TIPOS: { kind: ReminderKind; title: string; detail: (dias: number) => string }[] = [
  {
    kind: 'presupuesto',
    title: 'Presupuesto sin respuesta',
    detail: (d) => `A los ${d} días de enviar el presupuesto sin que el cliente confirme.`,
  },
  {
    kind: 'recoger',
    title: 'Equipo listo sin recoger',
    detail: (d) => `A los ${d} días de estar listo sin que lo recojan.`,
  },
]
const SHORT: Record<ReminderKind, string> = { presupuesto: 'Presupuesto', recoger: 'Recoger' }

/** Recordatorios automáticos por WhatsApp: se prenden y apagan aquí, y se ve qué saldría. */
export function RecordatoriosPanel({ connected }: { connected: boolean }) {
  const { data, error, isLoading, mutate } = useSWR<RemindersSummary>('recordatorios', getReminders, {
    refreshInterval: 60_000,
  })
  const [saving, setSaving] = useState<ReminderKind | null>(null)

  async function toggle(kind: ReminderKind) {
    if (!data) return
    const on = !data.config[kind]
    setSaving(kind)
    try {
      const next = await setReminders({ [kind]: on })
      await mutate(next, false)
      toast.success(on ? 'Recordatorio activado' : 'Recordatorio apagado', {
        description: TIPOS.find((t) => t.kind === kind)?.title,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setSaving(null)
    }
  }

  const activos = data ? TIPOS.filter((t) => data.config[t.kind]).map((t) => t.kind) : []
  const porEnviar = (data?.pendientes ?? []).filter((p) => p.due)
  const proximos = (data?.pendientes ?? []).filter((p) => !p.due)

  return (
    <section className="rounded-3xl border border-border bg-card p-4 md:p-5" aria-labelledby="recordatorios-titulo">
      <header className="flex items-center gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <BellRing className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="recordatorios-titulo" className="text-[16px] font-extrabold tracking-tight">
            Recordatorios automáticos
          </h2>
          <p className="text-xs text-muted-foreground">Un solo recordatorio por orden, con el nombre y el equipo de cada cliente.</p>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Cargando…
        </div>
      ) : error || !data ? (
        <p className="mt-4 text-sm text-destructive">No se pudieron cargar los recordatorios.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-col gap-2">
            {TIPOS.map((t) => {
              const on = data.config[t.kind]
              return (
                <div key={t.kind} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-bold">{t.title}</p>
                    <p className="text-[12.5px] text-muted-foreground">{t.detail(data.reglas[t.kind].desdeDias)}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={t.title}
                    disabled={saving === t.kind}
                    onClick={() => void toggle(t.kind)}
                    className={cn(
                      'relative inline-flex h-11 w-[64px] shrink-0 items-center rounded-full p-1 transition-colors disabled:opacity-60',
                      on ? 'bg-status-done' : 'bg-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-9 place-items-center rounded-full bg-white shadow-sm transition-transform',
                        on ? 'translate-x-5' : 'translate-x-0',
                      )}
                    >
                      {saving === t.kind && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>

          <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
            Salen de lunes a sábado entre las {data.horario.desde} y las {data.horario.hasta} h, uno cada pocos minutos y como
            máximo {data.maxPorDia} al día ({data.enviadosHoy} en las últimas 24 h). Pasan por las mismas protecciones
            anti-bloqueo y no le escriben a quien ya recibió un mensaje hoy.
            {!connected && activos.length > 0 && (
              <span className="mt-1 flex items-center gap-1.5 font-semibold text-status-review">
                <TriangleAlert className="size-3.5" aria-hidden="true" /> WhatsApp no está conectado: quedan en espera.
              </span>
            )}
          </p>

          <Lista
            title={activos.length ? 'Por enviar' : 'Saldrían ahora si los activas'}
            empty="Ninguna orden necesita recordatorio ahora."
            items={porEnviar}
            activos={activos}
          />
          {proximos.length > 0 && <Lista title="Próximos" items={proximos} activos={activos} />}

          {data.enviados.length > 0 && (
            <div className="mt-4">
              <h3 className="text-[13px] font-bold text-muted-foreground">Enviados</h3>
              <ul className="mt-1.5 flex flex-col divide-y divide-border/70">
                {data.enviados.slice(0, 10).map((r) => (
                  <li key={r.id} className="flex min-h-11 items-center gap-2 py-1.5 text-[13.5px]">
                    {r.ok ? (
                      <CheckCircle2 className="size-4 shrink-0 text-status-done" aria-label="Enviado" />
                    ) : (
                      <TriangleAlert className="size-4 shrink-0 text-destructive" aria-label="Falló" />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      <Link href={`/orden/${encodeURIComponent(r.orderId)}`} className="font-mono font-semibold hover:underline">
                        {r.orderId}
                      </Link>{' '}
                      · {r.customer} · {SHORT[r.kind]}
                      {!r.ok && r.detail && <span className="block truncate text-[12px] text-destructive">{r.detail}</span>}
                    </span>
                    <span className="shrink-0 text-[12px] text-muted-foreground">{formatDate(r.sentAt, true)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function Lista({
  title,
  empty,
  items,
  activos,
}: {
  title: string
  empty?: string
  items: ReminderPending[]
  activos: ReminderKind[]
}) {
  return (
    <div className="mt-4">
      <h3 className="text-[13px] font-bold text-muted-foreground">
        {title} {items.length > 0 && <span className="tabular">({items.length})</span>}
      </h3>
      {items.length === 0 ? (
        empty && <p className="mt-1.5 text-[13.5px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1.5 flex flex-col divide-y divide-border/70">
          {items.map((p) => {
            const apagado = !activos.includes(p.kind)
            return (
              <li key={`${p.orderId}-${p.kind}`} className={cn('flex min-h-11 items-center gap-2 py-1.5 text-[13.5px]', apagado && activos.length > 0 && 'opacity-60')}>
                <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    <Link href={`/orden/${encodeURIComponent(p.orderId)}`} className="font-mono font-semibold hover:underline">
                      {p.orderId}
                    </Link>{' '}
                    · {p.customer}
                  </span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {p.device}
                    {p.motivo ? <span className="font-semibold text-status-review"> · {p.motivo}</span> : !p.due && <> · desde el {formatDate(p.dueAt)}</>}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[12px] font-bold">{SHORT[p.kind]}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

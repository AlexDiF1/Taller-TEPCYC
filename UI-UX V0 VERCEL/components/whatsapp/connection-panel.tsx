'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  QrCode,
  RefreshCw,
  Power,
  Smartphone,
  Users,
  ShieldCheck,
  Loader2,
  Wifi,
  TriangleAlert,
  ScrollText,
  PlayCircle,
  PauseCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/business'
import {
  STATUS_LABEL,
  waContacts,
  waLogout,
  waRestart,
  waResume,
  waSyncContacts,
  type WaContact,
  type WaState,
} from '@/lib/wa'
import { cn } from '@/lib/utils'

export function ConnectionPanel({
  state,
  isLoading,
  error,
  onState,
}: {
  state?: WaState
  isLoading: boolean
  error: unknown
  onState: (next: WaState) => void
}) {
  const [busy, setBusy] = useState<'restart' | 'logout' | 'sync' | 'resume' | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [contacts, setContacts] = useState<WaContact[] | null>(null)

  const meta = state ? STATUS_LABEL[state.status] : undefined
  const protection = state?.protections
  const needsQr = !state?.connected

  async function run(action: 'restart' | 'logout' | 'sync' | 'resume') {
    setBusy(action)
    try {
      if (action === 'restart') {
        onState(await waRestart())
        toast.success('Reiniciando la conexión de WhatsApp...')
      } else if (action === 'logout') {
        onState(await waLogout())
        setConfirming(false)
        toast.success('Sesión cerrada. Escanea el nuevo QR para vincular otro número.')
      } else if (action === 'resume') {
        onState(await waResume())
        toast.success('Envíos reanudados.')
      } else {
        const result = await waSyncContacts()
        toast.success(`Números sincronizados: ${result.total} contactos.`)
        setContacts(null)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo completar la acción.')
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    if (!state) return
    let cancelled = false
    if (contacts === null && state.contacts > 0) {
      waContacts()
        .then((data) => !cancelled && setContacts(data.contactos))
        .catch(() => undefined)
    }
    return () => {
      cancelled = true
    }
  }, [state?.contacts, contacts, state])

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <div className="flex flex-col gap-4">
        <section className="rounded-2xl border border-border bg-card/70 p-4 ring-1 ring-foreground/5 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'grid size-11 place-items-center rounded-xl',
                  meta?.bg,
                  meta?.text,
                )}
              >
                {state?.connected ? <Wifi className="size-5" aria-hidden="true" /> : <Smartphone className="size-5" aria-hidden="true" />}
              </span>
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className={cn('size-2 rounded-full', meta?.dot)} aria-hidden="true" />
                  {meta?.label ?? 'Consultando…'}
                </p>
                <p className="text-xs text-muted-foreground">{meta?.hint ?? 'Leyendo el estado del servicio'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl"
                disabled={busy !== null}
                onClick={() => run('restart')}
              >
                {busy === 'restart' ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Reiniciar conexión
              </Button>
              {confirming ? (
                <span className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-9 rounded-xl"
                    disabled={busy !== null}
                    onClick={() => run('logout')}
                  >
                    Sí, cerrar sesión
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-9 rounded-xl" onClick={() => setConfirming(false)}>
                    Cancelar
                  </Button>
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirming(true)}
                >
                  <Power className="size-3.5" />
                  Cerrar sesión
                </Button>
              )}
            </div>
          </div>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background/40 p-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Número vinculado</dt>
              <dd className="mt-1 font-mono text-sm font-semibold tabular-nums">
                {state?.me?.display ?? (state?.connected ? 'Sin identificar' : '—')}
              </dd>
              {state?.me?.name && <p className="text-[11px] text-muted-foreground">{state.me.name}</p>}
            </div>
            <div className="rounded-xl border border-border bg-background/40 p-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Mensajes enviados</dt>
              <dd className="mt-1 font-mono text-sm font-semibold tabular-nums">
                {state?.sentTotal ?? 0}
                {(state?.sentErrors ?? 0) > 0 && <span className="ml-2 text-[11px] font-normal text-destructive">{state?.sentErrors} con error</span>}
              </dd>
              <p className="text-[11px] text-muted-foreground">
                Pausa {Math.round((state?.limits?.minGapMs ?? 4000) / 1000)} s · tope {state?.limits?.maxPerHour ?? 100}/hora
              </p>
            </div>
          </dl>

          {state?.lastError && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {state.lastError}
            </p>
          )}
          {error !== undefined && error !== null && (
            <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error instanceof Error ? error.message : String(error)}
            </p>
          )}
          {isLoading && !state && (
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Consultando el estado del servicio…
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card/70 p-4 ring-1 ring-foreground/5 md:p-5">
          <header className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'grid size-7 place-items-center rounded-lg',
                protection?.paused ? 'bg-destructive/12 text-destructive' : 'bg-status-done/12 text-status-done',
              )}
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <h2 className="text-sm font-semibold">Protecciones anti-bloqueo</h2>
              <p className="text-xs text-muted-foreground">
                El servicio escribe despacio y se frena solo si WhatsApp se queja, para cuidar la cuenta.
              </p>
            </div>
            {protection?.paused ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
                disabled={busy !== null}
                onClick={() => run('resume')}
              >
                {busy === 'resume' ? <Loader2 className="size-3.5 animate-spin" /> : <PlayCircle className="size-3.5" />}
                Reanudar envíos
              </Button>
            ) : (
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide',
                  protection?.active ? 'bg-status-done/12 text-status-done' : 'bg-status-review/12 text-status-review',
                )}
              >
                {protection?.active ? 'Activas' : 'En espera'}
              </span>
            )}
          </header>

          {protection?.paused && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <PauseCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Envíos en pausa: {protection.cooldownReason ?? 'ritmo alto'} · vuelve en ~
              {Math.max(1, Math.ceil(protection.cooldownRemainingMs / 60000))} min
              {protection.cooldownUntil ? ` (${formatDate(protection.cooldownUntil, true)})` : ''}.
            </p>
          )}

          {!protection?.paused && (protection?.graceRemainingMs ?? 0) > 0 && (
            <p className="mt-3 rounded-xl border border-status-review/30 bg-status-review/10 px-3 py-2 text-xs text-status-review">
              Ventana de gracia: faltan {Math.ceil((protection?.graceRemainingMs ?? 0) / 1000)} s para poder escribir. Nadie
              escribe en el primer segundo después de conectar.
            </p>
          )}

          {protection?.warmup.active && (
            <p className="mt-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
              Cuenta en calentamiento: {protection.warmup.daysLeft} día(s) con límites reducidos (los números recién
              vinculados son los que más fácil se reportan).
            </p>
          )}

          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <ProtectionStat
              label="Última hora"
              value={`${protection?.sentLastHour ?? 0}/${protection?.effective.maxPerHour ?? 0}`}
            />
            <ProtectionStat label="Hoy" value={`${protection?.sentToday ?? 0}/${protection?.effective.maxPerDay ?? 0}`} />
            <ProtectionStat
              label="Estados hoy"
              value={`${protection?.statusesToday ?? 0}/${protection?.effective.maxStatusPerDay ?? 0}`}
            />
            <ProtectionStat
              label="Errores hoy"
              value={String(protection?.errorsToday ?? 0)}
              danger={(protection?.errorsToday ?? 0) > 0}
            />
          </div>

          <ul className="mt-3 flex flex-col gap-1">
            {(protection?.rules ?? []).map((rule) => (
              <li key={rule} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-status-done" aria-hidden="true" />
                {rule}
              </li>
            ))}
          </ul>

          {(protection?.guardTrips ?? 0) > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Envíos masivos bloqueados por la guarda anti-spam: {protection?.guardTrips}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card/70 p-4 ring-1 ring-foreground/5 md:p-5">
          <header className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-status-pending/12 text-status-pending">
              <Users className="size-4" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <h2 className="text-sm font-semibold">Números para los estados</h2>
              <p className="text-xs text-muted-foreground">
                Se sincronizan las órdenes, las ventas y los chats que llegan al WhatsApp.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-xl"
              disabled={busy !== null}
              onClick={() => run('sync')}
            >
              {busy === 'sync' ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Sincronizar
            </Button>
          </header>

          <p className="mt-3 text-2xl font-bold tabular-nums">{state?.contacts ?? 0}</p>
          <p className="text-xs text-muted-foreground">
            contactos listos para ver tus estados (así WhatsApp no los limita a tus contactos propios).
          </p>

          {contacts && contacts.length > 0 && (
            <ul className="mt-3 max-h-64 divide-y divide-border/60 overflow-y-auto rounded-xl border border-border bg-background/40">
              {contacts.map((contact) => (
                <li key={contact.phone} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{contact.name || 'Sin nombre'}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">+{contact.phone}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {contact.source}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card/70 p-4 ring-1 ring-foreground/5 md:p-5">
          <header className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-secondary text-muted-foreground">
              <ScrollText className="size-4" aria-hidden="true" />
            </span>
            <h2 className="text-sm font-semibold">Actividad reciente</h2>
          </header>
          <ul className="mt-3 flex flex-col gap-1.5">
            {(state?.events ?? []).length === 0 && <li className="text-xs text-muted-foreground">Sin eventos todavía.</li>}
            {(state?.events ?? []).map((event, index) => (
              <li key={`${event.at}-${index}`} className="flex items-start justify-between gap-3 text-xs">
                <span className="text-muted-foreground">
                  <span className="text-foreground">{event.event}</span>
                  {event.detail ? ` · ${event.detail}` : ''}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">{formatDate(event.at, true)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="flex flex-col gap-4 rounded-2xl border border-border bg-card/80 p-4 ring-1 ring-foreground/10 lg:sticky lg:top-6">
        <header className="flex items-center gap-2">
          <QrCode className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Vinculación</h2>
        </header>

        {state?.connected ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-status-done/15 text-status-done">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold">WhatsApp vinculado</p>
            <p className="max-w-[240px] text-xs text-muted-foreground">
              {state.me?.display ?? 'Sesión activa'}. Los comprobantes y notificaciones salen solos desde esta sesión.
            </p>
          </div>
        ) : needsQr ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="relative rounded-2xl bg-white p-3">
              {state?.qr ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={state.qr} alt="Código QR para vincular WhatsApp" className="size-56" />
              ) : (
                <div className="grid size-56 place-items-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Abre <strong>WhatsApp Business</strong> en el celular → Dispositivos vinculados → Vincular dispositivo y escanea
              este código.
            </p>
            <p className="text-[11px] text-muted-foreground/70">
              {state?.qrUpdatedAt ? `QR actualizado ${formatDate(state.qrUpdatedAt, true)}` : 'Generando código…'} · se renueva
              solo
            </p>
          </div>
        ) : (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Cerrando la sesión… el QR aparecerá en unos segundos.
          </p>
        )}
      </aside>
    </div>
  )
}

function ProtectionStat({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 font-mono text-sm font-semibold tabular-nums', danger ? 'text-destructive' : 'text-foreground')}>
        {value}
      </p>
    </div>
  )
}

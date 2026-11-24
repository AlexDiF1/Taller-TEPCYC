'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowRight, Inbox, Loader2, MessageCircle, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { timeAgo } from '@/components/orders/order-card'
import { useSolicitudes } from '@/hooks/use-solicitudes'
import { chatUrl } from '@/lib/notify'
import { formatPhoneDisplay, solicitudDeviceType } from '@/lib/solicitudes'
import { DEVICE_ICON } from '@/lib/status'
import type { Solicitud, SolicitudStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const FILTROS: { value: SolicitudStatus; label: string }[] = [
  { value: 'nueva', label: 'Nuevas' },
  { value: 'convertida', label: 'Convertidas' },
  { value: 'descartada', label: 'Descartadas' },
]

export function SolicitudesDashboard() {
  const { solicitudes, isLoading, error, setStatus } = useSolicitudes()
  const [filtro, setFiltro] = useState<SolicitudStatus>('nueva')
  const [ocupada, setOcupada] = useState<number | null>(null)

  const lista = solicitudes.filter((s) => s.status === filtro)
  const cuenta = (status: SolicitudStatus) => solicitudes.filter((s) => s.status === status).length

  async function cambiar(s: Solicitud, status: 'nueva' | 'descartada') {
    setOcupada(s.id)
    try {
      await setStatus(s.id, status)
      if (status === 'descartada') {
        toast.success('Solicitud descartada', {
          description: s.name,
          action: { label: 'Deshacer', onClick: () => void setStatus(s.id, 'nueva') },
        })
      } else {
        toast.success('Solicitud de vuelta en «Nuevas»')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar la solicitud.')
    } finally {
      setOcupada(null)
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-4 md:px-8 md:py-8">
      <div className="hidden lg:block">
        <PageHeader
          eyebrow="Taller"
          title="Solicitudes de la web"
          description="Lo que los clientes piden en tepcyc.com/reparacion. Cuando traigan el equipo, conviértela en orden."
        />
      </div>
      <p className="text-[14px] text-muted-foreground lg:hidden">
        Lo que piden en tepcyc.com. Cuando traigan el equipo, conviértela en orden.
      </p>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="Filtrar solicitudes">
        {FILTROS.map((f) => {
          const activo = filtro === f.value
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={activo}
              onClick={() => setFiltro(f.value)}
              className={cn(
                'inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[14px] font-semibold whitespace-nowrap transition-colors',
                activo ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
              <span className={cn('tabular text-[13px]', activo ? 'opacity-70' : 'opacity-80')}>{cuenta(f.value)}</span>
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          Cargando solicitudes…
        </div>
      ) : error ? (
        <p className="rounded-2xl border border-destructive/40 bg-destructive/6 p-4 text-[14px] text-destructive">
          No se pudieron cargar las solicitudes. Revisa la conexión e intenta de nuevo.
        </p>
      ) : lista.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <Inbox className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-[15px] font-bold">
            {filtro === 'nueva' ? 'No hay solicitudes nuevas' : filtro === 'convertida' ? 'Aún no hay convertidas' : 'No hay descartadas'}
          </p>
          {filtro === 'nueva' && (
            <p className="max-w-xs text-[13.5px] text-muted-foreground">Cuando alguien llene el formulario de la web, aparece aquí.</p>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.map((s) => (
            <li key={s.id}>
              <SolicitudCard s={s} ocupada={ocupada === s.id} onCambiar={(status) => void cambiar(s, status)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SolicitudCard({
  s,
  ocupada,
  onCambiar,
}: {
  s: Solicitud
  ocupada: boolean
  onCambiar: (status: 'nueva' | 'descartada') => void
}) {
  const Icon = DEVICE_ICON[solicitudDeviceType(s.device)]
  const equipo = [s.device, s.model].filter(Boolean).join(' · ')

  return (
    <article className={cn('rounded-2xl border border-border bg-card p-4', s.status !== 'nueva' && 'bg-card/60')}>
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface-2">
          <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted-foreground">
            <span className="font-mono font-semibold">{s.ref}</span>
            <span aria-hidden="true">·</span>
            <span>{timeAgo(s.receivedAt)}</span>
          </p>
          <h2 className="mt-0.5 truncate text-[16.5px] leading-snug font-bold">{s.name || 'Sin nombre'}</h2>
          <p className="truncate text-[14px] text-muted-foreground">{equipo}</p>
        </div>
      </div>

      <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2.5 text-[14px] leading-relaxed whitespace-pre-line break-words">
        {s.fault}
        {s.since && <span className="block text-[13px] text-muted-foreground">Falla desde: {s.since}</span>}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {s.phone ? (
          <a
            href={chatUrl(s.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-whatsapp/10 px-3.5 text-[14px] font-semibold text-whatsapp transition-colors hover:bg-whatsapp/20"
          >
            <MessageCircle className="size-[18px]" aria-hidden="true" />
            {formatPhoneDisplay(s.phone)}
          </a>
        ) : (
          s.status === 'nueva' && (
            <p className="text-[13px] text-muted-foreground">
              Aún no escribió por WhatsApp. Si escribe, su mensaje trae el código <b className="font-mono">{s.ref}</b>.
            </p>
          )
        )}
      </div>

      {s.status === 'nueva' && (
        <div className="mt-3 flex gap-2">
          <Button
            nativeButton={false}
            render={<Link href={`/ingreso?solicitud=${s.id}`} />}
            className="h-11 flex-1 rounded-xl text-[14.5px] font-bold"
          >
            Convertir en orden
            <ArrowRight data-icon="inline-end" className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={ocupada}
            onClick={() => onCambiar('descartada')}
            className="h-11 rounded-xl px-3.5"
            aria-label={`Descartar la solicitud de ${s.name}`}
          >
            {ocupada ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
            <span className="hidden sm:inline">Descartar</span>
          </Button>
        </div>
      )}
      {s.status === 'convertida' && s.orderId && (
        <Link
          href={`/orden/${encodeURIComponent(s.orderId)}`}
          className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl border border-border px-3.5 text-[14px] font-semibold transition-colors hover:bg-surface-2"
        >
          Ver la orden <span className="font-mono">{s.orderId}</span>
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
      {s.status === 'descartada' && (
        <Button type="button" variant="outline" disabled={ocupada} onClick={() => onCambiar('nueva')} className="mt-3 h-11 rounded-xl">
          {ocupada ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <RotateCcw data-icon="inline-start" />}
          Volver a nuevas
        </Button>
      )}
    </article>
  )
}

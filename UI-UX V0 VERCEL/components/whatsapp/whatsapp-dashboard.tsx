'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Link2, ImagePlus } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { ConnectionPanel } from './connection-panel'
import { EstadosPanel } from './estados-panel'
import { waListEstados, waStatus, type EstadoProgramado } from '@/lib/wa'
import { cn } from '@/lib/utils'

type Tab = 'conexion' | 'estados'

export function WhatsappDashboard() {
  const [tab, setTab] = useState<Tab>('conexion')

  // Mientras no hay sesión el QR cambia cada pocos segundos: se refresca rápido.
  const { data: state, error, isLoading, mutate } = useSWR('wa-status', waStatus, {
    refreshInterval: (data) => (data?.connected ? 20_000 : 3_000),
    revalidateOnFocus: true,
  })

  const { data: estados, mutate: refreshEstados } = useSWR<EstadoProgramado[]>('wa-estados', waListEstados, {
    refreshInterval: (data) => ((data ?? []).some((e) => e.status === 'pendiente') ? 30_000 : 0),
  })

  // Los estados programados también se refrescan al cambiar de pestaña.
  useEffect(() => {
    void refreshEstados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        eyebrow="Mensajería"
        title="WhatsApp"
        description="Vincula el WhatsApp Business del taller, publica estados y deja programadas las historias del día."
      />

      <div
        className="inline-flex w-fit items-center gap-1 rounded-xl border border-border bg-muted/40 p-1"
        role="tablist"
        aria-label="Secciones de WhatsApp"
      >
        <TabButton active={tab === 'conexion'} onClick={() => setTab('conexion')} icon={Link2} label="Conexión" />
        <TabButton active={tab === 'estados'} onClick={() => setTab('estados')} icon={ImagePlus} label="Estados" />
      </div>

      {tab === 'conexion' ? (
        <ConnectionPanel state={state} isLoading={isLoading} error={error} onState={(next) => void mutate(next, false)} />
      ) : (
        <EstadosPanel
          estados={estados ?? []}
          connected={Boolean(state?.connected)}
          onChange={() => {
            void refreshEstados()
            void mutate()
          }}
        />
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: 'true' }>
  label: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
        active ? 'bg-card text-foreground shadow-sm ring-1 ring-foreground/10' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className={cn('size-4', active && 'text-primary')} aria-hidden="true" />
      {label}
    </button>
  )
}

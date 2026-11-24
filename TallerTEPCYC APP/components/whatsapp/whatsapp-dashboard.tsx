'use client'

import useSWR from 'swr'
import { PageHeader } from '@/components/page-header'
import { ConnectionPanel } from './connection-panel'
import { EstadosPanel } from './estados-panel'
import { RecordatoriosPanel } from './recordatorios-panel'
import { waListEstados, waListPlanes, waStatus, type EstadoPlan, type EstadoProgramado } from '@/lib/wa'

export function WhatsappDashboard() {
  // Mientras no hay sesión el QR cambia cada pocos segundos: se refresca rápido.
  const { data: state, error, isLoading, mutate } = useSWR('wa-status', waStatus, {
    refreshInterval: (data) => (data?.connected ? 20_000 : 3_000),
    revalidateOnFocus: true,
  })

  const { data: estados, mutate: refreshEstados } = useSWR<EstadoProgramado[]>('wa-estados', waListEstados, {
    refreshInterval: (data) => ((data ?? []).some((e) => e.status === 'pendiente') ? 30_000 : 0),
  })

  const { data: planes, mutate: refreshPlanes } = useSWR<EstadoPlan[]>('wa-planes', waListPlanes)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-4 md:px-8 md:py-8">
      <div className="hidden lg:block">
        <PageHeader
          eyebrow="Negocio"
          title="WhatsApp"
          description="Conexión del número del taller, protecciones anti-bloqueo, recordatorios automáticos y estados programados."
        />
      </div>

      {/* Dos bloques simétricos: conexión en vivo + visor del QR a la izquierda,
          creador y programador de Estados a la derecha. */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 xl:items-start [&>*]:min-w-0">
        <div className="flex flex-col gap-5 [&>*]:min-w-0">
          <ConnectionPanel
            state={state}
            isLoading={isLoading}
            error={error}
            onState={(next) => void mutate(next, false)}
          />
          <RecordatoriosPanel connected={Boolean(state?.connected)} />
        </div>
        <EstadosPanel
          estados={estados ?? []}
          planes={planes ?? []}
          connected={Boolean(state?.connected)}
          onChange={() => {
            void refreshEstados()
            void mutate()
          }}
          onPlanesChange={() => void refreshPlanes()}
        />
      </div>
    </div>
  )
}

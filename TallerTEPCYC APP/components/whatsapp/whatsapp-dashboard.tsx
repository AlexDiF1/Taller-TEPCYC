'use client'

import { useEffect } from 'react'
import useSWR from 'swr'
import { PageHeader } from '@/components/page-header'
import { ConnectionPanel } from './connection-panel'
import { EstadosPanel } from './estados-panel'
import { waListEstados, waStatus, type EstadoProgramado } from '@/lib/wa'

export function WhatsappDashboard() {
  // Mientras no hay sesión el QR cambia cada pocos segundos: se refresca rápido.
  const { data: state, error, isLoading, mutate } = useSWR('wa-status', waStatus, {
    refreshInterval: (data) => (data?.connected ? 20_000 : 3_000),
    revalidateOnFocus: true,
  })

  const { data: estados, mutate: refreshEstados } = useSWR<EstadoProgramado[]>('wa-estados', waListEstados, {
    refreshInterval: (data) => ((data ?? []).some((e) => e.status === 'pendiente') ? 30_000 : 0),
  })

  // Los estados programados se refrescan al entrar a la vista.
  useEffect(() => {
    void refreshEstados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        eyebrow="Centro de Mensajería"
        title="WhatsApp Business"
        description="Vincula la cuenta de WhatsApp del taller mediante Baileys, gestiona protecciones anti-bloqueo y programa historias/estados."
      />

      {/* Dos bloques simétricos: conexión en vivo + visor del QR a la izquierda,
          creador y programador de Estados a la derecha. */}
      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <ConnectionPanel
          state={state}
          isLoading={isLoading}
          error={error}
          onState={(next) => void mutate(next, false)}
        />
        <EstadosPanel
          estados={estados ?? []}
          connected={Boolean(state?.connected)}
          onChange={() => {
            void refreshEstados()
            void mutate()
          }}
        />
      </div>
    </div>
  )
}

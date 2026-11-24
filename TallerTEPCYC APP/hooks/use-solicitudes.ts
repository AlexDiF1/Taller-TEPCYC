'use client'

import useSWR from 'swr'
import * as api from '@/lib/api'

/** Bandeja de solicitudes de la web. La comparten la página y el aviso de la lista de órdenes. */
export function useSolicitudes() {
  const { data, error, isLoading, mutate } = useSWR('solicitudes', api.listSolicitudes, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  })

  async function setStatus(id: number, status: 'nueva' | 'descartada') {
    const updated = await api.setSolicitudStatus(id, status)
    await mutate()
    return updated
  }

  return {
    solicitudes: data?.solicitudes ?? [],
    nuevas: data?.nuevas ?? 0,
    error,
    isLoading,
    refresh: mutate,
    setStatus,
  }
}

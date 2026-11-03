'use client'

import useSWR from 'swr'
import * as api from '@/lib/ventas'
import type { NewVentaInput, VentaFilters } from '@/lib/ventas'

function key(filters: VentaFilters) {
  const params = new URLSearchParams()
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.method) params.set('method', filters.method)
  return params.toString() ? `ventas?${params.toString()}` : 'ventas'
}

const EMPTY = {
  ventas: [],
  summary: {
    count: 0,
    total: 0,
    totalCost: 0,
    profit: 0,
    averageTicket: 0,
    byMethod: { efectivo: 0, nequi: 0, daviplata: 0, llave: 0, tarjeta: 0 },
  },
}

export function useVentas(filters: VentaFilters = {}) {
  const { data, error, isLoading, mutate } = useSWR(key(filters), () => api.listVentas(filters), {
    keepPreviousData: true,
  })

  async function createVenta(input: NewVentaInput) {
    const venta = await api.createVenta(input)
    await mutate()
    return venta
  }

  async function deleteVenta(id: string | number) {
    await api.deleteVenta(id)
    await mutate()
  }

  return {
    ventas: data?.ventas ?? EMPTY.ventas,
    summary: data?.summary ?? EMPTY.summary,
    isLoading,
    error,
    createVenta,
    deleteVenta,
    refresh: mutate,
  }
}

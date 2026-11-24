'use client'

import useSWR from 'swr'
import * as api from '@/lib/catalogo'

/** Catálogo compartido por la página Catálogo y la Nueva venta (misma clave de SWR). */
export function useProductos() {
  const { data, error, isLoading, mutate } = useSWR('productos', api.listProductos, {
    revalidateOnFocus: true,
  })
  return { productos: data ?? [], error, isLoading, refresh: mutate }
}

'use client'

import useSWR, { useSWRConfig } from 'swr'
import * as api from '@/lib/api'
import type { NewOrderInput, Order, OrderPatch, OrderStatus, PaymentMethod, ServiceItem } from '@/lib/types'

/**
 * La lista trae órdenes resumidas (`?resumen=1`); la ficha pide solo su orden completa.
 * Así la app no descarga todas las órdenes con historial, comentarios y pagos cada vez.
 */
const LIST_KEY = 'orders-resumen'
const orderKey = (id: string) => ['order', id] as const

/** Lista de la pantalla de órdenes. */
export function useOrderList() {
  const { data, error, isLoading } = useSWR(LIST_KEY, api.listOrderSummaries)
  const all = data ?? []
  return {
    /** Órdenes en uso (sin las archivadas). */
    orders: all.filter((o) => !o.archivedAt),
    /** Órdenes archivadas: solo se ven con el filtro «Archivadas». */
    archivedOrders: all.filter((o) => o.archivedAt),
    isLoading,
    error,
  }
}

/** Una orden completa (también archivada), para su ficha. */
export function useOrder(id: string) {
  const { data, error, isLoading } = useSWR(orderKey(id), ([, orderId]) => api.getOrder(orderId))
  return { order: data, isLoading, error }
}

/** Acciones sobre las órdenes: dejan al día la ficha y la lista. */
export function useOrderActions() {
  const { mutate } = useSWRConfig()

  /** Guarda la orden devuelta en su ficha y refresca la lista (si `wait`, espera a la lista). */
  async function done(order: Order, wait = false) {
    await mutate(orderKey(order.id), order, { revalidate: false })
    const list = mutate(LIST_KEY)
    if (wait) await list
    return order
  }

  return {
    createOrder: async (input: NewOrderInput) => done(await api.createOrder(input), true),
    setStatus: async (id: string, status: OrderStatus) => done(await api.updateOrderStatus(id, status)),
    updateOrder: async (id: string, patch: OrderPatch) => done(await api.updateOrder(id, patch)),
    setItems: async (id: string, items: ServiceItem[]) => done(await api.updateOrderItems(id, items)),
    addComment: async (id: string, text: string, author?: string) => done(await api.addOrderComment(id, text, author)),
    archiveOrder: async (id: string) => done(await api.archiveOrder(id), true),
    restoreOrder: async (id: string) => done(await api.restoreOrder(id), true),
    addPayment: async (id: string, payment: { amount: number; method: PaymentMethod; note?: string }) =>
      done(await api.addOrderPayment(id, payment)),
    deletePayment: async (id: string, paymentId: string) => done(await api.deleteOrderPayment(id, paymentId)),
    deliverOrder: async (id: string, payment?: { amount: number; method: PaymentMethod }) =>
      done(await api.deliverOrder(id, payment)),
    undeliverOrder: async (id: string) => done(await api.undeliverOrder(id)),
    /** Borrado definitivo: solo para órdenes ya archivadas. */
    deleteOrder: async (id: string) => {
      await api.deleteOrder(id)
      await mutate(LIST_KEY)
      await mutate(orderKey(id), undefined, { revalidate: false })
    },
  }
}

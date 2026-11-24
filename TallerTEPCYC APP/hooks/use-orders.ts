'use client'

import useSWR from 'swr'
import * as api from '@/lib/api'
import type { NewOrderInput, OrderPatch, OrderStatus, ServiceItem } from '@/lib/types'

const ORDERS_KEY = 'orders'

export function useOrders() {
  const { data, error, isLoading, mutate } = useSWR(ORDERS_KEY, api.listOrders)

  async function createOrder(input: NewOrderInput) {
    const order = await api.createOrder(input)
    await mutate()
    return order
  }

  async function setStatus(id: string, status: OrderStatus) {
    const updated = await api.updateOrderStatus(id, status)
    await mutate()
    return updated
  }

  async function updateOrder(id: string, patch: OrderPatch) {
    const updated = await api.updateOrder(id, patch)
    await mutate()
    return updated
  }

  async function addComment(id: string, text: string, author?: string) {
    const updated = await api.addOrderComment(id, text, author)
    await mutate()
    return updated
  }

  async function archiveOrder(id: string) {
    const updated = await api.archiveOrder(id)
    await mutate()
    return updated
  }

  async function restoreOrder(id: string) {
    const updated = await api.restoreOrder(id)
    await mutate()
    return updated
  }

  /** Borrado definitivo: solo para órdenes ya archivadas. */
  async function deleteOrder(id: string) {
    await api.deleteOrder(id)
    await mutate()
  }

  async function setItems(id: string, items: ServiceItem[]) {
    const updated = await api.updateOrderItems(id, items)
    await mutate()
    return updated
  }

  const allOrders = data ?? []
  return {
    /** Órdenes en uso (sin las archivadas). */
    orders: allOrders.filter((o) => !o.archivedAt),
    /** Órdenes archivadas: solo se ven con el filtro «Archivadas». */
    archivedOrders: allOrders.filter((o) => o.archivedAt),
    /** Todas, para abrir la ficha de cualquier orden (también archivada). */
    allOrders,
    isLoading,
    error,
    createOrder,
    setStatus,
    setItems,
    updateOrder,
    addComment,
    archiveOrder,
    restoreOrder,
    deleteOrder,
  }
}

'use client'

import useSWR from 'swr'
import * as api from '@/lib/api'
import type { NewOrderInput, OrderStatus, ServiceItem } from '@/lib/types'

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

  async function setItems(id: string, items: ServiceItem[]) {
    const updated = await api.updateOrderItems(id, items)
    await mutate()
    return updated
  }

  return {
    orders: data ?? [],
    isLoading,
    error,
    createOrder,
    setStatus,
    setItems,
  }
}

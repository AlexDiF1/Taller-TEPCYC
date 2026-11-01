/**
 * Capa de acceso a datos del cliente.
 * Habla con `/api/orders`, que lee y escribe en Firestore mediante
 * `lib/orders-firestore.ts` (que solo se ejecuta en el servidor).
 */
import type { NewOrderInput, Order, OrderStatus, ServiceItem } from './types'

const ORDERS_URL = '/api/orders'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const body = (await response.json()) as { error?: string }
      if (body?.error) detail = body.error
    } catch {
      /* respuesta sin JSON */
    }
    throw new Error(detail)
  }

  return (await response.json()) as T
}

export function orderUrl(id: string) {
  return `${ORDERS_URL}/${encodeURIComponent(id)}`
}

export async function listOrders(): Promise<Order[]> {
  return request<Order[]>(ORDERS_URL)
}

export async function getOrder(id: string): Promise<Order | undefined> {
  try {
    return await request<Order>(orderUrl(id))
  } catch {
    return undefined
  }
}

export async function createOrder(input: NewOrderInput): Promise<Order> {
  return request<Order>(ORDERS_URL, { method: 'POST', body: JSON.stringify(input) })
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  return request<Order>(orderUrl(id), { method: 'PATCH', body: JSON.stringify({ status }) })
}

export async function updateOrderItems(id: string, items: ServiceItem[]): Promise<Order> {
  return request<Order>(orderUrl(id), { method: 'PATCH', body: JSON.stringify({ items }) })
}

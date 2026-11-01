/**
 * Data access layer. Every function is async and returns plain JSON so the
 * in-memory mock below can be swapped for `fetch('/api/orders', ...)` calls
 * (or Server Actions) without touching any component.
 */
import { SEED_ORDERS } from './seed'
import type { NewOrderInput, Order, OrderStatus, ServiceItem } from './types'

let db: Order[] = structuredClone(SEED_ORDERS)
let sequence = 1048

const latency = () => new Promise((r) => setTimeout(r, 120))

export async function listOrders(): Promise<Order[]> {
  await latency()
  return [...db].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getOrder(id: string): Promise<Order | undefined> {
  await latency()
  return db.find((o) => o.id === id)
}

export async function createOrder(input: NewOrderInput): Promise<Order> {
  await latency()
  const now = new Date().toISOString()
  sequence += 1
  const order: Order = {
    ...input,
    id: `OT-${sequence}`,
    createdAt: now,
    status: 'recibido',
    items: [],
    history: [{ status: 'recibido', at: now, note: 'Equipo ingresado al taller' }],
  }
  db = [order, ...db]
  return order
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  await latency()
  const now = new Date().toISOString()
  db = db.map((o) =>
    o.id === id
      ? {
          ...o,
          status,
          deliveredAt: status === 'entregado' ? now : o.deliveredAt,
          history: [...o.history, { status, at: now }],
        }
      : o,
  )
  return db.find((o) => o.id === id)!
}

export async function updateOrderItems(id: string, items: ServiceItem[]): Promise<Order> {
  await latency()
  db = db.map((o) => (o.id === id ? { ...o, items } : o))
  return db.find((o) => o.id === id)!
}

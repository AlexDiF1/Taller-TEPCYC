/**
 * Capa de acceso a datos del cliente.
 * Habla con `/api/orders`, que lee y escribe en Firestore mediante
 * `lib/orders-firestore.ts` (que solo se ejecuta en el servidor).
 */
import type {
  CustomerHistory,
  NewOrderInput,
  Order,
  OrderPatch,
  OrderStatus,
  OrderSummary,
  PaymentMethod,
  ServiceItem,
  Solicitud,
} from './types'

const ORDERS_URL = '/api/orders'
const UPLOADS_URL = '/api/uploads'

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

/** Lista liviana para la pantalla de órdenes (sin historial, comentarios ni pagos). */
export async function listOrderSummaries(): Promise<OrderSummary[]> {
  return request<OrderSummary[]>(`${ORDERS_URL}?resumen=1`)
}

/** Una orden completa. `undefined` si no existe (404); otros errores se lanzan. */
export async function getOrder(id: string): Promise<Order | undefined> {
  const response = await fetch(orderUrl(id), { cache: 'no-store' })
  if (response.status === 404) return undefined
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `${response.status} ${response.statusText}`)
  }
  return (await response.json()) as Order
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

/** Edición completa del registro: cliente, equipo, falla, costos, fecha, técnico y estado. */
export async function updateOrder(id: string, patch: OrderPatch): Promise<Order> {
  return request<Order>(orderUrl(id), { method: 'PUT', body: JSON.stringify(patch) })
}

/** Agrega un comentario interno a la orden (devuelve la orden actualizada). */
export async function addOrderComment(id: string, text: string, author?: string): Promise<Order> {
  return request<Order>(`${orderUrl(id)}/comments`, { method: 'POST', body: JSON.stringify({ text, author }) })
}

/** Archiva la orden: deja de salir en la lista, pero se puede restaurar. */
export async function archiveOrder(id: string): Promise<Order> {
  return request<Order>(`${orderUrl(id)}/archive`, { method: 'POST' })
}

/** Saca la orden del archivo y la devuelve a la lista. */
export async function restoreOrder(id: string): Promise<Order> {
  return request<Order>(`${orderUrl(id)}/restore`, { method: 'POST' })
}

/** Registra un pago de la orden (abono extra, repuesto, saldo…). */
export async function addOrderPayment(id: string, payment: { amount: number; method: PaymentMethod; note?: string }): Promise<Order> {
  return request<Order>(`${orderUrl(id)}/payments`, { method: 'POST', body: JSON.stringify(payment) })
}

/** Borra un pago mal registrado. */
export async function deleteOrderPayment(id: string, paymentId: string): Promise<Order> {
  return request<Order>(`${orderUrl(id)}/payments/${encodeURIComponent(paymentId)}`, { method: 'DELETE' })
}

/** Entrega el equipo; si `payment` trae valor, se cobra en ese momento. */
export async function deliverOrder(id: string, payment?: { amount: number; method: PaymentMethod }): Promise<Order> {
  return request<Order>(`${orderUrl(id)}/deliver`, { method: 'POST', body: JSON.stringify(payment ?? {}) })
}

/** Corrige una entrega marcada por error. */
export async function undeliverOrder(id: string): Promise<Order> {
  return request<Order>(`${orderUrl(id)}/undeliver`, { method: 'POST' })
}

export interface CashBlock {
  count: number
  total: number
  byMethod: Record<PaymentMethod, number>
}

export interface CashMovement {
  kind: 'pago' | 'venta'
  id: string
  /** Número de la orden o de la venta. */
  ref: string
  label: string
  note?: string
  method: PaymentMethod
  amount: number
  at: string
}

export interface CashSummary {
  from: string
  to: string
  total: number
  byMethod: Record<PaymentMethod, number>
  reparaciones: CashBlock
  ventas: CashBlock
  movimientos: CashMovement[]
}

/** Caja: lo que entró en el rango (ventas + pagos de reparaciones). */
export async function getCashSummary(from: string, to: string): Promise<CashSummary> {
  const q = new URLSearchParams({ from, to })
  return request<CashSummary>(`/api/caja?${q}`)
}

/**
 * Borrado definitivo (ítems, fotos del disco, historial y comprobantes).
 * El servidor solo lo permite con órdenes ya archivadas.
 */
export async function deleteOrder(id: string): Promise<void> {
  await request<{ ok: boolean }>(orderUrl(id), { method: 'DELETE' })
}

/* ---------------- solicitudes de la web ---------------- */

export async function listSolicitudes(): Promise<{ solicitudes: Solicitud[]; nuevas: number }> {
  return request('/api/solicitudes')
}

export async function getSolicitud(id: number | string): Promise<Solicitud> {
  return request<Solicitud>(`/api/solicitudes/${encodeURIComponent(String(id))}`)
}

/** Descartar una solicitud o devolverla a «nueva». */
export async function setSolicitudStatus(id: number, status: 'nueva' | 'descartada'): Promise<Solicitud> {
  return request<Solicitud>(`/api/solicitudes/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

/* ---------------- clientes recurrentes ---------------- */

/** Cliente y órdenes anteriores con ese teléfono (cualquier formato). */
export async function findCustomer(phone: string): Promise<CustomerHistory> {
  return request<CustomerHistory>(`/api/clientes/buscar?${new URLSearchParams({ telefono: phone })}`)
}

/* ---------------- recordatorios automáticos ---------------- */

export type ReminderKind = 'presupuesto' | 'recoger'

export interface ReminderPending {
  orderId: string
  kind: ReminderKind
  customer: string
  device: string
  since: string
  dueAt: string
  /** Ya toca enviarlo. */
  due: boolean
  /** Por qué no saldría aunque toque. */
  motivo?: string
}

export interface ReminderSent {
  id: number
  orderId: string
  customer: string
  kind: ReminderKind
  sentAt: string
  ok: boolean
  detail?: string
}

export interface RemindersSummary {
  config: Record<ReminderKind, boolean>
  reglas: Record<ReminderKind, { desdeDias: number; hastaDias: number }>
  horario: { desde: number; hasta: number; ahora: boolean }
  maxPorDia: number
  enviadosHoy: number
  pendientes: ReminderPending[]
  enviados: ReminderSent[]
}

export async function getReminders(): Promise<RemindersSummary> {
  return request<RemindersSummary>('/api/recordatorios')
}

export async function setReminders(patch: Partial<Record<ReminderKind, boolean>>): Promise<RemindersSummary> {
  return request<RemindersSummary>('/api/recordatorios', { method: 'PUT', body: JSON.stringify(patch) })
}

/** Sube una foto (data URL ya comprimida) y devuelve su URL en /uploads. */
export async function uploadPhoto(dataUrl: string): Promise<string> {
  const { url } = await request<{ url: string }>(UPLOADS_URL, {
    method: 'POST',
    body: JSON.stringify({ dataUrl }),
  })
  return url
}

/**
 * Puente entre Firestore (proyecto `todoenpcyconsolasapp`, colección `repairs`)
 * y el modelo `Order` de la app.
 *
 * Los documentos originales vienen de la app anterior con un esquema plano:
 *   { orderNumber, createdAt, status, customerName, customerPhone, customerCedula,
 *     customerType, device, description, accessories, estimatedCost }
 * Aquí se leen tal cual y, al escribir, se conservan esos campos (compatibilidad
 * con la app vieja) añadiendo los campos extra que usa esta UI.
 */
import { FieldValue } from 'firebase-admin/firestore'
import { firestore } from './firebase-admin'
import { ORDER_STATUS_VALUES, isClosed } from './status'
import type {
  Device,
  DeviceType,
  NewOrderInput,
  Order,
  OrderStatus,
  ServiceItem,
  StatusEvent,
} from './types'

export const ORDERS_COLLECTION = 'repairs'

export const ORDER_STATUSES: OrderStatus[] = ORDER_STATUS_VALUES

export { isClosed }

export function normalizeStatus(value: unknown): OrderStatus {
  const s = String(value ?? '').trim()
  return (ORDER_STATUSES as string[]).includes(s) ? (s as OrderStatus) : 'pendiente'
}

type Doc = Record<string, unknown>

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
}

function number(value: unknown): number {
  if (typeof value === 'number') return value
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function isoDate(value: unknown): string {
  if (!value) return new Date().toISOString()
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const d = (value as { toDate: () => Date }).toDate()
    return d.toISOString()
  }
  if (value instanceof Date) return value.toISOString()
  const d = new Date(typeof value === 'number' ? value : String(value))
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

/** `XBOX 360`, `Celular: MI 9T`, `Otro: Portátil HP` -> { type, brand, model }. */
export function parseDevice(raw: unknown, data: Doc = {}): Device {
  const stored = text(data.deviceType) as DeviceType
  const source = text(raw)
  const [head, ...tail] = source.split(':')
  const detail = tail.join(':').trim()
  const low = source.toLowerCase()

  let type: DeviceType = 'accesorio'
  if (/control|mando|joystick|gamepad/.test(low)) type = 'control'
  else if (/celular|iphone|redmi|xiaomi|moto|samsung|honor|oppo|tecno|nokia|huawei/.test(low)) type = 'celular'
  else if (/portatil|laptop|computador|notebook|pc |windows/.test(low)) type = 'portatil'
  else if (/xbox|playstation|^ps[0-9]|ps[0-9]|nintendo|switch|wii|consola|sega|gamecube/.test(low)) type = 'consola'

  let brand = 'Otra'
  if (/xbox/.test(low)) brand = 'Xbox'
  else if (/playstation|ps[0-9]/.test(low)) brand = 'PlayStation'
  else if (/nintendo|switch|wii/.test(low)) brand = 'Nintendo'
  else if (/steam|valve/.test(low)) brand = 'Valve'

  const model = detail || head.trim() || 'Sin especificar'

  return {
    type: (['consola', 'control', 'portatil', 'accesorio', 'celular'] as string[]).includes(stored)
      ? stored
      : type,
    brand: text(data.deviceBrand) || brand,
    model: text(data.deviceModel) || model,
    serial: text(data.deviceSerial) || undefined,
    color: text(data.deviceColor) || undefined,
  }
}

function parseAccessories(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => text(v)).filter(Boolean)
  const raw = text(value)
  if (!raw || /^nada$|^na$|^-$/i.test(raw)) return []
  return raw
    .split(/,| y |;/)
    .map((v) => v.trim())
    .filter((v) => v && !/^nada$/i.test(v))
}

function parseItems(value: unknown): ServiceItem[] {
  if (!Array.isArray(value)) return []
  return value.map((raw, i) => {
    const item = (raw ?? {}) as Doc
    return {
      id: text(item.id) || `item-${i + 1}`,
      description: text(item.description) || text(item.name),
      kind: item.kind === 'repuesto' ? 'repuesto' : 'servicio',
      price: number(item.price),
    }
  })
}

function parseHistory(value: unknown, status: OrderStatus, createdAt: string): StatusEvent[] {
  if (Array.isArray(value) && value.length > 0) {
    return value.map((raw) => {
      const event = (raw ?? {}) as Doc
      return {
        status: normalizeStatus(event.status),
        at: isoDate(event.at),
        note: text(event.note) || undefined,
      }
    })
  }
  return [{ status, at: createdAt, note: 'Equipo ingresado al taller' }]
}

export function toOrder(docId: string, data: Doc): Order {
  const status = normalizeStatus(data.status)
  const createdAt = isoDate(data.createdAt)
  const orderNumber = text(data.orderNumber).replace(/^#/, '')

  return {
    id: orderNumber || docId,
    createdAt,
    status,
    customer: {
      name: text(data.customerName) || 'Cliente sin nombre',
      phone: text(data.customerPhone),
      documentId: ['', '0'].includes(text(data.customerCedula)) ? undefined : text(data.customerCedula),
      email: text(data.customerEmail) || undefined,
    },
    device: parseDevice(data.device, data),
    reportedFault: text(data.description) || text(data.reportedFault) || 'Sin descripción',
    faultTags: Array.isArray(data.faultTags) ? data.faultTags.map((t) => text(t)).filter(Boolean) : [],
    accessories: parseAccessories(data.accessories),
    physicalNotes: text(data.physicalNotes) || undefined,
    photos: Array.isArray(data.photos)
      ? (data.photos as Doc[]).map((p, i) => ({
          id: text(p.id) || `photo-${i + 1}`,
          url: text(p.url),
          takenAt: isoDate(p.takenAt),
        }))
      : [],
    estimatedCost: number(data.estimatedCost),
    deposit: number(data.deposit),
    estimatedDate: text(data.estimatedDate) || undefined,
    technician: text(data.technician) || undefined,
    items: parseItems(data.items),
    history: parseHistory(data.history, status, createdAt),
    deliveredAt: text(data.deliveredAt) || undefined,
  }
}

/** Campos planos que conserva la app anterior + extras de esta UI. */
export function toDoc(order: Order, data: Doc = {}): Doc {
  const payload: Doc = {
    orderNumber: `#${order.id}`,
    createdAt: order.createdAt,
    status: order.status,
    customerName: order.customer.name,
    customerPhone: order.customer.phone,
    customerCedula: order.customer.documentId ?? '0',
    customerType: text(data.customerType) || 'clientePropio',
    device: text(data.device) || `${order.device.brand} ${order.device.model}`.trim(),
    description: order.reportedFault,
    accessories: order.accessories.length > 0 ? order.accessories.join(', ') : 'Nada',
    estimatedCost: order.estimatedCost,
    // extras propios de la app (la app vieja los ignora)
    deviceType: order.device.type,
    deviceBrand: order.device.brand,
    deviceModel: order.device.model,
    deviceSerial: order.device.serial ?? null,
    deviceColor: order.device.color ?? null,
    faultTags: order.faultTags,
    physicalNotes: order.physicalNotes ?? null,
    photos: order.photos,
    deposit: order.deposit,
    estimatedDate: order.estimatedDate ?? null,
    technician: order.technician ?? null,
    items: order.items.map((item) => ({
      id: item.id,
      name: item.description,
      description: item.description,
      kind: item.kind,
      price: item.price,
      quantity: 1,
    })),
    history: order.history,
    deliveredAt: order.deliveredAt ?? null,
    updatedAt: new Date().toISOString(),
  }

  if (data.customerEmail) payload.customerEmail = data.customerEmail
  return payload
}

function collection() {
  return firestore().collection(ORDERS_COLLECTION)
}

/** Busca la referencia real: id de documento o `orderNumber` (`#ORD-12345` / `ORD-12345`). */
async function resolveRef(id: string) {
  const col = collection()
  const direct = col.doc(id)
  if ((await direct.get()).exists) return direct

  for (const candidate of [`#${id}`, id]) {
    const found = await col.where('orderNumber', '==', candidate).limit(1).get()
    if (!found.empty) return found.docs[0].ref
  }
  throw new Error(`Orden no encontrada en Firestore: ${id}`)
}

async function readDoc(id: string): Promise<Order> {
  const ref = await resolveRef(id)
  const snap = await ref.get()
  return toOrder(ref.id, (snap.data() ?? {}) as Doc)
}

export async function listOrders(): Promise<Order[]> {
  const snap = await collection().get()
  return snap.docs
    .map((doc) => toOrder(doc.id, doc.data() as Doc))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getOrder(id: string): Promise<Order | undefined> {
  try {
    return await readDoc(id)
  } catch {
    return undefined
  }
}

async function nextOrderNumber(): Promise<string> {
  const col = collection()
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const code = `#ORD-${Math.floor(10000 + Math.random() * 89999)}`
    const taken = await col.where('orderNumber', '==', code).limit(1).get()
    if (taken.empty) return code
  }
  return `#ORD-${Date.now().toString().slice(-5)}`
}

export async function createOrder(input: NewOrderInput): Promise<Order> {
  const now = new Date().toISOString()
  const orderNumber = await nextOrderNumber()
  const order: Order = {
    ...input,
    id: orderNumber.replace(/^#/, ''),
    createdAt: now,
    status: 'pendiente',
    items: [],
    history: [{ status: 'pendiente', at: now, note: 'Equipo ingresado al taller' }],
  }
  await collection().doc(order.id).set(toDoc(order))
  return order
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  const ref = await resolveRef(id)
  const snap = await ref.get()
  const data = (snap.data() ?? {}) as Doc
  const current = toOrder(ref.id, data)
  const now = new Date().toISOString()

  const updated: Order = {
    ...current,
    status,
    deliveredAt: isClosed(status) ? (current.deliveredAt ?? now) : undefined,
    history: [...current.history, { status, at: now }],
  }

  await ref.update({
    status,
    deliveredAt: updated.deliveredAt ?? null,
    history: updated.history,
    updatedAt: now,
  })
  return updated
}

export async function updateOrderItems(id: string, items: ServiceItem[]): Promise<Order> {
  const ref = await resolveRef(id)
  const snap = await ref.get()
  const current = toOrder(ref.id, (snap.data() ?? {}) as Doc)
  const updated: Order = { ...current, items }

  await ref.update({
    items: items.map((item) => ({
      id: item.id,
      name: item.description,
      description: item.description,
      kind: item.kind,
      price: item.price,
      quantity: 1,
    })),
    updatedAt: FieldValue.serverTimestamp(),
  })
  return updated
}

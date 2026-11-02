/**
 * Importa a SQLite el respaldo descargado de Firestore (firestore-backup/*.json).
 * Uso: node scripts/import-firestore.mjs
 * Es idempotente: salta las órdenes que ya existan por número.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { db, projectDir } from '../server/db.mjs'

const backupDir = join(projectDir, '..', 'firestore-backup')

function latest(prefix) {
  const files = readdirSync(backupDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
  return files.length ? join(backupDir, files.at(-1)) : null
}

function parseDevice(raw = '') {
  const source = String(raw).trim()
  const [head, ...tail] = source.split(':')
  const detail = tail.join(':').trim()
  const low = source.toLowerCase()
  let type = 'accesorio'
  if (/control|mando|joystick|gamepad/.test(low)) type = 'control'
  else if (/celular|iphone|redmi|xiaomi|moto|samsung|honor|oppo|tecno|nokia|huawei/.test(low)) type = 'celular'
  else if (/portatil|laptop|computador|notebook|windows/.test(low)) type = 'portatil'
  else if (/xbox|playstation|ps[0-9]|nintendo|switch|wii|consola|sega/.test(low)) type = 'consola'

  let brand = 'Otra'
  if (/xbox/.test(low)) brand = 'Xbox'
  else if (/playstation|ps[0-9]/.test(low)) brand = 'PlayStation'
  else if (/nintendo|switch|wii/.test(low)) brand = 'Nintendo'
  return { type, brand, model: detail || head.trim() || 'Sin especificar' }
}

const STATUSES = ['pendiente', 'enRevision', 'esperandoConfirmacion', 'completada', 'rechazada', 'fallida']
const CLOSED = ['completada', 'rechazada', 'fallida']

/** El respaldo guarda los Timestamp de Firestore como { _seconds, _nanoseconds }. */
function toIso(value) {
  if (!value) return new Date().toISOString()
  if (typeof value === 'string') return value
  if (typeof value === 'number') return new Date(value).toISOString()
  if (typeof value === 'object') {
    const seconds = value._seconds ?? value.seconds
    if (typeof seconds === 'number') return new Date(seconds * 1000).toISOString()
    if (typeof value.toDate === 'function') return value.toDate().toISOString()
  }
  return new Date(String(value)).toISOString()
}

const findCustomer = db.prepare('SELECT id FROM customers WHERE phone = ? ORDER BY id LIMIT 1')
const insertCustomer = db.prepare(
  'INSERT INTO customers (name, phone, document_id, email, type, created_at) VALUES (?,?,?,?,?,?)',
)
const existsOrder = db.prepare('SELECT id FROM orders WHERE order_number = ?')
const insertOrder = db.prepare(`INSERT INTO orders (order_number, customer_id, device_type, device_brand, device_model,
  reported_fault, fault_tags, accessories, estimated_cost, status, created_at, updated_at, delivered_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
const insertEvent = db.prepare('INSERT INTO status_events (order_id, status, at, note) VALUES (?,?,?,?)')
const insertInvoice = db.prepare(
  'INSERT OR IGNORE INTO invoices (order_id, number, type, subtotal, total, deposit, balance, created_at) VALUES (?,?,?,?,?,?,?,?)',
)
const insertSale = db.prepare('INSERT INTO sales (sale_date, items, total) VALUES (?,?,?)')

let imported = { repairs: 0, sales: 0, skipped: 0 }

const repairsFile = latest('repairs')
if (repairsFile) {
  for (const doc of JSON.parse(readFileSync(repairsFile, 'utf8'))) {
    const orderNumber = String(doc.orderNumber ?? '').replace(/^#/, '') || `ORD-${doc._id.slice(0, 6).toUpperCase()}`
    if (existsOrder.get(orderNumber)) {
      imported.skipped += 1
      continue
    }
    const createdAt = toIso(doc.createdAt)
    const status = STATUSES.includes(doc.status) ? doc.status : 'pendiente'
    const device = parseDevice(doc.device)
    const accessories = /^(nada|na|)$/i.test(String(doc.accessories ?? '').trim())
      ? []
      : String(doc.accessories ?? '')
          .split(/,| y |;/)
          .map((v) => v.trim())
          .filter((v) => v && !/^nada$/i.test(v))

    const tx = db.transaction(() => {
      const phone = String(doc.customerPhone ?? '').trim()
      const found = phone ? findCustomer.get(phone) : undefined
      const name = String(doc.customerName ?? 'Cliente sin nombre').trim()
      const customerId = found
        ? found.id
        : Number(
            insertCustomer.run(
              name,
              phone || null,
              ['', '0'].includes(String(doc.customerCedula ?? '')) ? null : String(doc.customerCedula),
              null,
              doc.customerType ?? 'clientePropio',
              createdAt,
            ).lastInsertRowid,
          )
      const estimated = Number(doc.estimatedCost ?? 0) || 0
      const orderId = Number(
        insertOrder.run(
          orderNumber,
          customerId,
          device.type,
          device.brand,
          device.model,
          String(doc.description ?? '').trim() || 'Sin descripción',
          '[]',
          JSON.stringify(accessories),
          estimated,
          status,
          createdAt,
          createdAt,
          CLOSED.includes(status) ? createdAt : null,
        ).lastInsertRowid,
      )
      insertEvent.run(orderId, 'pendiente', createdAt, 'Equipo ingresado al taller (importado de Firestore)')
      if (status !== 'pendiente') insertEvent.run(orderId, status, createdAt, null)
      insertInvoice.run(orderId, `R-${orderNumber}`, 'recepcion', 0, estimated, 0, estimated, createdAt)
      if (status === 'completada') insertInvoice.run(orderId, `E-${orderNumber}`, 'entrega', 0, estimated, 0, estimated, createdAt)
    })
    tx()
    imported.repairs += 1
  }
}

const salesFile = latest('sales')
if (salesFile) {
  const already = db.prepare('SELECT COUNT(*) c FROM sales').get().c
  if (already === 0) {
    for (const sale of JSON.parse(readFileSync(salesFile, 'utf8'))) {
      const items = sale.items ?? []
      const total = items.reduce((s, i) => s + Number(i.price ?? 0) * Number(i.quantity ?? 1), 0)
      insertSale.run(sale.date ? toIso(sale.date) : null, JSON.stringify(items), total)
      imported.sales += 1
    }
  }
}

console.log(
  `Importadas ${imported.repairs} órdenes (${imported.skipped} ya existían) y ${imported.sales} ventas.`,
)
console.log(
  `Totales → órdenes: ${db.prepare('SELECT COUNT(*) c FROM orders').get().c}, ` +
    `clientes: ${db.prepare('SELECT COUNT(*) c FROM customers').get().c}`,
)

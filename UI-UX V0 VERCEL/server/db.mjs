/**
 * Base de datos local (SQLite vía better-sqlite3).
 * Guarda clientes, ingresos de equipos, estados, fotos e facturas.
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const here = dirname(fileURLToPath(import.meta.url))
export const projectDir = join(here, '..')
const dataDir = process.env.DATA_DIR ?? join(projectDir, 'data')
mkdirSync(dataDir, { recursive: true })

const db = new Database(process.env.DB_PATH ?? join(dataDir, 'taller.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  document_id TEXT,
  email TEXT,
  type TEXT NOT NULL DEFAULT 'clientePropio',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  device_type TEXT NOT NULL DEFAULT 'consola',
  device_brand TEXT,
  device_model TEXT,
  device_serial TEXT,
  device_color TEXT,
  reported_fault TEXT,
  fault_tags TEXT NOT NULL DEFAULT '[]',
  accessories TEXT NOT NULL DEFAULT '[]',
  physical_notes TEXT,
  estimated_cost REAL NOT NULL DEFAULT 0,
  deposit REAL NOT NULL DEFAULT 0,
  estimated_date TEXT,
  technician TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente',
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'servicio',
  price REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  taken_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS status_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  at TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  type TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  deposit REAL NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(order_id, type)
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_date TEXT,
  items TEXT NOT NULL DEFAULT '[]',
  total REAL NOT NULL DEFAULT 0
);
`)

/* ------------------------------- lectura -------------------------------- */

function rows(sql, params = []) {
  return db.prepare(sql).all(...params)
}

function groupByOrder(table, orderIds) {
  const map = new Map()
  if (orderIds.length === 0) return map
  const list = rows(`SELECT * FROM ${table} WHERE order_id IN (${orderIds.map(() => '?').join(',')}) ORDER BY id`, orderIds)
  for (const row of list) {
    if (!map.has(row.order_id)) map.set(row.order_id, [])
    map.get(row.order_id).push(row)
  }
  return map
}

function rowToOrder(row, items, photos, events) {
  return {
    id: row.order_number,
    createdAt: row.created_at,
    status: row.status,
    customer: {
      name: row.customer_name,
      phone: row.customer_phone ?? '',
      documentId: row.customer_document || undefined,
      email: row.customer_email || undefined,
    },
    device: {
      type: row.device_type,
      brand: row.device_brand || 'Otra',
      model: row.device_model || '',
      serial: row.device_serial || undefined,
      color: row.device_color || undefined,
    },
    reportedFault: row.reported_fault || '',
    faultTags: JSON.parse(row.fault_tags || '[]'),
    accessories: JSON.parse(row.accessories || '[]'),
    physicalNotes: row.physical_notes || undefined,
    photos: photos.map((p) => ({ id: String(p.id), url: p.url, takenAt: p.taken_at })),
    estimatedCost: row.estimated_cost,
    deposit: row.deposit,
    estimatedDate: row.estimated_date || undefined,
    technician: row.technician || undefined,
    items: items.map((i) => ({ id: String(i.id), description: i.description, kind: i.kind, price: i.price })),
    history: events.map((e) => ({ status: e.status, at: e.at, note: e.note || undefined })),
    deliveredAt: row.delivered_at || undefined,
  }
}

const SELECT_ORDERS = `
SELECT o.*, c.name AS customer_name, c.phone AS customer_phone,
       c.document_id AS customer_document, c.email AS customer_email
  FROM orders o JOIN customers c ON c.id = o.customer_id`

export function listOrders() {
  const orders = rows(`${SELECT_ORDERS} ORDER BY o.created_at DESC, o.id DESC`)
  const ids = orders.map((o) => o.id)
  const items = groupByOrder('order_items', ids)
  const photos = groupByOrder('order_photos', ids)
  const events = groupByOrder('status_events', ids)
  return orders.map((o) => rowToOrder(o, items.get(o.id) ?? [], photos.get(o.id) ?? [], events.get(o.id) ?? []))
}

export function getOrder(orderNumber) {
  const row = db.prepare(`${SELECT_ORDERS} WHERE o.order_number = ?`).get(orderNumber)
  if (!row) return undefined
  const items = groupByOrder('order_items', [row.id]).get(row.id) ?? []
  const photos = groupByOrder('order_photos', [row.id]).get(row.id) ?? []
  const events = groupByOrder('status_events', [row.id]).get(row.id) ?? []
  return rowToOrder(row, items, photos, events)
}

/* ------------------------------- escritura ------------------------------ */

function upsertCustomer(input) {
  const now = new Date().toISOString()
  const phone = (input.phone ?? '').trim()
  const found = phone
    ? db.prepare('SELECT * FROM customers WHERE phone = ? ORDER BY id LIMIT 1').get(phone)
    : undefined
  if (found) {
    db.prepare('UPDATE customers SET name = ?, document_id = ?, email = ? WHERE id = ?').run(
      (input.name ?? '').trim(),
      input.documentId || found.document_id,
      input.email || found.email,
      found.id,
    )
    return found.id
  }
  const info = db
    .prepare('INSERT INTO customers (name, phone, document_id, email, type, created_at) VALUES (?,?,?,?,?,?)')
    .run((input.name ?? '').trim(), phone, input.documentId || null, input.email || null, 'clientePropio', now)
  return Number(info.lastInsertRowid)
}

function nextOrderNumber() {
  // Ojo: la base importada trae números de Firestore con formatos variados
  // (ORD-12341, ORD-93645, y algunos generados con letras), así que se toma el
  // mayor valor numérico parseable y se busca el primer hueco libre.
  const used = new Set(db.prepare('SELECT order_number FROM orders').all().map((r) => r.order_number))
  const max = [...used].reduce((m, value) => {
    const digits = Number(String(value).replace(/\D/g, ''))
    return Number.isFinite(digits) ? Math.max(m, digits) : m
  }, 0)
  let candidate = Math.max(max + 1, 12341)
  while (used.has(`ORD-${candidate}`)) candidate += 1
  return `ORD-${candidate}`
}

function invoiceTotals(orderId) {
  const items = rows('SELECT price FROM order_items WHERE order_id = ?', [orderId])
  const order = db.prepare('SELECT estimated_cost, deposit FROM orders WHERE id = ?').get(orderId)
  const subtotal = items.reduce((s, i) => s + i.price, 0)
  const total = subtotal || order.estimated_cost || 0
  const deposit = order.deposit || 0
  return { subtotal, total, deposit, balance: Math.max(total - deposit, 0) }
}

function addInvoice(orderId, type, orderNumber) {
  const existing = db.prepare('SELECT id FROM invoices WHERE order_id = ? AND type = ?').get(orderId, type)
  if (existing) return
  const { subtotal, total, deposit, balance } = invoiceTotals(orderId)
  db.prepare(
    'INSERT INTO invoices (order_id, number, type, subtotal, total, deposit, balance, created_at) VALUES (?,?,?,?,?,?,?,?)',
  ).run(orderId, `${type === 'entrega' ? 'E' : 'R'}-${orderNumber}`, type, subtotal, total, deposit, balance, new Date().toISOString())
}

export function createOrder(input) {
  const now = new Date().toISOString()
  const orderNumber = nextOrderNumber()
  const tx = db.transaction(() => {
    const customerId = upsertCustomer({ ...(input.customer ?? {}), type: 'clientePropio' })
    const info = db
      .prepare(`INSERT INTO orders (order_number, customer_id, device_type, device_brand, device_model,
        device_serial, device_color, reported_fault, fault_tags, accessories, physical_notes,
        estimated_cost, deposit, estimated_date, technician, status, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(
        orderNumber,
        customerId,
        input.device?.type ?? 'consola',
        input.device?.brand ?? null,
        input.device?.model ?? null,
        input.device?.serial ?? null,
        input.device?.color ?? null,
        input.reportedFault ?? null,
        JSON.stringify(input.faultTags ?? []),
        JSON.stringify(input.accessories ?? []),
        input.physicalNotes ?? null,
        Number(input.estimatedCost ?? 0),
        Number(input.deposit ?? 0),
        input.estimatedDate ?? null,
        input.technician ?? null,
        'pendiente',
        now,
        now,
      )
    const orderId = Number(info.lastInsertRowid)
    for (const photo of input.photos ?? []) {
      db.prepare('INSERT INTO order_photos (order_id, url, taken_at) VALUES (?,?,?)').run(
        orderId,
        photo.url,
        photo.takenAt ?? now,
      )
    }
    db.prepare('INSERT INTO status_events (order_id, status, at, note) VALUES (?,?,?,?)').run(
      orderId,
      'pendiente',
      now,
      'Equipo ingresado al taller',
    )
    addInvoice(orderId, 'recepcion', orderNumber)
    return orderId
  })
  tx()
  return getOrder(orderNumber)
}

function findRow(orderNumber) {
  return db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber)
}

export function updateOrderStatus(orderNumber, status) {
  const row = findRow(orderNumber)
  if (!row) return undefined
  const now = new Date().toISOString()
  const closed = ['completada', 'rechazada', 'fallida'].includes(status)
  const tx = db.transaction(() => {
    db.prepare('UPDATE orders SET status = ?, delivered_at = ?, updated_at = ? WHERE id = ?').run(
      status,
      closed ? row.delivered_at ?? now : null,
      now,
      row.id,
    )
    db.prepare('INSERT INTO status_events (order_id, status, at, note) VALUES (?,?,?,?)').run(row.id, status, now, null)
  })
  tx()
  if (status === 'completada') addInvoice(row.id, 'entrega', orderNumber)
  return getOrder(orderNumber)
}

export function updateOrderItems(orderNumber, items) {
  const row = findRow(orderNumber)
  if (!row) return undefined
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(row.id)
    for (const item of items) {
      db.prepare('INSERT INTO order_items (order_id, description, kind, price) VALUES (?,?,?,?)').run(
        row.id,
        item.description ?? '',
        item.kind === 'repuesto' ? 'repuesto' : 'servicio',
        Number(item.price ?? 0),
      )
    }
    db.prepare('UPDATE orders SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), row.id)
    db.prepare('DELETE FROM invoices WHERE order_id = ? AND type = ?').run(row.id, 'recepcion')
    addInvoice(row.id, 'recepcion', orderNumber)
    if (row.status === 'completada') {
      db.prepare('DELETE FROM invoices WHERE order_id = ? AND type = ?').run(row.id, 'entrega')
      addInvoice(row.id, 'entrega', orderNumber)
    }
  })
  tx()
  return getOrder(orderNumber)
}

export function listInvoices(orderNumber) {
  return rows(
    'SELECT i.* FROM invoices i JOIN orders o ON o.id = i.order_id WHERE o.order_number = ? ORDER BY i.id',
    [orderNumber],
  )
}

export function stats() {
  return {
    orders: db.prepare('SELECT COUNT(*) c FROM orders').get().c,
    customers: db.prepare('SELECT COUNT(*) c FROM customers').get().c,
    photos: db.prepare('SELECT COUNT(*) c FROM order_photos').get().c,
    invoices: db.prepare('SELECT COUNT(*) c FROM invoices').get().c,
    sales: db.prepare('SELECT COUNT(*) c FROM sales').get().c,
  }
}

export { db }

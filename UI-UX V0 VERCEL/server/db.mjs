/**
 * Base de datos local (SQLite vía better-sqlite3).
 * Guarda clientes, ingresos de equipos, estados, fotos e facturas.
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { normalizePhone } from './phone.mjs'

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

CREATE TABLE IF NOT EXISTS ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_number TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  payment_method TEXT NOT NULL DEFAULT 'efectivo',
  total REAL NOT NULL DEFAULT 0,
  total_cost REAL NOT NULL DEFAULT 0,
  profit REAL NOT NULL DEFAULT 0,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_ventas_created ON ventas(created_at);
CREATE INDEX IF NOT EXISTS idx_ventas_method ON ventas(payment_method);

CREATE TABLE IF NOT EXISTS venta_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  subtotal REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_venta_items_venta ON venta_items(venta_id);

CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  source TEXT NOT NULL DEFAULT 'chat',
  created_at TEXT NOT NULL,
  last_seen TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_phone ON whatsapp_contacts(phone);

CREATE TABLE IF NOT EXISTS estados_programados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT,
  caption TEXT,
  media_url TEXT,
  media_type TEXT,
  background_color TEXT,
  scheduled_at TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente',
  error TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_estados_status ON estados_programados(status, scheduled_at);

CREATE TABLE IF NOT EXISTS whatsapp_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS whatsapp_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  phone TEXT,
  kind TEXT NOT NULL,
  ok INTEGER NOT NULL DEFAULT 1,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_audit_at ON whatsapp_audit(at);
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

const CLOSED_STATUSES = ['completada', 'rechazada', 'fallida']

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

export function updateOrderDetails(orderNumber, patch = {}) {
  const row = findRow(orderNumber)
  if (!row) return undefined
  const now = new Date().toISOString()
  const d = patch.device ?? {}
  const c = patch.customer ?? {}
  const sets = []
  const params = []

  const columns = [
    ['device_type', patch.deviceType ?? d.type],
    ['device_brand', patch.brand ?? d.brand],
    ['device_model', patch.model ?? d.model],
    ['device_serial', patch.serial ?? d.serial],
    ['device_color', patch.color ?? d.color],
    ['reported_fault', patch.reportedFault],
    ['physical_notes', patch.physicalNotes],
    ['estimated_date', patch.estimatedDate],
    ['technician', patch.technician],
  ]
  for (const [column, value] of columns) {
    if (value === undefined) continue
    sets.push(`${column} = ?`)
    params.push(value || null)
  }
  for (const [column, key] of [['estimated_cost', 'estimatedCost'], ['deposit', 'deposit']]) {
    if (patch[key] === undefined) continue
    sets.push(`${column} = ?`)
    params.push(Number(patch[key]) || 0)
  }
  for (const [column, key] of [['fault_tags', 'faultTags'], ['accessories', 'accessories']]) {
    if (patch[key] === undefined) continue
    sets.push(`${column} = ?`)
    params.push(JSON.stringify(patch[key] ?? []))
  }

  const nextStatus = patch.status && patch.status !== row.status ? patch.status : null
  if (nextStatus) {
    sets.push('status = ?')
    params.push(nextStatus)
    sets.push('delivered_at = ?')
    params.push(CLOSED_STATUSES.includes(nextStatus) ? row.delivered_at ?? now : null)
  }
  sets.push('updated_at = ?')
  params.push(now)

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone),
         document_id = COALESCE(?, document_id), email = COALESCE(?, email) WHERE id = ?`,
    ).run(
      c.name?.trim() || null,
      c.phone?.trim() || null,
      c.documentId?.trim() || null,
      c.email?.trim() || null,
      row.customer_id,
    )
    db.prepare(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`).run(...params, row.id)
    if (nextStatus) {
      db.prepare('INSERT INTO status_events (order_id, status, at, note) VALUES (?,?,?,?)').run(
        row.id,
        nextStatus,
        now,
        'Datos editados',
      )
    }
    // Los importes pueden haber cambiado: regenera los comprobantes de la orden.
    db.prepare('DELETE FROM invoices WHERE order_id = ?').run(row.id)
    addInvoice(row.id, 'recepcion', orderNumber)
    if ((patch.status ?? row.status) === 'completada') addInvoice(row.id, 'entrega', orderNumber)
  })
  tx()
  return getOrder(orderNumber)
}

export function deleteOrder(orderNumber) {
  const row = findRow(orderNumber)
  if (!row) return false
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(row.id)
    db.prepare('DELETE FROM order_photos WHERE order_id = ?').run(row.id)
    db.prepare('DELETE FROM status_events WHERE order_id = ?').run(row.id)
    db.prepare('DELETE FROM invoices WHERE order_id = ?').run(row.id)
    db.prepare('DELETE FROM orders WHERE id = ?').run(row.id)
    // Si el cliente no tiene más órdenes, se elimina también para no dejar registros huérfanos.
    const left = db.prepare('SELECT COUNT(*) AS c FROM orders WHERE customer_id = ?').get(row.customer_id).c
    if (left === 0) db.prepare('DELETE FROM customers WHERE id = ?').run(row.customer_id)
  })
  tx()
  return true
}

export function listInvoices(orderNumber) {
  return rows(
    'SELECT i.* FROM invoices i JOIN orders o ON o.id = i.order_id WHERE o.order_number = ? ORDER BY i.id',
    [orderNumber],
  )
}

/* --------------------------------- ventas -------------------------------- */

export const PAYMENT_METHODS = ['efectivo', 'nequi', 'daviplata', 'llave', 'tarjeta']

function groupByVenta(ventaIds) {
  const map = new Map()
  if (ventaIds.length === 0) return map
  const list = rows(
    `SELECT * FROM venta_items WHERE venta_id IN (${ventaIds.map(() => '?').join(',')}) ORDER BY id`,
    ventaIds,
  )
  for (const row of list) {
    if (!map.has(row.venta_id)) map.set(row.venta_id, [])
    map.get(row.venta_id).push(row)
  }
  return map
}

function rowToVenta(row, items) {
  return {
    id: row.sale_number,
    dbId: row.id,
    createdAt: row.created_at,
    customerName: row.customer_name || undefined,
    customerPhone: row.customer_phone || undefined,
    paymentMethod: row.payment_method,
    total: row.total,
    totalCost: row.total_cost,
    profit: row.profit,
    notes: row.notes || undefined,
    items: items.map((i) => ({
      id: String(i.id),
      name: i.name,
      price: i.price,
      cost: i.cost,
      quantity: i.quantity,
      subtotal: i.subtotal,
    })),
  }
}

function nextSaleNumber() {
  const used = new Set(db.prepare('SELECT sale_number FROM ventas').all().map((r) => r.sale_number))
  const max = [...used].reduce((m, value) => {
    const digits = Number(String(value).replace(/\D/g, ''))
    return Number.isFinite(digits) ? Math.max(m, digits) : m
  }, 0)
  let candidate = Math.max(max + 1, 1001)
  while (used.has(`VTA-${candidate}`)) candidate += 1
  return `VTA-${candidate}`
}

export function listVentas(filters = {}) {
  const where = []
  const params = []
  if (filters.from) {
    where.push('v.created_at >= ?')
    params.push(filters.from)
  }
  if (filters.to) {
    where.push('v.created_at <= ?')
    params.push(filters.to)
  }
  if (filters.method && PAYMENT_METHODS.includes(filters.method)) {
    where.push('v.payment_method = ?')
    params.push(filters.method)
  }
  const q = (filters.q ?? '').trim()
  if (q) {
    const like = `%${q}%`
    where.push(`(
      COALESCE(v.customer_name, '') LIKE ? OR
      COALESCE(v.customer_phone, '') LIKE ? OR
      v.sale_number LIKE ? OR
      EXISTS (SELECT 1 FROM venta_items vi WHERE vi.venta_id = v.id AND vi.name LIKE ?)
    )`)
    params.push(like, like, like, like)
  }
  const sql = `SELECT v.* FROM ventas v ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY v.created_at DESC, v.id DESC`
  const list = rows(sql, params)
  const items = groupByVenta(list.map((v) => v.id))
  return list.map((v) => rowToVenta(v, items.get(v.id) ?? []))
}

export function getVenta(id) {
  const row = db.prepare('SELECT * FROM ventas WHERE id = ?').get(Number(id))
  if (!row) return undefined
  const items = groupByVenta([row.id]).get(row.id) ?? []
  return rowToVenta(row, items)
}

export function createVenta(input = {}) {
  const now = new Date().toISOString()
  const items = (Array.isArray(input.items) ? input.items : []).map((i) => ({
    name: String(i?.name ?? '').trim(),
    price: Math.max(0, Number(i?.price) || 0),
    cost: Math.max(0, Number(i?.cost) || 0),
    quantity: Math.max(1, Math.trunc(Number(i?.quantity) || 1)),
  }))
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const totalCost = items.reduce((s, i) => s + i.cost * i.quantity, 0)

  const tx = db.transaction(() => {
    const info = db
      .prepare(`INSERT INTO ventas (sale_number, created_at, customer_name, customer_phone,
        payment_method, total, total_cost, profit, notes) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(
        nextSaleNumber(),
        input.createdAt || now,
        input.customerName?.trim() || null,
        input.customerPhone?.trim() || null,
        input.paymentMethod,
        total,
        totalCost,
        total - totalCost,
        input.notes?.trim() || null,
      )
    const ventaId = Number(info.lastInsertRowid)
    const insertItem = db.prepare(
      'INSERT INTO venta_items (venta_id, name, price, cost, quantity, subtotal) VALUES (?,?,?,?,?,?)',
    )
    for (const item of items) {
      insertItem.run(ventaId, item.name, item.price, item.cost, item.quantity, item.price * item.quantity)
    }
    return ventaId
  })
  return getVenta(tx())
}

export function deleteVenta(id) {
  const row = db.prepare('SELECT id FROM ventas WHERE id = ?').get(Number(id))
  if (!row) return false
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM venta_items WHERE venta_id = ?').run(row.id)
    db.prepare('DELETE FROM ventas WHERE id = ?').run(row.id)
  })
  tx()
  return true
}

/**
 * Edita una venta ya registrada. Los totales siempre se recalculan desde los
 * ítems (nunca se aceptan del cliente).
 */
export function updateVenta(id, patch = {}) {
  const row = db.prepare('SELECT id FROM ventas WHERE id = ?').get(Number(id))
  if (!row) return undefined

  const tx = db.transaction(() => {
    if (Array.isArray(patch.items)) {
      db.prepare('DELETE FROM venta_items WHERE venta_id = ?').run(row.id)
      const insert = db.prepare(
        'INSERT INTO venta_items (venta_id, name, price, cost, quantity, subtotal) VALUES (?,?,?,?,?,?)',
      )
      for (const item of patch.items) {
        insert.run(row.id, item.name, item.price, item.cost, item.quantity, item.price * item.quantity)
      }
    }

    const items = rows('SELECT * FROM venta_items WHERE venta_id = ? ORDER BY id', [row.id])
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const totalCost = items.reduce((sum, item) => sum + item.cost * item.quantity, 0)

    const sets = []
    const params = []
    if (patch.customerName !== undefined) {
      sets.push('customer_name = ?')
      params.push(patch.customerName?.trim() || null)
    }
    if (patch.customerPhone !== undefined) {
      sets.push('customer_phone = ?')
      params.push(patch.customerPhone?.trim() || null)
    }
    if (patch.paymentMethod !== undefined) {
      sets.push('payment_method = ?')
      params.push(patch.paymentMethod)
    }
    if (patch.notes !== undefined) {
      sets.push('notes = ?')
      params.push(patch.notes?.trim() || null)
    }
    sets.push('total = ?', 'total_cost = ?', 'profit = ?')
    params.push(total, totalCost, total - totalCost)

    db.prepare(`UPDATE ventas SET ${sets.join(', ')} WHERE id = ?`).run(...params, row.id)
  })
  tx()
  return getVenta(row.id)
}

/**
 * Migra la vieja tabla `sales` (ítems en JSON) a `ventas`/`venta_items` la
 * primera vez, para que el historial no arranque vacío. No borra `sales`.
 */
function migrateLegacySales() {
  const already = db.prepare('SELECT COUNT(*) AS c FROM ventas').get().c
  if (already > 0) return
  const legacy = rows('SELECT * FROM sales ORDER BY id')
  if (legacy.length === 0) return
  const tx = db.transaction(() => {
    const insertVenta = db.prepare(`INSERT INTO ventas (sale_number, created_at, customer_name,
      customer_phone, payment_method, total, total_cost, profit, notes) VALUES (?,?,?,?,?,?,?,?,?)`)
    const insertItem = db.prepare(
      'INSERT INTO venta_items (venta_id, name, price, cost, quantity, subtotal) VALUES (?,?,?,?,?,?)',
    )
    for (const sale of legacy) {
      let items = []
      try {
        items = JSON.parse(sale.items || '[]')
      } catch {
        items = []
      }
      if (!Array.isArray(items) || items.length === 0) continue
      const parsed = items.map((i) => ({
        name: String(i?.name ?? 'Artículo').trim() || 'Artículo',
        price: Math.max(0, Number(i?.price) || 0),
        cost: Math.max(0, Number(i?.costPrice ?? i?.cost) || 0),
        quantity: Math.max(1, Math.trunc(Number(i?.quantity) || 1)),
      }))
      const total = parsed.reduce((s, i) => s + i.price * i.quantity, 0)
      const totalCost = parsed.reduce((s, i) => s + i.cost * i.quantity, 0)
      const info = insertVenta.run(
        `VTA-L${String(sale.id).padStart(4, '0')}`,
        sale.sale_date || new Date().toISOString(),
        null,
        null,
        'efectivo',
        total,
        totalCost,
        total - totalCost,
        'Venta histórica migrada',
      )
      const ventaId = Number(info.lastInsertRowid)
      for (const item of parsed) {
        insertItem.run(ventaId, item.name, item.price, item.cost, item.quantity, item.price * item.quantity)
      }
    }
  })
  tx()
}

migrateLegacySales()

/* ------------------------------- whatsapp -------------------------------- */

export function upsertWhatsappContact({ phone, name, source = 'chat' }) {
  const normalized = normalizePhone(phone)
  if (!normalized) return null
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO whatsapp_contacts (phone, name, source, created_at, last_seen)
     VALUES (?,?,?,?,?)
     ON CONFLICT(phone) DO UPDATE SET
       name = COALESCE(NULLIF(TRIM(excluded.name), ''), whatsapp_contacts.name),
       source = CASE
         WHEN whatsapp_contacts.source = 'chat' OR excluded.source = 'chat' THEN 'chat'
         WHEN whatsapp_contacts.source IN ('orden', 'venta') THEN whatsapp_contacts.source
         WHEN excluded.source IN ('orden', 'venta') THEN excluded.source
         ELSE COALESCE(whatsapp_contacts.source, excluded.source)
       END,
       last_seen = excluded.last_seen`,
  ).run(normalized, (name ?? '').trim() || null, source, now, now)
  return normalized
}

export function listWhatsappContacts(limit = 500) {
  return rows('SELECT * FROM whatsapp_contacts ORDER BY last_seen DESC LIMIT ?', [limit]).map((r) => ({
    phone: r.phone,
    name: r.name || undefined,
    source: r.source,
    lastSeen: r.last_seen,
  }))
}

export function countWhatsappContacts() {
  return db.prepare('SELECT COUNT(*) c FROM whatsapp_contacts').get().c
}

/** Sincroniza los teléfonos de órdenes, ventas y clientes hacia los contactos de WhatsApp. */
export function syncWhatsappContacts() {
  const sources = [
    {
      source: 'orden',
      list: rows(
        `SELECT c.phone AS phone, c.name AS name FROM orders o
           JOIN customers c ON c.id = o.customer_id
          WHERE TRIM(COALESCE(c.phone, '')) <> ''`,
      ),
    },
    {
      source: 'venta',
      list: rows(
        `SELECT customer_phone AS phone, customer_name AS name FROM ventas
          WHERE TRIM(COALESCE(customer_phone, '')) <> ''`,
      ),
    },
  ]
  let count = 0
  const tx = db.transaction(() => {
    for (const { source, list } of sources) {
      for (const person of list) {
        if (upsertWhatsappContact({ phone: person.phone, name: person.name, source })) count += 1
      }
    }
  })
  tx()
  return count
}

/** Números sincronizados (sin sufijo) para armar el `statusJidList`. */
export function statusJidPhones(limit = 2000) {
  return rows('SELECT phone FROM whatsapp_contacts ORDER BY last_seen DESC LIMIT ?', [limit]).map((r) => r.phone)
}

/* --------------------- bitácora y estado del servicio WA ------------------ */

export function getMeta(key) {
  const row = db.prepare('SELECT value FROM whatsapp_meta WHERE key = ?').get(String(key))
  return row?.value ?? null
}

export function setMeta(key, value) {
  db.prepare(
    `INSERT INTO whatsapp_meta (key, value) VALUES (?,?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(String(key), String(value))
  return String(value)
}

/** Registra cada envío (o intento) para auditar los límites anti-bloqueo. */
export function logAudit({ phone = null, kind, ok = true, detail = null } = {}) {
  db.prepare('INSERT INTO whatsapp_audit (at, phone, kind, ok, detail) VALUES (?,?,?,?,?)').run(
    new Date().toISOString(),
    phone ? String(phone).slice(0, 20) : null,
    String(kind ?? 'texto').slice(0, 20),
    ok ? 1 : 0,
    detail ? String(detail).slice(0, 200) : null,
  )
}

export function countAudit({ since, kind, onlyOk = false } = {}) {
  const where = ['at >= ?']
  const params = [since]
  if (kind) {
    where.push('kind = ?')
    params.push(kind)
  }
  if (onlyOk) where.push('ok = 1')
  return db.prepare(`SELECT COUNT(*) c FROM whatsapp_audit WHERE ${where.join(' AND ')}`).get(...params).c
}

export function lastAudit({ kind, onlyOk = true } = {}) {
  const where = []
  const params = []
  if (kind) {
    where.push('kind = ?')
    params.push(kind)
  }
  if (onlyOk) where.push('ok = 1')
  const row = db
    .prepare(`SELECT at FROM whatsapp_audit ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY at DESC LIMIT 1`)
    .get(...params)
  return row?.at ?? null
}

export function pruneAudit(days = 30) {
  const limit = new Date(Date.now() - days * 86_400_000).toISOString()
  return db.prepare('DELETE FROM whatsapp_audit WHERE at < ?').run(limit).changes
}

function rowToEstado(row) {
  return {
    id: row.id,
    text: row.text || undefined,
    caption: row.caption || undefined,
    mediaUrl: row.media_url || undefined,
    mediaType: row.media_type || undefined,
    backgroundColor: row.background_color || undefined,
    scheduledAt: row.scheduled_at || undefined,
    status: row.status,
    error: row.error || undefined,
    createdAt: row.created_at,
    sentAt: row.sent_at || undefined,
  }
}

export function createEstado(input = {}) {
  const info = db
    .prepare(
      `INSERT INTO estados_programados (text, caption, media_url, media_type, background_color,
        scheduled_at, status, created_at) VALUES (?,?,?,?,?,?,'pendiente',?)`,
    )
    .run(
      input.text?.trim() || null,
      input.caption?.trim() || null,
      input.mediaUrl || null,
      input.mediaType || null,
      input.backgroundColor || null,
      input.scheduledAt || null,
      new Date().toISOString(),
    )
  return getEstado(Number(info.lastInsertRowid))
}

export function getEstado(id) {
  const row = db.prepare('SELECT * FROM estados_programados WHERE id = ?').get(Number(id))
  return row ? rowToEstado(row) : undefined
}

export function listEstados(limit = 60) {
  return rows(
    `SELECT * FROM estados_programados ORDER BY COALESCE(scheduled_at, created_at) DESC LIMIT ?`,
    [limit],
  ).map(rowToEstado)
}

export function deleteEstado(id) {
  return db.prepare('DELETE FROM estados_programados WHERE id = ?').run(Number(id)).changes > 0
}

export function pendingEstados(nowIso = new Date().toISOString(), limit = 3) {
  return rows(
    `SELECT * FROM estados_programados
      WHERE status = 'pendiente' AND (scheduled_at IS NULL OR scheduled_at <= ?)
      ORDER BY COALESCE(scheduled_at, created_at) LIMIT ?`,
    [nowIso, limit],
  ).map(rowToEstado)
}

export function markEstado(id, status, error = null) {
  db.prepare('UPDATE estados_programados SET status = ?, error = ?, sent_at = ? WHERE id = ?').run(
    status,
    error,
    status === 'publicado' ? new Date().toISOString() : null,
    Number(id),
  )
}

export function stats() {
  return {
    orders: db.prepare('SELECT COUNT(*) c FROM orders').get().c,
    customers: db.prepare('SELECT COUNT(*) c FROM customers').get().c,
    photos: db.prepare('SELECT COUNT(*) c FROM order_photos').get().c,
    invoices: db.prepare('SELECT COUNT(*) c FROM invoices').get().c,
    sales: db.prepare('SELECT COUNT(*) c FROM ventas').get().c,
  }
}

export { db, dataDir }

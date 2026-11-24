/**
 * API REST del taller (montada en /api).
 */
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import * as store from './db.mjs'
import * as wa from './whatsapp.mjs'

export const uploadsDir = process.env.UPLOADS_DIR ?? join(store.projectDir, 'uploads')
mkdirSync(uploadsDir, { recursive: true })

const STATUSES = ['pendiente', 'enRevision', 'esperandoConfirmacion', 'completada', 'rechazada', 'fallida']
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export const api = Router()

api.get('/health', (_req, res) => {
  res.json({ ok: true, ...store.stats() })
})

api.get('/orders', (_req, res) => {
  res.json(store.listOrders())
})

api.post('/orders', (req, res) => {
  const body = req.body ?? {}
  if (!body.customer?.name || !body.device?.model) {
    return res.status(400).json({ error: 'Faltan datos del cliente o del equipo.' })
  }
  res.status(201).json(store.createOrder(body))
})

api.get('/orders/:id', (req, res) => {
  const order = store.getOrder(req.params.id)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  res.json(order)
})

api.patch('/orders/:id', (req, res) => {
  const { status, items } = req.body ?? {}
  if (status) {
    if (!STATUSES.includes(status)) return res.status(400).json({ error: `Estado inválido: ${status}` })
    const order = store.updateOrderStatus(req.params.id, status)
    if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
    return res.json(order)
  }
  if (Array.isArray(items)) {
    const order = store.updateOrderItems(req.params.id, items)
    if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
    return res.json(order)
  }
  res.status(400).json({ error: 'Nada que actualizar.' })
})

api.put('/orders/:id', (req, res) => {
  const body = req.body ?? {}
  if (body.status !== undefined && !STATUSES.includes(body.status)) {
    return res.status(400).json({ error: `Estado inválido: ${body.status}` })
  }
  const order = store.updateOrderDetails(req.params.id, body)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  res.json(order)
})

/* Archivar en vez de borrar: reversible y no se pierde nada. */
api.post('/orders/:id/archive', (req, res) => {
  const order = store.setOrderArchived(req.params.id, true)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  res.json(order)
})

api.post('/orders/:id/restore', (req, res) => {
  const order = store.setOrderArchived(req.params.id, false)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  res.json(order)
})

/* ------------------------- pagos y entrega ------------------------- */

const MAX_PAGO = 100_000_000

/** Valida { amount, method, note }; devuelve el pago limpio o { error }. */
function readPayment(body, { optional = false } = {}) {
  const amount = Math.round(Number(body?.amount))
  if (optional && (body?.amount === undefined || body?.amount === null || amount === 0)) return { payment: null }
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_PAGO) return { error: 'El valor del pago no es válido.' }
  const method = String(body?.method ?? '')
  if (!store.PAYMENT_METHODS.includes(method)) return { error: 'Método de pago inválido.' }
  const note = typeof body?.note === 'string' ? body.note.slice(0, 200) : undefined
  return { payment: { amount, method, note } }
}

api.post('/orders/:id/payments', (req, res) => {
  const { payment, error } = readPayment(req.body)
  if (error) return res.status(400).json({ error })
  const order = store.addOrderPayment(req.params.id, payment)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  res.status(201).json(order)
})

api.delete('/orders/:id/payments/:paymentId', (req, res) => {
  const order = store.deleteOrderPayment(req.params.id, req.params.paymentId)
  if (order === undefined) return res.status(404).json({ error: 'Orden no encontrada.' })
  if (order === null) return res.status(404).json({ error: 'Pago no encontrado.' })
  res.json(order)
})

/* Entregar: marca la entrega (desde ahí cuenta la garantía) y cobra el saldo si se indica. */
api.post('/orders/:id/deliver', (req, res) => {
  const { payment, error } = readPayment(req.body, { optional: true })
  if (error) return res.status(400).json({ error })
  const result = store.deliverOrder(req.params.id, payment)
  if (result.error === 'not_found') return res.status(404).json({ error: 'Orden no encontrada.' })
  if (result.error === 'not_ready') return res.status(409).json({ error: 'La orden todavía está en el taller: primero márcala como lista.' })
  if (result.error === 'already') return res.status(409).json({ error: 'Esta orden ya se entregó.' })
  res.json(result.order)
})

api.post('/orders/:id/undeliver', (req, res) => {
  const order = store.undeliverOrder(req.params.id)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  res.json(order)
})

/* Borrado definitivo: solo de una orden archivada; borra también sus fotos del disco. */
api.delete('/orders/:id', (req, res) => {
  const result = store.deleteOrder(req.params.id)
  if (!result.ok && result.reason === 'not_found') return res.status(404).json({ error: 'Orden no encontrada.' })
  if (!result.ok) return res.status(409).json({ error: 'Primero archiva la orden: solo se borran órdenes archivadas.' })
  let photosRemoved = 0
  for (const url of result.photos) {
    if (!url.startsWith('/uploads/')) continue
    const file = basename(url)
    if (!file || file.startsWith('.')) continue
    try {
      unlinkSync(join(uploadsDir, file))
      photosRemoved += 1
    } catch {
      /* la foto ya no estaba en el disco */
    }
  }
  res.json({ ok: true, photosRemoved })
})

api.post('/orders/:id/comments', (req, res) => {
  const text = String(req.body?.text ?? '').trim()
  const author = String(req.body?.author ?? '').trim()
  if (!text) return res.status(400).json({ error: 'El comentario está vacío.' })
  if (text.length > 1000) return res.status(400).json({ error: 'Máximo 1000 caracteres.' })
  const order = store.addOrderComment(req.params.id, text, author || null)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  res.status(201).json(order)
})

api.get('/orders/:id/invoices', (req, res) => {
  res.json(store.listInvoices(req.params.id))
})

/* ----------------------- consulta pública (web externa) ------------------- */

/**
 * Buscador de órdenes de la web pública (tepcyc.com).
 * Exige el número de orden **y** los últimos 4 dígitos del teléfono del cliente
 * (`?t=1234`): sin la comprobación, los números secuenciales permitirían espiar
 * órdenes ajenas. Devuelve estado, equipo, cifras, nombre del cliente y falla
 * reportada; nunca teléfono, documento, correo, fotos, historial ni notas.
 * El sitio estático lo consume a través de su propio proxy (`/api/orden/...`),
 * así que no se emite CORS: nadie puede leerlo desde otro origen.
 */
function numeroDeOrden(valor) {
  const limpio = String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32)
  if (!limpio) return ''
  if (/^ORD\d+$/.test(limpio)) return `ORD-${limpio.slice(3)}`
  if (/^\d+$/.test(limpio)) return `ORD-${limpio}`
  return limpio
}

/*
 * Freno de fuerza bruta: los 4 dígitos son solo 10.000 combinaciones y los números
 * de orden son seguidos. La web pública llega por un proxy local (siempre la misma IP),
 * así que el límite va por número de orden y, además, uno global.
 */
const INTENTOS_POR_ORDEN = 8
const INTENTOS_GLOBALES = 300
const VENTANA_MS = 60 * 60 * 1000
const fallosPorOrden = new Map()
let fallosGlobales = { cuenta: 0, desde: Date.now() }

function bloqueada(numero) {
  const ahora = Date.now()
  if (ahora - fallosGlobales.desde > VENTANA_MS) fallosGlobales = { cuenta: 0, desde: ahora }
  if (fallosGlobales.cuenta >= INTENTOS_GLOBALES) return true
  const registro = fallosPorOrden.get(numero)
  if (!registro) return false
  if (ahora - registro.desde > VENTANA_MS) {
    fallosPorOrden.delete(numero)
    return false
  }
  return registro.cuenta >= INTENTOS_POR_ORDEN
}

function anotarFallo(numero) {
  const ahora = Date.now()
  fallosGlobales.cuenta += 1
  const registro = fallosPorOrden.get(numero)
  if (!registro || ahora - registro.desde > VENTANA_MS) fallosPorOrden.set(numero, { cuenta: 1, desde: ahora })
  else registro.cuenta += 1
  if (fallosPorOrden.size > 5000) {
    for (const [clave, r] of fallosPorOrden) if (ahora - r.desde > VENTANA_MS) fallosPorOrden.delete(clave)
  }
}

api.get('/public/orden/:numero', (req, res) => {
  const numero = numeroDeOrden(req.params.numero)
  if (numero && bloqueada(numero)) {
    return res.status(429).json({ encontrada: false, error: 'Demasiados intentos. Prueba de nuevo en una hora.' })
  }
  const sufijo = String(req.query?.t ?? '').replace(/\D/g, '').slice(0, 4)
  const encontrada = numero ? store.getOrder(numero) : undefined
  // Las órdenes archivadas no se muestran en la web.
  const orden = encontrada?.archivedAt ? undefined : encontrada
  // Segunda llave: los últimos 4 dígitos del teléfono registrado en la orden.
  const telefono = String(orden?.customer?.phone ?? '').replace(/\D/g, '')
  if (!orden || sufijo.length !== 4 || !telefono.endsWith(sufijo)) {
    if (numero) anotarFallo(numero)
    return res.status(404).json({ encontrada: false })
  }
  const subtotal = (orden.items ?? []).reduce((suma, item) => suma + (Number(item.price) || 0), 0)
  const total = subtotal || Number(orden.estimatedCost) || 0
  const abono = Number(orden.deposit) || 0
  res.json({
    encontrada: true,
    numero: orden.id,
    estado: orden.status,
    cliente: orden.customer.name || '',
    equipo: { tipo: orden.device.type, marca: orden.device.brand, modelo: orden.device.model },
    falla: orden.reportedFault || '',
    total,
    abono,
    saldo: Math.max(total - abono, 0),
    recibidaEl: orden.createdAt,
    estimadaEl: orden.estimatedDate ?? null,
    // «Lista para recoger» (completada) y «Entregada» ya no son lo mismo: la entrega se marca aparte.
    entregada: Boolean(orden.deliveredAt),
    entregadaEl: orden.deliveredAt ?? null,
    garantiaDias: orden.warrantyDays ?? null,
  })
})

/* ---------------------------------- caja --------------------------------- */

function isIsoDate(value) {
  return typeof value === 'string' && value.length >= 10 && !Number.isNaN(new Date(value).getTime())
}

/* Lo que entró en un rango (ventas + pagos de reparaciones), por método de pago. */
api.get('/caja', (req, res) => {
  const { from, to } = req.query ?? {}
  if (!isIsoDate(from) || !isIsoDate(to)) return res.status(400).json({ error: 'Indica el rango de fechas (desde y hasta).' })
  const desde = new Date(String(from)).toISOString()
  const hasta = new Date(String(to)).toISOString()
  if (desde > hasta) return res.status(400).json({ error: 'La fecha «desde» es posterior a «hasta».' })
  res.json(store.cashSummary({ from: desde, to: hasta }))
})

/* --------------------------------- ventas -------------------------------- */

function normalizeMoney(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : NaN
}

api.get('/ventas', (req, res) => {
  const { q, from, to, method } = req.query ?? {}
  if (from !== undefined && !isIsoDate(from)) return res.status(400).json({ error: 'Fecha "desde" inválida.' })
  if (to !== undefined && !isIsoDate(to)) return res.status(400).json({ error: 'Fecha "hasta" inválida.' })
  if (method !== undefined && !store.PAYMENT_METHODS.includes(String(method))) {
    return res.status(400).json({ error: 'Método de pago inválido.' })
  }

  const ventas = store.listVentas({
    q: typeof q === 'string' ? q.slice(0, 80) : '',
    from: from ? String(from) : '',
    to: to ? String(to) : '',
    method: method ? String(method) : '',
  })

  const byMethod = Object.fromEntries(store.PAYMENT_METHODS.map((m) => [m, 0]))
  let total = 0
  let totalCost = 0
  for (const venta of ventas) {
    total += venta.total
    totalCost += venta.totalCost
    byMethod[venta.paymentMethod] = (byMethod[venta.paymentMethod] ?? 0) + venta.total
  }

  res.json({
    ventas,
    summary: {
      count: ventas.length,
      total,
      totalCost,
      profit: total - totalCost,
      averageTicket: ventas.length ? Math.round(total / ventas.length) : 0,
      byMethod,
    },
  })
})

/** Valida los ítems de una venta; lanza {status:400, message} si algo no cuadra. */
function cleanVentaItems(rawItems) {
  const items = Array.isArray(rawItems) ? rawItems : []
  const fail = (message) => {
    throw Object.assign(new Error(message), { status: 400 })
  }
  if (items.length === 0) fail('La venta debe tener al menos un artículo.')
  if (items.length > 200) fail('La venta supera el máximo de 200 artículos.')

  return items.map((item, index) => {
    const name = String(item?.name ?? '').trim()
    if (!name) fail(`El artículo #${index + 1} no tiene nombre.`)
    if (name.length > 120) fail(`El nombre del artículo #${index + 1} es demasiado largo.`)
    const price = normalizeMoney(item?.price)
    const cost = normalizeMoney(item?.cost ?? 0)
    if (Number.isNaN(price)) fail(`Precio inválido en el artículo #${index + 1}.`)
    if (Number.isNaN(cost)) fail(`Costo inválido en el artículo #${index + 1}.`)
    const quantity = Math.trunc(Number(item?.quantity ?? 1))
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 999) {
      fail(`Cantidad inválida en el artículo #${index + 1}.`)
    }
    // Línea del catálogo (descuenta existencias); si no, es un artículo escrito a mano.
    const productId = /^[1-9]\d{0,15}$/.test(String(item?.productId ?? '')) ? Number(item.productId) : null
    return { name, price, cost, quantity, productId }
  })
}

function cleanVentaCustomer(body) {
  const customerName = String(body.customerName ?? '').trim().slice(0, 120)
  const customerPhone = String(body.customerPhone ?? '').trim().slice(0, 30)
  if (customerPhone && !/^[+()\-\s\d]{7,30}$/.test(customerPhone)) {
    throw Object.assign(new Error('El teléfono del cliente no es válido.'), { status: 400 })
  }
  return { customerName, customerPhone }
}

api.post('/ventas', (req, res) => {
  const body = req.body ?? {}
  const method = String(body.paymentMethod ?? '').toLowerCase()
  if (!store.PAYMENT_METHODS.includes(method)) return res.status(400).json({ error: 'Método de pago inválido.' })

  let cleanItems
  let customer
  try {
    cleanItems = cleanVentaItems(body.items)
    customer = cleanVentaCustomer(body)
  } catch (error) {
    return res.status(error?.status ?? 400).json({ error: error.message })
  }

  let venta
  try {
    venta = store.createVenta({
      items: cleanItems,
      paymentMethod: method,
      customerName: customer.customerName,
      customerPhone: customer.customerPhone,
      notes: String(body.notes ?? '').slice(0, 400),
    })
  } catch (error) {
    // 409: no alcanzan las existencias del catálogo (la venta no se guarda).
    if (error?.status === 409) return res.status(409).json({ error: error.message })
    throw error
  }
  res.status(201).json(venta)
})

/** Edición de una venta ya registrada (cliente, método, nota e ítems). */
api.put('/ventas/:id', (req, res) => {
  const body = req.body ?? {}
  if (body.paymentMethod !== undefined) {
    const method = String(body.paymentMethod).toLowerCase()
    if (!store.PAYMENT_METHODS.includes(method)) {
      return res.status(400).json({ error: 'Método de pago inválido.' })
    }
    body.paymentMethod = method
  }

  const patch = {}
  try {
    if (body.items !== undefined) patch.items = cleanVentaItems(body.items)
    if (body.customerName !== undefined || body.customerPhone !== undefined) {
      const customer = cleanVentaCustomer({ customerName: body.customerName, customerPhone: body.customerPhone })
      if (body.customerName !== undefined) patch.customerName = customer.customerName
      if (body.customerPhone !== undefined) patch.customerPhone = customer.customerPhone
    }
    if (body.paymentMethod !== undefined) patch.paymentMethod = body.paymentMethod
    if (body.notes !== undefined) patch.notes = String(body.notes).slice(0, 400)
  } catch (error) {
    return res.status(error?.status ?? 400).json({ error: error.message })
  }

  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nada que actualizar.' })

  let venta
  try {
    venta = store.updateVenta(req.params.id, patch)
  } catch (error) {
    if (error?.status === 409) return res.status(409).json({ error: error.message })
    throw error
  }
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada.' })
  res.json(venta)
})

/* -------------------------------- catálogo ------------------------------- */

const PHOTO_URL = /^\/uploads\/[\w-]+\.(?:jpg|png|webp)$/

/** Valida un producto. `partial` = edición (solo lo que venga). Lanza {status:400}. */
function cleanProducto(body, partial = false) {
  const fail = (message) => {
    throw Object.assign(new Error(message), { status: 400 })
  }
  const out = {}
  const has = (key) => body[key] !== undefined
  if (!partial || has('name')) {
    const name = String(body.name ?? '').trim().replace(/\s+/g, ' ')
    if (!name) fail('Escribe el nombre del producto.')
    if (name.length > 80) fail('El nombre es demasiado largo (máximo 80 letras).')
    out.name = name
  }
  if (!partial || has('category')) {
    const category = String(body.category ?? '')
    if (!store.PRODUCT_CATEGORIES.includes(category)) fail('Elige una categoría válida.')
    out.category = category
  }
  if (!partial || has('price')) {
    const price = normalizeMoney(body.price)
    if (Number.isNaN(price) || price <= 0) fail('El precio debe ser mayor a cero.')
    if (price > 99_999_999) fail('El precio es demasiado alto.')
    out.price = price
  }
  if (has('cost')) {
    const cost = normalizeMoney(body.cost)
    if (Number.isNaN(cost) || cost > 99_999_999) fail('El costo no es válido.')
    out.cost = cost
  }
  if (has('description')) out.description = String(body.description ?? '').trim().slice(0, 300)
  if (has('photoUrl')) {
    const photoUrl = String(body.photoUrl ?? '')
    if (photoUrl && !PHOTO_URL.test(photoUrl)) fail('La foto no es válida: súbela de nuevo.')
    out.photoUrl = photoUrl
  }
  if (has('available')) out.available = Boolean(body.available)
  if (has('stock')) {
    if (body.stock === null || body.stock === '') out.stock = null
    else {
      const stock = Number(body.stock)
      if (!Number.isInteger(stock) || stock < 0 || stock > 9999) fail('Las existencias deben ser un número entre 0 y 9999.')
      out.stock = stock
    }
  }
  return out
}

/** Borra del disco la foto de un producto si ya nadie la usa. */
function removeProductPhoto(url) {
  if (!url || !PHOTO_URL.test(url) || store.productPhotoInUse(url)) return
  try {
    unlinkSync(join(uploadsDir, basename(url)))
  } catch {
    /* ya no estaba */
  }
}

api.get('/productos', (_req, res) => {
  res.json(store.listProductos())
})

api.post('/productos', (req, res) => {
  let input
  try {
    input = cleanProducto(req.body ?? {})
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
  res.status(201).json(store.createProducto(input))
})

api.put('/productos/:id', (req, res) => {
  let patch
  try {
    patch = cleanProducto(req.body ?? {}, true)
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
  const before = store.getProducto(req.params.id)
  if (!before) return res.status(404).json({ error: 'Producto no encontrado.' })
  const producto = store.updateProducto(before.id, patch)
  if (patch.photoUrl !== undefined && before.photoUrl && before.photoUrl !== producto.photoUrl) {
    removeProductPhoto(before.photoUrl)
  }
  res.json(producto)
})

api.delete('/productos/:id', (req, res) => {
  const removed = store.deleteProducto(req.params.id)
  if (!removed) return res.status(404).json({ error: 'Producto no encontrado.' })
  removeProductPhoto(removed.photoUrl)
  res.json({ ok: true })
})

/* Tienda de la web (tepcyc.com la pide a través de su server.py): solo lectura y sin costos. */
api.get('/public/productos', (_req, res) => {
  const productos = store.listProductosPublicos().map((p) => ({
    id: p.id,
    nombre: p.name,
    categoria: p.category,
    descripcion: p.description ?? '',
    precio: p.price,
    // La web arma la ruta de la foto; `foto` es la versión (cambia al cambiar la foto o el producto).
    foto: p.photoUrl ? Date.parse(p.updatedAt).toString(36) : '',
  }))
  res.setHeader('Cache-Control', 'no-store')
  res.json({ productos })
})

api.get('/public/productos/:id/foto', (req, res) => {
  const producto = store.getProducto(req.params.id)
  const visible = producto?.available && (producto.stock === null || producto.stock > 0)
  if (!visible || !producto.photoUrl || !PHOTO_URL.test(producto.photoUrl)) {
    return res.status(404).json({ error: 'Sin foto.' })
  }
  res.setHeader('Cache-Control', 'public, max-age=86400')
  res.sendFile(join(uploadsDir, basename(producto.photoUrl)), (error) => {
    if (error && !res.headersSent) res.status(404).json({ error: 'Sin foto.' })
  })
})

api.get('/ventas/:id', (req, res) => {
  const venta = store.getVenta(req.params.id)
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada.' })
  res.json(venta)
})

api.delete('/ventas/:id', (req, res) => {
  if (!store.deleteVenta(req.params.id)) return res.status(404).json({ error: 'Venta no encontrada.' })
  res.json({ ok: true })
})

/* ------------------------------- whatsapp -------------------------------- */

const MEDIA_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'application/pdf': 'pdf',
}

/** Guarda un archivo en data URL dentro de /uploads y devuelve su ruta y URL. */
function saveDataUrl(dataUrl, { maxBytes, allowed }) {
  const match = typeof dataUrl === 'string' ? dataUrl.match(/^data:([\w/+.-]+);base64,(.+)$/s) : null
  if (!match) return { error: 'Se esperaba un archivo en data URL.' }
  const [, mime, base64] = match
  if (!allowed.includes(mime)) return { error: `Formato no soportado (${mime}).` }
  const buffer = Buffer.from(base64, 'base64')
  if (!buffer.length) return { error: 'El archivo está vacío.' }
  if (buffer.length > maxBytes) return { error: `El archivo supera ${Math.round(maxBytes / 1024 / 1024)} MB.` }
  const file = `${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}.${MEDIA_EXT[mime]}`
  writeFileSync(join(uploadsDir, file), buffer)
  return { url: `/uploads/${file}`, path: join(uploadsDir, file), type: mime, bytes: buffer.length }
}

function waError(res, error) {
  const code = error?.code
  if (code === 'WA_BAD_PHONE') return res.status(400).json({ error: error.message })
  if (code === 'WA_BULK_GUARD') return res.status(429).json({ error: error.message, guard: true })
  if (code === 'WA_COOLDOWN') return res.status(429).json({ error: error.message, paused: true })
  if (code === 'WA_GRACE') return res.status(429).json({ error: error.message, grace: true })
  if (code === 'WA_OFFLINE') return res.status(409).json({ error: 'WhatsApp no está conectado.', offline: true })
  if (code === 'WA_RATE_LIMIT') return res.status(429).json({ error: error.message })
  return res.status(500).json({ error: error?.message ?? 'Error al enviar por WhatsApp.' })
}

api.get('/whatsapp/status', (_req, res) => {
  res.json(wa.getStatus())
})

api.post('/whatsapp/restart', async (_req, res) => {
  res.json(await wa.restartSession())
})

api.post('/whatsapp/logout', async (_req, res) => {
  res.json(await wa.logoutSession())
})

/** Reanuda los envíos si el enfriamiento automático fue una falsa alarma. */
api.post('/whatsapp/resume', (_req, res) => {
  res.json(wa.resumeSending())
})

api.post('/whatsapp/send', async (req, res) => {
  const { phone, message } = req.body ?? {}
  try {
    const sent = await wa.sendText(phone, String(message ?? '').slice(0, 4000))
    res.json({ ok: true, id: sent?.key?.id ?? null, to: phone })
  } catch (error) {
    waError(res, error)
  }
})

/** Mensaje de actualización de una orden, con sus fotos si se piden. */
api.post('/whatsapp/send-order', async (req, res) => {
  const { orderId, phone, message, includePhotos, cardUrl } = req.body ?? {}
  if (!orderId && !phone) return res.status(400).json({ error: 'Falta la orden o el teléfono.' })
  const order = orderId ? store.getOrder(String(orderId)) : undefined
  const target = phone || order?.customer?.phone
  if (!target) return res.status(400).json({ error: 'La orden no tiene teléfono registrado.' })
  const text = String(message ?? '').slice(0, 4000)
  if (!text) return res.status(400).json({ error: 'El mensaje está vacío.' })
  try {
    const photos = includePhotos && order ? order.photos.map((p) => p.url) : []
    const result = await wa.sendOrderUpdate({ phone: target, message: text, photos, cardUrl: cardUrl ? String(cardUrl) : undefined })
    res.json({ ok: true, ...result, to: target })
  } catch (error) {
    waError(res, error)
  }
})

/** Comprobante o recibo en PDF (el PDF lo genera el navegador con jsPDF). */
api.post('/whatsapp/send-document', async (req, res) => {
  const { phone, caption, fileName, dataUrl, cardUrl } = req.body ?? {}
  if (!phone) return res.status(400).json({ error: 'Falta el teléfono del cliente.' })
  const pdf = /^data:application\/pdf;base64,/.test(String(dataUrl ?? ''))
    ? { buffer: Buffer.from(String(dataUrl).replace(/^data:application\/pdf;base64,/, ''), 'base64') }
    : null
  if (!pdf) return res.status(400).json({ error: 'Se esperaba el PDF en data URL.' })
  if (pdf.buffer.length > 8 * 1024 * 1024) return res.status(413).json({ error: 'El PDF supera 8 MB.' })
  try {
    const sent = await wa.sendDocument(phone, {
      buffer: pdf.buffer,
      fileName: String(fileName ?? 'comprobante.pdf').slice(0, 80),
      mimetype: 'application/pdf',
      caption: caption ? String(caption).slice(0, 900) : undefined,
    })
    // Tarjeta con la miniatura de la web: va después del PDF, best-effort.
    let card = null
    if (cardUrl) {
      try {
        const tarjeta = await wa.sendLinkCard(phone, { url: String(cardUrl) })
        card = tarjeta?.key?.id ?? 'ok'
      } catch (error) {
        card = `error: ${error?.message ?? error}`
      }
    }
    res.json({ ok: true, id: sent?.key?.id ?? null, to: phone, card })
  } catch (error) {
    waError(res, error)
  }
})

api.get('/whatsapp/contactos', (_req, res) => {
  res.json({ total: store.countWhatsappContacts(), contactos: store.listWhatsappContacts(400) })
})

api.post('/whatsapp/sync', (_req, res) => {
  res.json({ ok: true, actualizados: store.syncWhatsappContacts(), total: store.countWhatsappContacts() })
})

/**
 * Descarga de la agenda en formato vCard (.vcf) para importarla en el teléfono.
 * Sirve para que el número desde el que se suben estados tenga agendados a todos
 * los contactos (WhatsApp solo muestra estados a números agendados o incluidos
 * explícitamente en la lista de destinatarios).
 */
api.get('/whatsapp/agenda.vcf', (_req, res) => {
  const contactos = store.listWhatsappContacts(50000)
  const limpiar = (texto) =>
    String(texto ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/([,;])/g, '\\$1')
      .replace(/\n/g, ' ')
      .trim()
  const tarjetas = contactos.map((c) => {
    const nombre = limpiar(c.name) || `Contacto ${c.phone.slice(-4)}`
    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${nombre}`,
      `N:${nombre};;;;`,
      `TEL;TYPE=CELL:+${c.phone}`,
      'END:VCARD',
    ].join('\r\n')
  })
  const cuerpo = tarjetas.join('\r\n')
  res.setHeader('Content-Type', 'text/vcard; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="contactos-tepcyc.vcf"')
  res.send(`${cuerpo}\r\n`)
})

/**
 * Envía la agenda completa a los contactos de Google del dueño.
 * El navegador consigue un access token (Google Identity Services, sin secreto de
 * cliente) con permiso `contacts` y aquí se crean por lotes con la People API.
 * Requiere la People API habilitada en el proyecto de Google Cloud.
 */
api.post('/whatsapp/google-contacts', async (req, res) => {
  const token = String(req.body?.accessToken ?? '').trim()
  if (!token) return res.status(400).json({ error: 'Falta el permiso de Google.' })
  const contactos = store.listWhatsappContacts(50000)
  if (!contactos.length) return res.json({ ok: true, total: 0, creados: 0, fallos: [] })

  const nombre = (c) => c.name?.trim() || `Contacto ${c.phone.slice(-4)}`
  const lotes = []
  for (let i = 0; i < contactos.length; i += 200) lotes.push(contactos.slice(i, i + 200))

  let creados = 0
  const fallos = []
  for (const lote of lotes) {
    const cuerpo = {
      contacts: lote.map((c) => ({
        contactPerson: {
          names: [{ givenName: nombre(c), unstructuredName: nombre(c) }],
          phoneNumbers: [{ value: `+${c.phone}`, type: 'mobile' }],
        },
      })),
      readMask: 'names,phoneNumbers',
    }
    const respuesta = await fetch('https://people.googleapis.com/v1/people:batchCreateContacts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    }).catch((error) => ({ ok: false, status: 0, json: async () => ({ error: { message: error?.message } }) }))
    if (respuesta.ok) {
      creados += lote.length
    } else {
      const detalle = await respuesta.json().catch(() => ({}))
      fallos.push({
        lote: `${lote[0].phone}…${lote[lote.length - 1].phone}`,
        estado: respuesta.status,
        error: detalle?.error?.message ?? 'Error de Google',
      })
      if (respuesta.status === 401 || respuesta.status === 403) break
    }
  }
  res.json({ ok: fallos.length === 0, total: contactos.length, creados, fallos })
})

api.get('/whatsapp/estados', (_req, res) => {
  res.json(store.listEstados(60))
})

api.post('/whatsapp/estados', async (req, res) => {
  const body = req.body ?? {}
  const text = String(body.text ?? '').trim().slice(0, 700)
  const caption = String(body.caption ?? '').trim().slice(0, 700)
  const mediaType = body.mediaType === 'video' ? 'video' : 'image'
  let media
  if (body.mediaDataUrl) {
    media = saveDataUrl(body.mediaDataUrl, {
      maxBytes: mediaType === 'video' ? 12 * 1024 * 1024 : 8 * 1024 * 1024,
      allowed: mediaType === 'video' ? ['video/mp4'] : ['image/jpeg', 'image/png', 'image/webp'],
    })
    if (media.error) return res.status(400).json({ error: media.error })
  }
  if (!text && !caption && !media) {
    return res.status(400).json({ error: 'Escribe un texto o adjunta una imagen/video.' })
  }

  const scheduledAt = body.scheduledAt ? new Date(String(body.scheduledAt)) : null
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    return res.status(400).json({ error: 'La fecha de programación no es válida.' })
  }
  // Publicar en el momento exige la sesión activa; no se crea basura en la tabla.
  if (!scheduledAt && !wa.isConnected()) {
    return res.status(409).json({ error: 'WhatsApp no está conectado.', offline: true })
  }

  const estado = store.createEstado({
    text: media && !caption ? text : caption || text,
    caption: caption || text,
    mediaUrl: media?.url,
    mediaType: media ? mediaType : undefined,
    backgroundColor: typeof body.backgroundColor === 'string' ? body.backgroundColor.slice(0, 9) : undefined,
    scheduledAt: scheduledAt ? scheduledAt.toISOString() : undefined,
    // «Ahora» se marca como publicando para que el ticker no lo tome en paralelo
    // y genere un «estado aplazado» falso mientras el envío está en curso.
    status: scheduledAt ? 'pendiente' : 'publicando',
  })

  // Si es "ahora" se publica de inmediato; si es programado lo toma el ticker.
  if (!scheduledAt) {
    try {
      await wa.publishEstado({
        text: estado.text,
        caption: estado.caption,
        mediaPath: media?.path,
        mediaType: estado.mediaType,
        backgroundColor: estado.backgroundColor,
        // audience:'yo' publica solo para la propia cuenta y audienceLimit recorta
        // la lista de destinatarios: ambos son solo para diagnóstico.
        onlyMe: body.audience === 'yo',
        maxJids: Number.isInteger(body.audienceLimit) ? body.audienceLimit : undefined,
        estadoId: estado.id,
      })
      store.markEstado(estado.id, 'publicado')
    } catch (error) {
      store.markEstado(estado.id, 'error', error?.message ?? String(error))
      return waError(res, error)
    }
  }
  res.status(201).json(store.getEstado(estado.id))
})

api.delete('/whatsapp/estados/:id', (req, res) => {
  if (!store.deleteEstado(req.params.id)) return res.status(404).json({ error: 'Estado no encontrado.' })
  res.json({ ok: true })
})

api.get('/whatsapp/planes', (_req, res) => {
  res.json(store.listPlanes())
})

/** Estados automáticos semanales: días (0=dom..6=sáb) + hora local del taller. */
api.post('/whatsapp/planes', (req, res) => {
  const body = req.body ?? {}
  const text = String(body.text ?? '').trim().slice(0, 700)
  const caption = String(body.caption ?? '').trim().slice(0, 700)
  const days = Array.isArray(body.days) ? body.days.map(Number) : []
  const time = String(body.time ?? '').trim()
  const timezone = String(body.timezone ?? 'America/Bogota').trim() || 'America/Bogota'
  const mediaType = body.mediaType === 'video' ? 'video' : 'image'

  if (!days.length) return res.status(400).json({ error: 'Elige al menos un día de la semana.' })
  if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return res.status(400).json({ error: 'Día de la semana inválido.' })
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return res.status(400).json({ error: 'La hora debe ser HH:MM.' })

  let media
  if (body.mediaDataUrl) {
    media = saveDataUrl(body.mediaDataUrl, {
      maxBytes: mediaType === 'video' ? 12 * 1024 * 1024 : 8 * 1024 * 1024,
      allowed: mediaType === 'video' ? ['video/mp4'] : ['image/jpeg', 'image/png', 'image/webp'],
    })
    if (media.error) return res.status(400).json({ error: media.error })
  }
  if (!text && !caption && !media) {
    return res.status(400).json({ error: 'Escribe un texto o adjunta una imagen/video.' })
  }

  const plan = store.createPlan({
    text: caption || text,
    caption: caption || text,
    mediaUrl: media?.url,
    mediaType: media ? mediaType : undefined,
    backgroundColor: !media && typeof body.backgroundColor === 'string' ? body.backgroundColor.slice(0, 9) : undefined,
    days,
    time,
    timezone,
  })
  res.status(201).json(plan)
})

api.patch('/whatsapp/planes/:id', (req, res) => {
  if (!store.getPlan(req.params.id)) return res.status(404).json({ error: 'Automatización no encontrada.' })
  const body = req.body ?? {}
  if (body.time !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(body.time))) {
    return res.status(400).json({ error: 'La hora debe ser HH:MM.' })
  }
  if (body.days !== undefined && (!Array.isArray(body.days) || !body.days.length)) {
    return res.status(400).json({ error: 'Elige al menos un día de la semana.' })
  }
  if (body.time !== undefined || body.days !== undefined) {
    store.updatePlan(req.params.id, { time: body.time, days: body.days })
  }
  if (body.active !== undefined) store.setPlanActive(req.params.id, Boolean(body.active))
  res.json(store.getPlan(req.params.id))
})

api.delete('/whatsapp/planes/:id', (req, res) => {
  if (!store.deletePlan(req.params.id)) return res.status(404).json({ error: 'Automatización no encontrada.' })
  res.json({ ok: true })
})

api.post('/uploads', (req, res) => {
  const { dataUrl, name } = req.body ?? {}
  const match = typeof dataUrl === 'string' ? dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s) : null
  if (!match) return res.status(400).json({ error: 'Se esperaba una imagen en data URL (jpeg, png o webp).' })

  const [, mime, base64] = match
  const buffer = Buffer.from(base64, 'base64')
  if (buffer.length > 8 * 1024 * 1024) return res.status(413).json({ error: 'La imagen supera 8 MB.' })

  const file = `${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}.${EXT[mime]}`
  writeFileSync(join(uploadsDir, file), buffer)
  res.status(201).json({ url: `/uploads/${file}`, bytes: buffer.length, name: name ?? undefined })
})

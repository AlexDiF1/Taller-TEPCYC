/**
 * API REST del taller (montada en /api).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
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
  const order = store.updateOrderDetails(req.params.id, req.body ?? {})
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  res.json(order)
})

api.delete('/orders/:id', (req, res) => {
  if (!store.deleteOrder(req.params.id)) return res.status(404).json({ error: 'Orden no encontrada.' })
  res.json({ ok: true })
})

api.get('/orders/:id/invoices', (req, res) => {
  res.json(store.listInvoices(req.params.id))
})

/* --------------------------------- ventas -------------------------------- */

function isIsoDate(value) {
  return typeof value === 'string' && value.length >= 10 && !Number.isNaN(new Date(value).getTime())
}

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

api.post('/ventas', (req, res) => {
  const body = req.body ?? {}
  const items = Array.isArray(body.items) ? body.items : []
  if (items.length === 0) return res.status(400).json({ error: 'La venta debe tener al menos un artículo.' })
  if (items.length > 200) return res.status(400).json({ error: 'La venta supera el máximo de 200 artículos.' })

  const method = String(body.paymentMethod ?? '').toLowerCase()
  if (!store.PAYMENT_METHODS.includes(method)) return res.status(400).json({ error: 'Método de pago inválido.' })

  const cleanItems = []
  for (const [index, item] of items.entries()) {
    const name = String(item?.name ?? '').trim()
    if (!name) return res.status(400).json({ error: `El artículo #${index + 1} no tiene nombre.` })
    if (name.length > 120) return res.status(400).json({ error: `El nombre del artículo #${index + 1} es demasiado largo.` })
    const price = normalizeMoney(item?.price)
    const cost = normalizeMoney(item?.cost ?? 0)
    if (Number.isNaN(price)) return res.status(400).json({ error: `Precio inválido en el artículo #${index + 1}.` })
    if (Number.isNaN(cost)) return res.status(400).json({ error: `Costo inválido en el artículo #${index + 1}.` })
    const quantity = Math.trunc(Number(item?.quantity ?? 1))
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 999) {
      return res.status(400).json({ error: `Cantidad inválida en el artículo #${index + 1}.` })
    }
    cleanItems.push({ name, price, cost, quantity })
  }

  const customerName = String(body.customerName ?? '').trim().slice(0, 120)
  const customerPhone = String(body.customerPhone ?? '').trim().slice(0, 30)
  if (customerPhone && !/^[+()\-\s\d]{7,30}$/.test(customerPhone)) {
    return res.status(400).json({ error: 'El teléfono del cliente no es válido.' })
  }

  const venta = store.createVenta({
    items: cleanItems,
    paymentMethod: method,
    customerName,
    customerPhone,
    notes: String(body.notes ?? '').slice(0, 400),
  })
  res.status(201).json(venta)
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
  const { orderId, phone, message, includePhotos } = req.body ?? {}
  if (!orderId && !phone) return res.status(400).json({ error: 'Falta la orden o el teléfono.' })
  const order = orderId ? store.getOrder(String(orderId)) : undefined
  const target = phone || order?.customer?.phone
  if (!target) return res.status(400).json({ error: 'La orden no tiene teléfono registrado.' })
  const text = String(message ?? '').slice(0, 4000)
  if (!text) return res.status(400).json({ error: 'El mensaje está vacío.' })
  try {
    const photos = includePhotos && order ? order.photos.map((p) => p.url) : []
    const result = await wa.sendOrderUpdate({ phone: target, message: text, photos })
    res.json({ ok: true, ...result, to: target })
  } catch (error) {
    waError(res, error)
  }
})

/** Comprobante o recibo en PDF (el PDF lo genera el navegador con jsPDF). */
api.post('/whatsapp/send-document', async (req, res) => {
  const { phone, caption, fileName, dataUrl } = req.body ?? {}
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
    res.json({ ok: true, id: sent?.key?.id ?? null, to: phone })
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

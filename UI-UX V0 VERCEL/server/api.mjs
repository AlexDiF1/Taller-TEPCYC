/**
 * API REST del taller (montada en /api).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import * as store from './db.mjs'

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

api.get('/orders/:id/invoices', (req, res) => {
  res.json(store.listInvoices(req.params.id))
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

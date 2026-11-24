/**
 * Recibo en PDF para enviar por WhatsApp, pensado para leerse en el celular.
 *
 * - Una sola tira de 90 mm de ancho y alto según el contenido: en el teléfono
 *   ocupa el ancho de la pantalla y se lee sin zoom, como un chat.
 * - Lo importante primero: saldo o total, luego cliente, equipo y falla.
 * - Incluye las fotos del ingreso, el detalle cobrado y la garantía.
 * - Nunca imprime costos internos ni ganancias: solo lo que ve el cliente.
 */
import { BUSINESS, DATA_CONSENT, INTAKE_TERMS, addDays, formatDate, formatMoney } from './business'
import { STATUS_MAP, deviceLabel } from './status'
import type { IntakePhoto, Order, ServiceItem } from './types'

export type ReceiptType = 'recepcion' | 'entrega'

const W = 90
const M = 6
const CW = W - M * 2

const INK: RGB = [20, 18, 18]
const MUTED: RGB = [110, 104, 102]
const RED: RGB = [210, 31, 41]
const SOFT: RGB = [244, 241, 240]
const LINE: RGB = [226, 221, 219]
const WHITE: RGB = [255, 255, 255]
const DARK: RGB = [18, 16, 16]

type RGB = [number, number, number]
type Doc = import('jspdf').jsPDF

const DEVICE_TYPE_LABEL: Record<string, string> = {
  consola: 'Consola',
  control: 'Control',
  celular: 'Celular',
  portatil: 'Portátil',
  accesorio: 'Accesorio',
}

/* ------------------------------ utilidades ------------------------------ */

function ink(doc: Doc, c: RGB) {
  doc.setTextColor(c[0], c[1], c[2])
}

function font(doc: Doc, size: number, style: 'normal' | 'bold' = 'normal') {
  doc.setFont('helvetica', style)
  doc.setFontSize(size)
}

/** Alto de una línea en mm para un tamaño de letra en pt. */
const lh = (pt: number) => pt * 0.42

function clean(value?: string | null) {
  const t = (value ?? '').trim()
  return t && t !== '0' ? t : ''
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    if (url.startsWith('data:')) return url
    const absolute = url.startsWith('http') ? url : `${window.location.origin}${url}`
    const response = await fetch(absolute)
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

async function imageRatio(dataUrl: string): Promise<number> {
  if (typeof Image === 'undefined') return 0.75
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? img.naturalHeight / img.naturalWidth : 0.75)
    img.onerror = () => resolve(0.75)
    img.src = dataUrl
  })
}

type LoadedPhoto = { dataUrl: string; ratio: number }

async function loadPhotos(photos: IntakePhoto[]): Promise<LoadedPhoto[]> {
  const results = await Promise.all(
    photos.slice(0, 6).map(async (photo) => {
      const dataUrl = await toDataUrl(photo.url)
      if (!dataUrl) return null
      return { dataUrl, ratio: await imageRatio(dataUrl) }
    }),
  )
  return results.filter((p): p is LoadedPhoto => p !== null)
}

/* ------------------------------- dibujo -------------------------------- */

/** Texto con salto de línea; devuelve la y siguiente. */
function para(doc: Doc, text: string, y: number, pt: number, color: RGB = INK, style: 'normal' | 'bold' = 'normal', x = M, width = CW) {
  font(doc, pt, style)
  ink(doc, color)
  const lines = doc.splitTextToSize(text, width)
  doc.text(lines, x, y)
  return y + lines.length * lh(pt) * 1.25
}

function label(doc: Doc, text: string, y: number) {
  font(doc, 7, 'bold')
  ink(doc, RED)
  doc.text(text.toUpperCase(), M, y)
  return y + 4.2
}

function rule(doc: Doc, y: number) {
  doc.setDrawColor(LINE[0], LINE[1], LINE[2])
  doc.setLineWidth(0.25)
  doc.line(M, y, W - M, y)
  return y + 4.5
}

function moneyRow(doc: Doc, left: string, right: string, y: number, pt = 9, strong = false) {
  font(doc, pt, strong ? 'bold' : 'normal')
  ink(doc, strong ? INK : MUTED)
  doc.text(left, M, y)
  ink(doc, INK)
  doc.text(right, W - M, y, { align: 'right' })
  return y + lh(pt) * 1.5
}

type Ctx = {
  order: Order
  type: ReceiptType
  items: ServiceItem[]
  photos: LoadedPhoto[]
}

/** Dibuja el recibo completo y devuelve la altura usada (mm). */
function render(doc: Doc, { order, type, items, photos }: Ctx): number {
  const isDelivery = type === 'entrega'
  const deliveredAt = order.deliveredAt ?? new Date().toISOString()
  const total = isDelivery ? items.reduce((s, i) => s + i.price, 0) || order.estimatedCost : order.estimatedCost
  const balance = Math.max(total - order.deposit, 0)
  const warrantyDays = order.warrantyDays ?? BUSINESS.warrantyDays

  // ---------- encabezado ----------
  doc.setFillColor(DARK[0], DARK[1], DARK[2])
  doc.rect(0, 0, W, 19, 'F')
  doc.setFillColor(RED[0], RED[1], RED[2])
  doc.rect(0, 19, W, 1.2, 'F')
  font(doc, 12.5, 'bold')
  ink(doc, WHITE)
  doc.text(BUSINESS.name, M, 8.6)
  font(doc, 7.5, 'normal')
  doc.text(`Servicio técnico · WhatsApp ${BUSINESS.phone}`, M, 14)

  let y = 27
  font(doc, 7.5, 'bold')
  ink(doc, RED)
  doc.text(isDelivery ? 'FACTURA DE ENTREGA' : 'RECIBO DE RECEPCIÓN', M, y)
  font(doc, 7.5, 'normal')
  ink(doc, MUTED)
  doc.text(formatDate(isDelivery ? deliveredAt : order.createdAt, true), W - M, y, { align: 'right' })
  y += 7
  font(doc, 18, 'bold')
  ink(doc, INK)
  doc.text(order.id, M, y)
  font(doc, 8, 'bold')
  ink(doc, MUTED)
  doc.text((order.deliveredAt ? 'Entregada' : STATUS_MAP[order.status]?.label ?? order.status), W - M, y, { align: 'right' })
  y += 5

  // ---------- valores (lo primero que se busca) ----------
  const boxH = 26
  doc.setFillColor(SOFT[0], SOFT[1], SOFT[2])
  doc.roundedRect(M, y, CW, boxH, 3, 3, 'F')
  font(doc, 8, 'bold')
  ink(doc, MUTED)
  // En la entrega: si aún debe algo, se muestra el saldo; si no, lo pagado.
  const paidInFull = isDelivery && balance === 0
  doc.text(paidInFull ? 'TOTAL PAGADO' : 'SALDO PENDIENTE', M + 4, y + 6)
  font(doc, 20, 'bold')
  ink(doc, paidInFull ? INK : RED)
  doc.text(formatMoney(paidInFull ? total : balance), M + 4, y + 14)
  const ry = y + 20
  font(doc, 8, 'normal')
  ink(doc, MUTED)
  doc.text(`${isDelivery ? 'Servicio' : 'Estimado'} ${formatMoney(total)}`, M + 4, ry)
  doc.text(`${isDelivery ? 'Pagado' : 'Abono'} ${formatMoney(order.deposit)}`, W - M - 4, ry, { align: 'right' })
  y += boxH + 6

  // ---------- cliente ----------
  y = label(doc, 'Cliente', y)
  y = para(doc, order.customer.name || '—', y, 11, INK, 'bold')
  const contact = [`+${BUSINESS.countryCode} ${order.customer.phone}`, clean(order.customer.documentId) && `Doc. ${clean(order.customer.documentId)}`]
    .filter(Boolean)
    .join(' · ')
  y = para(doc, contact, y, 8.5, MUTED)
  y = rule(doc, y + 1)

  // ---------- equipo ----------
  y = label(doc, 'Equipo', y)
  y = para(doc, deviceLabel(order.device), y, 11, INK, 'bold')
  const extra = [
    DEVICE_TYPE_LABEL[order.device.type] ?? order.device.type,
    clean(order.device.color),
    clean(order.device.serial) && `Serie ${clean(order.device.serial)}`,
  ]
    .filter(Boolean)
    .join(' · ')
  y = para(doc, extra, y, 8.5, MUTED)
  y += 2.5
  y = label(doc, isDelivery ? 'Falla atendida' : 'Falla reportada', y)
  y = para(doc, order.reportedFault || 'Sin descripción registrada.', y, 9.5)

  if (!isDelivery) {
    y += 2
    y = label(doc, 'Recibido con', y)
    y = para(doc, order.accessories.length ? order.accessories.join(', ') : 'Sin accesorios.', y, 9)
    if (clean(order.physicalNotes)) y = para(doc, `Estado físico: ${order.physicalNotes}`, y + 0.5, 8.5, MUTED)
    if (order.estimatedDate) y = para(doc, `Entrega estimada: ${formatDate(order.estimatedDate)}`, y + 0.5, 8.5, MUTED)
  }
  y = rule(doc, y + 1)

  // ---------- detalle ----------
  const list: ServiceItem[] = items.length
    ? items
    : [{ id: 'est', description: isDelivery ? 'Servicio técnico' : 'Reparación (estimado)', kind: 'servicio', price: order.estimatedCost }]
  y = label(doc, isDelivery ? 'Detalle del servicio' : 'Presupuesto', y)
  for (const item of list) {
    font(doc, 9, 'normal')
    const lines = doc.splitTextToSize(item.description || '—', CW - 26)
    ink(doc, INK)
    doc.text(lines, M, y)
    font(doc, 9, 'bold')
    doc.text(formatMoney(item.price), W - M, y, { align: 'right' })
    y += lines.length * lh(9) * 1.25
    font(doc, 7, 'normal')
    ink(doc, MUTED)
    doc.text(item.kind === 'repuesto' ? 'Repuesto' : 'Servicio', M, y)
    y += 4.2
  }
  y = moneyRow(doc, 'Total', formatMoney(total), y + 1, 9.5, true)
  y = rule(doc, y)

  // ---------- fotos ----------
  if (photos.length) {
    y = label(doc, `Fotos del ingreso (${photos.length})`, y)
    const gap = 2.5
    const cell = (CW - gap) / 2
    for (let i = 0; i < photos.length; i += 2) {
      const row = photos.slice(i, i + 2)
      const h = Math.min(34, cell * Math.max(...row.map((p) => p.ratio)))
      row.forEach((p, col) => {
        const x = M + col * (cell + gap)
        const ph = Math.min(34, cell * p.ratio)
        for (const format of ['JPEG', 'PNG', 'WEBP'] as const) {
          try {
            doc.addImage(p.dataUrl, format, x, y, cell, ph)
            break
          } catch {
            /* se prueba el siguiente formato */
          }
        }
      })
      y += h + gap
    }
    y = rule(doc, y + 1.5)
  }

  // ---------- garantía / condiciones ----------
  const clauses: string[] = []
  if (isDelivery) {
    clauses.push(`Garantía de ${warrantyDays} días, hasta el ${formatDate(addDays(deliveredAt, warrantyDays))}.`)
    clauses.push('Cubre solo la reparación y los repuestos de esta factura. No cubre golpes, humedad, manipulación por terceros, sellos rotos ni otras fallas.')
    if (order.device.type === 'celular' && order.warrantyScreenExcluded) clauses.push('No hay garantía por pantallas cambiadas.')
    if (order.warrantyNoAfterReview !== false) clauses.push('Después de la entrega y revisión del cliente no hay garantía por daños posteriores.')
  } else {
    clauses.push(INTAKE_TERMS)
    clauses.push(DATA_CONSENT)
  }
  y = label(doc, isDelivery ? 'Garantía' : 'Condiciones', y)
  for (const c of clauses) y = para(doc, `• ${c}`, y, 8, INK) + 0.6
  y += 3

  // ---------- cierre ----------
  font(doc, 10, 'bold')
  ink(doc, INK)
  doc.text('¡Gracias por su confianza!', W / 2, y, { align: 'center' })
  y += 5
  font(doc, 7.5, 'normal')
  ink(doc, MUTED)
  const address = doc.splitTextToSize(`${BUSINESS.address}, ${BUSINESS.city} · ${BUSINESS.taxId}`, CW)
  doc.text(address, W / 2, y, { align: 'center' })
  return y + address.length * lh(7.5) * 1.25 + 5
}

export async function buildPrettyReceiptPdf(order: Order, type: ReceiptType, items: ServiceItem[]) {
  const { jsPDF } = await import('jspdf')
  const photos = await loadPhotos(order.photos ?? [])
  const ctx: Ctx = { order, type, items, photos }

  // Primera pasada en una hoja alta para medir; la segunda, con el alto exacto.
  const probe = new jsPDF({ unit: 'mm', format: [W, 2000], orientation: 'portrait' })
  const height = Math.max(120, Math.ceil(render(probe, ctx)))

  const doc = new jsPDF({ unit: 'mm', format: [W, height], orientation: 'portrait', compress: true })
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, W, height, 'F')
  render(doc, ctx)

  const filename = `${type === 'entrega' ? 'Factura' : 'Recibo'}-${order.id}.pdf`
  return { blob: doc.output('blob'), filename }
}

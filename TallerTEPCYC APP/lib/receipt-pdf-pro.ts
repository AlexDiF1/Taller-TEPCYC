/**
 * Comprobante "bonito" (A4) pensado para enviarse por WhatsApp.
 *
 * Diferencias con el ticket térmico de 80 mm:
 * - Página A4 con diseño a color, bloques y jerarquía visual.
 * - Incluye las fotos del ingreso del equipo con su fecha.
 * - Muestra todos los datos de la orden (cliente, equipo, falla, accesorios,
 *   observaciones, detalle facturado, abonos y garantía).
 * - Nunca imprime costos internos ni ganancias: solo lo que ve el cliente.
 */
import { BUSINESS, addDays, formatDate, formatMoney } from './business'
import { STATUS_MAP } from './status'
import type { IntakePhoto, Order, ServiceItem } from './types'

export type ReceiptType = 'recepcion' | 'entrega'

const PAGE = { width: 210, height: 297, margin: 14 }
const CONTENT = PAGE.width - PAGE.margin * 2
const BOTTOM = PAGE.height - 16

const INK: [number, number, number] = [17, 17, 17]
const MUTED: [number, number, number] = [95, 95, 99]
const ACCENT: [number, number, number] = [139, 26, 26]
const SOFT: [number, number, number] = [245, 245, 246]
const WHITE: [number, number, number] = [255, 255, 255]

const DEVICE_TYPE_LABEL: Record<string, string> = {
  consola: 'Consola',
  control: 'Control',
  celular: 'Celular',
  portatil: 'Portátil',
  accesorio: 'Accesorio',
}

type Doc = import('jspdf').jsPDF

function setInk(doc: Doc, color: [number, number, number] = INK) {
  doc.setTextColor(color[0], color[1], color[2])
}

function font(doc: Doc, size: number, style: 'normal' | 'bold' = 'normal', family = 'helvetica') {
  doc.setFont(family, style)
  doc.setFontSize(size)
}

/** Convierte una URL (/uploads/... o remota) en data URL para jsPDF. */
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

type LoadedPhoto = { dataUrl: string; ratio: number; takenAt: string }

async function loadPhotos(photos: IntakePhoto[]): Promise<LoadedPhoto[]> {
  const results = await Promise.all(
    photos.slice(0, 8).map(async (photo) => {
      const dataUrl = await toDataUrl(photo.url)
      if (!dataUrl) return null
      return { dataUrl, ratio: await imageRatio(dataUrl), takenAt: photo.takenAt }
    }),
  )
  return results.filter((p): p is LoadedPhoto => p !== null)
}

function divider(doc: Doc, y: number, color: [number, number, number] = [214, 214, 216]) {
  doc.setDrawColor(color[0], color[1], color[2])
  doc.setLineWidth(0.3)
  doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y)
  return y + 5
}

function footer(doc: Doc, order: Order, page: number, type: ReceiptType) {
  const y = PAGE.height - 10
  doc.setDrawColor(220, 220, 222)
  doc.setLineWidth(0.3)
  doc.line(PAGE.margin, y - 4, PAGE.width - PAGE.margin, y - 4)
  setInk(doc, MUTED)
  font(doc, 7, 'normal')
  doc.text(`${BUSINESS.name} · ${BUSINESS.phone}`, PAGE.margin, y)
  doc.text(
    `${type === 'entrega' ? 'Factura' : 'Comprobante'} ${order.id} · página ${page}`,
    PAGE.width - PAGE.margin,
    y,
    { align: 'right' },
  )
}

/** Cierra la página actual y abre una nueva con encabezado corrido. */
function newPage(doc: Doc, order: Order, page: number, type: ReceiptType) {
  footer(doc, order, page, type)
  doc.addPage()
  const next = page + 1
  doc.setFillColor(17, 17, 17)
  doc.rect(0, 0, PAGE.width, 16, 'F')
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2])
  doc.rect(0, 16, PAGE.width, 1.6, 'F')
  setInk(doc, WHITE)
  font(doc, 9, 'bold')
  doc.text(BUSINESS.name, PAGE.margin, 10.5)
  font(doc, 7, 'normal')
  doc.text(`${type === 'entrega' ? 'Factura' : 'Comprobante'} ${order.id} (continuación)`, PAGE.width - PAGE.margin, 10.5, {
    align: 'right',
  })
  return { y: 28, page: next }
}

function header(doc: Doc, order: Order, type: ReceiptType) {
  doc.setFillColor(17, 17, 17)
  doc.rect(0, 0, PAGE.width, 30, 'F')
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2])
  doc.rect(0, 30, PAGE.width, 2, 'F')

  setInk(doc, WHITE)
  font(doc, 16, 'bold')
  doc.text(BUSINESS.name, PAGE.margin, 13)
  font(doc, 8.5, 'normal')
  doc.text(BUSINESS.tagline, PAGE.margin, 19.5)
  font(doc, 7.5, 'normal')
  doc.text(`${BUSINESS.taxId} · ${BUSINESS.address}, ${BUSINESS.city}`, PAGE.margin, 25.5)
  doc.text(`WhatsApp ${BUSINESS.phone}`, PAGE.width - PAGE.margin, 19.5, { align: 'right' })
  doc.text(
    formatDate(type === 'entrega' ? order.deliveredAt ?? new Date().toISOString() : order.createdAt, true),
    PAGE.width - PAGE.margin,
    25.5,
    { align: 'right' },
  )

  let y = 41
  setInk(doc, ACCENT)
  font(doc, 8, 'bold')
  doc.text(type === 'entrega' ? 'FACTURA DE ENTREGA' : 'COMPROBANTE DE RECEPCIÓN', PAGE.margin, y)
  setInk(doc, INK)
  font(doc, 22, 'bold')
  doc.text(order.id, PAGE.margin, y + 10)
  setInk(doc, MUTED)
  font(doc, 9, 'bold')
  doc.text(STATUS_MAP[order.status]?.label ?? order.status, PAGE.width - PAGE.margin, y + 10, { align: 'right' })
  return y + 19
}

function sectionTitle(doc: Doc, title: string, y: number) {
  setInk(doc, ACCENT)
  font(doc, 7.5, 'bold')
  doc.text(title.toUpperCase(), PAGE.margin, y)
  setInk(doc, INK)
  return y + 5.5
}

function softBox(doc: Doc, y: number, height: number) {
  doc.setFillColor(SOFT[0], SOFT[1], SOFT[2])
  doc.roundedRect(PAGE.margin, y, CONTENT, height, 2.5, 2.5, 'F')
}

function keyValue(doc: Doc, label: string, value: string, x: number, y: number, width: number) {
  setInk(doc, MUTED)
  font(doc, 7, 'normal')
  doc.text(label.toUpperCase(), x, y)
  setInk(doc, INK)
  font(doc, 9.5, 'normal')
  const lines = doc.splitTextToSize(value || '—', width)
  doc.text(lines, x, y + 4.8)
  return y + 4.8 + Math.max(1, lines.length) * 4.4
}

function bodyText(doc: Doc, text: string, x: number, y: number, width: number, size = 9.5) {
  setInk(doc, INK)
  font(doc, size, 'normal')
  const lines = doc.splitTextToSize(text || '—', width)
  doc.text(lines, x, y)
  return y + Math.max(1, lines.length) * size * 0.45
}

function itemsHeader(doc: Doc, y: number) {
  doc.setFillColor(17, 17, 17)
  doc.rect(PAGE.margin, y - 4.5, CONTENT, 7, 'F')
  setInk(doc, WHITE)
  font(doc, 7.5, 'bold')
  doc.text('DESCRIPCIÓN', PAGE.margin + 3, y)
  doc.text('TIPO', PAGE.width - PAGE.margin - 33, y)
  doc.text('VALOR', PAGE.width - PAGE.margin - 3, y, { align: 'right' })
  return y + 7
}

function photosBlock(doc: Doc, photos: LoadedPhoto[], y: number): number {
  const gap = 5
  const cell = (CONTENT - gap) / 2
  const maxHeight = 56

  for (let index = 0; index < photos.length; index += 2) {
    const row = photos.slice(index, index + 2)
    const rowHeight = Math.min(maxHeight, cell * Math.max(...row.map((p) => p.ratio))) + 8
    if (y + rowHeight > BOTTOM) return -1

    row.forEach((photo, col) => {
      const x = PAGE.margin + col * (cell + gap)
      const height = Math.min(maxHeight, cell * photo.ratio)
      let placed = false
      for (const format of ['JPEG', 'PNG', 'WEBP'] as const) {
        try {
          doc.addImage(photo.dataUrl, format, x, y, cell, height)
          placed = true
          break
        } catch {
          /* se prueba el siguiente formato */
        }
      }
      if (!placed) return
      doc.setDrawColor(226, 226, 228)
      doc.setLineWidth(0.2)
      doc.rect(x, y, cell, height)
      setInk(doc, MUTED)
      font(doc, 6.5, 'normal')
      doc.text(`Ingreso: ${formatDate(photo.takenAt, true)}`, x, y + height + 3.4)
    })
    y += rowHeight
  }
  return y + 1
}

export async function buildPrettyReceiptPdf(order: Order, type: ReceiptType, items: ServiceItem[]) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  const isDelivery = type === 'entrega'
  const deliveredAt = order.deliveredAt ?? new Date().toISOString()
  const total = isDelivery ? items.reduce((sum, i) => sum + i.price, 0) || order.estimatedCost : order.estimatedCost
  const balance = Math.max(total - order.deposit, 0)
  const warrantyDays = order.warrantyDays ?? BUSINESS.warrantyDays
  const warrantyUntil = addDays(deliveredAt, warrantyDays)
  const photos = await loadPhotos(order.photos ?? [])
  let page = 1

  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F')

  let y = header(doc, order, type)

  // ------------------------------- cliente ----------------------------------
  const clientHeight = order.customer.documentId ? 30 : 25
  softBox(doc, y, clientHeight)
  setInk(doc, ACCENT)
  font(doc, 7.5, 'bold')
  doc.text('CLIENTE', PAGE.margin + 5, y + 7)
  setInk(doc, INK)
  font(doc, 12.5, 'bold')
  doc.text(order.customer.name, PAGE.margin + 5, y + 14.5)
  setInk(doc, MUTED)
  font(doc, 8.5, 'normal')
  doc.text(`Tel/WhatsApp: +${BUSINESS.countryCode} ${order.customer.phone}`, PAGE.margin + 5, y + 20)
  if (order.customer.documentId) doc.text(`Documento: ${order.customer.documentId}`, PAGE.margin + 5, y + 25)
  if (order.customer.email) doc.text(order.customer.email, PAGE.width - PAGE.margin - 5, y + 20, { align: 'right' })
  y += clientHeight + 9

  // ------------------------------- equipo -----------------------------------
  y = sectionTitle(doc, 'Equipo recibido', y)
  const colW = (CONTENT - 8) / 2
  const row1 = Math.max(
    keyValue(doc, 'Tipo', DEVICE_TYPE_LABEL[order.device.type] ?? order.device.type, PAGE.margin, y, colW),
    keyValue(doc, 'Marca', order.device.brand, PAGE.margin + colW + 8, y, colW),
  )
  const row2 = Math.max(
    keyValue(doc, 'Modelo', order.device.model, PAGE.margin, row1 + 3, colW),
    keyValue(doc, 'Serie', order.device.serial ?? 'No registra', PAGE.margin + colW + 8, row1 + 3, colW),
  )
  const row3 = keyValue(doc, 'Color', order.device.color ?? 'No registra', PAGE.margin, row2 + 3, colW)
  const row4 = order.technician
    ? keyValue(doc, 'Técnico', order.technician, PAGE.margin + colW + 8, row2 + 3, colW)
    : 0
  y = divider(doc, Math.max(row3, row4) + 4)

  // ------------------------- falla y observaciones ---------------------------
  y = sectionTitle(doc, isDelivery ? 'Diagnóstico y trabajo realizado' : 'Falla reportada', y)
  y = bodyText(doc, order.reportedFault || 'Sin descripción registrada.', PAGE.margin, y, CONTENT, 9.5)
  if (order.faultTags.length) {
    setInk(doc, MUTED)
    font(doc, 7.5, 'normal')
    doc.text(`Etiquetas: ${order.faultTags.join(' · ')}`, PAGE.margin, y + 2)
    y += 6
  }
  y += 2

  if (!isDelivery) {
    y = sectionTitle(doc, 'Accesorios y estado físico', y)
    y = bodyText(
      doc,
      `Accesorios: ${order.accessories.length ? order.accessories.join(', ') : 'El equipo ingresa sin accesorios.'}`,
      PAGE.margin,
      y,
      CONTENT,
      8.5,
    )
    y = bodyText(
      doc,
      `Observaciones: ${order.physicalNotes || 'Sin observaciones adicionales.'}`,
      PAGE.margin,
      y + 1,
      CONTENT,
      8.5,
    )
    if (order.estimatedDate) {
      y = bodyText(doc, `Entrega estimada: ${formatDate(order.estimatedDate)}`, PAGE.margin, y + 1, CONTENT, 8.5)
    }
    y = divider(doc, y + 2)
  }

  // -------------------------------- fotos ------------------------------------
  if (photos.length) {
    y = sectionTitle(doc, `Fotos del equipo (${photos.length})`, y)
    let next = photosBlock(doc, photos, y)
    if (next === -1) {
      const start = newPage(doc, order, page, type)
      page = start.page
      y = start.y
      setInk(doc, MUTED)
      font(doc, 7.5, 'bold')
      doc.text('FOTOS DEL EQUIPO (CONTINUACIÓN)', PAGE.margin, y)
      y += 6
      next = photosBlock(doc, photos, y)
    }
    y = divider(doc, (next === -1 ? BOTTOM : next) + 1)
  }

  // --------------------------- detalle facturado ------------------------------
  const list: ServiceItem[] = items.length
    ? items
    : [{ id: 'est', description: 'Servicio técnico', kind: 'servicio', price: order.estimatedCost }]

  y = sectionTitle(doc, isDelivery ? 'Detalle del servicio' : 'Presupuesto estimado', y)
  y = itemsHeader(doc, y)

  for (const item of list) {
    const lines = doc.splitTextToSize(item.description || '—', CONTENT - 48)
    const height = Math.max(7.5, lines.length * 4.4 + 3)
    if (y + height > BOTTOM) {
      const start = newPage(doc, order, page, type)
      page = start.page
      y = itemsHeader(doc, start.y + 2)
    }
    setInk(doc, INK)
    font(doc, 9.5, 'normal')
    doc.text(lines, PAGE.margin + 3, y + 1)
    setInk(doc, MUTED)
    font(doc, 7.5, 'normal')
    doc.text(item.kind === 'repuesto' ? 'Repuesto' : 'Servicio', PAGE.width - PAGE.margin - 33, y + 1)
    setInk(doc, INK)
    font(doc, 9.5, 'normal')
    doc.text(formatMoney(item.price), PAGE.width - PAGE.margin - 3, y + 1, { align: 'right' })
    y += height
    doc.setDrawColor(232, 232, 234)
    doc.setLineWidth(0.2)
    doc.line(PAGE.margin, y - 1, PAGE.width - PAGE.margin, y - 1)
  }
  y += 6

  // -------------------------------- totales ----------------------------------
  const totalsHeight = 26
  if (y + totalsHeight + 6 > BOTTOM) {
    const start = newPage(doc, order, page, type)
    page = start.page
    y = start.y
  }
  softBox(doc, y, totalsHeight)
  setInk(doc, MUTED)
  font(doc, 8, 'normal')
  doc.text(isDelivery ? 'Total servicio' : 'Costo estimado', PAGE.margin + 5, y + 7)
  doc.text(formatMoney(total), PAGE.width - PAGE.margin - 5, y + 7, { align: 'right' })
  doc.text('Abono recibido', PAGE.margin + 5, y + 13)
  doc.text(`- ${formatMoney(order.deposit)}`, PAGE.width - PAGE.margin - 5, y + 13, { align: 'right' })
  doc.setDrawColor(200, 200, 202)
  doc.setLineWidth(0.2)
  doc.line(PAGE.margin + 5, y + 17, PAGE.width - PAGE.margin - 5, y + 17)
  setInk(doc, INK)
  font(doc, 8.5, 'bold')
  doc.text(isDelivery ? 'TOTAL PAGADO' : 'SALDO PENDIENTE', PAGE.margin + 5, y + 23)
  font(doc, 14, 'bold')
  doc.text(formatMoney(isDelivery ? total : balance), PAGE.width - PAGE.margin - 5, y + 23, { align: 'right' })
  y += totalsHeight + 9

  // -------------------------------- garantía ---------------------------------
  const clauses: string[] = []
  if (isDelivery) {
    clauses.push(`Garantía de ${warrantyDays} días, válida hasta el ${formatDate(warrantyUntil)}.`)
    clauses.push(
      'Cubre exclusivamente la reparación y los repuestos descritos en esta factura. No cubre golpes, humedad, manipulación por terceros, sellos rotos ni fallas distintas a la reparada.',
    )
    if (order.device.type === 'celular' && order.warrantyScreenExcluded) {
      clauses.push('No se otorga garantía por pantallas cambiadas.')
    }
    if (order.warrantyNoAfterReview !== false) {
      clauses.push(
        'Después de la entrega y revisión por parte del cliente no se otorga garantía por daños o fallas posteriores.',
      )
    }
  } else {
    clauses.push('El diagnóstico puede modificar el costo estimado.')
    clauses.push(
      'Los equipos no reclamados en 60 días podrán generar cobro por bodegaje. Presente este comprobante para retirar el equipo.',
    )
  }

  const warrantyText = clauses.map((line) => `• ${line}`).join('\n')
  const warrantyHeight = 16 + doc.splitTextToSize(warrantyText, CONTENT - 10).length * 4.3
  if (y + warrantyHeight + 24 > BOTTOM) {
    const start = newPage(doc, order, page, type)
    page = start.page
    y = start.y
  }
  softBox(doc, y, warrantyHeight)
  setInk(doc, ACCENT)
  font(doc, 8, 'bold')
  doc.text(isDelivery ? 'GARANTÍA' : 'CONDICIONES', PAGE.margin + 5, y + 7)
  setInk(doc, INK)
  font(doc, 8, 'normal')
  doc.text(doc.splitTextToSize(warrantyText, CONTENT - 10), PAGE.margin + 5, y + 13)
  y += warrantyHeight + 8

  // --------------------------- contacto y cierre -----------------------------
  setInk(doc, INK)
  font(doc, 11.5, 'bold')
  doc.text('¡Gracias por su preferencia!', PAGE.width / 2, y, { align: 'center' })
  setInk(doc, MUTED)
  font(doc, 7.5, 'normal')
  doc.text('Conserve este comprobante para hacer efectiva cualquier garantía.', PAGE.width / 2, y + 5.5, {
    align: 'center',
  })
  doc.text(`Dudas o reclamos: WhatsApp ${BUSINESS.phone}`, PAGE.width / 2, y + 10.5, { align: 'center' })

  footer(doc, order, page, type)

  const filename = `${isDelivery ? 'Factura' : 'Comprobante'}-${order.id}-WhatsApp.pdf`
  return { blob: doc.output('blob'), filename }
}

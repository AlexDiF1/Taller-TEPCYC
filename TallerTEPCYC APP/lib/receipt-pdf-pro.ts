/**
 * Comprobante "bonito" (A4) pensado para enviarse por WhatsApp.
 *
 * Diferencias con el ticket térmico de 80 mm:
 * - Página A5 vertical (mitad de A4) con diseño a color, compacta y legible
 *   en el celular: la hoja entra completa en pantalla.
 * - Incluye las fotos del ingreso del equipo con su fecha.
 * - Muestra todos los datos de la orden (cliente, equipo, falla, accesorios,
 *   observaciones, detalle facturado, abonos y garantía).
 * - Nunca imprime costos internos ni ganancias: solo lo que ve el cliente.
 */
import { BUSINESS, addDays, formatDate, formatMoney } from './business'
import { STATUS_MAP, deviceLabel } from './status'
import type { IntakePhoto, Order, ServiceItem } from './types'

export type ReceiptType = 'recepcion' | 'entrega'

/**
 * A5 vertical (mitad de una A4): el mismo diseño, pero compacto. Al abrirla en
 * un celular la hoja entra completa en pantalla y el texto se lee sin zoom.
 */
const PAGE = { width: 148, height: 210, margin: 8 }
const CONTENT = PAGE.width - PAGE.margin * 2
const BOTTOM = PAGE.height - 10

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

/** Valores vacíos o «0» se muestran como «—» en la factura. */
function shown(value?: string | null) {
  const text = (value ?? '').trim()
  return !text || text === '0' ? '—' : text
}

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
  doc.setLineWidth(0.25)
  doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y)
  return y + 2.8
}

function footer(doc: Doc, order: Order, page: number, type: ReceiptType) {
  const y = PAGE.height - 6
  doc.setDrawColor(220, 220, 222)
  doc.setLineWidth(0.25)
  doc.line(PAGE.margin, y - 2.6, PAGE.width - PAGE.margin, y - 2.6)
  setInk(doc, MUTED)
  font(doc, 6, 'normal')
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
  doc.rect(0, 0, PAGE.width, 11, 'F')
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2])
  doc.rect(0, 11, PAGE.width, 1.2, 'F')
  setInk(doc, WHITE)
  font(doc, 8, 'bold')
  doc.text(BUSINESS.name, PAGE.margin, 7.4)
  font(doc, 5.5, 'normal')
  doc.text(`${type === 'entrega' ? 'Factura' : 'Comprobante'} ${order.id} (continuación)`, PAGE.width - PAGE.margin, 7.4, {
    align: 'right',
  })
  return { y: 16.5, page: next }
}

function header(doc: Doc, order: Order, type: ReceiptType) {
  doc.setFillColor(17, 17, 17)
  doc.rect(0, 0, PAGE.width, 17.5, 'F')
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2])
  doc.rect(0, 17.5, PAGE.width, 1.3, 'F')

  setInk(doc, WHITE)
  font(doc, 11.5, 'bold')
  doc.text(BUSINESS.name, PAGE.margin, 7.8)
  font(doc, 6, 'normal')
  doc.text(BUSINESS.tagline, PAGE.margin, 11.6)
  font(doc, 5.5, 'normal')
  doc.text(`${BUSINESS.taxId} · ${BUSINESS.address}, ${BUSINESS.city}`, PAGE.margin, 15.2)
  doc.text(`WhatsApp ${BUSINESS.phone}`, PAGE.width - PAGE.margin, 11.6, { align: 'right' })
  doc.text(
    formatDate(type === 'entrega' ? order.deliveredAt ?? new Date().toISOString() : order.createdAt, true),
    PAGE.width - PAGE.margin,
    15.2,
    { align: 'right' },
  )

  let y = 23.8
  setInk(doc, ACCENT)
  font(doc, 6, 'bold')
  doc.text(type === 'entrega' ? 'FACTURA DE ENTREGA' : 'COMPROBANTE DE RECEPCIÓN', PAGE.margin, y)
  setInk(doc, INK)
  font(doc, 15, 'bold')
  doc.text(order.id, PAGE.margin, y + 5.9)
  setInk(doc, MUTED)
  font(doc, 7, 'bold')
  doc.text(STATUS_MAP[order.status]?.label ?? order.status, PAGE.width - PAGE.margin, y + 5.9, { align: 'right' })
  return y + 9.6
}

function sectionTitle(doc: Doc, title: string, y: number) {
  setInk(doc, ACCENT)
  font(doc, 6, 'bold')
  doc.text(title.toUpperCase(), PAGE.margin, y)
  setInk(doc, INK)
  return y + 3.8
}

function softBox(doc: Doc, y: number, height: number) {
  doc.setFillColor(SOFT[0], SOFT[1], SOFT[2])
  doc.roundedRect(PAGE.margin, y, CONTENT, height, 2.5, 2.5, 'F')
}

function keyValue(doc: Doc, label: string, value: string, x: number, y: number, width: number) {
  setInk(doc, MUTED)
  font(doc, 5.5, 'normal')
  doc.text(label.toUpperCase(), x, y)
  setInk(doc, INK)
  font(doc, 8, 'normal')
  const lines = doc.splitTextToSize(value || '—', width)
  doc.text(lines, x, y + 3.3)
  return y + 3.3 + Math.max(1, lines.length) * 3.5
}

function bodyText(doc: Doc, text: string, x: number, y: number, width: number, size = 8) {
  setInk(doc, INK)
  font(doc, size, 'normal')
  const lines = doc.splitTextToSize(text || '—', width)
  doc.text(lines, x, y)
  return y + Math.max(1, lines.length) * size * 0.42
}

function itemsHeader(doc: Doc, y: number) {
  doc.setFillColor(17, 17, 17)
  doc.rect(PAGE.margin, y - 3.6, CONTENT, 5.4, 'F')
  setInk(doc, WHITE)
  font(doc, 6, 'bold')
  doc.text('DESCRIPCIÓN', PAGE.margin + 3, y)
  doc.text('TIPO', PAGE.width - PAGE.margin - 28, y)
  doc.text('VALOR', PAGE.width - PAGE.margin - 3, y, { align: 'right' })
  return y + 5.2
}

function photosBlock(doc: Doc, photos: LoadedPhoto[], y: number): number {
  const gap = 3.5
  const columns = 3
  const cell = (CONTENT - gap * (columns - 1)) / columns
  const maxHeight = 17

  for (let index = 0; index < photos.length; index += columns) {
    const row = photos.slice(index, index + columns)
    const rowHeight = Math.min(maxHeight, cell * Math.max(...row.map((p) => p.ratio))) + 4.2
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
      font(doc, 5.5, 'normal')
      doc.text(`Ingreso: ${formatDate(photo.takenAt, true)}`, x, y + height + 3)
    })
    y += rowHeight
  }
  return y + 1
}

export async function buildPrettyReceiptPdf(order: Order, type: ReceiptType, items: ServiceItem[]) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: [PAGE.width, PAGE.height], orientation: 'portrait', compress: true })
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
  const documentId = order.customer.documentId?.trim()
  const hasDocument = Boolean(documentId && documentId !== '0')
  font(doc, 10.5, 'bold')
  const nameLines = doc.splitTextToSize(order.customer.name || '—', CONTENT - 8).slice(0, 2)
  const nameHeight = nameLines.length * 4.6
  const clientHeight = 10.4 + nameHeight + (hasDocument ? 4.2 : 0)
  softBox(doc, y, clientHeight)
  setInk(doc, ACCENT)
  font(doc, 6, 'bold')
  doc.text('CLIENTE', PAGE.margin + 4, y + 5.2)
  setInk(doc, INK)
  font(doc, 10.5, 'bold')
  doc.text(nameLines, PAGE.margin + 4, y + 10.6)
  const contactY = y + 10.6 + nameHeight + 0.2
  setInk(doc, MUTED)
  font(doc, 7, 'normal')
  doc.text(`Tel/WhatsApp: +${BUSINESS.countryCode} ${order.customer.phone}`, PAGE.margin + 4, contactY)
  if (hasDocument) doc.text(`Documento: ${documentId}`, PAGE.margin + 4, contactY + 4)
  if (order.customer.email) doc.text(order.customer.email, PAGE.width - PAGE.margin - 4, contactY, { align: 'right' })
  y += clientHeight + 4.4

  // ------------------------------- equipo -----------------------------------
  y = sectionTitle(doc, 'Equipo recibido', y)
  const colW = (CONTENT - 6) / 2
  const row1 = Math.max(
    keyValue(doc, 'Equipo', deviceLabel(order.device), PAGE.margin, y, colW),
    keyValue(doc, 'Tipo', DEVICE_TYPE_LABEL[order.device.type] ?? order.device.type, PAGE.margin + colW + 6, y, colW),
  )
  const row2 = Math.max(
    keyValue(doc, 'Serie', shown(order.device.serial), PAGE.margin, row1 + 2.2, colW),
    keyValue(doc, 'Color', shown(order.device.color), PAGE.margin + colW + 6, row1 + 2.2, colW),
  )
  const row3 = order.technician ? keyValue(doc, 'Técnico', order.technician, PAGE.margin, row2 + 2.2, colW) : 0
  y = divider(doc, Math.max(row2, row3) + 2.6)

  // ------------------------- falla y observaciones ---------------------------
  y = sectionTitle(doc, isDelivery ? 'Diagnóstico y trabajo realizado' : 'Falla reportada', y)
  y = bodyText(doc, order.reportedFault || 'Sin descripción registrada.', PAGE.margin, y, CONTENT, 8.5)
  if (order.faultTags.length) {
    setInk(doc, MUTED)
    font(doc, 6, 'normal')
    doc.text(`Etiquetas: ${order.faultTags.join(' · ')}`, PAGE.margin, y + 1.2)
    y += 4.2
  }
  y += 1.2

  if (!isDelivery) {
    y = sectionTitle(doc, 'Accesorios y estado físico', y)
    y = bodyText(
      doc,
      `Accesorios: ${order.accessories.length ? order.accessories.join(', ') : 'El equipo ingresa sin accesorios.'}`,
      PAGE.margin,
      y,
      CONTENT,
      7.2,
    )
    y = bodyText(
      doc,
      `Observaciones: ${order.physicalNotes || 'Sin observaciones adicionales.'}`,
      PAGE.margin,
      y + 0.8,
      CONTENT,
      7.2,
    )
    if (order.estimatedDate) {
      y = bodyText(doc, `Entrega estimada: ${formatDate(order.estimatedDate)}`, PAGE.margin, y + 0.8, CONTENT, 7.2)
    }
    y = divider(doc, y + 1.2)
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
      font(doc, 6.5, 'bold')
      doc.text('FOTOS DEL EQUIPO (CONTINUACIÓN)', PAGE.margin, y)
      y += 5
      next = photosBlock(doc, photos, y)
    }
    y = divider(doc, (next === -1 ? BOTTOM : next) + 1)
  }

  // --------------------------- detalle facturado ------------------------------
  const list: ServiceItem[] = items.length
    ? items
    : [{ id: 'est', description: 'Servicio técnico', kind: 'servicio', price: order.estimatedCost }]

  // La tabla no se parte: si no entra completa con sus totales, pasa a la página siguiente.
  const tableHeight =
    list.reduce((sum, item) => {
      const lines = doc.splitTextToSize(item.description || '—', CONTENT - 40)
      return sum + Math.max(5.8, lines.length * 3.6 + 2.2)
    }, 0) +
    5.2 +
    18 +
    4.6 +
    3.2
  if (y + tableHeight > BOTTOM && tableHeight < BOTTOM - 20) {
    const start = newPage(doc, order, page, type)
    page = start.page
    y = start.y
  }

  y = sectionTitle(doc, isDelivery ? 'Detalle del servicio' : 'Presupuesto estimado', y)
  y = itemsHeader(doc, y)

  for (const item of list) {
    const lines = doc.splitTextToSize(item.description || '—', CONTENT - 40)
    const height = Math.max(5.8, lines.length * 3.6 + 2.2)
    if (y + height > BOTTOM) {
      const start = newPage(doc, order, page, type)
      page = start.page
      y = itemsHeader(doc, start.y + 2)
    }
    setInk(doc, INK)
    font(doc, 8, 'normal')
    doc.text(lines, PAGE.margin + 3, y + 1)
    setInk(doc, MUTED)
    font(doc, 6, 'normal')
    doc.text(item.kind === 'repuesto' ? 'Repuesto' : 'Servicio', PAGE.width - PAGE.margin - 28, y + 1)
    setInk(doc, INK)
    font(doc, 8, 'normal')
    doc.text(formatMoney(item.price), PAGE.width - PAGE.margin - 3, y + 1, { align: 'right' })
    y += height
    doc.setDrawColor(232, 232, 234)
    doc.setLineWidth(0.2)
    doc.line(PAGE.margin, y - 1, PAGE.width - PAGE.margin, y - 1)
  }
  y += 3.2

  // -------------------------------- totales ----------------------------------
  const totalsHeight = 18
  if (y + totalsHeight + 6 > BOTTOM) {
    const start = newPage(doc, order, page, type)
    page = start.page
    y = start.y
  }
  softBox(doc, y, totalsHeight)
  setInk(doc, MUTED)
  font(doc, 7, 'normal')
  doc.text(isDelivery ? 'Total servicio' : 'Costo estimado', PAGE.margin + 4, y + 4.8)
  doc.text(formatMoney(total), PAGE.width - PAGE.margin - 4, y + 4.8, { align: 'right' })
  doc.text('Abono recibido', PAGE.margin + 4, y + 9)
  doc.text(`- ${formatMoney(order.deposit)}`, PAGE.width - PAGE.margin - 4, y + 9, { align: 'right' })
  doc.setDrawColor(200, 200, 202)
  doc.setLineWidth(0.2)
  doc.line(PAGE.margin + 4, y + 12, PAGE.width - PAGE.margin - 4, y + 12)
  setInk(doc, INK)
  font(doc, 7.5, 'bold')
  doc.text(isDelivery ? 'TOTAL PAGADO' : 'SALDO PENDIENTE', PAGE.margin + 4, y + 16.2)
  font(doc, 11.5, 'bold')
  doc.text(formatMoney(isDelivery ? total : balance), PAGE.width - PAGE.margin - 4, y + 16.2, { align: 'right' })
  y += totalsHeight + 2.8

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
  const warrantyHeight = 8.6 + doc.splitTextToSize(warrantyText, CONTENT - 8).length * 3.2
  if (y + warrantyHeight + 8.2 > BOTTOM) {
    const start = newPage(doc, order, page, type)
    page = start.page
    y = start.y
  }
  softBox(doc, y, warrantyHeight)
  setInk(doc, ACCENT)
  font(doc, 6.2, 'bold')
  doc.text(isDelivery ? 'GARANTÍA' : 'CONDICIONES', PAGE.margin + 4, y + 4.8)
  setInk(doc, INK)
  font(doc, 6.2, 'normal')
  doc.text(doc.splitTextToSize(warrantyText, CONTENT - 8), PAGE.margin + 4, y + 8)
  y += warrantyHeight + 2.6

  // --------------------------- contacto y cierre -----------------------------
  setInk(doc, INK)
  font(doc, 9, 'bold')
  doc.text('¡Gracias por su preferencia!', PAGE.width / 2, y, { align: 'center' })
  setInk(doc, MUTED)
  font(doc, 6, 'normal')
  doc.text(
    `Conserve este comprobante para su garantía · Dudas o reclamos: WhatsApp ${BUSINESS.phone}`,
    PAGE.width / 2,
    y + 4.2,
    { align: 'center' },
  )

  footer(doc, order, page, type)

  const filename = `${isDelivery ? 'Factura' : 'Comprobante'}-${order.id}-WhatsApp.pdf`
  return { blob: doc.output('blob'), filename }
}

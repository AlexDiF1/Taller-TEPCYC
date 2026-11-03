/**
 * Genera el comprobante (recepción o entrega) como PDF y lo entrega por WhatsApp.
 *
 * - El PDF se descarga en el dispositivo.
 * - El chat del cliente se abre con el mensaje ya escrito (enlace `wa.me`), nunca
 *   la hoja de compartir del sistema: en Android esa hoja obliga a elegir el
 *   contacto a mano y se puede enviar al cliente equivocado.
 * - WhatsApp no permite adjuntar archivos desde un enlace, así que el operador
 *   adjunta el PDF descargado con el botón "+" del chat.
 *
 * Importante: el PDF se prepara ANTES del clic (ver `prepareReceiptDelivery` en
 * los componentes). Generarlo dentro del manejador deja sin "gesto de usuario"
 * a la navegación y los móviles la bloquean.
 */
import { BUSINESS, addDays, formatDate } from './business'
import { buildReceiptMessage, buildWhatsAppUrl } from './whatsapp'
import type { Order, ServiceItem } from './types'

export type ReceiptPdfType = 'recepcion' | 'entrega'
type ReceiptType = ReceiptPdfType

const DEVICE_TYPE_LABEL: Record<string, string> = {
  consola: 'Consola',
  control: 'Control',
  celular: 'Celular',
  portatil: 'Portátil',
  accesorio: 'Accesorio',
}

function money(value: number) {
  return `$${Math.round(value).toLocaleString('es-CO')}`
}

export function receiptFileName(order: Order, type: ReceiptType) {
  return `${type === 'entrega' ? 'Factura' : 'Comprobante'}-${order.id}.pdf`
}

export async function buildReceiptPdf(order: Order, type: ReceiptType, items: ServiceItem[]) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 42
  const contentWidth = pageWidth - margin * 2
  const isDelivery = type === 'entrega'
  let y = margin

  const subtotal = items.reduce((sum, item) => sum + item.price, 0)
  const total = isDelivery ? subtotal || order.estimatedCost : order.estimatedCost
  const balance = Math.max(total - order.deposit, 0)
  const deliveredAt = order.deliveredAt ?? new Date().toISOString()

  const gray = 110
  const black = 20

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  function text(value: string, size: number, style: 'normal' | 'bold' = 'normal', color = black) {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(color)
    return doc
  }

  function sectionTitle(title: string) {
    ensureSpace(38)
    text(title.toUpperCase(), 8, 'bold', gray)
    y += 12
    doc.setDrawColor(210)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    y += 14
  }

  function row(label: string, value: string) {
    text(`${label}:`, 9, 'bold', gray)
    doc.text(`${label}:`, margin, y)
    text(value || '—', 9)
    doc.text(value || '—', margin + 92, y)
    y += 14
  }

  function paragraph(value: string, size = 9) {
    text(value, size)
    const lines = doc.splitTextToSize(value || '—', contentWidth)
    ensureSpace(lines.length * (size + 3))
    doc.text(lines, margin, y)
    y += lines.length * (size + 3)
  }

  // ------------------------------- encabezado -------------------------------
  text(BUSINESS.name, 17, 'bold')
  doc.text(BUSINESS.name, margin, y)
  y += 15
  text(BUSINESS.tagline, 9, 'normal', gray)
  doc.text(BUSINESS.tagline, margin, y)
  y += 13
  text(`${BUSINESS.taxId} · ${BUSINESS.address}, ${BUSINESS.city}`, 8, 'normal', gray)
  doc.text(`${BUSINESS.taxId} · ${BUSINESS.address}, ${BUSINESS.city}`, margin, y)
  y += 11
  text(`WhatsApp ${BUSINESS.phone}`, 8, 'normal', gray)
  doc.text(`WhatsApp ${BUSINESS.phone}`, margin, y)

  let headY = margin
  text(isDelivery ? 'FACTURA DE ENTREGA' : 'COMPROBANTE DE RECEPCIÓN', 8, 'bold', gray)
  doc.text(isDelivery ? 'FACTURA DE ENTREGA' : 'COMPROBANTE DE RECEPCIÓN', pageWidth - margin, headY, { align: 'right' })
  headY += 18
  text(order.id, 16, 'bold')
  doc.text(order.id, pageWidth - margin, headY, { align: 'right' })
  headY += 14
  text(formatDate(isDelivery ? deliveredAt : order.createdAt, true), 8, 'normal', gray)
  doc.text(formatDate(isDelivery ? deliveredAt : order.createdAt, true), pageWidth - margin, headY, { align: 'right' })

  y += 20
  doc.setDrawColor(black)
  doc.setLineWidth(1.2)
  doc.line(margin, y, pageWidth - margin, y)
  y += 24

  // --------------------------------- cliente --------------------------------
  sectionTitle('Cliente')
  row('Nombre', order.customer.name)
  row('WhatsApp', `+${BUSINESS.countryCode} ${order.customer.phone}`)
  if (order.customer.documentId) row('Documento', order.customer.documentId)
  y += 8

  // --------------------------------- equipo ---------------------------------
  sectionTitle('Equipo')
  row('Tipo', DEVICE_TYPE_LABEL[order.device.type] ?? order.device.type)
  row('Marca / modelo', `${order.device.brand} ${order.device.model}`.trim())
  if (order.device.serial) row('Serie', order.device.serial)
  if (order.device.color) row('Color', order.device.color)
  y += 8

  // ------------------------------ falla / accesorios ------------------------
  sectionTitle('Falla reportada')
  paragraph(order.reportedFault || 'Sin descripción registrada.')
  y += 10

  if (!isDelivery) {
    sectionTitle('Accesorios recibidos')
    paragraph(order.accessories.length ? order.accessories.join(' · ') : 'El equipo ingresa sin accesorios.')
    y += 10

    sectionTitle('Estado físico')
    paragraph(order.physicalNotes || 'Sin observaciones adicionales.')
    text(`${order.photos.length} foto${order.photos.length === 1 ? '' : 's'} de respaldo en el sistema.`, 8, 'normal', gray)
    doc.text(`${order.photos.length} foto${order.photos.length === 1 ? '' : 's'} de respaldo en el sistema.`, margin, y)
    y += 20
  }

  // -------------------------------- detalle ---------------------------------
  if (isDelivery) {
    sectionTitle('Detalle del servicio')
    const list: ServiceItem[] = items.length
      ? items
      : [{ id: 'est', description: 'Servicio técnico', kind: 'servicio', price: order.estimatedCost }]
    text('Descripción', 8, 'bold', gray)
    doc.text('Descripción', margin, y)
    text('Tipo', 8, 'bold', gray)
    doc.text('Tipo', margin + 300, y)
    text('Valor', 8, 'bold', gray)
    doc.text('Valor', pageWidth - margin, y, { align: 'right' })
    y += 6
    doc.setDrawColor(black)
    doc.line(margin, y, pageWidth - margin, y)
    y += 14
    for (const item of list) {
      ensureSpace(20)
      text(item.description || '—', 9)
      doc.text(item.description || '—', margin, y)
      text(item.kind, 9, 'normal', gray)
      doc.text(item.kind, margin + 300, y)
      text(money(item.price), 9)
      doc.text(money(item.price), pageWidth - margin, y, { align: 'right' })
      y += 16
    }
    y += 12
  }

  // --------------------------------- totales --------------------------------
  ensureSpace(96)
  const boxWidth = 230
  const boxX = pageWidth - margin - boxWidth
  doc.setFillColor(243, 244, 246)
  doc.rect(boxX, y - 10, boxWidth, 86, 'F')
  let boxY = y + 6
  text(isDelivery ? 'Total servicio' : 'Costo estimado', 9, 'bold', gray)
  doc.text(isDelivery ? 'Total servicio' : 'Costo estimado', boxX + 12, boxY)
  text(money(total), 9)
  doc.text(money(total), boxX + boxWidth - 12, boxY, { align: 'right' })
  boxY += 16
  text('Abono', 9, 'bold', gray)
  doc.text('Abono', boxX + 12, boxY)
  text(`- ${money(order.deposit)}`, 9)
  doc.text(`- ${money(order.deposit)}`, boxX + boxWidth - 12, boxY, { align: 'right' })
  boxY += 20
  doc.setDrawColor(black)
  doc.line(boxX + 12, boxY - 12, boxX + boxWidth - 12, boxY - 12)
  text(isDelivery ? 'Total pagado' : 'Saldo pendiente', 10, 'bold')
  doc.text(isDelivery ? 'Total pagado' : 'Saldo pendiente', boxX + 12, boxY + 4)
  text(money(isDelivery ? total : balance), 10, 'bold')
  doc.text(money(isDelivery ? total : balance), boxX + boxWidth - 12, boxY + 4, { align: 'right' })

  const metaLines = [
    `Estado actual: ${order.status}`,
    ...(!isDelivery && order.estimatedDate ? [`Entrega estimada: ${formatDate(order.estimatedDate)}`] : []),
  ]
  text(metaLines.join('\n'), 8, 'normal', gray)
  doc.text(metaLines, margin, y)
  y += 96

  // -------------------------------- garantía --------------------------------
  ensureSpace(70)
  if (isDelivery) {
    const warrantyUntil = addDays(deliveredAt, BUSINESS.warrantyDays)
    doc.setDrawColor(black)
    doc.setLineWidth(1)
    doc.rect(margin, y, contentWidth, 46)
    text(`Garantía de ${BUSINESS.warrantyDays} días · válida hasta el ${formatDate(warrantyUntil)}`, 10, 'bold')
    doc.text(`Garantía de ${BUSINESS.warrantyDays} días · válida hasta el ${formatDate(warrantyUntil)}`, margin + 12, y + 20)
    text('La garantía cubre únicamente la falla reparada. No cubre golpes, humedad ni intervención de terceros.', 8, 'normal', gray)
    doc.text('La garantía cubre únicamente la falla reparada. No cubre golpes, humedad ni intervención de terceros.', margin + 12, y + 34)
    y += 58
  } else {
    paragraph(
      'El diagnóstico puede modificar el costo estimado. Los equipos no reclamados en 60 días podrán generar cobro por bodegaje.',
      8,
    )
    y += 8
  }

  ensureSpace(30)
  text('Comprobante generado por el sistema del taller.', 8, 'normal', gray)
  doc.text('Comprobante generado por el sistema del taller.', margin, y)

  return { blob: doc.output('blob'), filename: receiptFileName(order, type) }
}

export type ReceiptDelivery = {
  /** URL de WhatsApp con el chat del cliente y el mensaje ya escrito. */
  url: string
  blob: Blob
  fileName: string
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/**
 * Prepara el PDF y el enlace a WhatsApp del comprobante. Debe llamarse antes del
 * clic (p. ej. al abrir el detalle de la orden) para que el manejador del clic
 * pueda descargar y navegar sin perder el gesto de usuario.
 */
export async function prepareReceiptDelivery(
  order: Order,
  type: ReceiptType,
  items: ServiceItem[],
): Promise<ReceiptDelivery> {
  const { blob, filename } = await buildReceiptPdf(order, type, items)
  return {
    blob,
    fileName: filename,
    url: buildWhatsAppUrl(order.customer.phone, buildReceiptMessage(order, type)),
  }
}

/** Descarga el PDF preparado. Se llama de forma síncrona dentro del clic. */
export function downloadReceiptPdf(delivery: ReceiptDelivery) {
  download(delivery.blob, delivery.fileName)
}

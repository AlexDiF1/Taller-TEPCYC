/**
 * Genera el comprobante (recepción o entrega) como ticket térmico de 80 mm.
 *
 * - Formato 80 mm con alto dinámico: el rollo corta justo al terminar el texto.
 * - Monocromo puro (negro sobre blanco), sin grises ni fondos.
 * - El PDF se descarga en el dispositivo y también se puede enviar por WhatsApp
 *   (Baileys) desde la interfaz del comprobante.
 */
import { BUSINESS, addDays, formatDate } from './business'
import { buildReceiptMessage, buildWhatsAppUrl } from './whatsapp'
import { STATUS_MAP } from './status'
import type { Order, ServiceItem } from './types'
import {
  TICKET,
  buildTicketPdf,
  center,
  divider,
  paragraph,
  right,
  row,
  setTicketFont,
  totalLine,
  type TicketDoc,
} from './ticket-pdf'

export type ReceiptPdfType = 'recepcion' | 'entrega'
type ReceiptType = ReceiptPdfType

const DEVICE_TYPE_LABEL: Record<string, string> = {
  consola: 'Consola',
  control: 'Control',
  celular: 'Celular',
  portatil: 'Portátil',
  accesorio: 'Accesorio',
}

const MM_PER_PT = 0.3528

function money(value: number) {
  return `$${Math.round(value).toLocaleString('es-CO')}`
}

function drawTicket(doc: TicketDoc, order: Order, type: ReceiptType, items: ServiceItem[]): number {
  const isDelivery = type === 'entrega'
  const deliveredAt = order.deliveredAt ?? new Date().toISOString()
  const subtotal = items.reduce((sum, item) => sum + item.price, 0)
  const total = isDelivery ? subtotal || order.estimatedCost : order.estimatedCost
  const balance = Math.max(total - order.deposit, 0)
  const warrantyDays = order.warrantyDays ?? BUSINESS.warrantyDays
  const warrantyUntil = addDays(deliveredAt, warrantyDays)

  let y: number = TICKET.margin

  // Fondo blanco puro en toda la página.
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, TICKET.width, doc.internal.pageSize.getHeight(), 'F')

  // ------------------------------- encabezado -------------------------------
  y = center(doc, BUSINESS.name, y, 12, 'bold', 'helvetica')
  y = center(doc, BUSINESS.tagline, y, 7.5, 'normal', 'helvetica')
  y = center(doc, `${BUSINESS.address}, ${BUSINESS.city}`, y, 7, 'normal', 'helvetica')
  y = center(doc, `WhatsApp ${BUSINESS.phone}`, y, 7, 'normal', 'helvetica')
  y = center(doc, formatDate(isDelivery ? deliveredAt : order.createdAt, true), y, 7, 'normal', 'helvetica')
  y = divider(doc, y)

  // ---------------------------- documento y cliente --------------------------
  y = center(doc, isDelivery ? 'FACTURA DE ENTREGA' : 'COMPROBANTE DE RECEPCIÓN', y, 8, 'bold', 'helvetica')
  y = center(doc, order.id, y, 14, 'bold', 'courier')
  y = center(doc, order.customer.name, y, 9, 'bold', 'helvetica')
  y = center(doc, `Tel: +${BUSINESS.countryCode} ${order.customer.phone}`, y, 7.5, 'normal', 'helvetica')
  if (order.customer.documentId) {
    y = center(doc, `Doc: ${order.customer.documentId}`, y, 7, 'normal', 'helvetica')
  }
  y = divider(doc, y)

  // --------------------------------- equipo ----------------------------------
  y = row(doc, 'Equipo', DEVICE_TYPE_LABEL[order.device.type] ?? order.device.type, y)
  y = row(doc, 'Marca/modelo', `${order.device.brand} ${order.device.model}`.trim(), y)
  if (order.device.serial) y = row(doc, 'Serie', order.device.serial, y)
  if (order.device.color) y = row(doc, 'Color', order.device.color, y)
  y = divider(doc, y)

  // ------------------------------ falla / accesorios -------------------------
  y = paragraph(doc, `Falla reportada: ${order.reportedFault || 'Sin descripción registrada.'}`, y, 8)
  y += 0.8

  if (!isDelivery) {
    y = paragraph(
      doc,
      `Accesorios: ${order.accessories.length ? order.accessories.join(', ') : 'El equipo ingresa sin accesorios.'}`,
      y,
      7.5,
    )
    y = paragraph(doc, `Estado físico: ${order.physicalNotes || 'Sin observaciones adicionales.'}`, y, 7.5)
  } else {
    // --------------------------- detalle de entrega --------------------------
    y = divider(doc, y)
    y = center(doc, 'DETALLE DEL SERVICIO', y, 7.5, 'bold', 'helvetica')
    const list: ServiceItem[] = items.length
      ? items
      : [{ id: 'est', description: 'Servicio técnico', kind: 'servicio', price: order.estimatedCost }]
    for (const item of list) {
      const price = money(item.price)
      const maxDesc = TICKET.content - price.length * 8 * MM_PER_PT * 0.6 - 2
      setTicketFont(doc, 8, 'normal')
      const lines = doc.splitTextToSize(item.description || '—', Math.max(20, maxDesc))
      doc.text(lines, TICKET.margin, y)
      doc.text(price, TICKET.width - TICKET.margin, y, { align: 'right' })
      y += Math.max(1, lines.length) * 8 * MM_PER_PT * 1.25
    }
  }

  // --------------------------------- totales ---------------------------------
  y = divider(doc, y)
  setTicketFont(doc, 8, 'bold')
  doc.text(isDelivery ? 'TOTAL SERVICIO' : 'COSTO ESTIMADO', TICKET.margin, y)
  doc.text(money(total), TICKET.width - TICKET.margin, y, { align: 'right' })
  y += 3.8
  setTicketFont(doc, 8, 'normal')
  doc.text('ABONO', TICKET.margin, y)
  doc.text(`- ${money(order.deposit)}`, TICKET.width - TICKET.margin, y, { align: 'right' })
  y += 2
  y = divider(doc, y)
  y = totalLine(doc, isDelivery ? 'TOTAL PAGADO' : 'SALDO PENDIENTE', money(isDelivery ? total : balance), y, 11)

  // ------------------------------ estado / fecha -----------------------------
  y = row(doc, 'Estado', STATUS_MAP[order.status]?.label ?? order.status, y, 7.5)
  if (!isDelivery && order.estimatedDate) {
    y = row(doc, 'Entrega estimada', formatDate(order.estimatedDate), y, 7.5)
  }

  // -------------------------------- garantía ---------------------------------
  y = divider(doc, y)
  if (isDelivery) {
    y = center(doc, 'GARANTÍA', y, 8, 'bold', 'helvetica')
    y = paragraph(doc, `Garantía de ${warrantyDays} días · válida hasta el ${formatDate(warrantyUntil)}`, y, 7.5)
    y = paragraph(
      doc,
      'Cubre exclusivamente la reparación y los repuestos descritos en esta factura. No cubre golpes, humedad, manipulación por terceros, sellos rotos ni fallas distintas a la reparada.',
      y,
      7,
    )
    if (order.device.type === 'celular' && order.warrantyScreenExcluded) {
      y = paragraph(doc, 'No se otorga garantía por pantallas cambiadas.', y, 7)
    }
    if (order.warrantyNoAfterReview !== false) {
      y = paragraph(
        doc,
        'Después de la entrega y revisión por parte del cliente no se otorga garantía por daños o fallas posteriores.',
        y,
        7,
      )
    }
  } else {
    y = paragraph(
      doc,
      'El diagnóstico puede modificar el costo estimado. Equipos no reclamados en 60 días generan cobro por bodegaje. Presente este comprobante para retirar el equipo.',
      y,
      7,
    )
  }

  // ---------------------------------- pie ------------------------------------
  y = divider(doc, y)
  y = center(doc, '¡Gracias por su preferencia!', y, 9, 'bold', 'helvetica')
  y = center(doc, 'Comprobante generado por el sistema del taller', y, 6.5, 'normal', 'helvetica')
  return y + 2
}

export async function buildReceiptPdf(order: Order, type: ReceiptType, items: ServiceItem[]) {
  const blob = await buildTicketPdf((doc) => drawTicket(doc, order, type, items))
  return { blob, filename: receiptFileName(order, type) }
}

export function receiptFileName(order: Order, type: ReceiptType) {
  return `${type === 'entrega' ? 'Factura' : 'Comprobante'}-${order.id}.pdf`
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

/** Abre el PDF de 80 mm en una ventana nueva; el visor permite imprimir directo. */
export function openReceiptPdf(delivery: ReceiptDelivery) {
  const url = URL.createObjectURL(delivery.blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

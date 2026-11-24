/**
 * Un solo lugar para todo lo que sale por WhatsApp desde una orden:
 * abrir el chat, avisar el estado y mandar el recibo en PDF.
 * Si el WhatsApp del taller no está vinculado, se usa wa.me como respaldo.
 */
import { toast } from 'sonner'
import { BUSINESS } from './business'
import { buildReceiptMessage, buildStatusMessage, buildWhatsAppUrl, hasWebsiteCard } from './whatsapp'
import { WaOfflineError, WaThrottleError, blobToDataUrl, waSendDocument, waSendOrder } from './wa'
import { downloadReceiptPdf, type ReceiptDelivery } from './receipt-pdf'
import type { ReceiptType } from '@/components/receipts/receipt-document'
import type { Order } from './types'

function digits(phone: string) {
  const d = phone.replace(/\D/g, '')
  return d.startsWith(BUSINESS.countryCode) ? d : `${BUSINESS.countryCode}${d}`
}

function firstName(order: Order) {
  return order.customer.name.trim().split(/\s+/)[0] || 'el cliente'
}

/** Enlace al chat del cliente, sin mensaje escrito. */
export function chatUrl(phone: string) {
  return `https://wa.me/${digits(phone)}`
}

/** Avisa el estado actual de la orden. Devuelve true si salió desde el servidor. */
export async function notifyStatus(order: Order, { includePhotos = false } = {}) {
  const message = buildStatusMessage(order)
  const fallback = () =>
    window.open(
      buildWhatsAppUrl(order.customer.phone, buildStatusMessage(order, order.status, { link: true })),
      '_blank',
      'noopener,noreferrer',
    )
  try {
    const result = await waSendOrder({
      orderId: order.id,
      phone: order.customer.phone,
      message,
      includePhotos,
      cardUrl: hasWebsiteCard(order.status) ? BUSINESS.website : undefined,
    })
    toast.success(`Aviso enviado a ${firstName(order)}`, {
      description: result.photos > 0 ? `Con ${result.photos} foto${result.photos === 1 ? '' : 's'} del equipo` : undefined,
    })
    return true
  } catch (error) {
    if (error instanceof WaOfflineError || error instanceof WaThrottleError) {
      toast.info(
        error instanceof WaThrottleError
          ? `${error.message} Se abre WhatsApp para enviarlo a mano.`
          : 'WhatsApp del taller no está conectado: se abre WhatsApp para enviarlo a mano.',
      )
      fallback()
    } else {
      toast.error(error instanceof Error ? error.message : 'No se pudo enviar el aviso.', {
        action: { label: 'Abrir WhatsApp', onClick: fallback },
      })
    }
    return false
  }
}

/** Manda el recibo en PDF al chat del cliente; si no se puede, lo descarga. */
export async function sendReceipt(order: Order, type: ReceiptType, delivery: ReceiptDelivery) {
  if (!order.customer.phone) {
    downloadReceiptPdf(delivery)
    toast.info('PDF descargado: la orden no tiene WhatsApp registrado.')
    return false
  }
  try {
    await waSendDocument({
      phone: order.customer.phone,
      fileName: delivery.fileName,
      dataUrl: await blobToDataUrl(delivery.blob),
      caption: buildReceiptMessage(order, type),
    })
    toast.success(`${type === 'entrega' ? 'Factura' : 'Recibo'} enviado a ${firstName(order)}`)
    return true
  } catch (error) {
    downloadReceiptPdf(delivery)
    if (error instanceof WaOfflineError) toast.info('WhatsApp del taller no está conectado: se descargó el PDF para adjuntarlo a mano.')
    else if (error instanceof WaThrottleError) toast.info(`${error.message} Se descargó el PDF para enviarlo a mano.`)
    else toast.error(error instanceof Error ? `${error.message} Se descargó el PDF.` : 'No se pudo enviar; se descargó el PDF.')
    return false
  }
}

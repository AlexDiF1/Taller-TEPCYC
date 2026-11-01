import { BUSINESS, addDays, formatDate, formatMoney } from './business'
import type { Order, OrderStatus } from './types'

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith(BUSINESS.countryCode) ? digits : `${BUSINESS.countryCode}${digits}`
}

function deviceLabel(order: Order) {
  return `${order.device.brand} ${order.device.model}`.trim()
}

const TEMPLATES: Record<OrderStatus, (o: Order) => string> = {
  recibido: (o) =>
    `Hola ${o.customer.name.split(' ')[0]}, recibimos tu *${deviceLabel(o)}* en ${BUSINESS.name}.\n\n` +
    `Orden: *${o.id}*\nFalla reportada: ${o.reportedFault}\n` +
    (o.estimatedDate ? `Fecha estimada: ${formatDate(o.estimatedDate)}\n` : '') +
    `\nTe avisaremos por este medio cada vez que avance tu reparación.`,
  en_revision: (o) =>
    `Hola ${o.customer.name.split(' ')[0]}, tu *${deviceLabel(o)}* (orden *${o.id}*) ya está *en revisión*. ` +
    `Nuestro técnico está diagnosticando la falla y pronto te enviaremos el presupuesto.`,
  en_reparacion: (o) =>
    `Buenas noticias ${o.customer.name.split(' ')[0]}: tu *${deviceLabel(o)}* (orden *${o.id}*) está *en reparación*. ` +
    `Costo estimado: ${formatMoney(o.estimatedCost)}.`,
  listo: (o) => {
    const total = o.items.reduce((s, i) => s + i.price, 0) || o.estimatedCost
    return (
      `¡Hola ${o.customer.name.split(' ')[0]}! Tu *${deviceLabel(o)}* está *listo para entrega*.\n\n` +
      `Orden: *${o.id}*\nTotal: ${formatMoney(total)}\nAbono: ${formatMoney(o.deposit)}\n` +
      `Saldo a pagar: *${formatMoney(Math.max(total - o.deposit, 0))}*\n\n` +
      `Puedes recogerlo en ${BUSINESS.address}. Recuerda traer tu comprobante de recepción.`
    )
  },
  entregado: (o) =>
    `Gracias por confiar en ${BUSINESS.name}, ${o.customer.name.split(' ')[0]}.\n\n` +
    `Tu *${deviceLabel(o)}* (orden *${o.id}*) fue entregado. ` +
    `Garantía de ${BUSINESS.warrantyDays} días, válida hasta el ${formatDate(addDays(o.deliveredAt ?? new Date().toISOString(), BUSINESS.warrantyDays))}.`,
}

export function buildStatusMessage(order: Order, status: OrderStatus = order.status) {
  return TEMPLATES[status](order)
}

export function buildWhatsAppUrl(phone: string, message: string) {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`
}

export function openWhatsApp(order: Order, status: OrderStatus = order.status) {
  const url = buildWhatsAppUrl(order.customer.phone, buildStatusMessage(order, status))
  window.open(url, '_blank', 'noopener,noreferrer')
}

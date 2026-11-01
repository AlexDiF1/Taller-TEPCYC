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
  pendiente: (o) =>
    `Hola ${o.customer.name.split(' ')[0]}, recibimos tu *${deviceLabel(o)}* en ${BUSINESS.name}.\n\n` +
    `Orden: *${o.id}*\nFalla reportada: ${o.reportedFault}\n` +
    (o.estimatedDate ? `Fecha estimada: ${formatDate(o.estimatedDate)}\n` : '') +
    `\nTe avisaremos por este medio cada vez que avance tu reparación.`,
  enRevision: (o) =>
    `Hola ${o.customer.name.split(' ')[0]}, tu *${deviceLabel(o)}* (orden *${o.id}*) ya está *en revisión*. ` +
    `Nuestro técnico está diagnosticando la falla y pronto te enviaremos el presupuesto.`,
  esperandoConfirmacion: (o) =>
    `Hola ${o.customer.name.split(' ')[0]}, ya tenemos el diagnóstico de tu *${deviceLabel(o)}* (orden *${o.id}*).\n\n` +
    `Costo estimado: ${formatMoney(o.estimatedCost)}\n` +
    `Quedamos atentos a tu confirmación para iniciar la reparación.`,
  completada: (o) => {
    const total = o.items.reduce((s, i) => s + i.price, 0) || o.estimatedCost
    return (
      `¡Hola ${o.customer.name.split(' ')[0]}! Tu *${deviceLabel(o)}* está *listo para entrega*.\n\n` +
      `Orden: *${o.id}*\nTotal: ${formatMoney(total)}\nAbono: ${formatMoney(o.deposit)}\n` +
      `Saldo a pagar: *${formatMoney(Math.max(total - o.deposit, 0))}*\n\n` +
      `Puedes recogerlo en ${BUSINESS.address}. Recuerda traer tu comprobante de recepción.`
    )
  },
  rechazada: (o) =>
    `Hola ${o.customer.name.split(' ')[0]}, como no autorizaste la reparación de tu *${deviceLabel(o)}* ` +
    `(orden *${o.id}*), el equipo queda disponible para reclamar en ${BUSINESS.address}. ` +
    `Sin costo por la revisión.`,
  fallida: (o) =>
    `Hola ${o.customer.name.split(' ')[0]}, lamentablemente no pudimos reparar tu *${deviceLabel(o)}* ` +
    `(orden *${o.id}*).\n\n${o.history.at(-1)?.note ?? ''}\n\n` +
    `Puedes pasar por el equipo en ${BUSINESS.address}. No hay cobro por el diagnóstico.`,
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

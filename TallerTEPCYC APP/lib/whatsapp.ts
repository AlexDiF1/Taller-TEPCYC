import { BUSINESS } from './business'
import type { Order, OrderStatus } from './types'

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith(BUSINESS.countryCode) ? digits : `${BUSINESS.countryCode}${digits}`
}

function deviceLabel(order: Order) {
  const brand = order.device.brand.trim()
  const model = order.device.model.trim()
  if (!brand) return model
  if (!model) return brand
  return model.toLowerCase().startsWith(brand.toLowerCase()) ? model : `${brand} ${model}`
}

function firstName(order: Order) {
  return order.customer.name.trim().split(/\s+/)[0] ?? ''
}

function orderRef(order: Order) {
  return `(Orden: #${order.id})`
}

/** Valor en el formato del taller: $500000 */
function plainMoney(value: number) {
  return `$${Math.round(value)}`
}

const SIGNATURE = 'Cualquier inquietud adicional, estaremos atentos a sus mensajes. Gracias por elegir nuestro servicio técnico.'

function greeting(order: Order) {
  return `Cordial saludo, ${firstName(order)} . Somos TODOENPCYCONSOLAS 🎮📱.`
}

function totalOf(order: Order) {
  return order.items.reduce((sum, item) => sum + item.price, 0) || order.estimatedCost
}

const TEMPLATES: Record<OrderStatus, (o: Order) => string> = {
  pendiente: (o) =>
    `${greeting(o)}\n\n` +
    `Le informamos que su equipo ${deviceLabel(o)} ${orderRef(o)} ha sido ingresado exitosamente a nuestro taller y se encuentra en fila de espera.\n\n` +
    `Pronto iniciaremos su revisión técnica.\n\n` +
    SIGNATURE,
  enRevision: (o) =>
    `${greeting(o)}\n\n` +
    `Le informamos que su equipo ${deviceLabel(o)} ${orderRef(o)} ya se encuentra en revisión técnica por parte de nuestro equipo de taller.\n\n` +
    `Pronto le informaremos el resultado del diagnóstico y el costo de la reparación.\n\n` +
    SIGNATURE,
  esperandoConfirmacion: (o) =>
    `${greeting(o)}\n\n` +
    `Le informamos que nuestro equipo técnico ha finalizado el diagnóstico de su ${deviceLabel(o)} ${orderRef(o)}.\n\n` +
    `El costo exacto para realizar la reparación es de ${plainMoney(o.estimatedCost)}.\n\n` +
    `Por favor, confírmenos por este medio si autoriza que procedamos con el trabajo de reparación.\n\n` +
    SIGNATURE,
  completada: (o) =>
    `${greeting(o)}\n\n` +
    `Tenemos excelentes noticias. La reparación de su ${deviceLabel(o)} ${orderRef(o)} ha concluido de manera exitosa.\n\n` +
    `Ya puede acercarse a nuestras instalaciones para retirar su equipo.\n\n` +
    `Valor del servicio: ${plainMoney(totalOf(o))}\n\n` +
    SIGNATURE,
  rechazada: (o) =>
    `${greeting(o)}\n\n` +
    `Le confirmamos que el servicio para su ${deviceLabel(o)} ${orderRef(o)} ha sido marcado como no autorizado por usted.\n\n` +
    `Su equipo ya se encuentra ensamblado y listo para ser entregado. Recuerde que se genera el cobro por concepto de revisión y diagnóstico en taller.\n\n` +
    SIGNATURE,
  fallida: (o) =>
    `${greeting(o)}\n\n` +
    `Le informamos que, tras realizar múltiples pruebas técnicas, lamentablemente no ha sido posible darle solución a la falla de su ${deviceLabel(o)} ${orderRef(o)} debido a la complejidad del daño.\n\n` +
    `Por favor, acérquese a nuestro establecimiento cuando disponga de tiempo para realizar la devolución de su equipo.\n\n` +
    SIGNATURE,
}

export function buildStatusMessage(order: Order, status: OrderStatus = order.status) {
  return TEMPLATES[status](order)
}

export function buildWhatsAppUrl(phone: string, message: string) {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`
}

export type ReceiptKind = 'recepcion' | 'entrega'

/** Mensaje que acompaña al comprobante/factura enviado en PDF. */
export function buildReceiptMessage(order: Order, type: ReceiptKind) {
  const isDelivery = type === 'entrega'
  const lines = isDelivery
    ? [
        `Total del servicio: ${plainMoney(totalOf(order))}`,
        `Abono recibido: ${plainMoney(order.deposit)}`,
        `Total pagado: ${plainMoney(totalOf(order))}`,
      ]
    : [
        `Costo estimado: ${plainMoney(order.estimatedCost)}`,
        `Abono: ${plainMoney(order.deposit)}`,
        `Saldo pendiente: ${plainMoney(Math.max(totalOf(order) - order.deposit, 0))}`,
      ]

  return (
    `${greeting(order)}\n\n` +
    `Le compartimos ${isDelivery ? 'la factura de entrega' : 'el comprobante de recepción'} de su ${deviceLabel(order)} ${orderRef(order)}.\n\n` +
    `${lines.join('\n')}\n\n` +
    `El documento va adjunto en PDF.\n\n` +
    SIGNATURE
  )
}

export function openWhatsApp(order: Order, status: OrderStatus = order.status) {
  const url = buildWhatsAppUrl(order.customer.phone, buildStatusMessage(order, status))
  window.open(url, '_blank', 'noopener,noreferrer')
}

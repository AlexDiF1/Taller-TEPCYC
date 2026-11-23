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
  // El id ya puede venir como ORD-99536: en ese caso no se le pone otro «#».
  const id = String(order.id)
  return `(Orden: ${/^\d+$/.test(id) ? `#${id}` : id})`
}

/** Valor en el formato del taller: $500000 */
function plainMoney(value: number) {
  return `$${Math.round(value)}`
}

const SIGNATURE = 'Cualquier inquietud adicional, estaremos atentos a sus mensajes. Gracias por elegir nuestro servicio técnico.'

/** Cierre final de los mensajes: estos párrafos van al final, después de la firma. */
const WEBSITE_TEXTO = 'Conozca más de nuestro trabajo, productos y servicios en nuestra página web'
const MAPS_TEXTO = 'Si quedó satisfecho con nuestro trabajo, nos ayudaría muchísimo con una calificación en Google Maps'

/**
 * Los estados que llevan la tarjeta de la web. El servidor manda la tarjeta
 * (con miniatura) como mensaje aparte, así que en el texto solo va el «👇»;
 * en el respaldo `wa.me` sí hace falta la URL escrita, por eso `link`.
 */
export const STATUSES_WITH_WEBSITE: OrderStatus[] = ['pendiente', 'enRevision', 'esperandoConfirmacion', 'completada']

export function hasWebsiteCard(status: OrderStatus) {
  return STATUSES_WITH_WEBSITE.includes(status)
}

function webLine({ link = false }: { link?: boolean }) {
  return link ? `${WEBSITE_TEXTO}: ${BUSINESS.website}` : `${WEBSITE_TEXTO} 👇`
}

function mapsLine() {
  return `${MAPS_TEXTO}: ${BUSINESS.maps}`
}

function cierre(extras: string[]) {
  return [SIGNATURE, ...extras].join('\n\n')
}

function greeting(order: Order) {
  return `Cordial saludo, ${firstName(order)} . Somos TODOENPCYCONSOLAS 🎮📱.`
}

function totalOf(order: Order) {
  return order.items.reduce((sum, item) => sum + item.price, 0) || order.estimatedCost
}

type MsgOpts = { link?: boolean }

const TEMPLATES: Record<OrderStatus, (o: Order, opts: MsgOpts) => string> = {
  pendiente: (o, opts) =>
    `${greeting(o)}\n\n` +
    `Le informamos que su equipo ${deviceLabel(o)} ${orderRef(o)} ha sido ingresado exitosamente a nuestro taller y se encuentra en fila de espera.\n\n` +
    `Pronto iniciaremos su revisión técnica.\n\n` +
    cierre([webLine(opts)]),
  enRevision: (o, opts) =>
    `${greeting(o)}\n\n` +
    `Le informamos que su equipo ${deviceLabel(o)} ${orderRef(o)} ya se encuentra en revisión técnica por parte de nuestro equipo de taller.\n\n` +
    `Pronto le informaremos el resultado del diagnóstico y el costo de la reparación.\n\n` +
    cierre([webLine(opts)]),
  esperandoConfirmacion: (o, opts) =>
    `${greeting(o)}\n\n` +
    `Le informamos que nuestro equipo técnico ha finalizado el diagnóstico de su ${deviceLabel(o)} ${orderRef(o)}.\n\n` +
    `El costo exacto para realizar la reparación es de ${plainMoney(o.estimatedCost)}.\n\n` +
    `Por favor, confírmenos por este medio si autoriza que procedamos con el trabajo de reparación.\n\n` +
    cierre([webLine(opts)]),
  completada: (o, opts) =>
    `${greeting(o)}\n\n` +
    `Tenemos excelentes noticias. La reparación de su ${deviceLabel(o)} ${orderRef(o)} ha concluido de manera exitosa.\n\n` +
    `Ya puede acercarse a nuestras instalaciones para retirar su equipo.\n\n` +
    `Valor del servicio: ${plainMoney(totalOf(o))}\n\n` +
    cierre([webLine(opts), mapsLine()]),
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

export function buildStatusMessage(order: Order, status: OrderStatus = order.status, opts: MsgOpts = {}) {
  return TEMPLATES[status](order, opts)
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
    cierre(isDelivery ? [mapsLine()] : [])
  )
}

export function openWhatsApp(order: Order, status: OrderStatus = order.status) {
  const url = buildWhatsAppUrl(order.customer.phone, buildStatusMessage(order, status, { link: true }))
  window.open(url, '_blank', 'noopener,noreferrer')
}

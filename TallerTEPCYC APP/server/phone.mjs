/**
 * Utilidades de números de teléfono para WhatsApp.
 *
 * El negocio es colombiano: los números se escriben con 10 dígitos
 * (3001234567) y WhatsApp los necesita con el prefijo 57 y el sufijo
 * @s.whatsapp.net.
 */

/** Solo dígitos, sin +, espacios ni guiones. */
export function digitsOf(value) {
  return String(value ?? '').replace(/\D/g, '')
}

/**
 * Normaliza a formato internacional colombiano (573001234567).
 * Devuelve null cuando el número no es plausible.
 */
export function normalizePhone(value) {
  const digits = digitsOf(value)
  if (!digits) return null
  if (digits.startsWith('00')) return normalizePhone(digits.slice(2))
  if (digits.length === 10) return `57${digits}`
  if (digits.length === 12 && digits.startsWith('57')) return digits
  if (digits.length === 11 && digits.startsWith('57')) return digits // fijo con indicativo
  if (digits.length >= 11 && digits.length <= 15) return digits
  return null
}

/** JID de WhatsApp (573001234567@s.whatsapp.net) o null si no es válido. */
export function toJid(value) {
  if (typeof value === 'string' && value.endsWith('@s.whatsapp.net')) return value
  if (typeof value === 'string' && value.endsWith('@g.us')) return value
  if (typeof value === 'string' && value.includes('@lid')) return value
  const phone = normalizePhone(value)
  return phone ? `${phone}@s.whatsapp.net` : null
}

/** Formato legible: +57 300 123 4567 */
export function formatPhone(value) {
  const phone = normalizePhone(value)
  if (!phone) return String(value ?? '')
  if (phone.length === 12 && phone.startsWith('57')) {
    const local = phone.slice(2)
    return `+57 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
  }
  return `+${phone}`
}

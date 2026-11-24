export const BUSINESS = {
  name: 'TODOENPCYCONSOLAS 2',
  tagline: 'Servicio Técnico y Venta de Videojuegos',
  taxId: 'NIT 1007624883-1',
  address: 'Cra 3 # 20-26 Barrio la Esperanza',
  city: 'Mosquera, Cundinamarca',
  phone: '+57 318 022 3184',
  email: 'todoenpcyconsolas2@gmail.com',
  website: 'https://tepcyc.com',
  maps: 'https://maps.app.goo.gl/Q8zifgS4uN5Gjfv2A',
  countryCode: '57',
  warrantyDays: 90,
  /** Bodegaje: días sin costo desde el aviso de «listo» y valor por cada día siguiente. */
  storageFreeDays: 60,
  storageFeePerDay: 3000,
  currency: 'COP',
  locale: 'es-CO',
} as const

/** Condiciones que acepta el cliente al dejar el equipo (recibos de ingreso). */
export const INTAKE_TERMS =
  'El diagnóstico puede cambiar el costo estimado; solo se repara cuando el cliente aprueba el valor. ' +
  `Si el equipo no se recoge en ${BUSINESS.storageFreeDays} días desde el aviso de que está listo, ` +
  `se cobra bodegaje de $${BUSINESS.storageFeePerDay.toLocaleString('es-CO')} por día. ` +
  'Presente este comprobante para retirar el equipo.'

/** Autorización de datos personales (Ley 1581 de 2012) que da el cliente al dejar el equipo. */
export const DATA_CONSENT =
  'El cliente autoriza el uso de sus datos para atender la orden y recibir mensajes por WhatsApp. ' +
  'Términos y política de datos: tepcyc.com/terminos.html y tepcyc.com/privacidad.html'

export function formatMoney(value: number) {
  return new Intl.NumberFormat(BUSINESS.locale, {
    style: 'currency',
    currency: BUSINESS.currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(iso: string, withTime = false) {
  return new Intl.DateTimeFormat(BUSINESS.locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(iso))
}

export function addDays(iso: string, days: number) {
  const date = new Date(iso)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

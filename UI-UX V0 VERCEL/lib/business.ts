export const BUSINESS = {
  name: 'TODOENPCYCONSOLAS',
  tagline: 'Servicio técnico de consolas, controles y accesorios',
  taxId: 'NIT 1007624883-1',
  address: 'Cra 3 # 20-26 Barrio la Esperanza',
  city: 'Bogotá, Colombia',
  phone: '+57 300 000 0000',
  countryCode: '57',
  warrantyDays: 90,
  currency: 'COP',
  locale: 'es-CO',
} as const

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

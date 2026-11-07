/**
 * Ventas (POS): tipos, métodos de pago, cliente de API y recibo en PDF.
 */
import { Banknote, CreditCard, KeyRound, Smartphone, Wallet, type LucideIcon } from 'lucide-react'
import { BUSINESS, formatDate } from './business'
import {
  TICKET,
  buildTicketPdf,
  center,
  divider,
  paragraph,
  setTicketFont,
  totalLine,
  type TicketDoc,
} from './ticket-pdf'

export type PaymentMethod = 'efectivo' | 'nequi' | 'daviplata' | 'llave' | 'tarjeta'

export interface VentaItem {
  id?: string
  name: string
  price: number
  cost: number
  quantity: number
  subtotal: number
}

export interface Venta {
  id: string
  dbId: number
  createdAt: string
  customerName?: string
  customerPhone?: string
  paymentMethod: PaymentMethod
  total: number
  totalCost: number
  profit: number
  notes?: string
  items: VentaItem[]
}

export interface VentaSummary {
  count: number
  total: number
  totalCost: number
  profit: number
  averageTicket: number
  byMethod: Record<PaymentMethod, number>
}

export interface VentaListResponse {
  ventas: Venta[]
  summary: VentaSummary
}

export interface NewVentaInput {
  items: { name: string; price: number; cost: number; quantity: number }[]
  paymentMethod: PaymentMethod
  customerName?: string
  customerPhone?: string
  notes?: string
}

/** Campos editables de una venta ya registrada (PUT /api/ventas/:id). */
export interface VentaPatch {
  items?: { name: string; price: number; cost: number; quantity: number }[]
  paymentMethod?: PaymentMethod
  customerName?: string
  customerPhone?: string
  notes?: string
}

export interface VentaFilters {
  q?: string
  from?: string
  to?: string
  method?: PaymentMethod | ''
}

export interface PaymentMethodMeta {
  value: PaymentMethod
  label: string
  hint: string
  icon: LucideIcon
  text: string
  bg: string
  ring: string
  dot: string
}

/** Métodos con su ícono y acento; los colores salen de los tokens del tema. */
export const PAYMENT_METHODS: PaymentMethodMeta[] = [
  {
    value: 'efectivo',
    label: 'Efectivo',
    hint: 'Dinero en caja',
    icon: Banknote,
    text: 'text-status-done',
    bg: 'bg-status-done/12',
    ring: 'ring-status-done/40',
    dot: 'bg-status-done',
  },
  {
    value: 'nequi',
    label: 'Nequi',
    hint: 'Transferencia',
    icon: Smartphone,
    text: 'text-status-waiting',
    bg: 'bg-status-waiting/12',
    ring: 'ring-status-waiting/40',
    dot: 'bg-status-waiting',
  },
  {
    value: 'daviplata',
    label: 'Daviplata',
    hint: 'Transferencia',
    icon: Wallet,
    text: 'text-status-rejected',
    bg: 'bg-status-rejected/12',
    ring: 'ring-status-rejected/40',
    dot: 'bg-status-rejected',
  },
  {
    value: 'llave',
    label: 'Llave',
    hint: 'Bre-B / llave',
    icon: KeyRound,
    text: 'text-status-review',
    bg: 'bg-status-review/12',
    ring: 'ring-status-review/40',
    dot: 'bg-status-review',
  },
  {
    value: 'tarjeta',
    label: 'Tarjeta',
    hint: 'Crédito / débito',
    icon: CreditCard,
    text: 'text-status-pending',
    bg: 'bg-status-pending/12',
    ring: 'ring-status-pending/40',
    dot: 'bg-status-pending',
  },
]

export const PAYMENT_MAP = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m])) as Record<
  PaymentMethod,
  PaymentMethodMeta
>

const VENTAS_URL = '/api/ventas'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const body = (await response.json()) as { error?: string }
      if (body?.error) detail = body.error
    } catch {
      /* respuesta sin JSON */
    }
    throw new Error(detail)
  }
  return (await response.json()) as T
}

export function ventaUrl(id: string | number) {
  return `${VENTAS_URL}/${encodeURIComponent(String(id))}`
}

export async function listVentas(filters: VentaFilters = {}): Promise<VentaListResponse> {
  const params = new URLSearchParams()
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.method) params.set('method', filters.method)
  const query = params.toString()
  return request<VentaListResponse>(query ? `${VENTAS_URL}?${query}` : VENTAS_URL)
}

export async function createVenta(input: NewVentaInput): Promise<Venta> {
  return request<Venta>(VENTAS_URL, { method: 'POST', body: JSON.stringify(input) })
}

/** Edita cliente, método de pago, nota o los artículos de una venta. */
export async function updateVenta(id: string | number, patch: VentaPatch): Promise<Venta> {
  return request<Venta>(ventaUrl(id), { method: 'PUT', body: JSON.stringify(patch) })
}

export async function deleteVenta(id: string | number): Promise<void> {
  await request<{ ok: boolean }>(ventaUrl(id), { method: 'DELETE' })
}

/* ------------------------------- recibos -------------------------------- */

function plainMoney(value: number) {
  return `$${Math.round(value).toLocaleString('es-CO')}`
}

export function saleReceiptFileName(venta: Venta) {
  return `Recibo-${venta.id}.pdf`
}

/** Recibo de caja para el cliente (sin costos ni utilidad). */
export async function buildSaleReceiptPdf(venta: Venta) {
  const blob = await buildTicketPdf((doc) => drawSaleTicket(doc, venta))
  return { blob, filename: saleReceiptFileName(venta) }
}

/** Imprime el ticket de 80 mm usando el visor de PDF del navegador. */
export async function printSaleReceiptPdf(venta: Venta) {
  const { blob } = await buildSaleReceiptPdf(venta)
  const url = URL.createObjectURL(blob)
  const frame = document.createElement('iframe')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.src = url
  frame.onload = () => {
    try {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
    } catch {
      /* el visor puede bloquear la impresión incrustada */
    }
  }
  document.body.appendChild(frame)
  setTimeout(() => {
    frame.remove()
    URL.revokeObjectURL(url)
  }, 120000)
}

function drawSaleTicket(doc: TicketDoc, venta: Venta): number {
  let y: number = TICKET.margin
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, TICKET.width, doc.internal.pageSize.getHeight(), 'F')

  // Encabezado centrado
  y = center(doc, BUSINESS.name, y, 12, 'bold', 'helvetica')
  y = center(doc, BUSINESS.tagline, y, 7.5, 'normal', 'helvetica')
  y = center(doc, `${BUSINESS.address}, ${BUSINESS.city}`, y, 7, 'normal', 'helvetica')
  y = center(doc, `WhatsApp ${BUSINESS.phone}`, y, 7, 'normal', 'helvetica')
  y = center(doc, formatDate(venta.createdAt, true), y, 7, 'normal', 'helvetica')
  y = divider(doc, y)

  y = center(doc, 'RECIBO DE VENTA', y, 8, 'bold', 'helvetica')
  y = center(doc, venta.id, y, 14, 'bold', 'courier')
  y = center(doc, venta.customerName?.trim() || 'Cliente ocasional', y, 9, 'bold', 'helvetica')
  if (venta.customerPhone) {
    y = center(doc, `Tel: ${venta.customerPhone}`, y, 7.5, 'normal', 'helvetica')
  }
  y = divider(doc, y)

  // Detalle compacto: cantidad x artículo ....... subtotal
  for (const item of venta.items) {
    const price = plainMoney(item.subtotal)
    const prefix = `${item.quantity} x `
    const maxDesc = TICKET.content - (prefix.length + price.length) * 8 * 0.3528 * 0.6 - 2
    setTicketFont(doc, 8, 'normal')
    const lines = doc.splitTextToSize(item.name || '—', Math.max(20, maxDesc))
    doc.text(prefix + lines[0], TICKET.margin, y)
    doc.text(price, TICKET.width - TICKET.margin, y, { align: 'right' })
    y += 8 * 0.3528 * 1.25
    for (const extra of lines.slice(1)) {
      doc.text('   ' + extra, TICKET.margin, y)
      y += 8 * 0.3528 * 1.25
    }
  }

  y = divider(doc, y)
  setTicketFont(doc, 8, 'normal')
  doc.text('MÉTODO DE PAGO', TICKET.margin, y)
  doc.text(PAYMENT_MAP[venta.paymentMethod]?.label ?? venta.paymentMethod, TICKET.width - TICKET.margin, y, { align: 'right' })
  y += 3.8
  y = divider(doc, y)
  y = totalLine(doc, 'TOTAL', plainMoney(venta.total), y, 14)
  y += 1

  if (venta.notes) {
    y = divider(doc, y)
    y = paragraph(doc, `Nota: ${venta.notes}`, y, 7.5)
  }

  y = divider(doc, y)
  y = center(doc, 'Gracias por su compra', y, 9, 'bold', 'helvetica')
  y = center(doc, 'Garantía sujeta a las condiciones del producto', y, 6.5, 'normal', 'helvetica')
  return y + 2
}

/** Mensaje de WhatsApp con el resumen de la venta. */
export function buildSaleMessage(venta: Venta) {
  const firstName = venta.customerName?.trim().split(/\s+/)[0] ?? ''
  const lines = venta.items.map(
    (i) => `• ${i.quantity} × ${i.name} — ${plainMoney(i.subtotal)}`,
  )
  return (
    `Cordial saludo${firstName ? `, ${firstName}` : ''}. Somos ${BUSINESS.name} 🎮📱.\n\n` +
    `Registramos su compra ${venta.id}:\n\n` +
    `${lines.join('\n')}\n\n` +
    `Total: ${plainMoney(venta.total)}\n` +
    `Método de pago: ${PAYMENT_MAP[venta.paymentMethod]?.label ?? venta.paymentMethod}\n\n` +
    `El recibo va adjunto en PDF.\n\n` +
    `Cualquier inquietud adicional, estaremos atentos a sus mensajes. Gracias por su compra.`
  )
}

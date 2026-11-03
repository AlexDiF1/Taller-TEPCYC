/**
 * Ventas (POS): tipos, métodos de pago, cliente de API y recibo en PDF.
 */
import { Banknote, CreditCard, KeyRound, Smartphone, Wallet, type LucideIcon } from 'lucide-react'
import { BUSINESS, formatDate } from './business'

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
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 42
  const contentWidth = pageWidth - margin * 2
  const gray = 110
  const black = 20
  let y = margin

  function text(value: string, size: number, style: 'normal' | 'bold' = 'normal', color = black) {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(color)
    return doc
  }

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  // Encabezado
  text(BUSINESS.name, 17, 'bold')
  doc.text(BUSINESS.name, margin, y)
  y += 15
  text(BUSINESS.tagline, 9, 'normal', gray)
  doc.text(BUSINESS.tagline, margin, y)
  y += 13
  text(`${BUSINESS.taxId} · ${BUSINESS.address}, ${BUSINESS.city}`, 8, 'normal', gray)
  doc.text(`${BUSINESS.taxId} · ${BUSINESS.address}, ${BUSINESS.city}`, margin, y)
  y += 11
  text(`WhatsApp ${BUSINESS.phone}`, 8, 'normal', gray)
  doc.text(`WhatsApp ${BUSINESS.phone}`, margin, y)

  let headY = margin
  text('RECIBO DE VENTA', 8, 'bold', gray)
  doc.text('RECIBO DE VENTA', pageWidth - margin, headY, { align: 'right' })
  headY += 18
  text(venta.id, 16, 'bold')
  doc.text(venta.id, pageWidth - margin, headY, { align: 'right' })
  headY += 14
  text(formatDate(venta.createdAt, true), 8, 'normal', gray)
  doc.text(formatDate(venta.createdAt, true), pageWidth - margin, headY, { align: 'right' })

  y += 26
  doc.setDrawColor(black)
  doc.setLineWidth(1)
  doc.line(margin, y, pageWidth - margin, y)
  y += 20

  // Cliente y pago
  text('CLIENTE', 8, 'bold', gray)
  doc.text('CLIENTE', margin, y)
  text('MÉTODO DE PAGO', 8, 'bold', gray)
  doc.text('MÉTODO DE PAGO', margin + contentWidth * 0.55, y)
  y += 14
  text(venta.customerName || 'Cliente ocasional', 10, 'bold')
  doc.text(venta.customerName || 'Cliente ocasional', margin, y)
  text(PAYMENT_MAP[venta.paymentMethod]?.label ?? venta.paymentMethod, 10, 'bold')
  doc.text(PAYMENT_MAP[venta.paymentMethod]?.label ?? venta.paymentMethod, margin + contentWidth * 0.55, y)
  y += 12
  if (venta.customerPhone) {
    text(venta.customerPhone, 9, 'normal', gray)
    doc.text(venta.customerPhone, margin, y)
    y += 12
  }
  y += 12

  // Tabla de artículos
  text('ARTÍCULO', 8, 'bold', gray)
  doc.text('ARTÍCULO', margin, y)
  text('CANT.', 8, 'bold', gray)
  doc.text('CANT.', margin + contentWidth * 0.58, y, { align: 'right' })
  text('UNITARIO', 8, 'bold', gray)
  doc.text('UNITARIO', margin + contentWidth * 0.74, y, { align: 'right' })
  text('SUBTOTAL', 8, 'bold', gray)
  doc.text('SUBTOTAL', pageWidth - margin, y, { align: 'right' })
  y += 6
  doc.setDrawColor(220)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 14

  for (const item of venta.items) {
    const lines = doc.splitTextToSize(item.name, contentWidth * 0.54)
    const rowHeight = Math.max(14, lines.length * 12)
    ensureSpace(rowHeight + 10)
    text(item.name, 9)
    doc.text(lines, margin, y)
    text(String(item.quantity), 9)
    doc.text(String(item.quantity), margin + contentWidth * 0.58, y, { align: 'right' })
    text(plainMoney(item.price), 9)
    doc.text(plainMoney(item.price), margin + contentWidth * 0.74, y, { align: 'right' })
    text(plainMoney(item.subtotal), 9, 'bold')
    doc.text(plainMoney(item.subtotal), pageWidth - margin, y, { align: 'right' })
    y += rowHeight
  }

  y += 6
  doc.setDrawColor(black)
  doc.setLineWidth(0.8)
  doc.line(margin + contentWidth * 0.55, y, pageWidth - margin, y)
  y += 16
  text('TOTAL', 11, 'bold')
  doc.text('TOTAL', margin + contentWidth * 0.55, y)
  text(plainMoney(venta.total), 14, 'bold')
  doc.text(plainMoney(venta.total), pageWidth - margin, y, { align: 'right' })
  y += 30

  if (venta.notes) {
    text('NOTA', 8, 'bold', gray)
    doc.text('NOTA', margin, y)
    y += 12
    const noteLines = doc.splitTextToSize(venta.notes, contentWidth)
    text(venta.notes, 9)
    doc.text(noteLines, margin, y)
    y += noteLines.length * 12 + 12
  }

  text('Gracias por su compra. Garantía sujeta a las condiciones del producto.', 8, 'normal', gray)
  doc.text('Gracias por su compra. Garantía sujeta a las condiciones del producto.', margin, y)

  return { blob: doc.output('blob'), filename: saleReceiptFileName(venta) }
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

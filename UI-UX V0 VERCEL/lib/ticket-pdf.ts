/**
 * Utilidades compartidas para tickets térmicos de 80 mm.
 *
 * El PDF se genera en dos pasadas: la primera mide la altura real con un
 * documento temporal y la segunda crea la página con alto exacto, para que el
 * rollo corte justo donde termina el contenido.
 */
import type { jsPDF } from 'jspdf'

export const TICKET = {
  width: 80,
  margin: 4,
  content: 72,
} as const

const MM_PER_PT = 0.3528

export type TicketDoc = jsPDF
export type TicketFont = 'courier' | 'helvetica'

export async function buildTicketPdf(render: (doc: TicketDoc) => number): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const measure = new jsPDF({ unit: 'mm', format: [TICKET.width, 297], compress: true })
  const endY = render(measure)
  const height = Math.max(40, Math.ceil(endY + TICKET.margin))
  const doc = new jsPDF({ unit: 'mm', format: [TICKET.width, height], compress: true })
  render(doc)
  return doc.output('blob')
}

export function setTicketFont(
  doc: TicketDoc,
  size: number,
  style: 'normal' | 'bold' = 'normal',
  family: TicketFont = 'courier',
) {
  doc.setFont(family, style)
  doc.setFontSize(size)
  doc.setTextColor(0)
}

export function center(
  doc: TicketDoc,
  text: string,
  y: number,
  size: number,
  style: 'normal' | 'bold' = 'normal',
  family: TicketFont = 'helvetica',
) {
  setTicketFont(doc, size, style, family)
  doc.text(text, TICKET.width / 2, y, { align: 'center' })
  return y + size * MM_PER_PT * 1.35
}

export function left(
  doc: TicketDoc,
  text: string,
  y: number,
  size: number,
  style: 'normal' | 'bold' = 'normal',
  family: TicketFont = 'courier',
) {
  setTicketFont(doc, size, style, family)
  doc.text(text, TICKET.margin, y)
  return y + size * MM_PER_PT * 1.35
}

export function right(
  doc: TicketDoc,
  text: string,
  y: number,
  size: number,
  style: 'normal' | 'bold' = 'normal',
  family: TicketFont = 'courier',
) {
  setTicketFont(doc, size, style, family)
  doc.text(text, TICKET.width - TICKET.margin, y, { align: 'right' })
  return y + size * MM_PER_PT * 1.35
}

/** Línea divisoria punteada, sin grises. */
export function divider(doc: TicketDoc, y: number) {
  doc.setDrawColor(0)
  doc.setLineWidth(0.2)
  doc.setLineDashPattern([0.8, 0.8], 0)
  doc.line(TICKET.margin, y, TICKET.width - TICKET.margin, y)
  doc.setLineDashPattern([], 0)
  return y + 2.6
}

/** Párrafo con salto de línea automático a 72 mm. */
export function paragraph(
  doc: TicketDoc,
  text: string,
  y: number,
  size = 8,
  width = TICKET.content,
  family: TicketFont = 'courier',
) {
  setTicketFont(doc, size, 'normal', family)
  const lines = doc.splitTextToSize(text || '—', width)
  doc.text(lines, TICKET.margin, y)
  return y + Math.max(1, lines.length) * size * MM_PER_PT * 1.25
}

/** Fila etiqueta / valor en dos columnas. */
export function row(doc: TicketDoc, label: string, value: string, y: number, size = 8) {
  const labelText = `${label}:`
  setTicketFont(doc, size, 'bold')
  doc.text(labelText, TICKET.margin, y)
  const x = TICKET.margin + Math.max(16, labelText.length * size * MM_PER_PT * 0.6 + 1)
  const maxWidth = TICKET.width - TICKET.margin - x
  setTicketFont(doc, size, 'normal')
  const lines = doc.splitTextToSize(value || '—', maxWidth)
  doc.text(lines, x, y)
  return y + Math.max(1, lines.length) * size * MM_PER_PT * 1.25
}

/** Total grande con etiqueta a la izquierda y valor a la derecha. */
export function totalLine(doc: TicketDoc, label: string, value: string, y: number, size = 10) {
  setTicketFont(doc, size, 'bold')
  doc.text(label, TICKET.margin, y)
  doc.text(value, TICKET.width - TICKET.margin, y, { align: 'right' })
  return y + size * MM_PER_PT * 1.4
}

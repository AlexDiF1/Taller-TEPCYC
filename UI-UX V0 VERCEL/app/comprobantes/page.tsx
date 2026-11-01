import type { Metadata } from 'next'
import { ReceiptsView } from '@/components/receipts/receipts-view'
import type { ReceiptType } from '@/components/receipts/receipt-document'

export const metadata: Metadata = {
  title: 'Comprobantes · TODOENPCYCONSOLAS2',
}

export default async function ComprobantesPage({
  searchParams,
}: {
  searchParams: Promise<{ orden?: string; tipo?: string }>
}) {
  const { orden, tipo } = await searchParams
  const type: ReceiptType = tipo === 'entrega' ? 'entrega' : 'recepcion'
  return <ReceiptsView key={`${orden}-${type}`} initialOrderId={orden} initialType={type} />
}

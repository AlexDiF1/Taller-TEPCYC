import { VentasDashboard } from '@/components/ventas/ventas-dashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ventas POS · TODOENPCYCONSOLAS',
}

export default function VentasPage() {
  return <VentasDashboard />
}

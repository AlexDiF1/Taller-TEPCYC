import { CajaDashboard } from '@/components/caja/caja-dashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Caja del día · TEPCYC',
}

export default function CajaPage() {
  return <CajaDashboard />
}

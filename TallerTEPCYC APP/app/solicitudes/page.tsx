import type { Metadata } from 'next'
import { SolicitudesDashboard } from '@/components/solicitudes/solicitudes-dashboard'

export const metadata: Metadata = {
  title: 'Solicitudes de la web · TEPCYC',
}

export default function SolicitudesPage() {
  return <SolicitudesDashboard />
}

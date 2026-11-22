import { WhatsappDashboard } from '@/components/whatsapp/whatsapp-dashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'WhatsApp · TEPCYC',
}

export default function WhatsappPage() {
  return <WhatsappDashboard />
}

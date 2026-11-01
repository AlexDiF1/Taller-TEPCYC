'use client'

import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildStatusMessage, buildWhatsAppUrl } from '@/lib/whatsapp'
import type { Order } from '@/lib/types'
import { cn } from '@/lib/utils'

export function WhatsAppButton({
  order,
  className,
  label = 'Notificar',
}: {
  order: Order
  className?: string
  label?: string
}) {
  const href = buildWhatsAppUrl(order.customer.phone, buildStatusMessage(order))
  return (
    <Button
      nativeButton={false}
      render={<a href={href} target="_blank" rel="noopener noreferrer" />}
      className={cn('h-9 bg-whatsapp font-semibold text-black hover:bg-whatsapp/85', className)}
      aria-label={`Enviar estado por WhatsApp a ${order.customer.name}`}
    >
      <MessageCircle data-icon="inline-start" />
      {label}
    </Button>
  )
}

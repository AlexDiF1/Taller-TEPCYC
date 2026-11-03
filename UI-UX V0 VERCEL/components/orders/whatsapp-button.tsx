'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { MessageCircle, Loader2, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildStatusMessage, buildWhatsAppUrl } from '@/lib/whatsapp'
import { WaOfflineError, waSendOrder } from '@/lib/wa'
import type { Order } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * Botón "Notificar": si el WhatsApp del taller está vinculado, el mensaje sale
 * solo desde el servidor. Si no hay sesión (o el envío falla), se abre el enlace
 * de wa.me como respaldo para no dejar al cliente sin aviso.
 */
export function WhatsAppButton({
  order,
  className,
  label = 'Notificar',
  includePhotos = false,
}: {
  order: Order
  className?: string
  label?: string
  includePhotos?: boolean
}) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const message = buildStatusMessage(order)
  const fallbackHref = buildWhatsAppUrl(order.customer.phone, message)
  const firstName = order.customer.name.trim().split(/\s+/)[0] || 'el cliente'

  function openFallback() {
    window.open(fallbackHref, '_blank', 'noopener,noreferrer')
  }

  async function send() {
    setSending(true)
    try {
      const result = await waSendOrder({
        orderId: order.id,
        phone: order.customer.phone,
        message,
        includePhotos,
      })
      setSent(true)
      toast.success(`Mensaje enviado por WhatsApp a ${firstName}`, {
        description:
          result.photos > 0
            ? `${order.id} · con ${result.photos} foto${result.photos === 1 ? '' : 's'} del equipo`
            : `${order.id} · ${order.status}`,
      })
      setTimeout(() => setSent(false), 6000)
    } catch (error) {
      if (error instanceof WaOfflineError) {
        toast.info('WhatsApp no está conectado: se abre wa.me como respaldo.')
        openFallback()
      } else {
        toast.error(error instanceof Error ? error.message : 'No se pudo enviar el mensaje.', {
          action: { label: 'Abrir wa.me', onClick: openFallback },
        })
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <Button
      type="button"
      onClick={send}
      disabled={sending}
      className={cn(
        'h-9 bg-whatsapp font-semibold text-black hover:bg-whatsapp/85',
        sent && 'bg-status-done hover:bg-status-done/85',
        className,
      )}
      aria-label={`Enviar estado por WhatsApp a ${order.customer.name}`}
      title={
        sent
          ? 'Mensaje enviado'
          : `Envía el mensaje del estado ${order.status} por WhatsApp${includePhotos ? ' con las fotos del equipo' : ''}`
      }
    >
      {sending ? (
        <Loader2 data-icon="inline-start" className="animate-spin" />
      ) : sent ? (
        <CheckCheck data-icon="inline-start" />
      ) : (
        <MessageCircle data-icon="inline-start" />
      )}
      {sending ? 'Enviando…' : sent ? 'Enviado' : label}
    </Button>
  )
}

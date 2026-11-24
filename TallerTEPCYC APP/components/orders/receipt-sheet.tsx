'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ClipboardList, Download, Loader2, Printer, Send, ShieldCheck } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ReceiptDocument, type ReceiptType } from '@/components/receipts/receipt-document'
import { downloadReceiptPdf, prepareReceiptDelivery, type ReceiptDelivery } from '@/lib/receipt-pdf'
import { sendReceipt } from '@/lib/notify'
import type { Order } from '@/lib/types'
import { cn } from '@/lib/utils'

const TYPES: { value: ReceiptType; label: string; icon: typeof ClipboardList }[] = [
  { value: 'recepcion', label: 'Recepción', icon: ClipboardList },
  { value: 'entrega', label: 'Entrega', icon: ShieldCheck },
]

/** Único lugar para el recibo de una orden: ver, enviar por WhatsApp, imprimir o descargar. */
export function ReceiptSheet({
  order,
  open,
  initialType,
  onClose,
}: {
  order: Order
  open: boolean
  initialType: ReceiptType
  onClose: () => void
}) {
  const [type, setType] = useState<ReceiptType>(initialType)
  const [delivery, setDelivery] = useState<ReceiptDelivery | null>(null)
  const [failed, setFailed] = useState(false)
  const [sending, setSending] = useState(false)
  const itemsKey = JSON.stringify(order.items)

  useEffect(() => {
    if (open) setType(initialType)
  }, [open, initialType])

  // El PDF se prepara al abrir: así enviar o descargar es inmediato.
  useEffect(() => {
    if (!open) return
    let alive = true
    setDelivery(null)
    setFailed(false)
    prepareReceiptDelivery(order, type, order.items, 'pretty')
      .then((d) => alive && setDelivery(d))
      .catch(() => {
        if (!alive) return
        setFailed(true)
        toast.error('No se pudo generar el PDF del recibo.')
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order.id, type, itemsKey, order.estimatedCost, order.deposit])

  async function send() {
    if (!delivery || sending) return
    setSending(true)
    try {
      await sendReceipt(order, type, delivery)
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 pb-0 sm:max-w-lg sm:pb-0">
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted sm:hidden" aria-hidden="true" />
        <header className="shrink-0 px-5 pt-4 pr-14 pb-3">
          <DialogTitle>Recibo · {order.id}</DialogTitle>
          <DialogDescription>Elige el documento y envíalo, imprímelo o descárgalo.</DialogDescription>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1" role="radiogroup" aria-label="Documento">
            {TYPES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={type === value}
                onClick={() => setType(value)}
                className={cn(
                  'flex h-10 items-center justify-center gap-2 rounded-xl text-[13.5px] font-bold transition-colors',
                  type === value ? 'bg-surface shadow-sm dark:bg-accent' : 'text-muted-foreground',
                )}
              >
                <Icon className={cn('size-4', type === value && 'text-primary')} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain bg-surface-2 p-3">
          <div className="flex justify-center">
            <ReceiptDocument order={order} type={type} items={order.items} />
          </div>
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-border bg-popover px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
          <Button
            size="lg"
            className="w-full bg-whatsapp text-white hover:bg-whatsapp/90 dark:text-black"
            onClick={send}
            disabled={!delivery || sending}
          >
            {!delivery || sending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Send data-icon="inline-start" />}
            {failed ? 'No se pudo preparar el PDF' : sending ? 'Enviando…' : !delivery ? 'Preparando PDF…' : 'Enviar por WhatsApp'}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" onClick={() => window.print()}>
              <Printer data-icon="inline-start" />
              Imprimir
            </Button>
            <Button variant="outline" size="lg" onClick={() => delivery && downloadReceiptPdf(delivery)} disabled={!delivery}>
              <Download data-icon="inline-start" />
              Descargar
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Images } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/business'
import type { IntakePhoto } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * Visor de fotos de una orden: imagen grande, flechas, contador y tira de
 * miniaturas. Se abre al tocar la miniatura de la fila.
 */
export function PhotoViewer({
  photos,
  open,
  startIndex = 0,
  label,
  onClose,
}: {
  photos: IntakePhoto[]
  open: boolean
  startIndex?: number
  /** Código de la orden, para el encabezado. */
  label?: string
  onClose: () => void
}) {
  const [index, setIndex] = useState(startIndex)
  const total = photos.length

  useEffect(() => {
    if (open) setIndex(Math.min(Math.max(startIndex, 0), Math.max(total - 1, 0)))
  }, [open, startIndex, total])

  const go = useCallback(
    (delta: number) => {
      if (total < 2) return
      setIndex((i) => (i + delta + total) % total)
    },
    [total],
  )

  const current = photos[index]

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={total <= 1}
        className="max-w-[min(96vw,56rem)] gap-3 overflow-hidden border border-white/10 bg-black/80 p-3 shadow-2xl backdrop-blur-2xl sm:max-w-[min(96vw,56rem)]"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') go(1)
          if (e.key === 'ArrowLeft') go(-1)
        }}
        aria-label={label ? `Fotos de la orden ${label}` : 'Fotos de la orden'}
      >
        <DialogTitle className="sr-only">
          {label ? `Fotos de la orden ${label}` : 'Fotos de la orden'}
        </DialogTitle>

        <div className="flex items-center justify-between px-1">
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            {label ?? 'Fotos'} {total > 1 && `· ${index + 1}/${total}`}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            aria-label="Cerrar visor"
          >
            <span aria-hidden="true" className="block text-lg leading-none">
              ×
            </span>
          </button>
        </div>

        <div className="relative flex items-center justify-center rounded-xl bg-black/40">
          {current ? (
            <img
              key={current.id}
              src={current.url}
              alt={`Foto ${index + 1} de ${total}`}
              className="max-h-[72dvh] w-auto max-w-full rounded-lg object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <Images className="size-8" aria-hidden="true" />
              <p className="text-sm">Esta orden no tiene fotos.</p>
            </div>
          )}

          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                className="absolute left-2 grid size-9 place-items-center rounded-full bg-black/50 text-foreground ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-black/70"
                aria-label="Foto anterior"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="absolute right-2 grid size-9 place-items-center rounded-full bg-black/50 text-foreground ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-black/70"
                aria-label="Foto siguiente"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}
        </div>

        {total > 1 && (
          <div className="flex gap-2 overflow-x-auto px-1 pb-1">
            {photos.map((photo, i) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ver foto ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  'size-14 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10 transition-all',
                  i === index ? 'ring-2 ring-primary' : 'opacity-60 hover:opacity-100',
                )}
              >
                <img src={photo.url} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {current && (
          <p className="px-1 font-mono text-[10px] text-muted-foreground/80">
            {formatDate(current.takenAt, true)}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

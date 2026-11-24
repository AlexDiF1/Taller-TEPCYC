'use client'

import Link from 'next/link'
import { ChevronRight, Inbox } from 'lucide-react'
import { useSolicitudes } from '@/hooks/use-solicitudes'
import { cn } from '@/lib/utils'

/**
 * Entrada a la bandeja desde la lista de órdenes. En el celular es la única entrada
 * (la barra de abajo no tiene espacio); en escritorio solo aparece si hay nuevas.
 */
export function SolicitudesAviso() {
  const { nuevas, isLoading } = useSolicitudes()
  if (isLoading) return null
  const hay = nuevas > 0

  return (
    <Link
      href="/solicitudes"
      className={cn(
        'flex min-h-12 items-center gap-3 rounded-2xl border px-3.5 py-2.5 transition-colors',
        hay
          ? 'border-primary/40 bg-primary/8 hover:bg-primary/12'
          : 'border-border bg-surface text-muted-foreground hover:text-foreground lg:hidden',
      )}
    >
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', hay ? 'bg-primary text-primary-foreground' : 'bg-surface-2')}>
        <Inbox className="size-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-[14.5px] leading-tight">
        {hay ? (
          <>
            <b className="font-bold text-foreground">
              {nuevas} solicitud{nuevas === 1 ? '' : 'es'} nueva{nuevas === 1 ? '' : 's'}
            </b>
            <span className="block text-[13px] text-muted-foreground">Desde el formulario de la web</span>
          </>
        ) : (
          <span className="font-semibold">Solicitudes de la web</span>
        )}
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}

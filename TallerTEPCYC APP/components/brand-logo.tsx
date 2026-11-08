import Link from 'next/link'
import { Gamepad2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BrandLogo({
  className,
  compact = false,
  href,
}: {
  className?: string
  compact?: boolean
  /** Si se indica, el logo funciona como enlace (p. ej. volver a Órdenes). */
  href?: string
}) {
  const logo = (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="relative grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[0_0_24px_-4px] shadow-primary/60">
        <Gamepad2 className="size-5" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight">
            TODOENPC<span className="text-primary">Y</span>CONSOLAS
          </span>
          <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Service Lab
          </span>
        </span>
      )}
    </div>
  )

  if (!href) return logo

  return (
    <Link
      href={href}
      aria-label="Ir a las órdenes de trabajo"
      className="inline-flex rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {logo}
    </Link>
  )
}

import Link from 'next/link'
import { cn } from '@/lib/utils'

/** Marca TEPCYC: control de consola blanco sobre el rojo de la marca. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('size-9 shrink-0', className)}>
      <rect width="64" height="64" rx="16" fill="#e3252f" />
      <path
        d="M20 19H44C51 19 54.5 23 56 30L58.5 42C59.5 47 55 50.5 51 47.5L45 41.5H19L13 47.5C9 50.5 4.5 47 5.5 42L8 30C9.5 23 13 19 20 19Z"
        fill="#fff"
      />
      <path d="M18 24.5h4v3.5h3.5v4H22v3.5h-4V32h-3.5v-4H18z" fill="#e3252f" />
      <circle cx="47.5" cy="27.5" r="2.7" fill="#e3252f" />
      <circle cx="42.5" cy="33" r="2.7" fill="#e3252f" />
    </svg>
  )
}

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
      <BrandMark />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-extrabold tracking-tight">
            TEPCYC <span className="font-medium text-muted-foreground">Taller</span>
          </span>
          <span className="mt-1 text-[11px] font-medium text-muted-foreground">TodoenPC y Consolas</span>
        </span>
      )}
    </div>
  )

  if (!href) return logo

  return (
    <Link
      href={href}
      aria-label="Ir a las órdenes de trabajo"
      className="inline-flex rounded-xl outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {logo}
    </Link>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Plus, ReceiptText, ShoppingCart, MapPin, Phone } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { BUSINESS } from '@/lib/business'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/', label: 'Órdenes', icon: LayoutGrid },
  { href: '/ingreso', label: 'Nuevo ingreso', icon: Plus },
  { href: '/comprobantes', label: 'Comprobantes', icon: ReceiptText },
  { href: '/ventas', label: 'Ventas', icon: ShoppingCart },
]

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar p-5 print:hidden lg:flex">
        <BrandLogo />
        <nav aria-label="Principal" className="mt-10 flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground',
                  active && 'bg-sidebar-accent text-foreground',
                )}
              >
                <Icon
                  className={cn('size-4.5 transition-colors', active ? 'text-primary' : 'group-hover:text-foreground')}
                  aria-hidden="true"
                />
                {label}
                {active && <span className="ml-auto size-1.5 rounded-full bg-primary" aria-hidden="true" />}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto rounded-xl border border-sidebar-border bg-background/60 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Taller</p>
          <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {BUSINESS.address}, {BUSINESS.city}
          </p>
          <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="size-3.5 shrink-0" aria-hidden="true" />
            {BUSINESS.phone}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur-lg print:hidden lg:hidden">
          <BrandLogo />
        </header>

        <main className="bg-grid min-h-dvh flex-1 pb-28 print:bg-none print:pb-0 lg:pb-0">{children}</main>
      </div>

      <nav
        aria-label="Navegación móvil"
        className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-2xl border border-border bg-popover/90 px-2 py-2 shadow-2xl shadow-black/40 backdrop-blur-xl print:hidden lg:hidden"
      >
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          const isPrimary = href === '/ingreso'
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-w-16 flex-col items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors',
                active && 'text-foreground',
              )}
            >
              <span
                className={cn(
                  'grid place-items-center rounded-lg transition-all',
                  isPrimary
                    ? 'size-10 -mt-6 bg-primary text-primary-foreground shadow-[0_0_24px_-4px] shadow-primary/70'
                    : 'size-7',
                  active && !isPrimary && 'text-primary',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              {isPrimary ? 'Ingreso' : label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

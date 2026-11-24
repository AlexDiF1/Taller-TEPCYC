'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Plus, Search, ShoppingBag, MessageCircle, MapPin, Phone, Wallet } from 'lucide-react'
import { BrandLogo, BrandMark } from '@/components/brand-logo'
import { LogoutButton } from '@/components/auth/logout-button'
import { BUSINESS } from '@/lib/business'
import { cn } from '@/lib/utils'

type NavItem = { href: string; label: string; short: string; icon: typeof ClipboardList }

const ORDENES: NavItem = { href: '/', label: 'Órdenes de trabajo', short: 'Órdenes', icon: ClipboardList }
const INGRESO: NavItem = { href: '/ingreso', label: 'Nuevo ingreso', short: 'Ingreso', icon: Plus }
const VENTAS: NavItem = { href: '/ventas', label: 'Ventas', short: 'Ventas', icon: ShoppingBag }
const CAJA: NavItem = { href: '/caja', label: 'Caja del día', short: 'Caja', icon: Wallet }
const BUSCAR: NavItem = { href: '/?buscar=1', label: 'Buscar orden', short: 'Buscar', icon: Search }
const WHATSAPP: NavItem = { href: '/whatsapp', label: 'WhatsApp', short: 'WhatsApp', icon: MessageCircle }

const SIDEBAR: { title: string; items: NavItem[] }[] = [
  { title: 'Taller', items: [ORDENES] },
  { title: 'Negocio', items: [VENTAS, CAJA, WHATSAPP] },
]

function isActive(pathname: string, href: string) {
  // La ficha de una orden cuenta como «Órdenes»; «Buscar» es un atajo y no se marca.
  if (href.includes('?')) return false
  return href === '/' ? pathname === '/' || pathname.startsWith('/orden/') : pathname.startsWith(href)
}

function sectionName(pathname: string) {
  if (pathname.startsWith('/orden/')) return 'Orden'
  const all = [ORDENES, INGRESO, VENTAS, CAJA, WHATSAPP]
  return all.find((i) => isActive(pathname, i.href))?.short ?? ''
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // La pantalla de acceso va sin barras.
  if (pathname === '/login') return <>{children}</>

  return (
    <div className="relative min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
      {/* ---------- escritorio: barra lateral ---------- */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar p-4 print:hidden lg:flex">
        <BrandLogo href="/" className="px-1" />

        <Link
          href={INGRESO.href}
          className={cn(
            'mt-6 flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-bold text-primary-foreground shadow-[0_8px_20px_-8px] shadow-primary/60 transition-transform active:scale-[0.98]',
            isActive(pathname, INGRESO.href) && 'ring-2 ring-primary/30 ring-offset-2 ring-offset-sidebar',
          )}
        >
          <Plus className="size-5" strokeWidth={2.6} aria-hidden="true" />
          Nuevo ingreso
        </Link>

        <nav aria-label="Principal" className="mt-6 flex flex-col gap-5">
          {SIDEBAR.map((section) => (
            <div key={section.title} className="flex flex-col gap-0.5">
              <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {section.title}
              </p>
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(pathname, href)
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-11 items-center gap-3 rounded-xl px-3 text-[14.5px] font-semibold text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground',
                      active && 'bg-primary/10 text-primary hover:bg-primary/12 hover:text-primary',
                    )}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                    {label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl bg-sidebar-accent p-4">
          <p className="text-[13px] font-bold">{BUSINESS.name}</p>
          <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {BUSINESS.address}, {BUSINESS.city}
          </p>
          <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="size-3.5 shrink-0" aria-hidden="true" />
            {BUSINESS.phone}
          </p>
          <LogoutButton />
        </div>
      </aside>

      {/* ---------- contenido ---------- */}
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/70 bg-background/92 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md print:hidden lg:hidden">
          <Link href="/" aria-label="Ir a las órdenes" className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <BrandMark className="size-8" />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col leading-none">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">TEPCYC Taller</span>
            <span className="mt-1 truncate text-[17px] font-extrabold tracking-tight">{sectionName(pathname)}</span>
          </div>
          <LogoutButton compact />
        </header>

        <main className="min-h-dvh flex-1 pb-[calc(84px+env(safe-area-inset-bottom))] print:pb-0 lg:pb-0">{children}</main>
      </div>

      {/* ---------- móvil: barra inferior ---------- */}
      <nav
        aria-label="Navegación"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-safe backdrop-blur-md print:hidden lg:hidden"
      >
        <div className="mx-auto grid h-[66px] max-w-lg grid-cols-5 items-center px-1">
          <TabLink item={ORDENES} pathname={pathname} />
          <TabLink item={BUSCAR} pathname={pathname} />
          <Link
            href={INGRESO.href}
            aria-label="Nuevo ingreso"
            aria-current={isActive(pathname, INGRESO.href) ? 'page' : undefined}
            className="flex flex-col items-center gap-1 text-[11px] font-bold text-foreground"
          >
            <span className="-mt-7 grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_24px_-8px] shadow-primary/70 ring-4 ring-background transition-transform active:scale-95">
              <Plus className="size-7" strokeWidth={2.6} aria-hidden="true" />
            </span>
            Ingreso
          </Link>
          <TabLink item={VENTAS} pathname={pathname} />
          <TabLink item={WHATSAPP} pathname={pathname} />
        </div>
      </nav>
    </div>
  )
}

function TabLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href)
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-col items-center gap-1 text-[11px] font-semibold text-muted-foreground transition-colors',
        active && 'text-foreground',
      )}
    >
      <span
        className={cn(
          'grid h-8 w-14 place-items-center rounded-full transition-colors',
          active && 'bg-primary/12 text-primary',
        )}
      >
        <Icon className="size-[22px]" strokeWidth={active ? 2.3 : 1.9} aria-hidden="true" />
      </span>
      {item.short}
    </Link>
  )
}

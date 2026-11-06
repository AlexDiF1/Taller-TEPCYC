'use client'

import Link from 'next/link'
import { LayoutGrid, Plus, ReceiptText } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { cn } from '@/lib/utils'

const TALLER_TABS = [
  { id: 'ordenes', label: 'Órdenes de trabajo', href: '/', icon: LayoutGrid },
  { id: 'ingreso', label: 'Nuevo ingreso', href: '/ingreso', icon: Plus },
  { id: 'comprobantes', label: 'Comprobantes y facturas', href: '/comprobantes', icon: ReceiptText },
]

export function TallerHeader({
  activeTab,
  actions,
}: {
  activeTab: 'ordenes' | 'ingreso' | 'comprobantes'
  actions?: React.ReactNode
}) {
  return (
    <PageHeader
      eyebrow="Servicio Técnico"
      title="Taller de Reparación"
      description="Gestión integral de servicio técnico: registro de órdenes con fotografías de estado físico, seguimiento por estado y facturación."
      actions={actions}
    >
      <nav
        aria-label="Pestañas de Taller"
        className="mt-2 flex items-center gap-1.5 overflow-x-auto rounded-xl border border-border bg-card/60 p-1 backdrop-blur-sm"
      >
        {TALLER_TABS.map((tab) => {
          const active = activeTab === tab.id
          const Icon = tab.icon
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                'inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-all md:text-sm',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </PageHeader>
  )
}

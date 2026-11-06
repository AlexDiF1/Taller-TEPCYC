'use client'

import { useEffect, useMemo, useState } from 'react'
import { ShoppingCart, History, BarChart3 } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { SaleForm } from './sale-form'
import { SalesHistory } from './sales-history'
import { SaleEditDialog } from './sale-edit-dialog'
import { useVentas } from '@/hooks/use-ventas'
import type { PaymentMethod, Venta, VentaFilters } from '@/lib/ventas'
import { cn } from '@/lib/utils'

type Tab = 'nueva' | 'historial'

export function VentasDashboard() {
  const [tab, setTab] = useState<Tab>('nueva')
  const [editing, setEditing] = useState<Venta | null>(null)
  const [filters, setFilters] = useState<VentaFilters>({ q: '', method: '', from: '', to: '' })
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery((filters.q ?? '').trim()), 350)
    return () => clearTimeout(timer)
  }, [filters.q])

  const queryFilters = useMemo<VentaFilters>(
    () => ({ ...filters, q: debouncedQuery }),
    [filters, debouncedQuery],
  )

  const { ventas, summary, isLoading, error, deleteVenta, updateVenta, refresh } = useVentas(queryFilters)

  useEffect(() => {
    if (tab === 'historial') void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  async function handleDelete(venta: Venta) {
    await deleteVenta(venta.dbId)
  }

  function changeFilters(next: VentaFilters) {
    setFilters({
      q: next.q ?? '',
      method: next.method ?? '',
      from: next.from ?? '',
      to: next.to ?? '',
    })
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        eyebrow="Punto de Venta"
        title="Ventas y Caja POS"
        description="Registra ventas con carrito multiobjeto, métodos de pago, cálculo de utilidad neta e historial de transacciones."
      />

      <div
        className="inline-flex w-fit items-center gap-1 rounded-xl border border-border bg-muted/40 p-1"
        role="tablist"
        aria-label="Secciones de ventas"
      >
        <TabButton active={tab === 'nueva'} onClick={() => setTab('nueva')} icon={ShoppingCart} label="Nueva venta" />
        <TabButton active={tab === 'historial'} onClick={() => setTab('historial')} icon={History} label="Historial" />
      </div>

      {tab === 'nueva' ? (
        <SaleForm onCreated={() => void refresh()} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BarChart3 className="size-4 text-primary" aria-hidden="true" />
            Resumen e historial de ventas registradas
          </div>
          <SalesHistory
            ventas={ventas}
            summary={summary}
            isLoading={isLoading}
            error={error}
            filters={filters}
            onFiltersChange={changeFilters}
            onDelete={handleDelete}
            onEdit={setEditing}
          />
          <SaleEditDialog
            venta={editing}
            onClose={() => setEditing(null)}
            onSave={updateVenta}
          />
        </div>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: 'true' }>
  label: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
        active
          ? 'bg-card text-foreground shadow-sm ring-1 ring-foreground/10'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className={cn('size-4', active && 'text-primary')} aria-hidden="true" />
      {label}
    </button>
  )
}

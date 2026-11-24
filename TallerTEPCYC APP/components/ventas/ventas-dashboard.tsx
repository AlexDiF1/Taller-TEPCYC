'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ShoppingCart, History, BarChart3, ChevronRight, Package, Wallet } from 'lucide-react'
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
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-4 md:px-8 md:py-8">
      <div className="hidden lg:block">
        <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-primary">Negocio</p>
        <h1 className="mt-1 text-[32px] font-extrabold tracking-tight">Ventas</h1>
      </div>
      {/* En el celular Caja y Catálogo no caben en la barra inferior: se llega desde aquí. */}
      <div className="grid grid-cols-2 gap-2 lg:hidden">
        <Link
          href="/caja"
          className="flex min-h-14 items-center gap-2.5 rounded-2xl border border-border bg-surface px-3 py-2.5 transition-colors hover:border-foreground/25"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-status-done/12 text-status-done">
            <Wallet className="size-[18px]" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold">Caja</span>
            <span className="block truncate text-[12px] text-muted-foreground">Lo que entró</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
        <Link
          href="/catalogo"
          className="flex min-h-14 items-center gap-2.5 rounded-2xl border border-border bg-surface px-3 py-2.5 transition-colors hover:border-foreground/25"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-status-pending/12 text-status-pending">
            <Package className="size-[18px]" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold">Catálogo</span>
            <span className="block truncate text-[12px] text-muted-foreground">Productos</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      </div>
      <div
        className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1 sm:inline-grid sm:w-fit"
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
        'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-[14.5px] font-bold transition-colors',
        active ? 'bg-surface text-foreground shadow-sm dark:bg-accent' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className={cn('size-[18px]', active && 'text-primary')} aria-hidden="true" />
      {label}
    </button>
  )
}

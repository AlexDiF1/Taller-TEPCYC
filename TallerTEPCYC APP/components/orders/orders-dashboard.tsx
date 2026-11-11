'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Search, Plus, Inbox, Layers, LayoutGrid, TriangleAlert } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { OrderCard } from './order-card'
import { OrderDetailDialog } from './order-detail-dialog'
import { OrderEditDialog } from './order-edit-dialog'
import { useOrders } from '@/hooks/use-orders'
import { STATUSES, STATUS_MAP, isClosed } from '@/lib/status'
import { openWhatsApp } from '@/lib/whatsapp'
import type { Order, OrderStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

type Filter = 'todas' | 'activas' | OrderStatus

export function OrdersDashboard() {
  const { orders, isLoading, error, setStatus, updateOrder, deleteOrder } = useOrders()
  const [filter, setFilter] = useState<Filter>('activas')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUSES.map((s) => [s.value, 0])) as Record<OrderStatus, number>
    orders.forEach((o) => (c[o.status] += 1))
    return c
  }, [orders])
  const activeCount = orders.filter((o) => !isClosed(o.status)).length

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return orders.filter((o) => {
      const matchesFilter =
        filter === 'todas' ? true : filter === 'activas' ? !isClosed(o.status) : o.status === filter
      if (!matchesFilter) return false
      if (!q) return true
      return [o.id, o.customer.name, o.customer.phone, o.device.brand, o.device.model, o.device.serial ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [orders, filter, query])

  const selected = orders.find((o) => o.id === selectedId) ?? null
  const editing = orders.find((o) => o.id === editingId) ?? null

  function startEditing(order: Order) {
    setSelectedId(null)
    setEditingId(order.id)
  }

  async function handleDelete(order: Order) {
    await deleteOrder(order.id)
    setSelectedId(null)
    setEditingId(null)
  }

  async function handleStatusChange(order: Order, status: OrderStatus) {
    const promise = setStatus(order.id, status)
    toast.promise(promise, {
      loading: 'Actualizando estado...',
      success: (updated) => ({
        message: `${updated.id} → ${STATUS_MAP[status]?.label ?? status}`,
        description: `¿Avisar a ${updated.customer.name.split(' ')[0]}?`,
        action: { label: 'Enviar WhatsApp', onClick: () => openWhatsApp(updated) },
        duration: 8000,
      }),
      error: 'No se pudo actualizar el estado.',
    })
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      {/* Barra superior unificada: Buscador, Píldoras de Filtro y Botón Nuevo Ingreso */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/70 p-3.5 backdrop-blur-md lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-[280px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="order-search" className="sr-only">
            Buscar órdenes
          </label>
          <Input
            id="order-search"
            type="search"
            placeholder="Buscar por orden, cliente, teléfono, modelo o serial..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 rounded-xl bg-background/60 pl-10 text-sm border-border/80 transition-all duration-200 focus-visible:bg-background"
          />
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0" role="group" aria-label="Filtrar por estado">
            <FilterTile
              active={filter === 'todas'}
              onClick={() => setFilter('todas')}
              label="Todas"
              count={orders.length}
              icon={LayoutGrid}
              accent="text-primary"
              dot="bg-primary"
            />
            <FilterTile
              active={filter === 'activas'}
              onClick={() => setFilter('activas')}
              label="Activas"
              count={activeCount}
              icon={Layers}
              accent="text-foreground"
              dot="bg-foreground"
            />
            {STATUSES.map((s) => (
              <FilterTile
                key={s.value}
                active={filter === s.value}
                onClick={() => setFilter(s.value)}
                label={s.short}
                count={counts[s.value]}
                icon={s.icon}
                accent={s.text}
                dot={s.dot}
              />
            ))}
          </div>

          <Button
            size="sm"
            aria-label="Nuevo ingreso"
            className="h-9 shrink-0 gap-1.5 rounded-xl px-3 font-semibold shadow-sm transition-all duration-200 hover:shadow-primary/20"
            nativeButton={false}
            render={<Link href="/ingreso" />}
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">+ Nuevo ingreso</span>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-6 py-12 text-center">
          <TriangleAlert className="size-9 text-destructive" aria-hidden="true" />
          <p className="font-semibold">No se pudo leer Firestore</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {error instanceof Error ? error.message : String(error)}
          </p>
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl border border-border bg-card/40" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/30 px-6 py-16 text-center">
          <Inbox className="size-10 text-muted-foreground" aria-hidden="true" />
          <p className="font-semibold">No hay órdenes aquí</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {query ? 'Prueba con otro término de búsqueda.' : 'Cuando un equipo pase a este estado aparecerá en esta lista.'}
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((order) => (
            <li key={order.id} className="h-full">
              <OrderCard order={order} onStatusChange={handleStatusChange} onOpen={(o) => setSelectedId(o.id)} />
            </li>
          ))}
        </ul>
      )}

      <OrderDetailDialog
        order={selected}
        onClose={() => setSelectedId(null)}
        onEdit={startEditing}
        onDelete={handleDelete}
      />
      <OrderEditDialog order={editing} onClose={() => setEditingId(null)} onSave={updateOrder} />
    </div>
  )
}

function FilterTile({
  active,
  onClick,
  label,
  count,
  icon: Icon,
  accent,
  dot,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  icon: React.ComponentType<{ className?: string }>
  accent: string
  dot: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs transition-all duration-200',
        active
          ? 'border-foreground/30 bg-secondary text-foreground shadow-sm'
          : 'border-border/60 bg-background/40 text-muted-foreground hover:border-foreground/20 hover:bg-secondary/50 hover:text-foreground',
      )}
    >
      {active && <span className={cn('absolute inset-x-0 -top-px h-0.5 rounded-t-lg', dot)} aria-hidden="true" />}
      <Icon className={cn('size-3.5', accent)} />
      <span className="font-medium">{label}</span>
      <span className="font-mono font-bold tabular-nums opacity-90">{count}</span>
    </button>
  )
}

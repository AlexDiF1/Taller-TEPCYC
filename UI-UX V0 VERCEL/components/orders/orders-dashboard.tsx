'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Search, Plus, Inbox, Layers, TriangleAlert } from 'lucide-react'
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

type Filter = 'activas' | OrderStatus

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
      const matchesFilter = filter === 'activas' ? !isClosed(o.status) : o.status === filter
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
        message: `${updated.id} → ${STATUS_MAP[status].label}`,
        description: `¿Avisar a ${updated.customer.name.split(' ')[0]}?`,
        action: { label: 'Enviar WhatsApp', onClick: () => openWhatsApp(updated) },
        duration: 8000,
      }),
      error: 'No se pudo actualizar el estado.',
    })
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="flex min-w-max items-center gap-2" role="group" aria-label="Filtrar por estado">
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
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
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
          className="h-12 rounded-xl bg-card/80 pl-10 text-base backdrop-blur-sm"
        />
        </div>
        <Button
          size="icon"
          aria-label="Nuevo ingreso"
          className="size-12 shrink-0 rounded-xl"
          nativeButton={false}
          render={<Link href="/ingreso" />}
        >
          <Plus />
        </Button>
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
            <div key={i} className="h-80 animate-pulse rounded-2xl border border-border bg-card/60" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
          <Inbox className="size-10 text-muted-foreground" aria-hidden="true" />
          <p className="font-semibold">No hay órdenes aquí</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {query ? 'Prueba con otro término de búsqueda.' : 'Cuando un equipo pase a este estado aparecerá en esta lista.'}
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((order) => (
            <li key={order.id}>
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
        'relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 transition-all',
        active ? 'border-foreground/30 bg-card' : 'border-border bg-card/50 hover:bg-card',
      )}
    >
      {active && <span className={cn('absolute inset-x-0 top-0 h-0.5', dot)} aria-hidden="true" />}
      <Icon className={cn('size-4', accent)} />
      <span className={cn('text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
      <span className="font-mono text-base font-bold tabular-nums">{count}</span>
    </button>
  )
}

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Search, Plus, Inbox, Layers, TriangleAlert } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { OrderCard } from './order-card'
import { OrderDetailDialog } from './order-detail-dialog'
import { useOrders } from '@/hooks/use-orders'
import { STATUSES, STATUS_MAP, isClosed } from '@/lib/status'
import { openWhatsApp } from '@/lib/whatsapp'
import type { Order, OrderStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

type Filter = 'activas' | OrderStatus

export function OrdersDashboard() {
  const { orders, isLoading, error, setStatus } = useOrders()
  const [filter, setFilter] = useState<Filter>('activas')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

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
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 md:px-8 md:py-10">
      <PageHeader
        eyebrow="Banco de trabajo"
        title="Órdenes activas"
        description="Actualiza el estado de cada equipo y notifica al cliente con un toque."
        actions={
          <Button size="lg" className="h-10 px-4 font-semibold" nativeButton={false} render={<Link href="/ingreso" />}>
            <Plus data-icon="inline-start" />
            Nuevo ingreso
          </Button>
        }
      />

      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="flex min-w-max gap-3 md:grid md:min-w-0 md:grid-cols-4 xl:grid-cols-7" role="group" aria-label="Filtrar por estado">
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

      <div className="relative">
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

      <OrderDetailDialog order={selected} onClose={() => setSelectedId(null)} />
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
        'relative flex w-36 flex-col gap-3 overflow-hidden rounded-xl border p-4 text-left transition-all md:w-auto',
        active ? 'border-foreground/30 bg-card' : 'border-border bg-card/50 hover:bg-card',
      )}
    >
      {active && <span className={cn('absolute inset-x-0 top-0 h-0.5', dot)} aria-hidden="true" />}
      <span className="flex items-center justify-between">
        <Icon className={cn('size-4.5', accent)} />
        <span className="font-mono text-2xl font-bold tabular-nums">{count}</span>
      </span>
      <span className={cn('text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
    </button>
  )
}

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Search, Plus, Inbox, TriangleAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OrderCard, orderBalance } from './order-card'
import { OrderDetailDialog } from './order-detail-dialog'
import { OrderEditDialog } from './order-edit-dialog'
import { PhotoViewer } from './photo-viewer'
import { useOrders } from '@/hooks/use-orders'
import { STATUSES, STATUS_MAP, isClosed } from '@/lib/status'
import { formatMoney } from '@/lib/business'
import { openWhatsApp } from '@/lib/whatsapp'
import type { Order, OrderStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

type Filter = 'todas' | 'activas' | OrderStatus

const ACTIVE_STATUSES = STATUSES.filter((s) => !isClosed(s.value))
const CLOSED = STATUSES.filter((s) => isClosed(s.value))

function shortMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace('.0', '').replace('.', ',')}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}k`
  return formatMoney(n)
}

export function OrdersDashboard() {
  const { orders, isLoading, error, setStatus, updateOrder, addComment, deleteOrder } = useOrders()
  const [filter, setFilter] = useState<Filter>('activas')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewerId, setViewerId] = useState<string | null>(null)

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUSES.map((s) => [s.value, 0])) as Record<OrderStatus, number>
    orders.forEach((o) => (c[o.status] += 1))
    return c
  }, [orders])
  const active = orders.filter((o) => !isClosed(o.status))
  const porCobrar = active.reduce((s, o) => s + orderBalance(o), 0)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return orders.filter((o) => {
      const matchesFilter =
        filter === 'todas' ? true : filter === 'activas' ? !isClosed(o.status) : o.status === filter
      if (!matchesFilter) return false
      if (!q) return true
      return [o.id, o.customer.name, o.customer.phone, o.device.brand, o.device.model, o.device.serial ?? '', o.reportedFault]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [orders, filter, query])

  // En «Activas» la lista se agrupa por estado, en el orden del flujo del taller.
  const groups = useMemo(() => {
    if (filter !== 'activas' || query.trim()) return null
    return ACTIVE_STATUSES.map((s) => ({ meta: s, items: visible.filter((o) => o.status === s.value) })).filter(
      (g) => g.items.length > 0,
    )
  }, [filter, query, visible])

  const selected = orders.find((o) => o.id === selectedId) ?? null
  const editing = orders.find((o) => o.id === editingId) ?? null
  const viewing = orders.find((o) => o.id === viewerId) ?? null

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
      loading: 'Actualizando estado…',
      success: (updated) => ({
        message: `${updated.id} → ${STATUS_MAP[status]?.label ?? status}`,
        description: `¿Avisar a ${updated.customer.name.split(' ')[0]}?`,
        action: { label: 'WhatsApp', onClick: () => openWhatsApp(updated) },
        duration: 8000,
      }),
      error: 'No se pudo actualizar el estado.',
    })
  }

  const cardList = (list: Order[]) => (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {list.map((order) => (
        <li key={order.id} className="min-w-0">
          <OrderCard
            order={order}
            onStatusChange={handleStatusChange}
            onOpen={(o) => setSelectedId(o.id)}
            onOpenPhotos={(o) => setViewerId(o.id)}
          />
        </li>
      ))}
    </ul>
  )

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-4 md:px-8 md:py-8">
      {/* ---------- encabezado (escritorio) ---------- */}
      <div className="hidden items-end justify-between gap-4 lg:flex">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-primary">Taller</p>
          <h1 className="mt-1 text-[32px] font-extrabold tracking-tight">Órdenes de trabajo</h1>
        </div>
        <Button size="lg" nativeButton={false} render={<Link href="/ingreso" />}>
          <Plus data-icon="inline-start" />
          Nuevo ingreso
        </Button>
      </div>

      {/* ---------- resumen ---------- */}
      <section aria-label="Resumen" className="grid grid-cols-3 gap-2.5">
        <Stat value={String(active.length)} label="En el taller" onClick={() => setFilter('activas')} active={filter === 'activas'} />
        <Stat
          value={String(counts.esperandoConfirmacion)}
          label="Esperan al cliente"
          tone="text-status-waiting"
          onClick={() => setFilter('esperandoConfirmacion')}
          active={filter === 'esperandoConfirmacion'}
        />
        <Stat value={shortMoney(porCobrar)} label="Por cobrar" tone="text-status-done" />
      </section>

      {/* ---------- búsqueda ---------- */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <label htmlFor="order-search" className="sr-only">
          Buscar órdenes
        </label>
        <input
          id="order-search"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          placeholder="Buscar cliente, teléfono, equipo, orden…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 w-full rounded-2xl border border-border bg-surface pr-11 pl-11 text-base outline-none placeholder:text-muted-foreground focus-visible:border-foreground/40 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Borrar búsqueda"
            className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* ---------- filtros ---------- */}
      <div
        className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0"
        role="group"
        aria-label="Filtrar por estado"
      >
        <Chip active={filter === 'activas'} onClick={() => setFilter('activas')} label="Activas" count={active.length} />
        {ACTIVE_STATUSES.map((s) => (
          <Chip
            key={s.value}
            active={filter === s.value}
            onClick={() => setFilter(s.value)}
            label={s.short}
            count={counts[s.value]}
            dot={s.dot}
          />
        ))}
        <span className="mx-1 w-px shrink-0 self-stretch bg-border" aria-hidden="true" />
        {CLOSED.map((s) => (
          <Chip
            key={s.value}
            active={filter === s.value}
            onClick={() => setFilter(s.value)}
            label={s.short}
            count={counts[s.value]}
            dot={s.dot}
          />
        ))}
        <Chip active={filter === 'todas'} onClick={() => setFilter('todas')} label="Todas" count={orders.length} />
      </div>

      {/* ---------- lista ---------- */}
      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/8 px-6 py-12 text-center">
          <TriangleAlert className="size-9 text-destructive" aria-hidden="true" />
          <p className="font-bold">No se pudieron cargar las órdenes</p>
          <p className="max-w-md text-sm text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
        </div>
      ) : isLoading ? (
        <div className="grid gap-3 md:grid-cols-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[132px] animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border px-6 py-14 text-center">
          <Inbox className="size-10 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
          <p className="text-[16px] font-bold">{query ? 'Sin resultados' : 'No hay órdenes aquí'}</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            {query ? 'Prueba con otro nombre, teléfono o número de orden.' : 'Cuando un equipo pase a este estado aparecerá en esta lista.'}
          </p>
          {!query && filter === 'activas' && (
            <Button className="mt-3" nativeButton={false} render={<Link href="/ingreso" />}>
              <Plus data-icon="inline-start" />
              Registrar un ingreso
            </Button>
          )}
        </div>
      ) : groups ? (
        <div className="flex flex-col gap-6">
          {groups.map(({ meta, items }) => (
            <section key={meta.value} aria-label={meta.label} className="flex flex-col gap-2.5">
              <h2 className="flex items-center gap-2 px-1 text-[13px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                <span className={cn('size-2.5 rounded-full', meta.dot)} aria-hidden="true" />
                {meta.label}
                <span className="font-semibold tabular">{items.length}</span>
              </h2>
              {cardList(items)}
            </section>
          ))}
        </div>
      ) : (
        cardList(visible)
      )}

      <OrderDetailDialog
        order={selected}
        onClose={() => setSelectedId(null)}
        onEdit={startEditing}
        onDelete={handleDelete}
        onComment={addComment}
      />
      <OrderEditDialog order={editing} onClose={() => setEditingId(null)} onSave={updateOrder} />
      <PhotoViewer
        photos={viewing?.photos ?? []}
        open={Boolean(viewing && viewing.photos.length > 0)}
        label={viewing?.id}
        onClose={() => setViewerId(null)}
      />
    </div>
  )
}

function Stat({
  value,
  label,
  tone,
  onClick,
  active,
}: {
  value: string
  label: string
  tone?: string
  onClick?: () => void
  active?: boolean
}) {
  const body = (
    <>
      <span className={cn('font-display block text-[34px] leading-none', tone)}>{value}</span>
      <span className="mt-1.5 block text-[12px] font-semibold leading-tight text-muted-foreground">{label}</span>
    </>
  )
  const cls = cn(
    'rounded-2xl border border-border bg-card px-3 py-3 text-left transition-colors',
    active && 'border-foreground/25 bg-surface',
  )
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn(cls, 'hover:border-foreground/25')}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function Chip({
  active,
  onClick,
  label,
  count,
  dot,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  dot?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[14px] font-semibold whitespace-nowrap transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-surface text-muted-foreground hover:text-foreground',
      )}
    >
      {dot && <span className={cn('size-2 rounded-full', dot)} aria-hidden="true" />}
      {label}
      <span className={cn('tabular text-[13px]', active ? 'opacity-70' : 'opacity-80')}>{count}</span>
    </button>
  )
}

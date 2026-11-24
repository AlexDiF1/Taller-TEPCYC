'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Plus, Inbox, TriangleAlert, X, Archive, ArchiveRestore, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { OrderCard, orderBalance } from './order-card'
import { useOrders } from '@/hooks/use-orders'
import { STATUSES, isClosed, isDelivered, isInShop } from '@/lib/status'
import { formatMoney } from '@/lib/business'
import type { Order, OrderStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

type Filter = 'todas' | 'activas' | 'entregadas' | 'archivadas' | OrderStatus

const ACTIVE_STATUSES = STATUSES.filter((s) => !isClosed(s.value))
const CLOSED = STATUSES.filter((s) => isClosed(s.value))

/**
 * «Activas» = equipos que siguen en el taller (también los listos sin recoger).
 * Los estados cerrados (Lista, Rechazada, Fallida) cuentan solo los que faltan por entregar.
 */
function matches(o: Order, filter: Filter) {
  if (filter === 'todas' || filter === 'archivadas') return true
  if (filter === 'activas') return isInShop(o)
  if (filter === 'entregadas') return isDelivered(o)
  return o.status === filter && isInShop(o)
}

function shortMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace('.0', '').replace('.', ',')}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}k`
  return formatMoney(n)
}

export function OrdersDashboard() {
  const { orders, archivedOrders, isLoading, error, restoreOrder } = useOrders()
  const [restoring, setRestoring] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('activas')
  const [query, setQuery] = useState('')
  const router = useRouter()
  const buscar = useSearchParams().get('buscar')

  // El botón «Buscar» del menú abre todas las órdenes con el cursor en la búsqueda.
  useEffect(() => {
    if (!buscar) return
    setFilter('todas')
    document.getElementById('order-search')?.focus()
    router.replace('/', { scroll: false })
  }, [buscar, router])

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUSES.map((s) => [s.value, 0])) as Record<OrderStatus, number>
    orders.forEach((o) => {
      if (isInShop(o)) c[o.status] += 1
    })
    return c
  }, [orders])
  const active = orders.filter(isInShop)
  const delivered = orders.filter(isDelivered).length
  const porCobrar = active.reduce((s, o) => s + orderBalance(o), 0)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const source = filter === 'archivadas' ? archivedOrders : orders
    return source.filter((o) => {
      if (!matches(o, filter)) return false
      if (!q) return true
      return [o.id, o.customer.name, o.customer.phone, o.device.brand, o.device.model, o.device.serial ?? '', o.reportedFault]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [orders, archivedOrders, filter, query])

  async function restore(id: string) {
    setRestoring(id)
    try {
      await restoreOrder(id)
      toast.success(`Orden ${id} restaurada.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo restaurar la orden.')
    } finally {
      setRestoring(null)
    }
  }

  // En «Activas» la lista se agrupa por estado, en el orden del flujo del taller.
  const groups = useMemo(() => {
    if (filter !== 'activas' || query.trim()) return null
    return STATUSES.map((s) => ({ meta: s, items: visible.filter((o) => o.status === s.value) })).filter(
      (g) => g.items.length > 0,
    )
  }, [filter, query, visible])

  const cardList = (list: Order[]) => (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {list.map((order) => (
        <li key={order.id} className="flex min-w-0 flex-col gap-1.5">
          <OrderCard order={order} />
          {order.archivedAt && (
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              disabled={restoring === order.id}
              onClick={() => restore(order.id)}
              aria-label={`Restaurar orden ${order.id}`}
            >
              {restoring === order.id ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <ArchiveRestore data-icon="inline-start" />
              )}
              Restaurar
            </Button>
          )}
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
        <Chip active={filter === 'entregadas'} onClick={() => setFilter('entregadas')} label="Entregadas" count={delivered} />
        <Chip active={filter === 'todas'} onClick={() => setFilter('todas')} label="Todas" count={orders.length} />
        <Chip
          active={filter === 'archivadas'}
          onClick={() => setFilter('archivadas')}
          label="Archivadas"
          count={archivedOrders.length}
          icon={<Archive className="size-3.5" aria-hidden="true" />}
        />
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
          <p className="text-[16px] font-bold">{query ? 'Sin resultados' : filter === 'archivadas' ? 'No hay órdenes archivadas' : 'No hay órdenes aquí'}</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            {query
              ? 'Prueba con otro nombre, teléfono o número de orden.'
              : filter === 'archivadas'
                ? 'Las órdenes que archives desde su ficha (menú ⋯) quedan aquí y se pueden restaurar.'
                : 'Cuando un equipo pase a este estado aparecerá en esta lista.'}
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
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  dot?: string
  icon?: ReactNode
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
      {icon}
      {label}
      <span className={cn('tabular text-[13px]', active ? 'opacity-70' : 'opacity-80')}>{count}</span>
    </button>
  )
}

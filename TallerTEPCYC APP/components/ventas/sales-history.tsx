'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Search,
  Trash2,
  ChevronDown,
  ReceiptText,
  TrendingUp,
  ShoppingCart,
  Wallet,
  Inbox,
  TriangleAlert,
  CalendarDays,
  X,
  Pencil,
  Send,
  FileDown,
  Loader2,
  Printer,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, formatMoney } from '@/lib/business'
import {
  PAYMENT_METHODS,
  PAYMENT_MAP,
  buildSaleMessage,
  buildSaleReceiptPdf,
  printSaleReceiptPdf,
  type Venta,
  type VentaFilters,
  type VentaSummary,
} from '@/lib/ventas'
import { WaOfflineError, WaThrottleError, blobToDataUrl, waSendDocument } from '@/lib/wa'
import { cn } from '@/lib/utils'

const METHOD_ITEMS = [
  { value: 'todas', label: 'Todos los métodos' },
  ...PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label })),
]

type Period = 'todo' | 'hoy' | 'semana' | 'mes'

function localDayStart(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function periodRange(period: Period): { from?: string; to?: string } {
  const now = new Date()
  if (period === 'hoy') {
    const start = localDayStart(now)
    return { from: start.toISOString(), to: now.toISOString() }
  }
  if (period === 'semana') {
    const start = localDayStart(now)
    start.setDate(start.getDate() - 6)
    return { from: start.toISOString(), to: now.toISOString() }
  }
  if (period === 'mes') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: start.toISOString(), to: now.toISOString() }
  }
  return {}
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: '7 días' },
  { value: 'mes', label: 'Este mes' },
]

export function SalesHistory({
  ventas,
  summary,
  isLoading,
  error,
  filters,
  onFiltersChange,
  onDelete,
  onEdit,
}: {
  ventas: Venta[]
  summary: VentaSummary
  isLoading: boolean
  error: unknown
  filters: VentaFilters
  onFiltersChange: (next: VentaFilters) => void
  onDelete: (venta: Venta) => Promise<void>
  onEdit?: (venta: Venta) => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('todo')

  const maxMethod = useMemo(
    () => Math.max(1, ...PAYMENT_METHODS.map((m) => summary.byMethod[m.value] ?? 0)),
    [summary],
  )
  const margin = summary.total > 0 ? Math.round((summary.profit / summary.total) * 100) : 0

  function setPeriodFilter(next: Period) {
    setPeriod(next)
    const range = periodRange(next)
    onFiltersChange({ ...filters, from: range.from ?? '', to: range.to ?? '' })
  }

  async function handleDelete(venta: Venta) {
    const promise = onDelete(venta)
    toast.promise(promise, {
      loading: `Eliminando ${venta.id}...`,
      success: `Venta ${venta.id} eliminada.`,
      error: 'No se pudo eliminar la venta.',
    })
    setConfirmId(null)
    setExpandedId(null)
    try {
      await promise
    } catch {
      /* el toast ya muestra el error */
    }
  }

  /** Descarga el recibo en PDF de una venta del historial. */
  async function downloadReceipt(venta: Venta) {
    if (busyId === venta.id) return
    setBusyId(venta.id)
    try {
      const { blob, filename } = await buildSaleReceiptPdf(venta)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      toast.info(`Recibo ${venta.id} descargado en PDF.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo generar el recibo.')
    } finally {
      setBusyId(null)
    }
  }

  /** Abre el ticket de 80 mm en el visor de PDF para imprimir. */
  async function printReceipt(venta: Venta) {
    if (busyId === venta.id) return
    setBusyId(venta.id)
    try {
      await printSaleReceiptPdf(venta)
      toast.info(`Ticket ${venta.id} listo para imprimir.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo preparar el ticket.')
    } finally {
      setBusyId(null)
    }
  }

  /** Envía el recibo por WhatsApp desde la sesión vinculada del taller. */
  async function sendReceipt(venta: Venta) {
    if (!venta.customerPhone) {
      toast.error('Esta venta no tiene teléfono del cliente. Edítala para agregarlo.')
      return
    }
    setSendingId(venta.id)
    try {
      const { blob, filename } = await buildSaleReceiptPdf(venta)
      await waSendDocument({
        phone: venta.customerPhone,
        fileName: filename,
        dataUrl: await blobToDataUrl(blob),
        caption: buildSaleMessage(venta),
      })
      toast.success(`Recibo de ${venta.id} enviado a ${venta.customerName?.split(' ')[0] ?? venta.customerPhone}.`)
    } catch (error) {
      if (error instanceof WaOfflineError) {
        toast.info('WhatsApp no está conectado: usa "PDF" para enviarlo a mano.')
      } else if (error instanceof WaThrottleError) {
        toast.info(`${error.message} Usa "PDF" para enviarlo a mano.`)
      } else {
        toast.error(error instanceof Error ? error.message : 'No se pudo enviar el recibo.')
      }
    } finally {
      setSendingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* --------------------------- indicadores rápidos --------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ShoppingCart}
          accent="text-primary"
          bg="bg-primary/12"
          label="Total vendido"
          value={formatMoney(summary.total)}
          hint={`${summary.count} ${summary.count === 1 ? 'venta' : 'ventas'} en el rango`}
        />
        <StatCard
          icon={TrendingUp}
          accent="text-status-done"
          bg="bg-status-done/12"
          label="Ganancia neta"
          value={formatMoney(summary.profit)}
          hint={`${margin}% de margen sobre ventas`}
        />
        <StatCard
          icon={ReceiptText}
          accent="text-status-pending"
          bg="bg-status-pending/12"
          label="Ticket promedio"
          value={formatMoney(summary.averageTicket)}
          hint={`Costo de mercancía: ${formatMoney(summary.totalCost)}`}
        />
        <div className="rounded-2xl border border-border bg-card/70 p-4 ring-1 ring-foreground/5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Por método</p>
            <Wallet className="size-4 text-status-review" aria-hidden="true" />
          </div>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {PAYMENT_METHODS.map((m) => {
              const amount = summary.byMethod[m.value] ?? 0
              return (
                <li key={m.value} className="flex items-center gap-2">
                  <span className={cn('size-1.5 shrink-0 rounded-full', m.dot)} aria-hidden="true" />
                  <span className="w-16 shrink-0 truncate text-[11px] text-muted-foreground">{m.label}</span>
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className={cn('block h-full rounded-full', m.dot)}
                      style={{ width: `${Math.round((amount / maxMethod) * 100)}%` }}
                    />
                  </span>
                  <span className="w-20 shrink-0 text-right font-mono text-[11px] font-medium tabular-nums">
                    {formatMoney(amount)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {/* ------------------------------ filtros ------------------------------ */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Buscar por venta, cliente, teléfono o artículo..."
            value={filters.q ?? ''}
            onChange={(e) => onFiltersChange({ ...filters, q: e.target.value })}
            className="h-10 rounded-xl bg-background/40 pl-9 text-base"
            aria-label="Buscar ventas"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-border bg-background/40 p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriodFilter(p.value)}
                aria-pressed={period === p.value}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  period === p.value ? 'bg-card text-foreground ring-1 ring-foreground/10' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <Select
            items={METHOD_ITEMS}
            value={filters.method || 'todas'}
            onValueChange={(v) => onFiltersChange({ ...filters, method: v === 'todas' ? '' : (v as VentaFilters['method']) })}
          >
            <SelectTrigger className="h-10 w-44 rounded-xl bg-background/40" aria-label="Filtrar por método de pago">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHOD_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(filters.from || filters.to || filters.method) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setPeriod('todo')
                onFiltersChange({ ...filters, from: '', to: '', method: '' })
              }}
              className="h-10 rounded-xl text-muted-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* ------------------------------- listado ------------------------------- */}
      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-6 py-12 text-center">
          <TriangleAlert className="size-9 text-destructive" aria-hidden="true" />
          <p className="font-semibold">No se pudo cargar el historial</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {error instanceof Error ? error.message : String(error)}
          </p>
        </div>
      ) : isLoading && ventas.length === 0 ? (
        <div className="grid gap-3" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-card/60" />
          ))}
        </div>
      ) : ventas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
          <Inbox className="size-10 text-muted-foreground" aria-hidden="true" />
          <p className="font-semibold">No hay ventas aquí</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {filters.q || filters.method || filters.from
              ? 'Prueba con otro término o limpia los filtros.'
              : 'Cuando registres una venta aparecerá en esta lista.'}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {ventas.map((venta) => {
            const meta = PAYMENT_MAP[venta.paymentMethod]
            const Icon = meta?.icon ?? Wallet
            const expanded = expandedId === venta.id
            const confirming = confirmId === venta.id
            return (
              <li key={venta.id} className="overflow-hidden rounded-2xl border border-border bg-card/70 ring-1 ring-foreground/5">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : venta.id)}
                  aria-expanded={expanded}
                  className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-card sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', meta?.bg, meta?.text)}>
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        {venta.id}
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {meta?.label ?? venta.paymentMethod}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {formatDate(venta.createdAt, true)} · {venta.customerName || 'Cliente ocasional'}
                        {venta.customerPhone ? ` · ${venta.customerPhone}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-right">
                      <p className="font-mono text-base font-bold tabular-nums">{formatMoney(venta.total)}</p>
                      <p className="text-[11px] text-status-done">
                        Ganancia {formatMoney(venta.profit)} · {venta.items.length} art.
                      </p>
                    </div>
                    <ChevronDown
                      className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')}
                      aria-hidden="true"
                    />
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-border bg-background/30 px-4 py-3">
                    <ul className="flex flex-col gap-1.5 text-sm">
                      {venta.items.map((item) => (
                        <li key={item.id} className="flex items-start justify-between gap-2">
                          <span className="min-w-0">
                            <span className="font-mono text-xs text-muted-foreground">{item.quantity}×</span>{' '}
                            <span className="text-muted-foreground">{item.name}</span>
                            <span className="ml-2 font-mono text-[11px] text-muted-foreground/70">
                              (costo {formatMoney(item.cost)} c/u)
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-sm tabular-nums">{formatMoney(item.subtotal)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-col gap-2.5 border-t border-border pt-2.5">
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span>Costo: {formatMoney(venta.totalCost)}</span>
                        <span className="text-status-done">Ganancia: {formatMoney(venta.profit)}</span>
                        {venta.notes && <span className="max-w-[240px] truncate">{venta.notes}</span>}
                      </div>

                      {confirming ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <span className="text-xs text-destructive">¿Eliminar esta venta?</span>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(venta)}
                            className="h-8 rounded-lg"
                          >
                            Sí, eliminar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmId(null)}
                            className="h-8 rounded-lg"
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {onEdit && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onEdit(venta)}
                              className="h-8 rounded-lg"
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                              Editar
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => printReceipt(venta)}
                            disabled={busyId === venta.id}
                            className="h-8 rounded-lg"
                          >
                            <Printer className="size-3.5" aria-hidden="true" />
                            Imprimir 80mm
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => downloadReceipt(venta)}
                            disabled={busyId === venta.id}
                            className="h-8 rounded-lg"
                          >
                            <FileDown className="size-3.5" aria-hidden="true" />
                            PDF
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => sendReceipt(venta)}
                            disabled={sendingId === venta.id}
                            title={
                              venta.customerPhone
                                ? 'Envía el recibo por WhatsApp desde la sesión del taller'
                                : 'La venta no tiene teléfono del cliente'
                            }
                            className={cn(
                              'h-8 rounded-lg bg-whatsapp font-semibold text-black hover:bg-whatsapp/85',
                              !venta.customerPhone && 'opacity-60',
                            )}
                          >
                            {sendingId === venta.id ? (
                              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <Send className="size-3.5" aria-hidden="true" />
                            )}
                            {sendingId === venta.id ? 'Enviando…' : 'Enviar recibo'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmId(venta.id)}
                            className="h-8 rounded-lg text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                            Eliminar
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {!isLoading && ventas.length > 0 && (
        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          Mostrando {ventas.length} {ventas.length === 1 ? 'venta' : 'ventas'} · toca una para ver el detalle
        </p>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  accent,
  bg,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: 'true' }>
  accent: string
  bg: string
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-4 ring-1 ring-foreground/5">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <span className={cn('grid size-7 place-items-center rounded-lg', bg, accent)}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 font-mono text-xl font-bold tabular-nums tracking-tight md:text-2xl">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}

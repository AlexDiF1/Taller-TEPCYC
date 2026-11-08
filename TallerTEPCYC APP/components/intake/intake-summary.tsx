import { CheckCircle2, Circle } from 'lucide-react'
import { DEVICE_ICON } from '@/lib/status'
import { formatMoney } from '@/lib/business'
import type { IntakeDraft } from './intake-form'
import { cn } from '@/lib/utils'

export function IntakeSummary({
  draft,
  children,
}: {
  draft: IntakeDraft
  submitting: boolean
  children: React.ReactNode
}) {
  const Icon = DEVICE_ICON[draft.deviceType]
  const cost = Number(draft.estimatedCost) || 0
  const deposit = Number(draft.deposit) || 0

  const checklist = [
    { label: 'Cliente', done: draft.name.trim().length >= 3 && draft.phone.replace(/\D/g, '').length >= 7 },
    { label: 'Equipo', done: !!draft.model.trim() },
    { label: 'Falla', done: !!draft.reportedFault.trim() },
    { label: 'Fotos', done: draft.photos.length > 0 },
    { label: 'Condiciones', done: draft.acceptedTerms },
  ]
  const progress = checklist.filter((c) => c.done).length

  return (
    <aside className="xl:sticky xl:top-6 xl:self-start" aria-label="Resumen del ingreso">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="relative border-b border-dashed border-border bg-secondary/40 p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Orden nueva</p>
            <p className="font-mono text-xs text-primary">OT-####</p>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-xl bg-background ring-1 ring-border">
              <Icon className="size-6 text-primary" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {draft.brand} {draft.model || <span className="text-muted-foreground">Modelo</span>}
              </p>
              <p className="truncate text-sm text-muted-foreground">{draft.name || 'Cliente sin nombre'}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 p-5">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progreso del registro</span>
              <span className="font-mono">
                {progress}/{checklist.length}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(progress / checklist.length) * 100}%` }}
              />
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              {checklist.map((c) => (
                <li key={c.label} className={cn('flex items-center gap-2', c.done ? 'text-foreground' : 'text-muted-foreground')}>
                  {c.done ? (
                    <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                  ) : (
                    <Circle className="size-4" aria-hidden="true" />
                  )}
                  {c.label}
                </li>
              ))}
            </ul>
          </div>

          <dl className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-secondary/50 p-2.5">
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Accesorios</dt>
              <dd className="mt-1 font-mono text-lg font-semibold">{draft.accessories.length}</dd>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2.5">
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Fotos</dt>
              <dd className="mt-1 font-mono text-lg font-semibold">{draft.photos.length}</dd>
            </div>
          </dl>

          <dl className="flex flex-col gap-2 border-t border-dashed border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Costo estimado</dt>
              <dd className="font-mono">{formatMoney(cost)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Abono</dt>
              <dd className="font-mono">- {formatMoney(deposit)}</dd>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <dt className="font-medium">Saldo pendiente</dt>
              <dd className="font-mono text-xl font-bold text-primary">{formatMoney(Math.max(cost - deposit, 0))}</dd>
            </div>
          </dl>

          {children}
          <p className="text-center text-xs text-muted-foreground">
            Se generará el comprobante de recepción para imprimir.
          </p>
        </div>
      </div>
    </aside>
  )
}

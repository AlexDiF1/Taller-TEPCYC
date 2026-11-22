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
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-dashed border-border p-5">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/10">
            <Icon className="size-6 text-primary" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Orden nueva</p>
            <p className="truncate text-[16px] font-extrabold">
              {[draft.brand, draft.model].filter(Boolean).join(' ') || <span className="text-muted-foreground">Equipo</span>}
            </p>
            <p className="truncate text-[13.5px] text-muted-foreground">{draft.name || 'Cliente sin nombre'}</p>
          </div>
        </div>

        <div className="flex flex-col gap-5 p-5">
          <div>
            <div className="mb-2 flex items-center justify-between text-[13px]">
              <span className="font-semibold text-muted-foreground">Listo para registrar</span>
              <span className="tabular font-bold">
                {progress}/{checklist.length}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-status-done transition-all duration-500"
                style={{ width: `${(progress / checklist.length) * 100}%` }}
              />
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[14px]">
              {checklist.map((c) => (
                <li key={c.label} className={cn('flex items-center gap-2', c.done ? 'font-semibold' : 'text-muted-foreground')}>
                  {c.done ? (
                    <CheckCircle2 className="size-4 text-status-done" aria-hidden="true" />
                  ) : (
                    <Circle className="size-4" aria-hidden="true" />
                  )}
                  {c.label}
                </li>
              ))}
            </ul>
          </div>

          <dl className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-4 text-[14px]">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Costo estimado</dt>
              <dd className="tabular font-semibold">{formatMoney(cost)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Abono</dt>
              <dd className="tabular font-semibold">− {formatMoney(deposit)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-border pt-2">
              <dt className="font-bold">Saldo</dt>
              <dd className="font-display text-[30px] text-primary">{formatMoney(Math.max(cost - deposit, 0))}</dd>
            </div>
          </dl>

          {children}
          <p className="text-center text-[12.5px] text-muted-foreground">Después se abre el comprobante de recepción.</p>
        </div>
      </div>
    </aside>
  )
}

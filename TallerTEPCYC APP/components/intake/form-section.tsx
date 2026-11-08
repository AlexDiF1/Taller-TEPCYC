import { Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FormSection({
  step,
  title,
  description,
  icon: Icon,
  children,
}: {
  step: number
  title: string
  description?: string
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <section
      aria-labelledby={`section-${step}`}
      className="rounded-2xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6"
    >
      <header className="mb-5 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary ring-1 ring-border">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Paso {String(step).padStart(2, '0')}
          </p>
          <h2 id={`section-${step}`} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </header>
      {children}
    </section>
  )
}

export function ChipToggle({
  label,
  selected,
  onToggle,
  icon: Icon,
}: {
  label: string
  selected: boolean
  onToggle: () => void
  icon?: LucideIcon
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all',
        selected
          ? 'border-primary/60 bg-primary/12 text-primary'
          : 'border-border bg-secondary/40 text-muted-foreground hover:border-foreground/25 hover:text-foreground',
      )}
    >
      {selected ? <Check className="size-3.5" aria-hidden="true" /> : Icon && <Icon className="size-3.5" aria-hidden="true" />}
      {label}
    </button>
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  required,
  error,
  className,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  required?: boolean
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-sm font-medium">
        {label}
        {required && (
          <span className="text-primary" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

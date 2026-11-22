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
    <section aria-labelledby={`section-${step}`} className="rounded-3xl border border-border bg-card p-4 md:p-6">
      <header className="mb-4 flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id={`section-${step}`} className="text-[18px] leading-tight font-extrabold tracking-tight">
            {title}
          </h2>
          {description && <p className="text-[13.5px] text-muted-foreground">{description}</p>}
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
  className,
}: {
  label: string
  selected: boolean
  onToggle: () => void
  icon?: LucideIcon
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        'inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold transition-colors',
        selected
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-surface text-foreground/80 hover:border-foreground/30 hover:text-foreground',
        className,
      )}
    >
      {selected ? <Check className="size-4" aria-hidden="true" /> : Icon && <Icon className="size-4" aria-hidden="true" />}
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
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-[13.5px] font-semibold text-foreground/85">
        {label}
        {required && (
          <span className="text-primary" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p className="text-[13px] font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-[12.5px] text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

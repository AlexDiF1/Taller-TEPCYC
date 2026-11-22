export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 print:hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-primary">{eyebrow}</p>
          )}
          <h1 className="mt-1 text-balance text-[28px] font-extrabold leading-tight tracking-tight md:text-[32px]">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-pretty text-[14.5px] text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

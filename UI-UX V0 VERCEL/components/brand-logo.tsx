import { Gamepad2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BrandLogo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="relative grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[0_0_24px_-4px] shadow-primary/60">
        <Gamepad2 className="size-5" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight">
            TODOENPC<span className="text-primary">Y</span>CONSOLAS
            <span className="ml-0.5 font-mono text-primary">2</span>
          </span>
          <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Service Lab
          </span>
        </span>
      )}
    </div>
  )
}

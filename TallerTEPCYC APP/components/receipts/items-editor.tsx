'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BUSINESS, formatMoney } from '@/lib/business'
import type { ServiceItem } from '@/lib/types'
import { cn } from '@/lib/utils'

export function ItemsEditor({ items, onChange }: { items: ServiceItem[]; onChange: (items: ServiceItem[]) => void }) {
  function update(id: string, patch: Partial<ServiceItem>) {
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  function add(kind: ServiceItem['kind']) {
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
    onChange([...items, { id, description: '', kind, price: 0 }])
  }

  const total = items.reduce((s, i) => s + i.price, 0)

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          Agrega los servicios y repuestos aplicados.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={item.id} className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => update(item.id, { kind: item.kind === 'servicio' ? 'repuesto' : 'servicio' })}
                className={cn(
                  'shrink-0 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider',
                  item.kind === 'servicio' ? 'bg-primary/15 text-primary' : 'bg-status-pending/15 text-status-pending',
                )}
                aria-label={`Cambiar tipo de la línea ${index + 1}, actual: ${item.kind}`}
              >
                {item.kind}
              </button>
              <label htmlFor={`desc-${item.id}`} className="sr-only">
                Descripción línea {index + 1}
              </label>
              <Input
                id={`desc-${item.id}`}
                value={item.description}
                placeholder="Descripción"
                onChange={(e) => update(item.id, { description: e.target.value })}
                className="h-8"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onChange(items.filter((i) => i.id !== item.id))}
                aria-label={`Eliminar línea ${index + 1}`}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-muted-foreground">$</span>
              <label htmlFor={`price-${item.id}`} className="sr-only">
                Valor línea {index + 1}
              </label>
              <Input
                id={`price-${item.id}`}
                inputMode="numeric"
                value={item.price ? item.price.toLocaleString(BUSINESS.locale) : ''}
                placeholder="0"
                onChange={(e) => update(item.id, { price: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                className="h-8 pl-6 font-mono"
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => add('servicio')}>
          <Plus data-icon="inline-start" />
          Servicio
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => add('repuesto')}>
          <Plus data-icon="inline-start" />
          Repuesto
        </Button>
      </div>
      <div className="flex items-baseline justify-between border-t border-dashed border-border pt-3 text-sm">
        <span className="text-muted-foreground">Total</span>
        <span className="font-mono text-lg font-bold text-primary">{formatMoney(total)}</span>
      </div>
    </div>
  )
}

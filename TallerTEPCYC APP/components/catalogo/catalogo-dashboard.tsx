'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Globe, ImageOff, Package, Plus, Search, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useProductos } from '@/hooks/use-productos'
import {
  CATEGORIES,
  CATEGORY_MAP,
  createProducto,
  deleteProducto,
  inStock,
  updateProducto,
  type ProductCategory,
  type Producto,
  type ProductoInput,
} from '@/lib/catalogo'
import { formatMoney } from '@/lib/business'
import { cn } from '@/lib/utils'
import { ProductDialog } from './product-dialog'

type Filter = 'todos' | ProductCategory

function normalize(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function CatalogoDashboard() {
  const { productos, error, isLoading, refresh } = useProductos()
  const [filter, setFilter] = useState<Filter>('todos')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Producto | null>(null)
  const [open, setOpen] = useState(false)

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: productos.length }
    for (const p of productos) c[p.category] = (c[p.category] ?? 0) + 1
    return c
  }, [productos])

  const visible = useMemo(() => {
    const q = normalize(query.trim())
    return productos.filter((p) => (filter === 'todos' || p.category === filter) && (!q || normalize(p.name).includes(q)))
  }, [productos, filter, query])

  const enLaWeb = productos.filter(inStock).length

  function openNew() {
    setEditing(null)
    setOpen(true)
  }

  function openEdit(p: Producto) {
    setEditing(p)
    setOpen(true)
  }

  async function save(input: ProductoInput) {
    if (editing) await updateProducto(editing.id, input)
    else await createProducto(input)
    await refresh()
  }

  async function remove(p: Producto) {
    await deleteProducto(p.id)
    await refresh()
  }

  async function toggleAvailable(p: Producto) {
    try {
      await updateProducto(p.id, { available: !p.available })
      await refresh()
      toast.success(p.available ? `${p.name} quedó oculto.` : `${p.name} ya está disponible.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar.')
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:px-8 md:py-8">
      <div className="flex items-end justify-between gap-3">
        <div className="hidden lg:block">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-primary">Negocio</p>
          <h1 className="mt-1 text-[32px] font-extrabold tracking-tight">Catálogo</h1>
          <p className="mt-1 text-[14.5px] text-muted-foreground">Lo que vendes en el local y en la tienda de tepcyc.com.</p>
        </div>
        <p className="text-[13.5px] text-muted-foreground lg:hidden">
          <Globe className="mr-1 inline size-4 align-[-3px]" aria-hidden="true" />
          {enLaWeb} de {productos.length} en la web
        </p>
        <Button size="lg" onClick={openNew} className="shrink-0">
          <Plus data-icon="inline-start" />
          Nuevo producto
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto"
          aria-label="Buscar producto"
          className="pl-10"
        />
      </div>

      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Categoría">
        {[{ value: 'todos' as Filter, short: 'Todos' }, ...CATEGORIES].map((c) => (
          <button
            key={c.value}
            type="button"
            aria-pressed={filter === c.value}
            onClick={() => setFilter(c.value)}
            className={cn(
              'h-11 shrink-0 rounded-full border px-4 text-[14px] font-semibold transition-colors',
              filter === c.value ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-foreground/80',
            )}
          >
            {c.short}
            <span className="ml-1.5 tabular text-[12.5px] opacity-70">{counts[c.value] ?? 0}</span>
          </button>
        ))}
      </div>

      {error ? (
        <p className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/8 p-4 text-[14px] text-destructive">
          <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
          No se pudo cargar el catálogo. {error instanceof Error ? error.message : ''}
        </p>
      ) : isLoading ? (
        <p className="py-10 text-center text-[14px] text-muted-foreground">Cargando catálogo…</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border px-6 py-12 text-center">
          <Package className="size-9 text-muted-foreground/60" aria-hidden="true" />
          <p className="text-[15px] font-bold">{productos.length === 0 ? 'Aún no hay productos' : 'Nada con ese filtro'}</p>
          <p className="max-w-sm text-[13.5px] text-muted-foreground">
            {productos.length === 0
              ? 'Agrega las consolas, controles y accesorios que vendes. Lo disponible sale en la tienda de la web.'
              : 'Prueba con otra categoría o búsqueda.'}
          </p>
          {productos.length === 0 && (
            <Button className="mt-2" size="lg" onClick={openNew}>
              <Plus data-icon="inline-start" />
              Agregar el primero
            </Button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((p) => (
            <ProductCard key={p.id} producto={p} onEdit={() => openEdit(p)} onToggle={() => void toggleAvailable(p)} />
          ))}
        </ul>
      )}

      <ProductDialog
        open={open}
        producto={editing}
        defaultCategory={filter === 'todos' ? 'nuevas' : filter}
        onClose={() => setOpen(false)}
        onSave={save}
        onDelete={remove}
      />
    </div>
  )
}

function StockLine({ p }: { p: Producto }) {
  if (p.stock === null) return <span className="text-muted-foreground">Sin contar unidades</span>
  if (p.stock === 0) return <span className="font-bold text-status-rejected">Agotado</span>
  return (
    <span className={cn('font-semibold', p.stock <= 1 ? 'text-status-review' : 'text-foreground/80')}>
      {p.stock === 1 ? 'Queda 1' : `Quedan ${p.stock}`}
    </span>
  )
}

function ProductCard({ producto: p, onEdit, onToggle }: { producto: Producto; onEdit: () => void; onToggle: () => void }) {
  const live = inStock(p)
  return (
    <li className={cn('flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card', !p.available && 'opacity-70')}>
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 flex-col text-left" aria-label={`Editar ${p.name}`}>
        <div className="relative aspect-[4/3] w-full bg-surface-2">
          {p.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photoUrl} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center">
              <ImageOff className="size-7 text-muted-foreground/60" aria-hidden="true" />
            </span>
          )}
          <span className="absolute top-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-bold">
            {CATEGORY_MAP[p.category]?.short ?? p.category}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-3">
          <p className="line-clamp-2 text-[14.5px] leading-snug font-bold">{p.name}</p>
          <p className="tabular text-[16px] font-extrabold">{formatMoney(p.price)}</p>
          <p className="text-[12.5px]"><StockLine p={p} /></p>
        </div>
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={p.available}
        className={cn(
          'flex min-h-11 items-center justify-center gap-1.5 border-t border-border px-2 text-[12.5px] font-bold transition-colors',
          live ? 'text-status-done' : 'text-muted-foreground',
        )}
      >
        <Globe className="size-4" aria-hidden="true" />
        {p.available ? (live ? 'En la web' : 'Agotado: no sale') : 'Oculto · mostrar'}
      </button>
    </li>
  )
}

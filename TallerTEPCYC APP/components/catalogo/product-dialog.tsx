'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Camera, ImageOff, Loader2, Minus, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { uploadPhoto } from '@/lib/api'
import { compressImage } from '@/lib/image'
import { BUSINESS } from '@/lib/business'
import { CATEGORIES, type ProductCategory, type Producto, type ProductoInput } from '@/lib/catalogo'
import { cn } from '@/lib/utils'

/** Interruptor accesible de 44 px de alto (fila completa tocable). */
export function SwitchRow({
  id,
  checked,
  onChange,
  label,
  hint,
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-bold">{label}</span>
        {hint && <span className="block text-[12.5px] text-muted-foreground">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          checked ? 'bg-status-done' : 'bg-foreground/20',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </span>
    </button>
  )
}

function MoneyInput({ id, value, onChange, placeholder = '0' }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-semibold text-muted-foreground">$</span>
      <Input
        id={id}
        inputMode="numeric"
        placeholder={placeholder}
        value={value ? Number(value).toLocaleString(BUSINESS.locale) : ''}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 8))}
        className="tabular pl-7 text-[16px] font-bold"
      />
    </div>
  )
}

interface Draft {
  name: string
  category: ProductCategory
  price: string
  cost: string
  description: string
  available: boolean
  trackStock: boolean
  stock: string
  /** Foto guardada (/uploads/…) o una nueva en data URL aún sin subir; '' = sin foto. */
  photo: string
}

function toDraft(p: Producto | null, category: ProductCategory): Draft {
  return {
    name: p?.name ?? '',
    category: p?.category ?? category,
    price: p ? String(p.price) : '',
    cost: p?.cost ? String(p.cost) : '',
    description: p?.description ?? '',
    available: p?.available ?? true,
    trackStock: p ? p.stock !== null : false,
    stock: p?.stock != null ? String(p.stock) : '1',
    photo: p?.photoUrl ?? '',
  }
}

/** Crear o editar un producto. `producto` null + `open` = nuevo. */
export function ProductDialog({
  open,
  producto,
  defaultCategory = 'nuevas',
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  producto: Producto | null
  defaultCategory?: ProductCategory
  onClose: () => void
  onSave: (input: ProductoInput) => Promise<unknown>
  onDelete: (p: Producto) => Promise<unknown>
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(producto, defaultCategory))
  const [saving, setSaving] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setDraft(toDraft(producto, defaultCategory))
    setConfirmDelete(false)
  }, [open, producto, defaultCategory])

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPreparing(true)
    try {
      set({ photo: await compressImage(file, { maxSize: 1200, quality: 0.8 }) })
    } catch {
      toast.error('No se pudo leer la foto.')
    } finally {
      setPreparing(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const name = draft.name.trim()
    if (!name) return toast.error('Escribe el nombre del producto.')
    if (!(Number(draft.price) > 0)) return toast.error('Escribe el precio de venta.')
    const stock = Math.trunc(Number(draft.stock))
    if (draft.trackStock && !(stock >= 0)) return toast.error('Las existencias no son válidas.')
    setSaving(true)
    try {
      const photoUrl = draft.photo.startsWith('data:') ? await uploadPhoto(draft.photo) : draft.photo
      await onSave({
        name,
        category: draft.category,
        price: Number(draft.price),
        cost: Number(draft.cost) || 0,
        description: draft.description.trim(),
        available: draft.available,
        stock: draft.trackStock ? stock : null,
        photoUrl,
      })
      toast.success(producto ? 'Producto actualizado.' : `${name} agregado al catálogo.`)
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el producto.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!producto) return
    if (!confirmDelete) return setConfirmDelete(true)
    setSaving(true)
    try {
      await onDelete(producto)
      toast.success(`${producto.name} se quitó del catálogo.`)
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo borrar el producto.')
    } finally {
      setSaving(false)
    }
  }

  const busy = saving || preparing

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="overflow-y-auto sm:max-w-md">
        <DialogTitle>{producto ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
        <DialogDescription>Lo disponible sale en la tienda de tepcyc.com y se puede elegir en Ventas.</DialogDescription>

        <form onSubmit={submit} className="flex flex-col gap-3.5">
          {/* Foto */}
          <div className="flex items-center gap-3">
            <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-surface-2">
              {preparing ? (
                <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
              ) : draft.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.photo} alt="" className="size-full object-cover" />
              ) : (
                <ImageOff className="size-7 text-muted-foreground/70" aria-hidden="true" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
              <Button type="button" variant="outline" className="h-11" onClick={() => fileRef.current?.click()} disabled={busy}>
                <Camera data-icon="inline-start" />
                {draft.photo ? 'Cambiar foto' : 'Agregar foto'}
              </Button>
              {draft.photo && (
                <Button type="button" variant="ghost" className="h-11 text-muted-foreground" onClick={() => set({ photo: '' })} disabled={busy}>
                  Quitar foto
                </Button>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="prod-name" className="text-[13.5px] font-semibold text-foreground/85">Nombre</label>
            <Input id="prod-name" className="mt-1" maxLength={80} value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ej.: PlayStation 5 Slim 1 TB" autoComplete="off" />
          </div>

          <div>
            <p className="mb-1.5 text-[13.5px] font-semibold text-foreground/85">Categoría</p>
            <div role="radiogroup" aria-label="Categoría" className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={draft.category === c.value}
                  onClick={() => set({ category: c.value })}
                  className={cn(
                    'min-h-11 rounded-xl border px-3 text-[14px] font-bold transition-colors',
                    draft.category === c.value ? 'border-foreground bg-foreground/5 ring-1 ring-foreground' : 'border-border bg-surface text-foreground/80',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="prod-price" className="text-[13.5px] font-semibold text-foreground/85">Precio de venta</label>
              <div className="mt-1"><MoneyInput id="prod-price" value={draft.price} onChange={(v) => set({ price: v })} /></div>
            </div>
            <div>
              <label htmlFor="prod-cost" className="text-[13.5px] font-semibold text-foreground/85">
                Costo <span className="font-normal text-muted-foreground">(interno)</span>
              </label>
              <div className="mt-1"><MoneyInput id="prod-cost" value={draft.cost} onChange={(v) => set({ cost: v })} /></div>
            </div>
          </div>

          <div>
            <label htmlFor="prod-desc" className="text-[13.5px] font-semibold text-foreground/85">
              Detalle <span className="font-normal text-muted-foreground">(opcional, sale en la web)</span>
            </label>
            <Textarea id="prod-desc" className="mt-1 min-h-16" maxLength={300} value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ej.: con un control y cable HDMI" />
          </div>

          <SwitchRow
            id="prod-available"
            checked={draft.available}
            onChange={(v) => set({ available: v })}
            label="Disponible"
            hint={draft.available ? 'Se ve en la web y en Ventas' : 'Oculto en la web y en Ventas'}
          />
          <SwitchRow
            id="prod-track"
            checked={draft.trackStock}
            onChange={(v) => set({ trackStock: v })}
            label="Llevar existencias"
            hint={draft.trackStock ? 'Se descuentan al vender; en 0 deja de salir en la web' : 'Sin contar unidades'}
          />
          {draft.trackStock && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3.5 py-2">
              <label htmlFor="prod-stock" className="text-[14.5px] font-bold">Unidades</label>
              <div className="flex items-center gap-1.5">
                <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Una menos" onClick={() => set({ stock: String(Math.max(0, (Number(draft.stock) || 0) - 1)) })}>
                  <Minus />
                </Button>
                <Input
                  id="prod-stock"
                  inputMode="numeric"
                  value={draft.stock}
                  onChange={(e) => set({ stock: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  className="tabular h-11 w-16 text-center text-[16px] font-bold"
                />
                <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Una más" onClick={() => set({ stock: String(Math.min(9999, (Number(draft.stock) || 0) + 1)) })}>
                  <Plus />
                </Button>
              </div>
            </div>
          )}

          <div className="mt-1 grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={busy}>
              {saving ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
              Guardar
            </Button>
          </div>
          {producto && (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={remove}
              disabled={saving}
              className={cn('text-destructive hover:bg-destructive/10 hover:text-destructive', confirmDelete && 'bg-destructive/10')}
            >
              <Trash2 data-icon="inline-start" />
              {confirmDelete ? 'Toca otra vez para borrarlo' : 'Borrar del catálogo'}
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}

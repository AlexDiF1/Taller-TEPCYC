/**
 * Catálogo de productos: lo que se vende en el local (Ventas) y en la tienda de la web.
 */

export type ProductCategory = 'nuevas' | 'usadas' | 'controles' | 'accesorios'

export interface Producto {
  id: number
  name: string
  category: ProductCategory
  description?: string
  price: number
  cost: number
  photoUrl?: string
  /** Se muestra en la web y se puede elegir en Ventas. */
  available: boolean
  /** null = no se llevan existencias; número = se descuenta al vender. */
  stock: number | null
  createdAt: string
  updatedAt: string
}

export interface ProductoInput {
  name: string
  category: ProductCategory
  description?: string
  price: number
  cost?: number
  photoUrl?: string
  available?: boolean
  stock?: number | null
}

export const CATEGORIES: { value: ProductCategory; label: string; short: string }[] = [
  { value: 'nuevas', label: 'Consolas nuevas', short: 'Nuevas' },
  { value: 'usadas', label: 'Consolas usadas', short: 'Usadas' },
  { value: 'controles', label: 'Controles', short: 'Controles' },
  { value: 'accesorios', label: 'Accesorios', short: 'Accesorios' },
]

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c])) as Record<
  ProductCategory,
  (typeof CATEGORIES)[number]
>

/** ¿Se puede vender ahora? (disponible y con existencias, o sin control de existencias). */
export function inStock(p: Producto) {
  return p.available && (p.stock === null || p.stock > 0)
}

export const PRODUCTOS_URL = '/api/productos'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const body = (await response.json()) as { error?: string }
      if (body?.error) detail = body.error
    } catch {
      /* respuesta sin JSON */
    }
    throw new Error(detail)
  }
  return (await response.json()) as T
}

export function listProductos() {
  return request<Producto[]>(PRODUCTOS_URL)
}

export function createProducto(input: ProductoInput) {
  return request<Producto>(PRODUCTOS_URL, { method: 'POST', body: JSON.stringify(input) })
}

export function updateProducto(id: number, patch: Partial<ProductoInput>) {
  return request<Producto>(`${PRODUCTOS_URL}/${id}`, { method: 'PUT', body: JSON.stringify(patch) })
}

export async function deleteProducto(id: number) {
  await request<{ ok: boolean }>(`${PRODUCTOS_URL}/${id}`, { method: 'DELETE' })
}

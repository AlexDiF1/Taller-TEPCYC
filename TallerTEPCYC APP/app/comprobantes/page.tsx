import { redirect } from 'next/navigation'

/**
 * Los comprobantes ahora viven dentro de cada orden (/orden/[id]).
 * Esta ruta se conserva para que los enlaces viejos sigan funcionando.
 */
export default async function ComprobantesPage({
  searchParams,
}: {
  searchParams: Promise<{ orden?: string; tipo?: string }>
}) {
  const { orden, tipo } = await searchParams
  if (!orden) redirect('/')
  const recibo = tipo === 'entrega' ? 'entrega' : 'recepcion'
  redirect(`/orden/${encodeURIComponent(orden)}?recibo=${recibo}`)
}

import { NextResponse } from 'next/server'
import { getOrder, updateOrderItems, updateOrderStatus } from '@/lib/orders-firestore'
import { ORDER_STATUSES } from '@/lib/orders-firestore'
import type { OrderStatus, ServiceItem } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function fail(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[api/orders/:id]', message)
  return NextResponse.json({ error: message }, { status })
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const order = await getOrder(id)
    if (!order) return NextResponse.json({ error: 'Orden no encontrada.' }, { status: 404 })
    return NextResponse.json(order)
  } catch (error) {
    return fail(error)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await request.json()) as { status?: OrderStatus; items?: ServiceItem[] }

    if (body.status) {
      if (!ORDER_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: `Estado inválido: ${body.status}` }, { status: 400 })
      }
      return NextResponse.json(await updateOrderStatus(id, body.status))
    }

    if (Array.isArray(body.items)) {
      return NextResponse.json(await updateOrderItems(id, body.items))
    }

    return NextResponse.json({ error: 'Nada que actualizar.' }, { status: 400 })
  } catch (error) {
    return fail(error)
  }
}

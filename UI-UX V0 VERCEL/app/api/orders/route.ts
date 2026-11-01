import { NextResponse } from 'next/server'
import { createOrder, listOrders } from '@/lib/orders-firestore'
import type { NewOrderInput } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function fail(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[api/orders]', message)
  return NextResponse.json({ error: message }, { status })
}

export async function GET() {
  try {
    return NextResponse.json(await listOrders())
  } catch (error) {
    return fail(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as NewOrderInput
    if (!body?.customer?.name || !body?.device?.model) {
      return NextResponse.json({ error: 'Faltan datos del cliente o del equipo.' }, { status: 400 })
    }
    return NextResponse.json(await createOrder(body), { status: 201 })
  } catch (error) {
    return fail(error)
  }
}

import { Suspense } from 'react'
import type { Metadata } from 'next'
import { OrderPage } from '@/components/orders/order-page'

export const metadata: Metadata = {
  title: 'Orden · TEPCYC',
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense>
      <OrderPage id={decodeURIComponent(id)} />
    </Suspense>
  )
}

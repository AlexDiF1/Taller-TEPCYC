import { Suspense } from 'react'
import { OrdersDashboard } from '@/components/orders/orders-dashboard'

export default function Page() {
  return (
    <Suspense>
      <OrdersDashboard />
    </Suspense>
  )
}

import type { Metadata } from 'next'
import { IntakeForm } from '@/components/intake/intake-form'

export const metadata: Metadata = {
  title: 'Nuevo ingreso · TODOENPCYCONSOLAS',
}

export default function IngresoPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <IntakeForm />
    </div>
  )
}

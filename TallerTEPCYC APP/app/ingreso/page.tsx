import type { Metadata } from 'next'
import { IntakeForm } from '@/components/intake/intake-form'

export const metadata: Metadata = {
  title: 'Nuevo ingreso · TEPCYC',
}

export default function IngresoPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pt-4 pb-24 md:px-8 md:py-8 xl:pb-8">
      <div className="hidden lg:block">
        <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-primary">Taller</p>
        <h1 className="mt-1 text-[32px] font-extrabold tracking-tight">Nuevo ingreso</h1>
      </div>
      <IntakeForm />
    </div>
  )
}

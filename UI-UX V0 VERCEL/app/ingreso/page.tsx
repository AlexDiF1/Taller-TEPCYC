import type { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'
import { IntakeForm } from '@/components/intake/intake-form'

export const metadata: Metadata = {
  title: 'Nuevo ingreso · TODOENPCYCONSOLAS',
}

export default function IngresoPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 md:px-8 md:py-10">
      <PageHeader
        eyebrow="Recepción de equipo"
        title="Nuevo ingreso"
        description="Registra al cliente, el equipo, la falla y el estado físico con fotos antes de pasarlo al banco de trabajo."
      />
      <IntakeForm />
    </div>
  )
}

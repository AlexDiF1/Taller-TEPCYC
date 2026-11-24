import type { Metadata } from 'next'
import { IntakeForm } from '@/components/intake/intake-form'

export const metadata: Metadata = {
  title: 'Nuevo ingreso · TEPCYC',
}

export default async function IngresoPage({ searchParams }: { searchParams: Promise<{ solicitud?: string | string[] }> }) {
  // «Convertir en orden» desde la bandeja: /ingreso?solicitud=12
  const { solicitud } = await searchParams
  const raw = Array.isArray(solicitud) ? solicitud[0] : solicitud
  const solicitudId = raw && /^[1-9]\d{0,8}$/.test(raw) ? Number(raw) : undefined

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pt-4 pb-24 md:px-8 md:py-8 xl:pb-8">
      <div className="hidden lg:block">
        <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-primary">Taller</p>
        <h1 className="mt-1 text-[32px] font-extrabold tracking-tight">Nuevo ingreso</h1>
      </div>
      <IntakeForm key={solicitudId ?? 'nuevo'} solicitudId={solicitudId} />
    </div>
  )
}

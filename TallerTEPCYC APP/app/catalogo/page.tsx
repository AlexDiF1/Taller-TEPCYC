import { CatalogoDashboard } from '@/components/catalogo/catalogo-dashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Catálogo · TEPCYC',
}

export default function CatalogoPage() {
  return <CatalogoDashboard />
}

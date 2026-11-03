import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TODOENPCYCONSOLAS · Taller de reparación',
    short_name: 'TEPCYC',
    description:
      'Gestión de órdenes de servicio técnico para consolas, controles y accesorios: ingreso con fotos, seguimiento, WhatsApp y comprobantes.',
    lang: 'es',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#16171d',
    theme_color: '#16171d',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

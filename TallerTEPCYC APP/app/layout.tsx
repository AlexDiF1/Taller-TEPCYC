import type { Metadata, Viewport } from 'next'
import { Archivo, Bebas_Neue } from 'next/font/google'
import { Toaster } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { ServiceWorkerRegister } from '@/components/service-worker-register'
import './globals.css'

const archivo = Archivo({ subsets: ['latin'], variable: '--font-archivo', display: 'swap' })
const bebas = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--font-bebas', display: 'swap' })

export const metadata: Metadata = {
  title: 'TEPCYC · Taller',
  description:
    'Gestión de órdenes de servicio técnico para consolas, controles y accesorios: ingreso con fotos, seguimiento, WhatsApp y comprobantes.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'TEPCYC',
    statusBarStyle: 'default',
  },
  applicationName: 'TEPCYC',
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f2f1' },
    { media: '(prefers-color-scheme: dark)', color: '#121010' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${archivo.variable} ${bebas.variable} bg-background`}>
      <body className="antialiased">
        <AppShell>{children}</AppShell>
        <Toaster theme="system" position="top-center" richColors closeButton offset={16} mobileOffset={12} />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // El servidor de desarrollo se consume por el túnel público (taller.tepcyc.com)
  // y por IP, así que hay que autorizar esos orígenes para que carguen los recursos dev.
  allowedDevOrigins: ['localhost', '127.0.0.1', 'taller.tepcyc.com'],
  // El HTML va prerenderizado y tanto el navegador como los proxies intermedios
  // lo retienen: sin cabeceras de revalidación un despliegue tarda en verse.
  // Se fuerza la revalidación en cada navegación (los assets de /_next/ quedan intactos).
  async headers() {
    return [
      {
        source: '/((?!_next/).*)',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ]
  },
}

export default nextConfig

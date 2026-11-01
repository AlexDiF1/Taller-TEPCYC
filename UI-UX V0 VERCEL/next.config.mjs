/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // El servidor de desarrollo se consume por el túnel de Cloudflare y por IP,
  // así que hay que autorizar esos orígenes para que carguen los recursos dev.
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    'profiles-textbooks-innocent-souls.trycloudflare.com',
    '*.trycloudflare.com',
  ],
}

export default nextConfig

/**
 * Servidor único del taller: Express sirve /api, /uploads y delega el resto
 * a Next.js (frontend compilado). Escucha en el puerto 3005.
 */
import './env.mjs'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import express from 'express'
import next from 'next'
import { api, uploadsDir } from './api.mjs'
import { authApi, gate, authEnabled, readSession } from './auth.mjs'
import { projectDir } from './db.mjs'
import { startWhatsapp } from './whatsapp.mjs'

const port = Number(process.env.PORT ?? 3005)
const hostname = process.env.HOST ?? '0.0.0.0'
const dev = process.env.NODE_ENV === 'development'
const jsonLimit = process.env.JSON_LIMIT ?? '20mb'

if (!dev && !existsSync(join(projectDir, '.next', 'BUILD_ID'))) {
  console.error('[server] Falta el build de Next. Ejecuta `pnpm build` antes de arrancar en producción.')
  process.exit(1)
}

const app = express()
app.disable('x-powered-by')
app.use((_req, res, nextBinary) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  nextBinary()
})
app.use(express.json({ limit: jsonLimit }))
app.use('/api/auth', authApi)
// Portero propio: sesión de Google para toda la app y la API (si está configurado).
app.use(gate)
app.use('/api', api)
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d', fallthrough: true }))

// Error de API sin capturar → JSON 500 (nunca el HTML con la traza de Express).
app.use('/api', (error, _req, res, _next) => {
  console.error('[api] error no controlado:', error?.stack ?? error)
  if (res.headersSent) return
  res.status(error?.status && error.status >= 400 && error.status < 600 ? error.status : 500).json({
    error: error?.message ?? 'Error interno del servidor.',
  })
})

const nextApp = next({ dev, dir: projectDir, hostname, port })
const handle = nextApp.getRequestHandler()
await nextApp.prepare()

app.use((req, res) => handle(req, res))

const server = app.listen(port, hostname, () => {
  console.log(`[server] Taller TEPCYC escuchando en http://${hostname}:${port} (${dev ? 'dev' : 'producción'})`)
  console.log(`[server] acceso con Google: ${authEnabled ? 'activo' : 'sin configurar (app abierta)'}`)
  // WhatsApp arranca después de levantar el servidor: si falla, la app sigue viva.
  startWhatsapp()
    .then((status) => console.log(`[whatsapp] estado inicial: ${status.status}`))
    .catch((error) => console.error('[whatsapp] no se pudo iniciar:', error?.message ?? error))
})

server.on('error', (error) => {
  console.error(`[server] no se pudo escuchar en ${hostname}:${port}:`, error?.message ?? error)
  process.exit(1)
})

// Red de seguridad: un fallo suelto no debe tumbar el taller.
process.on('unhandledRejection', (reason) => {
  console.error('[server] promesa rechazada sin capturar:', reason?.stack ?? reason)
})

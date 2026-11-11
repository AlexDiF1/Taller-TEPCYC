/**
 * Login propio del taller con Google, sin depender del panel de Cloudflare.
 *
 * Flujo: la pantalla /login pide un ID token a Google Identity Services y lo
 * manda a `POST /api/auth/google`; aquí se valida (audiencia, correo permitido
 * y caducidad) y se emite una cookie de sesión firmada con HMAC.
 *
 * El portero (`gate`) solo se activa cuando hay GOOGLE_CLIENT_ID y AUTH_SECRET:
 * sin configurar, la app sigue abierta (y detrás de Cloudflare Access) para no
 * dejar al taller sin entrar por un despliegue a medias.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'

export const COOKIE = 'tepcyc_sesion'
const SESSION_DAYS = 7
const COOKIE_MAX_AGE = SESSION_DAYS * 24 * 60 * 60

export const clientId = (process.env.GOOGLE_CLIENT_ID ?? '').trim()
const sessionSecret = (process.env.AUTH_SECRET ?? '').trim()
const allowedEmails = (process.env.AUTH_ALLOWED_EMAILS ?? 'alexitodafa@gmail.com')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

export const authEnabled = Boolean(clientId && sessionSecret)

// Diagnóstico al arrancar: deja en el log quién puede entrar.
if (authEnabled) console.log(`[auth] acceso con Google activo · correos permitidos: ${allowedEmails.join(', ')}`)

function base64url(input) {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function sign(body) {
  return createHmac('sha256', sessionSecret).update(body).digest('base64url')
}

function parseCookies(header) {
  const out = {}
  for (const part of String(header ?? '').split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim())
  }
  return out
}

/** Devuelve el correo de la sesión válida, o null. */
export function readSession(req) {
  if (!authEnabled) return null
  const raw = parseCookies(req.headers?.cookie)[COOKIE]
  if (!raw) return null
  const [body, signature] = String(raw).split('.')
  if (!body || !signature) return null
  const expected = sign(body)
  if (expected.length !== signature.length) return null
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload?.email || !allowedEmails.includes(String(payload.email).toLowerCase())) return null
    if (!Number.isFinite(payload.exp) || payload.exp < Date.now()) return null
    return String(payload.email)
  } catch {
    return null
  }
}

function sessionCookie(email) {
  const payload = { email, exp: Date.now() + COOKIE_MAX_AGE * 1000 }
  const body = base64url(JSON.stringify(payload))
  return `${COOKIE}=${encodeURIComponent(`${body}.${sign(body)}`)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}; Secure`
}

/** Valida el ID token de Google contra la audiencia configurada. */
export async function verifyGoogleCredential(credential) {
  if (!clientId) throw new Error('Falta GOOGLE_CLIENT_ID en el servidor.')
  const token = String(credential ?? '').trim()
  if (!token) return null
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`)
  if (!response.ok) return null
  const info = await response.json()
  if (info.aud !== clientId) return null
  if (String(info.email_verified) !== 'true') return null
  if (Number(info.exp) * 1000 < Date.now()) return null
  const email = String(info.email ?? '').toLowerCase()
  if (!allowedEmails.includes(email)) return null
  return email
}

/** Rutas de sesión: se montan antes del portero. */
export const authApi = Router()

authApi.get('/config', (_req, res) => {
  res.json({ enabled: authEnabled, clientId: clientId || null })
})

authApi.get('/me', (req, res) => {
  const email = readSession(req)
  res.json({ email, enabled: authEnabled })
})

authApi.post('/google', async (req, res) => {
  if (!authEnabled) return res.status(503).json({ error: 'El acceso con Google aún no está configurado.' })
  try {
    const email = await verifyGoogleCredential(req.body?.credential)
    if (!email) {
      return res.status(401).json({ error: 'Ese correo no tiene acceso al taller.' })
    }
    res.setHeader('Set-Cookie', sessionCookie(email))
    res.json({ ok: true, email })
  } catch (error) {
    res.status(500).json({ error: error?.message ?? 'No se pudo validar el acceso.' })
  }
})

authApi.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`)
  res.json({ ok: true })
})

const PUBLIC_PREFIXES = [
  '/_next/',
  '/icons/',
  '/fonts/',
  '/api/auth',
  '/api/public',
  '/login',
  '/manifest.webmanifest',
  '/robots.txt',
  '/sitemap.xml',
  '/sw.js',
  '/favicon',
  '/icon-',
  '/apple-icon',
]

function isPublic(pathname) {
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true
  return /\.[a-z0-9]{2,5}$/i.test(pathname)
}

/** Portero: API sin sesión → 401 JSON; página sin sesión → /login. */
export function gate(req, res, next) {
  if (!authEnabled) return next()
  const pathname = String(req.path ?? '/')
  if (isPublic(pathname)) return next()
  if (readSession(req)) return next()
  if (pathname.startsWith('/api/')) {
    return res.status(401).json({ error: 'Sesión no válida. Vuelve a entrar con Google.' })
  }
  const next_ = encodeURIComponent(req.originalUrl || '/')
  return res.redirect(302, `/login?next=${next_}`)
}

/**
 * Servicio de WhatsApp del taller (Baileys, sin Docker).
 *
 * - Un único socket para todo el servidor, con la sesión guardada en
 *   `data/whatsapp-auth` (useMultiFileAuthState) para que PM2 pueda reiniciar
 *   sin perder la vinculación.
 * - Reconexión automática en `connection.update`, salvo cuando WhatsApp
 *   responde `loggedOut` (ahí se borra la sesión y se pide un QR nuevo).
 * - Envío "humano": subscribe + "escribiendo…" + pausa aleatoria + envío, más
 *   una cola con separación mínima y tope por hora para no parecer un bot.
 */
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { randomInt } from 'node:crypto'
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import QRCode from 'qrcode'
import * as store from './db.mjs'
import { formatPhone, toJid } from './phone.mjs'

const logger = pino({ level: process.env.WA_LOG_LEVEL ?? 'warn' })

export const authDir = process.env.WA_AUTH_DIR ?? join(store.dataDir, 'whatsapp-auth')
const STORIES_JID = 'status@broadcast'

/** Separación mínima entre mensajes directos (ms). */
const MIN_GAP_MS = Number(process.env.WA_MIN_GAP_MS ?? 4000)
/** Tope de mensajes por hora (protección anti-bloqueo). */
const MAX_PER_HOUR = Number(process.env.WA_MAX_PER_HOUR ?? 100)
/** Tope de estados publicados por día (los estados también pueden reportarse como spam). */
const MAX_STATUS_PER_DAY = Number(process.env.WA_MAX_STATUS_DAY ?? 25)
const TYPING_MIN_MS = Number(process.env.WA_TYPING_MIN_MS ?? 2000)
const TYPING_MAX_MS = Number(process.env.WA_TYPING_MAX_MS ?? 3500)
const STATUS_SYNC_MS = 10 * 60 * 1000
const ESTADOS_TICK_MS = 20 * 1000

const state = {
  status: 'starting', // starting | connecting | qr | connected | logged_out | error
  qr: null,
  qrUpdatedAt: null,
  me: null,
  lastError: null,
  updatedAt: new Date().toISOString(),
  reconnects: 0,
  sentTotal: 0,
  sentErrors: 0,
  events: [],
}

let sock = null
let starting = false
let reconnectTimer = null
let attempts = 0
let manualClose = false
let sendChain = Promise.resolve()
let lastSendAt = 0
let sendLog = []
let timersStarted = false

function nowIso() {
  return new Date().toISOString()
}

function setStatus(status) {
  state.status = status
  state.updatedAt = nowIso()
}

function pushEvent(event, detail) {
  state.events.unshift({ at: nowIso(), event, detail: detail ?? null })
  state.events = state.events.slice(0, 40)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isConnected() {
  return state.status === 'connected' && Boolean(sock)
}

export function getStatus() {
  const me = state.me
  return {
    status: state.status,
    connected: isConnected(),
    qr: state.status === 'qr' ? state.qr : null,
    qrUpdatedAt: state.qrUpdatedAt,
    me: me
      ? {
          id: me.id ?? null,
          phone: me.id ? String(me.id).split(':')[0].split('@')[0] : null,
          display: me.id ? formatPhone(String(me.id).split(':')[0].split('@')[0]) : null,
          name: me.name ?? me.verifiedName ?? null,
        }
      : null,
    lastError: state.lastError,
    updatedAt: state.updatedAt,
    reconnects: state.reconnects,
    sentTotal: state.sentTotal,
    sentErrors: state.sentErrors,
    contacts: store.countWhatsappContacts(),
    pendientes: store.listEstados(60).filter((e) => e.status === 'pendiente').length,
    events: state.events.slice(0, 12),
    limits: { minGapMs: MIN_GAP_MS, maxPerHour: MAX_PER_HOUR },
  }
}

/* ------------------------------- conexión -------------------------------- */

function scheduleReconnect(delay) {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  const wait = delay ?? Math.min(30000, 2000 * Math.max(1, ++attempts))
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    void startSocket()
  }, wait)
}

function clearAuth() {
  try {
    rmSync(authDir, { recursive: true, force: true })
  } catch {
    /* sin permisos: se ignora */
  }
  mkdirSync(authDir, { recursive: true })
}

function wireEvents(socket, saveCreds) {
  socket.ev.on('creds.update', saveCreds)

  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      try {
        state.qr = await QRCode.toDataURL(qr, {
          margin: 1,
          width: 340,
          color: { dark: '#101014', light: '#ffffffff' },
        })
        state.qrUpdatedAt = nowIso()
        setStatus('qr')
        pushEvent('qr generado')
      } catch (error) {
        state.lastError = `No se pudo generar el QR: ${error.message}`
      }
    }

    if (connection === 'connecting') {
      if (state.status !== 'qr') setStatus('connecting')
    }

    if (connection === 'open') {
      attempts = 0
      state.me = socket.user ?? null
      state.qr = null
      state.lastError = null
      setStatus('connected')
      pushEvent('conectado', state.me?.id ?? null)
      void store.syncWhatsappContacts()
    }

    if (connection === 'close') {
      // Un cierre provocado por "Reiniciar" o "Cerrar sesión" ya tiene su
      // propia reconexión: no se duplica el socket.
      if (manualClose) {
        pushEvent('conexión cerrada a mano')
        return
      }
      const code = lastDisconnect?.error?.output?.statusCode ?? lastDisconnect?.error?.status
      const reason = lastDisconnect?.error?.message
      state.lastError = reason ?? (code ? `código ${code}` : null)
      pushEvent('desconectado', `código ${code ?? 'desconocido'}`)

      if (code === DisconnectReason.loggedOut || code === DisconnectReason.badSession) {
        // La sesión ya no sirve: hay que volver a escanear el QR.
        state.me = null
        state.qr = null
        setStatus('logged_out')
        clearAuth()
        state.reconnects += 1
        sock = null
        scheduleReconnect(2000)
        return
      }

      state.reconnects += 1
      setStatus('connecting')
      scheduleReconnect()
    }
  })

  // Contactos con los que se interactúa: alimentan el statusJidList.
  socket.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return
    for (const message of messages ?? []) {
      const jid = message?.key?.remoteJid
      if (!jid || message.key?.fromMe) continue
      if (jid === STORIES_JID || jid.endsWith('@g.us') || jid.endsWith('@broadcast')) continue
      store.upsertWhatsappContact({
        phone: jid.split('@')[0].split(':')[0],
        name: message.pushName,
        source: 'chat',
      })
    }
  })

  socket.ev.on('contacts.upsert', (contacts) => {
    for (const contact of contacts ?? []) {
      if (!contact?.id?.endsWith('@s.whatsapp.net')) continue
      store.upsertWhatsappContact({
        phone: contact.id.split('@')[0],
        name: contact.name || contact.notify || contact.verifiedName,
        source: 'chat',
      })
    }
  })
}

async function startSocket() {
  if (starting) return
  // Ya hay un socket vivo (conectado o mostrando QR): no se duplica.
  if (sock && (isConnected() || state.status === 'qr')) return
  starting = true
  try {
    const { state: authState, saveCreds } = await useMultiFileAuthState(authDir)
    let version
    try {
      ;({ version } = await fetchLatestBaileysVersion())
    } catch {
      version = undefined
    }

    sock = makeWASocket({
      auth: authState,
      version,
      logger,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60_000,
      keepAliveIntervalMs: 25_000,
      retryRequestDelayMs: 800,
    })

    wireEvents(sock, saveCreds)
    if (!authState.creds.registered) setStatus('connecting')
  } catch (error) {
    state.lastError = error?.message ?? String(error)
    pushEvent('error al iniciar', state.lastError)
    setStatus('error')
    scheduleReconnect(6000)
  } finally {
    starting = false
  }
}

function requireSocket() {
  if (!isConnected()) {
    const error = new Error('WhatsApp no está conectado.')
    error.code = 'WA_OFFLINE'
    throw error
  }
  return sock
}

/* ------------------------------- anti-bloqueo ---------------------------- */

function enqueue(job) {
  const run = sendChain.then(job, job)
  sendChain = run.catch(() => {})
  return run
}

async function waitForTurn() {
  const now = Date.now()
  const hourAgo = now - 3_600_000
  sendLog = sendLog.filter((at) => at > hourAgo)
  if (sendLog.length >= MAX_PER_HOUR) {
    const error = new Error(
      `Protección anti-bloqueo: ya se enviaron ${MAX_PER_HOUR} mensajes en la última hora. Intenta más tarde.`,
    )
    error.code = 'WA_RATE_LIMIT'
    throw error
  }
  const wait = Math.max(0, lastSendAt + MIN_GAP_MS + randomInt(0, 1500) - now)
  if (wait > 0) await sleep(wait)
}

/** Marca el mensaje como enviado para el tope por hora. */
function markSent() {
  lastSendAt = Date.now()
  sendLog.push(lastSendAt)
  state.sentTotal += 1
}

/**
 * Envío con comportamiento humano: subscribe → "escribiendo…" → pausa
 * aleatoria de 2 a 3,5 s → "pausado" → mensaje real.
 */
async function humanSend(jid, content, options = {}) {
  return enqueue(async () => {
    const active = requireSocket()
    await waitForTurn()
    try {
      await active.presenceSubscribe(jid)
      await active.sendPresenceUpdate('composing', jid)
    } catch {
      /* la presencia es best-effort */
    }
    await sleep(randomInt(TYPING_MIN_MS, TYPING_MAX_MS))
    try {
      await active.sendPresenceUpdate('paused', jid)
    } catch {
      /* idem */
    }
    try {
      const result = await active.sendMessage(jid, content, options)
      markSent()
      return result
    } catch (error) {
      state.sentErrors += 1
      throw error
    }
  })
}

/* --------------------------------- envíos -------------------------------- */

/** Texto directo a un cliente. */
export async function sendText(phone, text, options = {}) {
  const jid = toJid(phone)
  if (!jid) throw Object.assign(new Error('Número de teléfono inválido.'), { code: 'WA_BAD_PHONE' })
  if (!String(text ?? '').trim()) throw new Error('El mensaje está vacío.')
  return humanSend(jid, { text: String(text) }, options)
}

/** Imagen (ruta local o URL) con caption opcional. */
export async function sendImage(phone, { path, caption } = {}) {
  const jid = toJid(phone)
  if (!jid) throw Object.assign(new Error('Número de teléfono inválido.'), { code: 'WA_BAD_PHONE' })
  if (!path) throw new Error('Falta la imagen.')
  const media = existsSync(path) ? readFileSync(path) : { url: path }
  return humanSend(jid, { image: media, caption: caption ? String(caption) : undefined })
}

/** Documento (por ejemplo el PDF del comprobante) con caption opcional. */
export async function sendDocument(phone, { path, buffer, fileName, mimetype, caption } = {}) {
  const jid = toJid(phone)
  if (!jid) throw Object.assign(new Error('Número de teléfono inválido.'), { code: 'WA_BAD_PHONE' })
  const data = buffer ?? (path && existsSync(path) ? readFileSync(path) : null)
  if (!data) throw new Error('Falta el documento a enviar.')
  return humanSend(jid, {
    document: data,
    fileName: fileName || 'documento.pdf',
    mimetype: mimetype || 'application/pdf',
    caption: caption ? String(caption) : undefined,
  })
}

/** Mensaje de estado de la orden + sus fotos (máximo 3 para no parecer spam). */
export async function sendOrderUpdate({ phone, message, photos = [], maxPhotos = 3 } = {}) {
  const sent = []
  const first = await sendText(phone, message)
  sent.push(first?.key?.id ?? null)

  const list = photos.slice(0, maxPhotos).map((photo) => (typeof photo === 'string' ? photo : photo?.url)).filter(Boolean)
  for (const [index, photo] of list.entries()) {
    try {
      const absolute = photo.startsWith('/uploads/') ? join(store.projectDir, photo) : photo
      await sendImage(phone, {
        path: absolute,
        caption: index === 0 ? 'Registro fotográfico del equipo 📸' : undefined,
      })
      sent.push('foto')
    } catch (error) {
      pushEvent('foto fallida', error?.message ?? String(error))
    }
  }
  return { sent: sent.length, photos: list.length }
}

/**
 * Publica una historia (status@broadcast). `statusJidList` son los JIDs de los
 * contactos sincronizados; sin ellos el estado solo lo vería la propia cuenta.
 */
export async function publishEstado({ text, caption, mediaPath, mediaType, backgroundColor, font = 1 } = {}) {
  const jids = store
    .statusJidPhones()
    .map((phone) => toJid(phone))
    .filter((jid) => Boolean(jid))

  const title = caption?.trim() || text?.trim() || ''
  if (!title && !mediaPath) throw new Error('El estado necesita un texto o una imagen/video.')

  const today = new Date().toISOString().slice(0, 10)
  const publicadosHoy = store
    .listEstados(200)
    .filter((estado) => estado.status === 'publicado' && (estado.sentAt ?? '').startsWith(today)).length
  if (publicadosHoy >= MAX_STATUS_PER_DAY) {
    const error = new Error(
      `Protección anti-bloqueo: ya se publicaron ${MAX_STATUS_PER_DAY} estados hoy. Intenta mañana.`,
    )
    error.code = 'WA_RATE_LIMIT'
    throw error
  }

  return enqueue(async () => {
    const active = requireSocket()
    await waitForTurn()
    const options = { statusJidList: jids, backgroundColor: backgroundColor || '#101014', font }
    let content
    if (mediaPath) {
      const buffer = readFileSync(mediaPath)
      content =
        mediaType === 'video'
          ? { video: buffer, caption: caption?.trim() || undefined, mimetype: 'video/mp4' }
          : { image: buffer, caption: caption?.trim() || undefined }
    } else {
      content = { text: title }
    }
    try {
      const result = await active.sendMessage(STORIES_JID, content, options)
      markSent()
      return { id: result?.key?.id ?? null, audience: jids.length }
    } catch (error) {
      state.sentErrors += 1
      throw error
    }
  })
}

/** Botón "Reiniciar conexión": mantiene la sesión y vuelve a conectar. */
export async function restartSession() {
  pushEvent('reinicio manual')
  state.lastError = null
  setStatus('connecting')
  manualClose = true
  try {
    await sock?.end?.(new Error('reinicio manual'))
  } catch {
    /* ignorado */
  }
  sock = null
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  await sleep(500)
  try {
    await startSocket()
  } finally {
    manualClose = false
  }
  return getStatus()
}

/** Botón "Cerrar sesión": borra las credenciales y pide un QR nuevo. */
export async function logoutSession() {
  pushEvent('cerrar sesión')
  manualClose = true
  try {
    await sock?.logout?.()
  } catch {
    /* si ya estaba caído, igual se borra la sesión */
  }
  try {
    await sock?.end?.(new Error('logout'))
  } catch {
    /* ignorado */
  }
  sock = null
  state.me = null
  state.qr = null
  clearAuth()
  setStatus('logged_out')
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  await sleep(800)
  try {
    await startSocket()
  } finally {
    manualClose = false
  }
  return getStatus()
}

/* ------------------------------ programación ----------------------------- */

async function tickEstados() {
  if (!isConnected()) return
  for (const estado of store.pendingEstados(nowIso(), 2)) {
    try {
      const mediaPath = estado.mediaUrl?.startsWith('/uploads/')
        ? join(store.projectDir, estado.mediaUrl)
        : estado.mediaUrl
      await publishEstado({
        text: estado.text,
        caption: estado.caption,
        mediaPath: mediaPath && existsSync(mediaPath) ? mediaPath : undefined,
        mediaType: estado.mediaType,
        backgroundColor: estado.backgroundColor,
      })
      store.markEstado(estado.id, 'publicado')
      pushEvent('estado publicado', `#${estado.id}`)
    } catch (error) {
      store.markEstado(estado.id, 'error', error?.message ?? String(error))
      pushEvent('estado fallido', `#${estado.id}: ${error?.message ?? error}`)
    }
  }
}

/** Arranca el socket y los temporizadores (idempotente). */
export async function startWhatsapp() {
  store.syncWhatsappContacts()
  await startSocket()
  if (!timersStarted) {
    timersStarted = true
    setInterval(() => {
      void tickEstados()
    }, ESTADOS_TICK_MS).unref?.()
    setInterval(
      () => {
        try {
          store.syncWhatsappContacts()
        } catch (error) {
          pushEvent('sincronización fallida', error?.message ?? String(error))
        }
      },
      STATUS_SYNC_MS,
    ).unref?.()
  }
  return getStatus()
}

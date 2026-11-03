/**
 * Servicio de WhatsApp del taller (Baileys, sin Docker).
 *
 * Conexión
 * - Un único socket para todo el servidor; la sesión vive en
 *   `data/whatsapp-auth` (useMultiFileAuthState) y se respalda a diario en
 *   `data/whatsapp-auth-backup`, porque tener que volver a vincular es el
 *   disparador de bloqueo más común.
 * - Reconexión automática con backoff en `connection.update`, salvo
 *   `loggedOut`/`badSession`, que exigen un QR nuevo.
 *
 * Protecciones anti-bloqueo (comportamiento humano)
 * - Envío: presenceSubscribe → "escribiendo…" (duración proporcional al texto)
 *   → pausa aleatoria → "pausado" → mensaje real.
 * - Cola serial, separación mínima aleatoria, topes por hora y por día, y
 *   límites más estrictos durante el "calentamiento" de una cuenta recién
 *   vinculada.
 * - Ventana de gracia tras conectar (nadie escribe en el segundo 1).
 * - Guarda contra envíos masivos: el mismo texto a demasiados números distintos
 *   en poco tiempo se bloquea.
 * - Enfriamiento automático cuando WhatsApp avisa que se va muy rápido
 *   (rate-overlimit, 429, 463/reachout timelock, cortes raros).
 * - Estados: pocos al día y bien separados, como los publica una persona.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { createHash, randomInt } from 'node:crypto'
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
const backupDir = process.env.WA_AUTH_BACKUP_DIR ?? join(store.dataDir, 'whatsapp-auth-backup')
const STORIES_JID = 'status@broadcast'

function envNumber(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

/**
 * Todos los tiempos y topes son configurables por variables de entorno: si
 * WhatsApp se pone quisquilloso se suben los tiempos sin tocar código.
 */
const CONFIG = {
  minGapMs: envNumber('WA_MIN_GAP_MS', 6000),
  maxPerHour: envNumber('WA_MAX_PER_HOUR', 60),
  maxPerDay: envNumber('WA_MAX_PER_DAY', 300),
  maxStatusPerDay: envNumber('WA_MAX_STATUS_DAY', 12),
  statusMinGapMs: envNumber('WA_STATUS_MIN_GAP_MS', 20 * 60 * 1000),
  typingMinMs: envNumber('WA_TYPING_MIN_MS', 2000),
  typingMaxMs: envNumber('WA_TYPING_MAX_MS', 3500),
  typingPerCharMs: envNumber('WA_TYPING_PER_CHAR_MS', 45),
  typingCapMs: envNumber('WA_TYPING_CAP_MS', 9000),
  warmupDays: envNumber('WA_WARMUP_DAYS', 7),
  warmupFactor: envNumber('WA_WARMUP_FACTOR', 3),
  graceAfterConnectMs: envNumber('WA_GRACE_AFTER_CONNECT_MS', 60 * 1000),
  graceFirstPairingMs: envNumber('WA_GRACE_FIRST_PAIRING_MS', 5 * 60 * 1000),
  duplicateWindowMs: envNumber('WA_DUPLICATE_WINDOW_MS', 10 * 60 * 1000),
  duplicateMaxTargets: envNumber('WA_DUPLICATE_MAX_TARGETS', 8),
  cooldownStartMs: envNumber('WA_COOLDOWN_START_MS', 5 * 60 * 1000),
  cooldownMaxMs: envNumber('WA_COOLDOWN_MAX_MS', 60 * 60 * 1000),
  reconnectMinMs: envNumber('WA_RECONNECT_MIN_MS', 5000),
  reconnectMaxMs: envNumber('WA_RECONNECT_MAX_MS', 5 * 60 * 1000),
  auditDays: envNumber('WA_AUDIT_DAYS', 30),
}

const STATUS_SYNC_MS = 10 * 60 * 1000
const ESTADOS_TICK_MS = 20 * 1000
const BACKUP_MS = 24 * 60 * 60 * 1000

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
  cooldownUntil: null,
  cooldownReason: null,
  cooldownLevel: 0,
  readyAt: null,
  warmupUntil: null,
  guardTrips: 0,
  events: [],
}

let sock = null
let starting = false
let reconnectTimer = null
let attempts = 0
let manualClose = false
let sendChain = Promise.resolve()
let lastSendAt = 0
let lastStatusAt = 0
let timersStarted = false

/** Textos que salieron hace poco: sirven para detectar envíos masivos. */
const recentTexts = new Map()

function nowIso() {
  return new Date().toISOString()
}

function toMs(iso) {
  const value = new Date(iso ?? 0).getTime()
  return Number.isFinite(value) ? value : 0
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

/* ------------------------------ calentamiento ---------------------------- */

function linkedAt() {
  const stored = store.getMeta('linked_at')
  return stored ? toMs(stored) : null
}

function refreshWarmup() {
  const since = linkedAt()
  if (!since) {
    state.warmupUntil = null
    return { active: false, until: null, daysLeft: 0 }
  }
  const until = since + CONFIG.warmupDays * 86_400_000
  state.warmupUntil = new Date(until).toISOString()
  const active = Date.now() < until
  return {
    active,
    until: state.warmupUntil,
    daysLeft: active ? Math.max(1, Math.ceil((until - Date.now()) / 86_400_000)) : 0,
  }
}

/** Topes efectivos: durante el calentamiento son mucho más conservadores. */
function limits() {
  const warmup = refreshWarmup()
  if (!warmup.active) {
    return {
      minGapMs: CONFIG.minGapMs,
      maxPerHour: CONFIG.maxPerHour,
      maxPerDay: CONFIG.maxPerDay,
      maxStatusPerDay: CONFIG.maxStatusPerDay,
      statusMinGapMs: CONFIG.statusMinGapMs,
    }
  }
  return {
    minGapMs: Math.round(CONFIG.minGapMs * 1.5),
    maxPerHour: Math.max(5, Math.round(CONFIG.maxPerHour / CONFIG.warmupFactor)),
    maxPerDay: Math.max(20, Math.round(CONFIG.maxPerDay / CONFIG.warmupFactor)),
    maxStatusPerDay: Math.max(2, Math.round(CONFIG.maxStatusPerDay / CONFIG.warmupFactor)),
    statusMinGapMs: Math.round(CONFIG.statusMinGapMs * 1.5),
  }
}

/** Contadores reales tomados de la bitácora (sobreviven a reinicios). */
function counters() {
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString()
  const dayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
  const total = store.countAudit({ since: dayStart })
  const ok = store.countAudit({ since: dayStart, onlyOk: true })
  return {
    lastHour: store.countAudit({ since: hourAgo, onlyOk: true }),
    today: ok,
    errorsToday: Math.max(0, total - ok),
    statusesToday: store.countAudit({ since: dayStart, kind: 'estado', onlyOk: true }),
  }
}

/* -------------------------------- estado --------------------------------- */

export function getStatus() {
  const me = state.me
  const current = limits()
  const warmup = refreshWarmup()
  const stats = counters()
  const cooldownRemaining = state.cooldownUntil ? Math.max(0, toMs(state.cooldownUntil) - Date.now()) : 0
  const graceRemaining = state.readyAt ? Math.max(0, toMs(state.readyAt) - Date.now()) : 0

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
    limits: { minGapMs: current.minGapMs, maxPerHour: current.maxPerHour },
    protections: {
      active: isConnected() && cooldownRemaining === 0 && graceRemaining === 0,
      paused: cooldownRemaining > 0,
      cooldownUntil: state.cooldownUntil,
      cooldownReason: state.cooldownReason,
      cooldownRemainingMs: cooldownRemaining,
      graceRemainingMs: graceRemaining,
      warmup: { active: warmup.active, until: warmup.until, daysLeft: warmup.daysLeft },
      guardTrips: state.guardTrips,
      sentLastHour: stats.lastHour,
      sentToday: stats.today,
      errorsToday: stats.errorsToday,
      statusesToday: stats.statusesToday,
      effective: {
        minGapMs: current.minGapMs,
        maxPerHour: current.maxPerHour,
        maxPerDay: current.maxPerDay,
        maxStatusPerDay: current.maxStatusPerDay,
        statusMinGapMs: current.statusMinGapMs,
      },
      rules: [
        `Escribe "escribiendo…" y espera ${Math.round(CONFIG.typingMinMs / 1000)}–${Math.round(CONFIG.typingMaxMs / 1000)} s según el texto antes de enviar`,
        `Separación mínima de ${Math.round(current.minGapMs / 1000)} s entre mensajes`,
        `Tope de ${current.maxPerHour}/hora y ${current.maxPerDay}/día`,
        `Máximo ${current.maxStatusPerDay} estados al día, separados ${Math.round(current.statusMinGapMs / 60000)} min`,
        `El mismo texto no sale a más de ${CONFIG.duplicateMaxTargets} números en ${Math.round(CONFIG.duplicateWindowMs / 60000)} min`,
        `Espera de ${Math.round(CONFIG.graceAfterConnectMs / 1000)} s tras conectar antes de escribir`,
        'Enfriamiento automático si WhatsApp pide bajar el ritmo',
      ],
    },
  }
}

/* ------------------------------- conexión -------------------------------- */

function scheduleReconnect(delay) {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  const backoff = Math.min(CONFIG.reconnectMaxMs, CONFIG.reconnectMinMs * 2 ** Math.max(0, attempts - 1))
  const wait = delay ?? backoff
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
  mkdirSync(authDir, { recursive: true, mode: 0o700 })
}

/** Copia la sesión para no tener que vincular de nuevo si algo se corrompe. */
function backupAuth() {
  try {
    if (!existsSync(join(authDir, 'creds.json'))) return false
    rmSync(backupDir, { recursive: true, force: true })
    cpSync(authDir, backupDir, { recursive: true })
    return true
  } catch (error) {
    pushEvent('respaldo fallido', error?.message ?? String(error))
    return false
  }
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
      const firstPairing = !linkedAt()
      attempts = 0
      state.me = socket.user ?? null
      state.qr = null
      state.lastError = null
      state.cooldownUntil = null
      state.cooldownReason = null
      state.cooldownLevel = 0
      if (firstPairing) {
        store.setMeta('linked_at', nowIso())
        pushEvent('sesión vinculada', 'inicia el calentamiento de 7 días')
      }
      refreshWarmup()
      // Nadie escribe en el segundo 1 después de conectar.
      state.readyAt = new Date(
        Date.now() + (firstPairing ? CONFIG.graceFirstPairingMs : CONFIG.graceAfterConnectMs),
      ).toISOString()
      setStatus('connected')
      pushEvent('conectado', state.me?.id ?? null)
      backupAuth()
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

      // Un corte raro o una reconexión pedida por el servidor también es señal
      // de ir más despacio: se aplica un enfriamiento corto.
      if (code === DisconnectReason.connectionClosed || code === DisconnectReason.timedOut) {
        pauseSending('Conexión interrumpida por WhatsApp; se baja el ritmo un momento.', Math.round(CONFIG.cooldownStartMs / 2))
      }

      attempts += 1
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
        source: 'agenda',
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
      // Identidad estable: cambiarla después de vincular la delata.
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
    attempts += 1
    scheduleReconnect()
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

/* --------------------------- controles anti-bloqueo ---------------------- */

function pauseSending(reason, penaltyMs) {
  state.cooldownLevel = Math.min(state.cooldownLevel + 1, 6)
  const penalty = Math.min(
    CONFIG.cooldownMaxMs,
    penaltyMs ?? CONFIG.cooldownStartMs * 2 ** (state.cooldownLevel - 1),
  )
  const until = new Date(Date.now() + penalty)
  if (!state.cooldownUntil || toMs(state.cooldownUntil) < until.getTime()) {
    state.cooldownUntil = until.toISOString()
    state.cooldownReason = reason
    pushEvent('envíos en pausa', `${reason} · ${Math.round(penalty / 60000)} min`)
  }
  return penalty
}

/** Botón para reanudar a mano si el enfriamiento fue una falsa alarma. */
export function resumeSending() {
  state.cooldownUntil = null
  state.cooldownReason = null
  state.cooldownLevel = 0
  pushEvent('envíos reanudados a mano')
  return getStatus()
}

/** WhatsApp avisa "vas muy rápido" con 429/463 o mensajes de este estilo. */
function looksLikeRateLimit(error) {
  const text = `${error?.message ?? ''} ${error?.data ?? ''} ${error?.output?.payload?.message ?? ''}`.toLowerCase()
  const codes = [error?.output?.statusCode, error?.data?.statusCode, error?.statusCode]
  return (
    codes.includes(429) ||
    codes.includes(463) ||
    /rate.?over.?limit|too many|reachout|took too long|too fast|spam|temporarily blocked|429|463/.test(text)
  )
}

function registerSend({ kind, phone, ok, detail }) {
  try {
    store.logAudit({ phone, kind, ok, detail })
  } catch (error) {
    pushEvent('bitácora fallida', error?.message ?? String(error))
  }
  if (ok) state.sentTotal += 1
  else state.sentErrors += 1
}

function enqueue(job) {
  const run = sendChain.then(job, job)
  sendChain = run.catch(() => {})
  return run
}

/** "Escribiendo…" proporcional al texto: 2–9 s, como teclea una persona. */
function typingDelay(text) {
  const length = String(text ?? '').length
  const estimate = CONFIG.typingMinMs + length * CONFIG.typingPerCharMs
  const capped = Math.min(CONFIG.typingCapMs, Math.max(CONFIG.typingMinMs, estimate))
  return Math.max(CONFIG.typingMinMs, Math.min(CONFIG.typingMaxMs, capped)) + randomInt(0, 900)
}

/** Guarda contra "el mismo mensaje a mucha gente": patrón clásico de spam. */
function checkBulkGuard(text) {
  const normalized = String(text ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (normalized.length < 12) return null
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 12)
  const now = Date.now()
  const hits = (recentTexts.get(hash) ?? []).filter((entry) => now - entry.at < CONFIG.duplicateWindowMs)
  recentTexts.set(hash, hits)

  const targets = new Set(hits.map((hit) => hit.phone))
  if (targets.size >= CONFIG.duplicateMaxTargets) {
    state.guardTrips += 1
    const error = new Error(
      `Protección anti-spam: ese mismo mensaje ya salió a ${targets.size} números distintos en ${Math.round(
        CONFIG.duplicateWindowMs / 60000,
      )} minutos. Escribe un texto propio para cada cliente.`,
    )
    error.code = 'WA_BULK_GUARD'
    pushEvent('envío bloqueado por anti-spam', `${targets.size} destinatarios`)
    throw error
  }
  return hash
}

function rememberText(hash, phone) {
  if (!hash) return
  recentTexts.set(hash, [...(recentTexts.get(hash) ?? []), { phone, at: Date.now() }].slice(-50))
}

async function waitForTurn(kind) {
  const current = limits()
  const now = Date.now()

  if (state.cooldownUntil && toMs(state.cooldownUntil) > now) {
    const minutes = Math.ceil((toMs(state.cooldownUntil) - now) / 60000)
    const error = new Error(
      `Envíos en pausa por seguridad (${state.cooldownReason ?? 'ritmo alto'}): faltan ~${minutes} min.`,
    )
    error.code = 'WA_COOLDOWN'
    throw error
  }

  if (state.readyAt && toMs(state.readyAt) > now) {
    const seconds = Math.ceil((toMs(state.readyAt) - now) / 1000)
    const error = new Error(`Esperando ${seconds} s después de conectar antes de escribir (protección anti-bloqueo).`)
    error.code = 'WA_GRACE'
    throw error
  }

  const stats = counters()
  if (stats.lastHour >= current.maxPerHour) {
    const error = new Error(
      `Protección anti-bloqueo: ya se enviaron ${current.maxPerHour} mensajes en la última hora. Intenta más tarde.`,
    )
    error.code = 'WA_RATE_LIMIT'
    throw error
  }
  if (stats.today >= current.maxPerDay) {
    const error = new Error(`Protección anti-bloqueo: se alcanzó el tope de ${current.maxPerDay} mensajes hoy.`)
    error.code = 'WA_RATE_LIMIT'
    throw error
  }

  if (kind === 'estado') {
    if (stats.statusesToday >= current.maxStatusPerDay) {
      const error = new Error(`Protección anti-bloqueo: ya se publicaron ${current.maxStatusPerDay} estados hoy.`)
      error.code = 'WA_RATE_LIMIT'
      throw error
    }
    const gap = current.statusMinGapMs
    const sinceLast = now - lastStatusAt
    if (lastStatusAt && sinceLast < gap) {
      const minutes = Math.max(1, Math.ceil((gap - sinceLast) / 60000))
      const error = new Error(`Los estados se publican separados: espera ~${minutes} min antes del siguiente.`)
      error.code = 'WA_RATE_LIMIT'
      throw error
    }
    return
  }

  // Separación mínima aleatoria respecto al mensaje anterior.
  const wait = Math.max(0, lastSendAt + current.minGapMs + randomInt(0, Math.round(current.minGapMs * 0.6)) - now)
  if (wait > 0) await sleep(wait)
}

/**
 * Envío con comportamiento humano: subscribe → "escribiendo…" (proporcional al
 * texto) → pausa aleatoria → "pausado" → micro-pausa → mensaje real.
 */
async function humanSend(jid, content, { kind = 'texto', options = {}, text = '' } = {}) {
  // Los estados van a status@broadcast: ahí no aplica "escribiendo".
  const withPresence = jid !== STORIES_JID
  const body = text || content?.text || content?.caption || ''
  const hash = checkBulkGuard(body)

  return enqueue(async () => {
    const active = requireSocket()
    await waitForTurn(kind)

    if (withPresence) {
      try {
        await active.presenceSubscribe(jid)
        await active.sendPresenceUpdate('composing', jid)
      } catch {
        /* la presencia es best-effort */
      }
      await sleep(typingDelay(body))
      try {
        await active.sendPresenceUpdate('paused', jid)
      } catch {
        /* idem */
      }
      await sleep(randomInt(300, 900))
    } else {
      await sleep(randomInt(1500, 3500))
    }

    try {
      const result = await active.sendMessage(jid, content, options)
      lastSendAt = Date.now()
      if (kind === 'estado') lastStatusAt = Date.now()
      rememberText(hash, jid.split('@')[0])
      registerSend({ kind, phone: jid.split('@')[0], ok: true, detail: null })
      return result
    } catch (error) {
      registerSend({ kind, phone: jid.split('@')[0], ok: false, detail: error?.message ?? String(error) })
      if (looksLikeRateLimit(error)) {
        pauseSending('WhatsApp pidió bajar el ritmo (posible límite de alcance).')
      }
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
  return humanSend(jid, { text: String(text) }, { kind: 'texto', text: String(text), options })
}

/** Imagen (ruta local o URL) con caption opcional. */
export async function sendImage(phone, { path, caption } = {}) {
  const jid = toJid(phone)
  if (!jid) throw Object.assign(new Error('Número de teléfono inválido.'), { code: 'WA_BAD_PHONE' })
  if (!path) throw new Error('Falta la imagen.')
  const media = existsSync(path) ? readFileSync(path) : { url: path }
  return humanSend(
    jid,
    { image: media, caption: caption ? String(caption) : undefined },
    { kind: 'imagen', text: caption ?? '' },
  )
}

/** Documento (por ejemplo el PDF del comprobante) con caption opcional. */
export async function sendDocument(phone, { path, buffer, fileName, mimetype, caption } = {}) {
  const jid = toJid(phone)
  if (!jid) throw Object.assign(new Error('Número de teléfono inválido.'), { code: 'WA_BAD_PHONE' })
  const data = buffer ?? (path && existsSync(path) ? readFileSync(path) : null)
  if (!data) throw new Error('Falta el documento a enviar.')
  return humanSend(
    jid,
    {
      document: data,
      fileName: fileName || 'documento.pdf',
      mimetype: mimetype || 'application/pdf',
      caption: caption ? String(caption) : undefined,
    },
    { kind: 'documento', text: caption ?? '' },
  )
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
    .statusJidPhones(envNumber('WA_STATUS_MAX_JIDS', 3000))
    .map((phone) => toJid(phone))
    .filter((jid) => Boolean(jid))

  const title = caption?.trim() || text?.trim() || ''
  if (!title && !mediaPath) throw new Error('El estado necesita un texto o una imagen/video.')

  return enqueue(async () => {
    const active = requireSocket()
    await waitForTurn('estado')
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
      lastSendAt = Date.now()
      lastStatusAt = Date.now()
      registerSend({ kind: 'estado', phone: null, ok: true, detail: `${jids.length} destinatarios` })
      return { id: result?.key?.id ?? null, audience: jids.length }
    } catch (error) {
      registerSend({ kind: 'estado', phone: null, ok: false, detail: error?.message ?? String(error) })
      if (looksLikeRateLimit(error)) pauseSending('WhatsApp pidió bajar el ritmo al publicar el estado.')
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
  attempts = 0
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
  state.readyAt = null
  clearAuth()
  setStatus('logged_out')
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  attempts = 0
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
  if (state.cooldownUntil && toMs(state.cooldownUntil) > Date.now()) return
  // Uno por tick: si hay varios programados salen separados, no en ráfaga.
  for (const estado of store.pendingEstados(nowIso(), 1)) {
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
      if (error?.code === 'WA_RATE_LIMIT' || error?.code === 'WA_COOLDOWN' || error?.code === 'WA_GRACE') {
        // Sigue pendiente: se reintenta en el próximo tick.
        pushEvent('estado aplazado', `#${estado.id}: ${error.message}`)
        break
      }
      store.markEstado(estado.id, 'error', error?.message ?? String(error))
      pushEvent('estado fallido', `#${estado.id}: ${error?.message ?? error}`)
    }
  }
}

/** Arranca el socket y los temporizadores (idempotente). */
export async function startWhatsapp() {
  mkdirSync(authDir, { recursive: true, mode: 0o700 })
  store.syncWhatsappContacts()
  store.pruneAudit(CONFIG.auditDays)
  lastSendAt = toMs(store.lastAudit())
  const lastStatus = store.lastAudit({ kind: 'estado' })
  lastStatusAt = toMs(lastStatus)
  refreshWarmup()
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
          store.pruneAudit(CONFIG.auditDays)
        } catch (error) {
          pushEvent('sincronización fallida', error?.message ?? String(error))
        }
      },
      STATUS_SYNC_MS,
    ).unref?.()
    setInterval(() => {
      if (backupAuth()) pushEvent('sesión respaldada')
    }, BACKUP_MS).unref?.()
  }

  return getStatus()
}

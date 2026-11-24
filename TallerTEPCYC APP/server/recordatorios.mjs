/**
 * Recordatorios automáticos por WhatsApp (se activan o desactivan desde la página WhatsApp).
 *
 * - Presupuesto sin respuesta: la orden lleva 2 días o más «esperando confirmación».
 * - Equipo listo sin recoger: la orden lleva 7 días o más lista y sin entregar.
 *
 * Cuidados para no quemar el número (además de las protecciones de whatsapp.mjs, por
 * donde pasa todo envío): uno cada pocos minutos, tope diario propio, solo en horario
 * del local (lunes a sábado), un único recordatorio por orden y estado, nada a quien ya
 * recibió un mensaje en las últimas horas, y nada de órdenes viejas (ventana máxima).
 * Cada texto lleva el nombre, el equipo y la orden del cliente: no hay dos iguales.
 */
import * as store from './db.mjs'
import * as wa from './whatsapp.mjs'
import { normalizePhone } from './phone.mjs'

const DIA = 86_400_000

function envNumber(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

export const REGLAS = {
  presupuesto: { status: 'esperandoConfirmacion', desdeDias: 2, hastaDias: envNumber('RECORDATORIO_PRESUPUESTO_MAX_DIAS', 10) },
  recoger: { status: 'completada', desdeDias: 7, hastaDias: envNumber('RECORDATORIO_RECOGER_MAX_DIAS', 45) },
}
const CONFIG = {
  tickMs: envNumber('RECORDATORIOS_TICK_MS', 5 * 60 * 1000),
  maxPorDia: envNumber('RECORDATORIOS_MAX_DIA', 15),
  horaDesde: envNumber('RECORDATORIOS_HORA_DESDE', 9),
  horaHasta: envNumber('RECORDATORIOS_HORA_HASTA', 18),
  // No se le escribe a quien ya recibió algo del taller hace menos de esto.
  silencioMs: envNumber('RECORDATORIOS_SILENCIO_MS', 20 * 60 * 60 * 1000),
}
const META = 'recordatorios'
const TIMEZONE = 'America/Bogota'

/* ------------------------------ configuración ---------------------------- */

export function getConfig() {
  try {
    const raw = JSON.parse(store.getMeta(META) ?? '{}')
    return { presupuesto: raw.presupuesto === true, recoger: raw.recoger === true }
  } catch {
    return { presupuesto: false, recoger: false }
  }
}

export function setConfig(patch = {}) {
  const next = { ...getConfig() }
  for (const key of ['presupuesto', 'recoger']) {
    if (typeof patch[key] === 'boolean') next[key] = patch[key]
  }
  store.setMeta(META, JSON.stringify(next))
  return next
}

/* --------------------------------- textos -------------------------------- */

function deviceLabel(brand, model) {
  const b = String(brand ?? '').trim()
  const m = String(model ?? '').trim()
  if (!b || b === 'Otra') return m || 'equipo'
  if (!m) return b
  return m.toLowerCase().startsWith(b.toLowerCase()) ? m : `${b} ${m}`
}

const plata = (v) => `$${Math.round(Number(v) || 0)}`
const nombre = (n) => String(n ?? '').trim().split(/\s+/)[0] ?? ''
const fechaCorta = (iso) =>
  new Intl.DateTimeFormat('es-CO', { timeZone: TIMEZONE, day: 'numeric', month: 'long' }).format(new Date(iso))

const SALUDO = (o) => `Cordial saludo, ${nombre(o.customer_name)} . Somos TODOENPCYCONSOLAS 2 🎮📱.`
const FIRMA = 'Cualquier inquietud adicional, estaremos atentos a sus mensajes. Gracias por elegir nuestro servicio técnico.'

export function mensaje(kind, o) {
  const equipo = deviceLabel(o.device_brand, o.device_model)
  const orden = `(Orden: ${o.order_number})`
  if (kind === 'presupuesto') {
    return (
      `${SALUDO(o)}\n\n` +
      `Le recordamos que el diagnóstico de su ${equipo} ${orden} está listo y el costo de la reparación es de ${plata(o.estimated_cost)}.\n\n` +
      `¿Desea que procedamos con el trabajo? Puede respondernos por este medio con un sí o un no.\n\n` +
      FIRMA
    )
  }
  const total = Number(o.items_total) || Number(o.estimated_cost) || 0
  const saldo = Math.max(total - (Number(o.deposit) || 0), 0)
  return (
    `${SALUDO(o)}\n\n` +
    `Le recordamos que su ${equipo} ${orden} está listo desde el ${fechaCorta(o.since)} y puede pasar a recogerlo en nuestras instalaciones.\n\n` +
    (saldo > 0 ? `Saldo a pagar al recoger: ${plata(saldo)}\n\n` : '') +
    `Recuerde que los equipos no reclamados en 60 días pueden generar cobro por bodegaje.\n\n` +
    FIRMA
  )
}

/* ------------------------------- candidatos ------------------------------ */

function kindOf(status) {
  return status === REGLAS.presupuesto.status ? 'presupuesto' : 'recoger'
}

/**
 * Órdenes dentro de la ventana de cada recordatorio que aún no lo recibieron.
 * `due` = ya toca; `motivo` explica por qué no saldría todavía.
 */
export function pendientes(now = Date.now()) {
  const enviados = store.reminderKeys()
  const lista = []
  for (const o of store.reminderCandidates()) {
    if (!o.since) continue
    const kind = kindOf(o.status)
    const regla = REGLAS[kind]
    const desde = Date.parse(o.since)
    if (!Number.isFinite(desde)) continue
    const edad = now - desde
    if (edad > regla.hastaDias * DIA) continue
    if (enviados.has(`${o.id}|${kind}|${o.since}`)) continue
    const phone = normalizePhone(o.customer_phone)
    const ultimo = phone ? store.lastSentTo(phone) : null
    const reciente = ultimo && now - Date.parse(ultimo) < CONFIG.silencioMs
    const due = edad >= regla.desdeDias * DIA
    lista.push({
      _row: o,
      orderId: o.order_number,
      kind,
      customer: o.customer_name,
      device: deviceLabel(o.device_brand, o.device_model),
      since: o.since,
      dueAt: new Date(desde + regla.desdeDias * DIA).toISOString(),
      due,
      motivo: !phone ? 'Sin WhatsApp válido' : reciente ? 'Ya recibió un mensaje hoy' : undefined,
    })
  }
  return lista.sort((a, b) => a.dueAt.localeCompare(b.dueAt))
}

/* --------------------------------- envío --------------------------------- */

function horaLocal(now) {
  const { weekday, time } = store.localClock(new Date(now), TIMEZONE)
  return { weekday, hour: Number(time.slice(0, 2)) }
}

export function enHorario(now = Date.now()) {
  const { weekday, hour } = horaLocal(now)
  return weekday !== 0 && hour >= CONFIG.horaDesde && hour < CONFIG.horaHasta
}

const ESPERAR = new Set(['WA_RATE_LIMIT', 'WA_COOLDOWN', 'WA_GRACE', 'WA_OFFLINE'])
let enCurso = false

/** Manda como mucho un recordatorio. Devuelve lo que pasó (para pruebas y registro). */
export async function tick(now = Date.now()) {
  if (enCurso) return { skipped: 'en curso' }
  const config = getConfig()
  if (!config.presupuesto && !config.recoger) return { skipped: 'apagados' }
  if (!enHorario(now)) return { skipped: 'fuera de horario' }
  if (!wa.isConnected()) return { skipped: 'whatsapp desconectado' }
  if (store.countRemindersSince(new Date(now - DIA).toISOString()) >= CONFIG.maxPorDia) return { skipped: 'tope diario' }

  const siguiente = pendientes(now).find((p) => p.due && !p.motivo && config[p.kind])
  if (!siguiente) return { skipped: 'nada pendiente' }

  enCurso = true
  const o = siguiente._row
  try {
    await wa.sendText(o.customer_phone, mensaje(siguiente.kind, o))
    store.recordReminder({ orderId: o.id, kind: siguiente.kind, since: o.since, ok: true })
    return { sent: siguiente.orderId, kind: siguiente.kind }
  } catch (error) {
    // Límite, pausa o desconexión: se intenta en otro momento. Otro error: queda anotado y no se repite.
    if (ESPERAR.has(error?.code)) return { skipped: error.code }
    store.recordReminder({ orderId: o.id, kind: siguiente.kind, since: o.since, ok: false, detail: error?.message ?? String(error) })
    return { failed: siguiente.orderId, error: error?.message ?? String(error) }
  } finally {
    enCurso = false
  }
}

/** Lo que muestra la página WhatsApp. */
export function resumen(now = Date.now()) {
  const config = getConfig()
  return {
    config,
    reglas: {
      presupuesto: { desdeDias: REGLAS.presupuesto.desdeDias, hastaDias: REGLAS.presupuesto.hastaDias },
      recoger: { desdeDias: REGLAS.recoger.desdeDias, hastaDias: REGLAS.recoger.hastaDias },
    },
    horario: { desde: CONFIG.horaDesde, hasta: CONFIG.horaHasta, ahora: enHorario(now) },
    maxPorDia: CONFIG.maxPorDia,
    enviadosHoy: store.countRemindersSince(new Date(now - DIA).toISOString()),
    pendientes: pendientes(now).map(({ _row, ...p }) => p),
    enviados: store.listReminders(30),
  }
}

let iniciado = false
export function startRecordatorios() {
  if (iniciado) return
  iniciado = true
  setInterval(() => {
    tick().catch((error) => console.error('[recordatorios]', error?.message ?? error))
  }, CONFIG.tickMs).unref?.()
}

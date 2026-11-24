/**
 * Solicitudes de la web (formulario de tepcyc.com/reparacion).
 *
 * `web-tepcyc/server.py` guarda cada solicitud como una línea JSON en `leads.jsonl`
 * (y la manda a n8n). Aquí se leen esas líneas y se pasan a la tabla `solicitudes`,
 * que es la bandeja del taller. El código `ref` (W-XXXX) evita duplicados y es el
 * mismo que viaja en el WhatsApp que abre el cliente: con él se reconoce su número.
 */
import { readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import * as store from './db.mjs'

export const LEADS_FILE = process.env.LEADS_FILE ?? '/opt/data/proyectos/n8n/leads.jsonl'
/** Las solicitudes viejas entran ya descartadas: no llenan la bandeja de cosas atendidas. */
const VIEJA_MS = 30 * 86_400_000

let leido = { mtime: -1, size: -1 }

const texto = (v, max) => String(v ?? '').trim().slice(0, max)

/** «2026-11-20T15:04:05-0500» (time.strftime de Python) → ISO en UTC. */
function fechaIso(valor) {
  const raw = String(valor ?? '').replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

export function refDeTexto(valor) {
  const m = String(valor ?? '').toUpperCase().match(/\bW-[A-Z0-9]{4,8}\b/)
  return m ? m[0] : null
}

/** Una línea de leads.jsonl → solicitud, o null si no sirve. */
export function parseLead(linea, ahora = Date.now()) {
  let lead
  try {
    lead = JSON.parse(linea)
  } catch {
    return null
  }
  const datos = lead?.datos
  if (!datos || typeof datos !== 'object') return null
  const nombre = texto(datos.nombre, 80)
  const fallo = texto(datos.fallo, 600)
  if (!nombre && !fallo) return null
  const receivedAt = fechaIso(lead.recibido) ?? new Date(ahora).toISOString()
  // Sin código (formularios viejos): se usa un resumen de la línea para no repetirla.
  const ref = refDeTexto(datos.ref) ?? `L-${createHash('sha1').update(linea).digest('hex').slice(0, 10).toUpperCase()}`
  return {
    ref,
    receivedAt,
    name: nombre,
    device: texto(datos.equipo, 40),
    model: texto(datos.modelo, 80),
    fault: fallo,
    since: texto(datos.desde, 60) || null,
    status: ahora - Date.parse(receivedAt) > VIEJA_MS ? 'descartada' : 'nueva',
  }
}

/** Lee el archivo si cambió y agrega las solicitudes nuevas. Nunca lanza. */
export function syncSolicitudes() {
  try {
    const info = statSync(LEADS_FILE)
    if (info.mtimeMs === leido.mtime && info.size === leido.size) return 0
    const lista = []
    for (const linea of readFileSync(LEADS_FILE, 'utf8').split('\n')) {
      if (!linea.trim()) continue
      const s = parseLead(linea.trim())
      if (s) lista.push(s)
    }
    const nuevas = store.importSolicitudes(lista)
    leido = { mtime: info.mtimeMs, size: info.size }
    return nuevas
  } catch {
    // Sin archivo (por ejemplo en otro equipo) o sin permisos: la bandeja queda como está.
    return 0
  }
}

/** Solicitud con ese código, después de leer lo último del archivo. */
export function solicitudPorRef(ref) {
  if (!ref) return null
  syncSolicitudes()
  return store.getSolicitudByRef(ref) ?? null
}

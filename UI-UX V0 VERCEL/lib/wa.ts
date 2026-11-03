/**
 * WhatsApp del taller: tipos, cliente de API y utilidades del panel.
 */
export type WaStatusName = 'starting' | 'connecting' | 'qr' | 'connected' | 'logged_out' | 'error'

export interface WaMe {
  id: string | null
  phone: string | null
  display: string | null
  name: string | null
}

export interface WaEvent {
  at: string
  event: string
  detail: string | null
}

export interface WaState {
  status: WaStatusName
  connected: boolean
  qr: string | null
  qrUpdatedAt: string | null
  me: WaMe | null
  lastError: string | null
  updatedAt: string
  reconnects: number
  sentTotal: number
  sentErrors: number
  contacts: number
  pendientes: number
  events: WaEvent[]
  limits: { minGapMs: number; maxPerHour: number }
}

export interface EstadoProgramado {
  id: number
  text?: string
  caption?: string
  mediaUrl?: string
  mediaType?: 'image' | 'video'
  backgroundColor?: string
  scheduledAt?: string
  status: 'pendiente' | 'publicado' | 'error'
  error?: string
  createdAt: string
  sentAt?: string
}

export interface WaContact {
  phone: string
  name?: string
  source: string
  lastSeen: string
}

export interface NewEstadoInput {
  text?: string
  caption?: string
  mediaDataUrl?: string
  mediaType?: 'image' | 'video'
  backgroundColor?: string
  scheduledAt?: string
}

const BASE = '/api/whatsapp'

export class WaOfflineError extends Error {}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    let offline = false
    try {
      const body = (await response.json()) as { error?: string; offline?: boolean }
      if (body?.error) detail = body.error
      offline = Boolean(body?.offline)
    } catch {
      /* respuesta sin JSON */
    }
    if (offline || response.status === 409) throw new WaOfflineError(detail)
    throw new Error(detail)
  }
  return (await response.json()) as T
}

export function waStatus() {
  return request<WaState>(`${BASE}/status`)
}

export function waRestart() {
  return request<WaState>(`${BASE}/restart`, { method: 'POST' })
}

export function waLogout() {
  return request<WaState>(`${BASE}/logout`, { method: 'POST' })
}

export function waSendText(phone: string, message: string) {
  return request<{ ok: boolean; id: string | null; to: string }>(`${BASE}/send`, {
    method: 'POST',
    body: JSON.stringify({ phone, message }),
  })
}

export function waSendOrder(input: { orderId: string; phone?: string; message: string; includePhotos?: boolean }) {
  return request<{ ok: boolean; sent: number; photos: number; to: string }>(`${BASE}/send-order`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function waSendDocument(input: { phone: string; fileName: string; dataUrl: string; caption?: string }) {
  return request<{ ok: boolean; id: string | null; to: string }>(`${BASE}/send-document`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function waListEstados() {
  return request<EstadoProgramado[]>(`${BASE}/estados`)
}

export function waCreateEstado(input: NewEstadoInput) {
  return request<EstadoProgramado>(`${BASE}/estados`, { method: 'POST', body: JSON.stringify(input) })
}

export function waDeleteEstado(id: number) {
  return request<{ ok: boolean }>(`${BASE}/estados/${id}`, { method: 'DELETE' })
}

export function waContacts() {
  return request<{ total: number; contactos: WaContact[] }>(`${BASE}/contactos`)
}

export function waSyncContacts() {
  return request<{ ok: boolean; actualizados: number; total: number }>(`${BASE}/sync`, { method: 'POST' })
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsDataURL(blob)
  })
}

/** Mensaje para los clientes cuando el envío automático no está disponible. */
export const WA_OFFLINE_HINT = 'WhatsApp no está conectado: se abrirá wa.me como respaldo.'

export const STATUS_LABEL: Record<WaStatusName, { label: string; hint: string; text: string; bg: string; dot: string }> = {
  starting: {
    label: 'Iniciando',
    hint: 'Levantando el servicio de WhatsApp',
    text: 'text-status-pending',
    bg: 'bg-status-pending/12',
    dot: 'bg-status-pending',
  },
  connecting: {
    label: 'Conectando',
    hint: 'Reconectando con WhatsApp…',
    text: 'text-status-review',
    bg: 'bg-status-review/12',
    dot: 'bg-status-review',
  },
  qr: {
    label: 'Esperando escaneo',
    hint: 'Escanea el código QR desde el celular',
    text: 'text-status-waiting',
    bg: 'bg-status-waiting/12',
    dot: 'bg-status-waiting',
  },
  connected: {
    label: 'Conectado',
    hint: 'Sesión activa',
    text: 'text-status-done',
    bg: 'bg-status-done/12',
    dot: 'bg-status-done',
  },
  logged_out: {
    label: 'Sesión cerrada',
    hint: 'Hay que escanear un QR nuevo',
    text: 'text-destructive',
    bg: 'bg-destructive/12',
    dot: 'bg-destructive',
  },
  error: {
    label: 'Con error',
    hint: 'No se pudo conectar',
    text: 'text-destructive',
    bg: 'bg-destructive/12',
    dot: 'bg-destructive',
  },
}

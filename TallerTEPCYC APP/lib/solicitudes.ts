import { BUSINESS } from './business'
import { CONSOLE_MODELS } from './status'
import type { DeviceType } from './types'

/** «Consola» / «Control» / «Celular» de la web → tipo de equipo del taller. */
export function solicitudDeviceType(device: string): DeviceType {
  const d = device.trim().toLowerCase()
  if (d.startsWith('control')) return 'control'
  if (d.startsWith('celular')) return 'celular'
  return 'consola'
}

/** Modelos que la web escribe corto. */
const ALIAS: Record<string, string> = {
  ps5: 'PlayStation 5',
  ps4: 'PlayStation 4',
  ps3: 'PlayStation 3',
}

function brandOf(text: string) {
  const t = text.toLowerCase()
  if (/\bps\d|playstation|dualsense|dualshock/.test(t)) return 'PlayStation'
  if (/xbox/.test(t)) return 'Xbox'
  if (/nintendo|switch|wii|joy-?con/.test(t)) return 'Nintendo'
  return ''
}

/**
 * Equipo para el formulario de Ingreso a partir de lo que eligió el cliente en la web.
 * `freeModel` = el modelo no está en los botones y va escrito.
 */
export function deviceFromSolicitud(device: string, model: string) {
  const deviceType = solicitudDeviceType(device)
  const raw = model.trim()
  if (deviceType === 'celular') {
    // La web pide marca y modelo en un solo campo: la primera palabra suele ser la marca.
    return { deviceType, brand: raw.split(/\s+/)[0] ?? '', model: raw, freeModel: false }
  }
  const brand = brandOf(raw) || 'Otra'
  const name = ALIAS[raw.toLowerCase()] ?? raw
  const known = (CONSOLE_MODELS[brand] ?? []).find((m) => m.toLowerCase() === name.toLowerCase())
  if (deviceType === 'consola' && known) return { deviceType, brand, model: known, freeModel: false }
  // «Xbox Series X|S»: la marca sí, el modelo exacto lo elige el taller con el equipo en la mano.
  if (deviceType === 'consola' && /series/i.test(raw)) return { deviceType, brand, model: '', freeModel: false }
  return { deviceType, brand, model: name, freeModel: Boolean(name) }
}

/** 573001234567 → 300 123 4567 (para el campo de Ingreso, que ya muestra el +57). */
export function localPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  const local = digits.length === 12 && digits.startsWith(BUSINESS.countryCode) ? digits.slice(2) : digits
  return local.length === 10 ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : local
}

/** 573001234567 → +57 300 123 4567 */
export function formatPhoneDisplay(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith(BUSINESS.countryCode)) return `+57 ${localPhone(digits)}`
  return `+${digits}`
}

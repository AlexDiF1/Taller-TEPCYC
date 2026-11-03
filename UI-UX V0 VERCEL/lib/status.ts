import {
  ClipboardCheck,
  PackageCheck,
  ScanSearch,
  Clock,
  CircleSlash,
  TriangleAlert,
  Smartphone,
  Gamepad2,
  Joystick,
  Monitor,
  Cable,
  type LucideIcon,
} from 'lucide-react'
import type { DeviceType, OrderStatus } from './types'

export interface StatusMeta {
  value: OrderStatus
  label: string
  short: string
  icon: LucideIcon
  /** Tailwind classes using the status-* theme tokens. */
  text: string
  bg: string
  dot: string
  ring: string
}

/** Estados reales que usa Firestore (colección `repairs`). */
export const STATUSES: StatusMeta[] = [
  {
    value: 'pendiente',
    label: 'Pendiente',
    short: 'Pendiente',
    icon: ClipboardCheck,
    text: 'text-status-pending',
    bg: 'bg-status-pending/12',
    dot: 'bg-status-pending',
    ring: 'ring-status-pending/30',
  },
  {
    value: 'enRevision',
    label: 'En revisión',
    short: 'Revisión',
    icon: ScanSearch,
    text: 'text-status-review',
    bg: 'bg-status-review/12',
    dot: 'bg-status-review',
    ring: 'ring-status-review/30',
  },
  {
    value: 'esperandoConfirmacion',
    label: 'Esperando confirmación',
    short: 'Esperando',
    icon: Clock,
    text: 'text-status-waiting',
    bg: 'bg-status-waiting/12',
    dot: 'bg-status-waiting',
    ring: 'ring-status-waiting/30',
  },
  {
    value: 'completada',
    label: 'Completada',
    short: 'Completada',
    icon: PackageCheck,
    text: 'text-status-done',
    bg: 'bg-status-done/12',
    dot: 'bg-status-done',
    ring: 'ring-status-done/30',
  },
  {
    value: 'rechazada',
    label: 'Rechazada por el cliente',
    short: 'Rechazada',
    icon: CircleSlash,
    text: 'text-status-rejected',
    bg: 'bg-status-rejected/12',
    dot: 'bg-status-rejected',
    ring: 'ring-status-rejected/30',
  },
  {
    value: 'fallida',
    label: 'Reparación fallida',
    short: 'Fallida',
    icon: TriangleAlert,
    text: 'text-status-failed',
    bg: 'bg-status-failed/12',
    dot: 'bg-status-failed',
    ring: 'ring-status-failed/30',
  },
]

/** Órdenes que ya salieron del banco de trabajo. */
export const CLOSED_STATUSES: OrderStatus[] = ['completada', 'rechazada', 'fallida']

export function isClosed(status: OrderStatus) {
  return CLOSED_STATUSES.includes(status)
}

export const ORDER_STATUS_VALUES: OrderStatus[] = STATUSES.map((s) => s.value)

export const STATUS_MAP = Object.fromEntries(
  STATUSES.map((s) => [s.value, s]),
) as Record<OrderStatus, StatusMeta>

export function statusIndex(status: OrderStatus) {
  return STATUSES.findIndex((s) => s.value === status)
}

export const DEVICE_TYPES: { value: DeviceType; label: string; icon: LucideIcon }[] = [
  { value: 'consola', label: 'Consola', icon: Monitor },
  { value: 'control', label: 'Control', icon: Gamepad2 },
  { value: 'celular', label: 'Celular', icon: Smartphone },
  { value: 'portatil', label: 'Portátil', icon: Joystick },
  { value: 'accesorio', label: 'Accesorio', icon: Cable },
]

export const DEVICE_ICON = Object.fromEntries(
  DEVICE_TYPES.map((d) => [d.value, d.icon]),
) as Record<DeviceType, LucideIcon>

export const BRANDS = ['PlayStation', 'Xbox', 'Nintendo', 'Otra']

/** Modelos disponibles por marca de consola (Xbox 360 → Series X/S, PS3 → PS5, Wii → Switch 2). */
export const CONSOLE_MODELS: Record<string, string[]> = {
  Xbox: ['Xbox 360', 'Xbox One', 'Xbox One S', 'Xbox One X', 'Xbox Series S', 'Xbox Series X'],
  PlayStation: ['PlayStation 3', 'PlayStation 4', 'PlayStation 5'],
  Nintendo: ['Wii', 'Wii U', 'Nintendo Switch', 'Nintendo Switch Lite', 'Nintendo Switch OLED', 'Nintendo Switch 2'],
}

/** Tipos de equipo donde la marca y el modelo se escriben a mano. */
export const CUSTOM_DEVICE_TYPES: DeviceType[] = ['celular', 'accesorio']

/** Única opción rápida de accesorios: el resto se escribe a mano. */
export const ACCESSORIES = ['Nada']

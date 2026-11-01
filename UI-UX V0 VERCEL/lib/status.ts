import {
  ClipboardCheck,
  PackageCheck,
  ScanSearch,
  Wrench,
  BadgeCheck,
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

export const STATUSES: StatusMeta[] = [
  {
    value: 'recibido',
    label: 'Recibido',
    short: 'Recibido',
    icon: ClipboardCheck,
    text: 'text-status-received',
    bg: 'bg-status-received/12',
    dot: 'bg-status-received',
    ring: 'ring-status-received/30',
  },
  {
    value: 'en_revision',
    label: 'En revisión',
    short: 'Revisión',
    icon: ScanSearch,
    text: 'text-status-review',
    bg: 'bg-status-review/12',
    dot: 'bg-status-review',
    ring: 'ring-status-review/30',
  },
  {
    value: 'en_reparacion',
    label: 'En reparación',
    short: 'Reparación',
    icon: Wrench,
    text: 'text-status-repair',
    bg: 'bg-status-repair/12',
    dot: 'bg-status-repair',
    ring: 'ring-status-repair/30',
  },
  {
    value: 'listo',
    label: 'Listo para entrega',
    short: 'Listo',
    icon: PackageCheck,
    text: 'text-status-ready',
    bg: 'bg-status-ready/12',
    dot: 'bg-status-ready',
    ring: 'ring-status-ready/30',
  },
  {
    value: 'entregado',
    label: 'Entregado',
    short: 'Entregado',
    icon: BadgeCheck,
    text: 'text-status-delivered',
    bg: 'bg-status-delivered/12',
    dot: 'bg-status-delivered',
    ring: 'ring-status-delivered/30',
  },
]

export const STATUS_MAP = Object.fromEntries(
  STATUSES.map((s) => [s.value, s]),
) as Record<OrderStatus, StatusMeta>

export function statusIndex(status: OrderStatus) {
  return STATUSES.findIndex((s) => s.value === status)
}

export const DEVICE_TYPES: { value: DeviceType; label: string; icon: LucideIcon }[] = [
  { value: 'consola', label: 'Consola', icon: Monitor },
  { value: 'control', label: 'Control', icon: Gamepad2 },
  { value: 'portatil', label: 'Portátil', icon: Joystick },
  { value: 'accesorio', label: 'Accesorio', icon: Cable },
]

export const DEVICE_ICON = Object.fromEntries(
  DEVICE_TYPES.map((d) => [d.value, d.icon]),
) as Record<DeviceType, LucideIcon>

export const BRANDS = ['PlayStation', 'Xbox', 'Nintendo', 'Valve', 'Otra']

export const COMMON_FAULTS = [
  'No enciende',
  'Drift en joystick',
  'Puerto HDMI dañado',
  'Sobrecalentamiento',
  'No lee discos',
  'Botones fallando',
  'No carga / batería',
  'Error de software',
  'Ruido en ventilador',
  'Sin conexión Bluetooth',
]

export const ACCESSORIES = [
  'Cable de poder',
  'Cable HDMI',
  'Control',
  'Cable de carga',
  'Base / Dock',
  'Estuche',
  'Caja original',
  'Memoria / SD',
  'Juegos',
  'Audífonos',
]

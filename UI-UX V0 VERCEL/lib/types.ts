export type OrderStatus =
  | 'pendiente'
  | 'enRevision'
  | 'esperandoConfirmacion'
  | 'completada'
  | 'rechazada'
  | 'fallida'

export type DeviceType = 'consola' | 'control' | 'portatil' | 'accesorio' | 'celular'

export interface Customer {
  name: string
  phone: string
  documentId?: string
  email?: string
}

export interface Device {
  type: DeviceType
  brand: string
  model: string
  serial?: string
  color?: string
}

export interface IntakePhoto {
  id: string
  /** Data URL in the mock layer; replace with a storage URL when uploading to a backend. */
  url: string
  takenAt: string
}

export interface ServiceItem {
  id: string
  description: string
  kind: 'servicio' | 'repuesto'
  price: number
}

export interface StatusEvent {
  status: OrderStatus
  at: string
  note?: string
}

export interface Order {
  id: string
  createdAt: string
  status: OrderStatus
  customer: Customer
  device: Device
  reportedFault: string
  faultTags: string[]
  accessories: string[]
  physicalNotes?: string
  photos: IntakePhoto[]
  estimatedCost: number
  deposit: number
  estimatedDate?: string
  /** Días de garantía definidos por el taller. Vacío = valor por defecto del negocio. */
  warrantyDays?: number
  /** Solo celulares: no se otorga garantía por pantallas cambiadas. */
  warrantyScreenExcluded?: boolean
  /** Una vez entregado y revisado por el cliente no se otorga garantía (por defecto sí). */
  warrantyNoAfterReview?: boolean
  technician?: string
  items: ServiceItem[]
  history: StatusEvent[]
  deliveredAt?: string
}

/** Campos editables de una orden ya registrada (PATCH/PUT /api/orders/:id). */
export interface OrderPatch {
  status?: OrderStatus
  customer?: Partial<Customer>
  device?: Partial<Device>
  deviceType?: DeviceType
  brand?: string
  model?: string
  serial?: string
  color?: string
  reportedFault?: string
  faultTags?: string[]
  accessories?: string[]
  physicalNotes?: string
  estimatedCost?: number
  deposit?: number
  estimatedDate?: string
  warrantyDays?: number | null
  warrantyScreenExcluded?: boolean
  warrantyNoAfterReview?: boolean
  technician?: string
}

export type NewOrderInput = Omit<
  Order,
  'id' | 'createdAt' | 'status' | 'history' | 'items' | 'deliveredAt' | 'technician'
>

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
  technician?: string
  items: ServiceItem[]
  history: StatusEvent[]
  deliveredAt?: string
}

export type NewOrderInput = Omit<
  Order,
  'id' | 'createdAt' | 'status' | 'history' | 'items' | 'deliveredAt'
>

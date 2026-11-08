import { BUSINESS, addDays, formatDate, formatMoney } from '@/lib/business'
import { STATUS_MAP } from '@/lib/status'
import type { DeviceType, Order, ServiceItem } from '@/lib/types'

export type ReceiptType = 'recepcion' | 'entrega'

const DEVICE_TYPE_LABEL: Record<DeviceType, string> = {
  consola: 'Consola',
  control: 'Control',
  celular: 'Celular',
  portatil: 'Portátil',
  accesorio: 'Accesorio',
}

/**
 * Ticket térmico de 80 mm. Se usa como vista previa en pantalla y como
 * documento de impresión directa (`window.print()`), con estilos monocromos
 * definidos en `app/globals.css`.
 */
export function ReceiptDocument({ order, type, items }: { order: Order; type: ReceiptType; items: ServiceItem[] }) {
  const isDelivery = type === 'entrega'
  const subtotal = items.reduce((s, i) => s + i.price, 0)
  const total = isDelivery ? subtotal || order.estimatedCost : order.estimatedCost
  const balance = Math.max(total - order.deposit, 0)
  const deliveredAt = order.deliveredAt ?? new Date().toISOString()
  const warrantyDays = order.warrantyDays ?? BUSINESS.warrantyDays
  const warrantyUntil = addDays(deliveredAt, warrantyDays)
  const warrantyExclusions = [
    'Cubre exclusivamente la reparación y los repuestos descritos en esta factura. No cubre golpes, humedad, manipulación por terceros, sellos rotos ni fallas distintas a la reparada.',
  ]
  if (order.device.type === 'celular' && order.warrantyScreenExcluded) {
    warrantyExclusions.push('No se otorga garantía por pantallas cambiadas.')
  }
  if (order.warrantyNoAfterReview !== false) {
    warrantyExclusions.push(
      'Después de la entrega y revisión por parte del cliente no se otorga garantía por daños o fallas posteriores.',
    )
  }

  return (
    <article className="print-sheet">
      <header className="text-center">
        <p className="text-[13px] font-bold leading-tight">{BUSINESS.name}</p>
        <p className="text-[8pt]">{BUSINESS.tagline}</p>
        <p className="text-[7.5pt]">
          {BUSINESS.address}, {BUSINESS.city}
        </p>
        <p className="text-[7.5pt]">WhatsApp {BUSINESS.phone}</p>
        <p className="text-[7.5pt]">{formatDate(isDelivery ? deliveredAt : order.createdAt, true)}</p>
      </header>

      <div className="ticket-divider" />

      <p className="text-center text-[8pt] font-bold uppercase">
        {isDelivery ? 'Factura de entrega' : 'Comprobante de recepción'}
      </p>
      <p className="text-center text-[15pt] font-bold leading-tight">{order.id}</p>
      <p className="text-center text-[9pt] font-bold">{order.customer.name}</p>
      <p className="text-center text-[7.5pt]">Tel: +{BUSINESS.countryCode} {order.customer.phone}</p>
      {order.customer.documentId && <p className="text-center text-[7pt]">Doc: {order.customer.documentId}</p>}

      <div className="ticket-divider" />

      <div className="flex flex-col gap-0.5 text-[8pt]">
        <div className="ticket-row">
          <span className="ticket-label">Equipo:</span>
          <span className="text-right">{DEVICE_TYPE_LABEL[order.device.type] ?? order.device.type}</span>
        </div>
        <div className="ticket-row">
          <span className="ticket-label">Marca/modelo:</span>
          <span className="text-right">
            {order.device.brand} {order.device.model}
          </span>
        </div>
        {order.device.serial && (
          <div className="ticket-row">
            <span className="ticket-label">Serie:</span>
            <span className="text-right">{order.device.serial}</span>
          </div>
        )}
        {order.device.color && (
          <div className="ticket-row">
            <span className="ticket-label">Color:</span>
            <span className="text-right">{order.device.color}</span>
          </div>
        )}
      </div>

      <div className="ticket-divider" />

      <div className="text-[8pt]">
        <p className="font-bold">Falla reportada:</p>
        <p>{order.reportedFault || 'Sin descripción registrada.'}</p>
      </div>

      {!isDelivery ? (
        <>
          <div className="ticket-divider" />
          <div className="text-[7.5pt]">
            <p className="font-bold">Accesorios:</p>
            <p>{order.accessories.length ? order.accessories.join(', ') : 'El equipo ingresa sin accesorios.'}</p>
            <p className="mt-1 font-bold">Estado físico:</p>
            <p>{order.physicalNotes || 'Sin observaciones adicionales.'}</p>
          </div>
        </>
      ) : (
        <>
          <div className="ticket-divider" />
          <p className="text-center text-[7.5pt] font-bold">DETALLE DEL SERVICIO</p>
          <div className="mt-1 flex flex-col gap-0.5 text-[8pt]">
            {(items.length
              ? items
              : [{ id: 'est', description: 'Servicio técnico', kind: 'servicio' as const, price: order.estimatedCost }]
            ).map((item) => (
              <div key={item.id} className="ticket-row">
                <span className="pr-1">{item.description || '—'}</span>
                <span className="shrink-0 font-mono">{formatMoney(item.price)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="ticket-divider" />

      <div className="flex flex-col gap-0.5 text-[8pt]">
        <div className="ticket-row">
          <span className="font-bold">{isDelivery ? 'TOTAL SERVICIO' : 'COSTO ESTIMADO'}</span>
          <span className="font-mono">{formatMoney(total)}</span>
        </div>
        <div className="ticket-row">
          <span>ABONO</span>
          <span className="font-mono">- {formatMoney(order.deposit)}</span>
        </div>
      </div>

      <div className="ticket-divider" />

      <div className="ticket-row ticket-total">
        <span>{isDelivery ? 'TOTAL PAGADO' : 'SALDO PENDIENTE'}</span>
        <span className="font-mono">{formatMoney(isDelivery ? total : balance)}</span>
      </div>

      <div className="ticket-divider" />

      <div className="flex flex-col gap-0.5 text-[7.5pt]">
        <div className="ticket-row">
          <span>Estado:</span>
          <span className="text-right font-bold">{STATUS_MAP[order.status]?.label ?? order.status}</span>
        </div>
        {!isDelivery && order.estimatedDate && (
          <div className="ticket-row">
            <span>Entrega estimada:</span>
            <span className="text-right">{formatDate(order.estimatedDate)}</span>
          </div>
        )}
      </div>

      <div className="ticket-divider" />

      {isDelivery ? (
        <div className="text-[7pt]">
          <p className="text-center text-[8pt] font-bold">GARANTÍA</p>
          <p className="mt-1">
            Garantía de {warrantyDays} días · válida hasta el {formatDate(warrantyUntil)}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {warrantyExclusions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-[7pt]">
          <p>El diagnóstico puede modificar el costo estimado. Equipos no reclamados en 60 días generan cobro por bodegaje. Presente este comprobante para retirar el equipo.</p>
        </div>
      )}

      <div className="ticket-divider" />

      <footer className="text-center">
        <p className="text-[9pt] font-bold">¡Gracias por su preferencia!</p>
        <p className="text-[6.5pt]">Comprobante generado por el sistema del taller</p>
      </footer>
    </article>
  )
}

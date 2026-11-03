import { Gamepad2, ShieldCheck } from 'lucide-react'
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

export function ReceiptDocument({ order, type, items }: { order: Order; type: ReceiptType; items: ServiceItem[] }) {
  const isDelivery = type === 'entrega'
  const subtotal = items.reduce((s, i) => s + i.price, 0)
  const total = isDelivery ? subtotal || order.estimatedCost : order.estimatedCost
  const balance = Math.max(total - order.deposit, 0)
  const deliveredAt = order.deliveredAt ?? new Date().toISOString()
  const warrantyUntil = addDays(deliveredAt, BUSINESS.warrantyDays)

  return (
    <article className="print-sheet mx-auto w-full max-w-[816px] rounded-xl bg-white text-[13px] leading-relaxed text-neutral-900 shadow-2xl shadow-black/50">
      <header className="flex flex-col gap-4 border-b-2 border-neutral-900 p-6 sm:flex-row sm:items-start sm:justify-between md:p-8">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-neutral-900 text-[#c0262d]">
            <Gamepad2 className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-bold tracking-tight">{BUSINESS.name}</p>
            <p className="text-xs text-neutral-600">{BUSINESS.tagline}</p>
            <p className="mt-1 text-xs text-neutral-600">
              {BUSINESS.taxId} · {BUSINESS.address}, {BUSINESS.city} · {BUSINESS.phone}
            </p>
          </div>
        </div>
        <div className="sm:text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
            {isDelivery ? 'Factura de entrega' : 'Comprobante de recepción'}
          </p>
          <p className="font-mono text-2xl font-bold">{order.id}</p>
          <p className="text-xs text-neutral-600">
            {formatDate(isDelivery ? deliveredAt : order.createdAt, true)}
          </p>
        </div>
      </header>

      <div className="grid gap-6 p-6 md:grid-cols-2 md:p-8">
        <Block title="Cliente">
          <Row label="Nombre" value={order.customer.name} />
          <Row label="WhatsApp" value={`+${BUSINESS.countryCode} ${order.customer.phone}`} mono />
          {order.customer.documentId && <Row label="Documento" value={order.customer.documentId} mono />}
          {order.customer.email && <Row label="Correo" value={order.customer.email} />}
        </Block>
        <Block title="Equipo">
          <Row label="Tipo" value={DEVICE_TYPE_LABEL[order.device.type]} />
          <Row label="Marca / modelo" value={`${order.device.brand} ${order.device.model}`} />
          {order.device.serial && <Row label="Serie" value={order.device.serial} mono />}
          {order.device.color && <Row label="Color" value={order.device.color} />}
        </Block>

        <Block title="Falla reportada" className="md:col-span-2">
          <p>{order.reportedFault}</p>
        </Block>

        {!isDelivery && (
          <>
            <Block title="Accesorios recibidos">
              {order.accessories.length ? (
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {order.accessories.map((a) => (
                    <li key={a} className="flex items-center gap-2">
                      <span className="size-3 shrink-0 rounded-sm border border-neutral-900 bg-neutral-900" aria-hidden="true" />
                      {a}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-neutral-500">El equipo ingresa sin accesorios.</p>
              )}
            </Block>
            <Block title="Estado físico">
              <p>{order.physicalNotes || 'Sin observaciones adicionales.'}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {order.photos.length} foto{order.photos.length === 1 ? '' : 's'} de respaldo en el sistema.
              </p>
            </Block>
            {order.photos.length > 0 && (
              <div className="grid grid-cols-6 gap-2 md:col-span-2">
                {order.photos.slice(0, 6).map((p, i) => (
                  <img
                    key={p.id}
                    src={p.url || '/placeholder.svg'}
                    alt={`Foto de ingreso ${i + 1}`}
                    className="aspect-square w-full rounded border border-neutral-300 object-cover"
                  />
                ))}
              </div>
            )}
          </>
        )}

        {isDelivery && (
          <div className="md:col-span-2">
            <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">Detalle del servicio</h3>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-neutral-900 text-left text-xs uppercase tracking-wider text-neutral-500">
                  <th className="py-2 font-medium">Descripción</th>
                  <th className="py-2 font-medium">Tipo</th>
                  <th className="py-2 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {(items.length ? items : [{ id: 'est', description: 'Servicio técnico', kind: 'servicio' as const, price: order.estimatedCost }]).map(
                  (item) => (
                    <tr key={item.id} className="border-b border-neutral-200">
                      <td className="py-2 pr-2">{item.description || '—'}</td>
                      <td className="py-2 capitalize text-neutral-600">{item.kind}</td>
                      <td className="py-2 text-right font-mono">{formatMoney(item.price)}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-4 md:col-span-2 md:flex-row md:items-end md:justify-between">
          <div className="text-xs text-neutral-600">
            {!isDelivery && order.estimatedDate && <p>Entrega estimada: {formatDate(order.estimatedDate)}</p>}
            <p>Estado actual: {STATUS_MAP[order.status].label}</p>
          </div>
          <dl className="w-full rounded-lg bg-neutral-100 p-4 md:w-72">
            <div className="flex justify-between">
              <dt className="text-neutral-600">{isDelivery ? 'Total servicio' : 'Costo estimado'}</dt>
              <dd className="font-mono">{formatMoney(total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-600">Abono</dt>
              <dd className="font-mono">- {formatMoney(order.deposit)}</dd>
            </div>
            <div className="mt-2 flex justify-between border-t border-neutral-900 pt-2 text-base font-bold">
              <dt>{isDelivery ? 'Total pagado' : 'Saldo pendiente'}</dt>
              <dd className="font-mono">{formatMoney(isDelivery ? total : balance)}</dd>
            </div>
          </dl>
        </div>

        {isDelivery ? (
          <div className="flex gap-3 rounded-lg border-2 border-neutral-900 p-4 md:col-span-2">
            <ShieldCheck className="size-6 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-bold">
                Garantía de {BUSINESS.warrantyDays} días · válida hasta el {formatDate(warrantyUntil)}
              </p>
              <p className="mt-1 text-xs text-neutral-600">
                Cubre exclusivamente la reparación y los repuestos descritos en esta factura. No cubre golpes, humedad,
                manipulación por terceros, sellos rotos ni fallas distintas a la reparada. Presente esta factura para
                hacerla efectiva.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-neutral-100 p-4 text-xs text-neutral-600 md:col-span-2">
            <p className="mb-1 font-semibold text-neutral-900">Condiciones del servicio</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>Presente este comprobante para retirar el equipo.</li>
              <li>El costo estimado puede variar después del diagnóstico; se le notificará antes de reparar.</li>
              <li>Equipos no reclamados en 60 días generan cobro por bodegaje.</li>
              <li>El taller no se responsabiliza por información o cuentas almacenadas en el equipo.</li>
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-8 pt-10 md:col-span-2">
          <Signature label={isDelivery ? 'Recibí a satisfacción · Cliente' : 'Firma del cliente'} />
          <Signature label={isDelivery ? 'Entrega · Técnico' : 'Recibido por · Taller'} />
        </div>
      </div>

      <footer className="border-t border-dashed border-neutral-300 px-6 py-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500 md:px-8">
        Gracias por confiar en {BUSINESS.name}
      </footer>
    </article>
  )
}

function Block({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">{title}</h3>
      {children}
    </section>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-200 py-1">
      <span className="text-neutral-600">{label}</span>
      <span className={mono ? 'text-right font-mono' : 'text-right font-medium'}>{value}</span>
    </div>
  )
}

function Signature({ label }: { label: string }) {
  return (
    <div className="border-t border-neutral-900 pt-2 text-center text-xs text-neutral-600">{label}</div>
  )
}

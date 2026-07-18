import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/api-session'
import { initDB, query, queryOne } from '@/lib/db'
import PrintActions from './print-actions'
import type { OrdenTrabajoCompleta, OrdenChecklistConItem } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

function simbolo(estado: string) {
  if (estado === 'ok')          return { icon: '✓', label: 'OK',         color: '#065f46' }
  if (estado === 'observacion') return { icon: '⚠', label: 'Observación', color: '#92400e' }
  if (estado === 'no_aplica')   return { icon: '—', label: 'No aplica',   color: '#6b7280' }
  return { icon: '○', label: 'Pendiente', color: '#9ca3af' }
}

function groupBy<T>(arr: T[], key: (x: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, x) => {
    const k = key(x); (acc[k] = acc[k] ?? []).push(x); return acc
  }, {})
}

export default async function ImprimirPage({ params }: Params) {
  const session = await getSession()
  if (!session) redirect('/login')
  const { id } = await params
  await initDB()

  const orden = await queryOne<OrdenTrabajoCompleta & { cliente_telefono: string | null; cliente_rut: string | null; mecanico_nombre: string | null }>(
    `SELECT ot.*, v.patente, v.marca, v.modelo,
            c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.rut AS cliente_rut,
            u.nombre AS mecanico_nombre
     FROM ordenes_trabajo ot
     JOIN vehiculos v  ON v.id = ot.vehiculo_id
     JOIN clientes  c  ON c.id = v.cliente_id
     LEFT JOIN usuarios u ON u.id = ot.mecanico_id
     WHERE ot.id=$1 AND ot.taller_id=$2`,
    [id, session.tallerId],
  )
  if (!orden) notFound()

  const items = await query<OrdenChecklistConItem>(
    `SELECT oc.*, ci.categoria, ci.nombre AS item_nombre,
            ci.descripcion AS item_descripcion, ci.orden AS item_orden
     FROM ordenes_checklist oc
     JOIN checklist_items ci ON ci.id = oc.item_id
     WHERE oc.orden_id=$1
     ORDER BY ci.categoria, ci.orden`,
    [id],
  )

  const grouped  = groupBy(items, i => i.categoria)
  const categorias = Object.keys(grouped).sort()

  const taller = await queryOne<{ nombre: string; telefono: string | null; direccion: string | null; logo_url: string | null }>(
    `SELECT COALESCE(pt.nombre, t.nombre) AS nombre,
            COALESCE(pt.telefono, t.telefono) AS telefono,
            COALESCE(pt.direccion, t.direccion) AS direccion,
            pt.logo_url
     FROM talleres t
     LEFT JOIN perfil_taller pt ON pt.taller_id = t.id
     WHERE t.id = $1`,
    [session.tallerId],
  )

  const fecha = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11pt; }
          .acta-header { border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 14px; }
          .categoria-bloque { page-break-inside: avoid; }
        }
        .acta-wrap { max-width: 820px; margin: 0 auto; padding: 24px; }
        .acta-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
        .acta-title { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
        .acta-sub { font-size: 12px; color: #555; margin-top: 2px; }
        .acta-taller { text-align: right; font-size: 12px; color: #333; }
        .data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        .data-section { border: 1px solid #ddd; border-radius: 6px; padding: 12px 14px; }
        .data-label { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #777; font-weight: 700; margin-bottom: 6px; }
        .data-row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; border-bottom: .5px solid #f0f0f0; }
        .data-row:last-child { border-bottom: none; }
        .data-key { color: #555; }
        .data-val { font-weight: 600; }
        .categoria-bloque { margin-bottom: 14px; }
        .cat-titulo { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; background: #f4f4f4; padding: 5px 10px; border: 1px solid #e0e0e0; border-radius: 4px 4px 0 0; }
        .items-tabla { border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 4px 4px; overflow: hidden; }
        .item-fila { display: grid; grid-template-columns: 24px 1fr 90px; gap: 8px; align-items: start; padding: 6px 10px; border-bottom: .5px solid #f0f0f0; font-size: 12px; }
        .item-fila:last-child { border-bottom: none; }
        .item-fila.par { background: #fafafa; }
        .item-simbolo { font-size: 14px; font-weight: 700; text-align: center; padding-top: 1px; }
        .item-nombre { line-height: 1.3; }
        .item-nota { font-size: 11px; color: #666; font-style: italic; margin-top: 3px; }
        .item-estado { font-size: 10px; font-weight: 600; text-align: right; padding-top: 2px; }
        .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
        .firma-bloque { border-top: 1px solid #333; padding-top: 8px; text-align: center; font-size: 12px; }
        .firma-label { color: #555; margin-top: 4px; }
        .acta-pie { margin-top: 24px; font-size: 10px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
        .badge-completado { display: inline-block; padding: 2px 8px; background: #d1fae5; color: #065f46; border-radius: 4px; font-size: 10px; font-weight: 700; margin-left: 8px; }
        .badge-progreso { display: inline-block; padding: 2px 8px; background: #fef3c7; color: #92400e; border-radius: 4px; font-size: 10px; font-weight: 700; margin-left: 8px; }
      `}</style>

      <div className="acta-wrap">
        <PrintActions backHref={`/ordenes-trabajo/${id}/checklist`} />

        <div className="acta-header">
          <div>
            <div className="acta-title">
              Acta de recepción de vehículo
              {orden.checklist_completado
                ? <span className="badge-completado">✓ Completado</span>
                : items.length > 0
                  ? <span className="badge-progreso">En progreso</span>
                  : null}
            </div>
            <div className="acta-sub">Orden de trabajo #{id} · {fecha}</div>
          </div>
          {taller && (
            <div className="acta-taller" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexDirection: 'column' }}>
              {taller.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={taller.logo_url} alt={taller.nombre} style={{ maxHeight: 56, maxWidth: 180, objectFit: 'contain', display: 'block', marginLeft: 'auto' }} />
              )}
              <div style={{ textAlign: 'right' }}>
                <strong>{taller.nombre}</strong>
                {taller.telefono && <><br />{taller.telefono}</>}
                {taller.direccion && <><br />{taller.direccion}</>}
              </div>
            </div>
          )}
        </div>

        <div className="data-grid">
          <div className="data-section">
            <div className="data-label">Vehículo</div>
            <div className="data-row"><span className="data-key">Patente</span><span className="data-val" style={{ fontFamily: 'monospace', letterSpacing: 2 }}>{orden.patente}</span></div>
            <div className="data-row"><span className="data-key">Marca / Modelo</span><span className="data-val">{orden.marca} {orden.modelo}</span></div>
            {orden.km_ingreso && <div className="data-row"><span className="data-key">KM ingreso</span><span className="data-val">{Number(orden.km_ingreso).toLocaleString('es-CL')} km</span></div>}
          </div>
          <div className="data-section">
            <div className="data-label">Cliente</div>
            <div className="data-row"><span className="data-key">Nombre</span><span className="data-val">{orden.cliente_nombre}</span></div>
            {orden.cliente_rut && <div className="data-row"><span className="data-key">RUT</span><span className="data-val">{orden.cliente_rut}</span></div>}
            {orden.cliente_telefono && <div className="data-row"><span className="data-key">Teléfono</span><span className="data-val">{orden.cliente_telefono}</span></div>}
            {orden.mecanico_nombre && <div className="data-row"><span className="data-key">Mecánico asignado</span><span className="data-val">{orden.mecanico_nombre}</span></div>}
          </div>
        </div>

        {orden.descripcion && (
          <div style={{ marginBottom: 20, padding: '10px 14px', border: '1px solid #ddd', borderRadius: 6, fontSize: 12 }}>
            <div className="data-label" style={{ marginBottom: 4 }}>Trabajo solicitado</div>
            <p style={{ margin: 0 }}>{orden.descripcion}</p>
          </div>
        )}

        {items.length === 0 ? (
          <p style={{ fontSize: 13, color: '#888', textAlign: 'center', padding: '24px 0' }}>
            El checklist de recepción no ha sido iniciado para esta orden.
          </p>
        ) : (
          categorias.map(cat => {
            const catItems = grouped[cat]
            return (
              <div key={cat} className="categoria-bloque">
                <div className="cat-titulo">{cat}</div>
                <div className="items-tabla">
                  {catItems.map((item, idx) => {
                    const s = simbolo(item.estado)
                    return (
                      <div key={item.item_id} className={`item-fila${idx % 2 === 1 ? ' par' : ''}`}>
                        <span className="item-simbolo" style={{ color: s.color }}>{s.icon}</span>
                        <div>
                          <div className="item-nombre">{item.item_nombre}</div>
                          {item.nota && <div className="item-nota">Observación: {item.nota}</div>}
                        </div>
                        <span className="item-estado" style={{ color: s.color }}>{s.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}

        <div className="firmas" style={{ marginTop: 48 }}>
          <div className="firma-bloque">
            <div className="firma-label">Firma cliente</div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{orden.cliente_nombre}</div>
          </div>
          <div className="firma-bloque">
            <div className="firma-label">Firma recepcionista</div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{session.nombre}</div>
          </div>
        </div>

        <div className="acta-pie">
          Documento generado el {fecha} · TallerPro · Orden #{id}
        </div>
      </div>
    </>
  )
}

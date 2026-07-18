import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/api-session'
import { initDB, query, queryOne } from '@/lib/db'
import AppShell from '@/app/app-shell'
import { Car, ArrowLeft, Plus, Calendar, ClipboardCheck } from 'lucide-react'
import type { EstadoOrden, OrdenTimeline, EstadoCita } from '@/lib/db'

const CLP   = (n: string | number | null) => Number(n ?? 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })
const FECHA = (d: Date | string | null) => d ? new Date(d).toLocaleDateString('es-CL') : '—'

const ESTADO_LABELS: Record<EstadoOrden, string> = {
  presupuestada: 'Presupuestada',
  pendiente:   'Pendiente',
  en_progreso: 'En progreso',
  completada:  'Completada',
  entregada:   'Entregada',
  rechazada:   'Rechazada',
}

interface VehiculoDetalle {
  id: number; taller_id: number; cliente_id: number; cliente_nombre: string
  patente: string; marca: string; modelo: string; anio: number | null; color: string | null
}

interface CitaProxima {
  id: number; fecha_hora: Date; duracion_min: number
  tipo_servicio: string | null; estado: EstadoCita; mecanico_nombre: string | null
}

interface VehiculoStats {
  total_ordenes: string
  ultima_visita: Date | null
  km_proxima: number | null
  fecha_proxima: string | null
}

type Params = { params: Promise<{ id: string }> }

export default async function VehiculoFichaPage({ params }: Params) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  await initDB()

  const [vehiculo, stats, ordenes, citasProximas] = await Promise.all([
    queryOne<VehiculoDetalle>(
      `SELECT v.*, c.nombre AS cliente_nombre
       FROM vehiculos v JOIN clientes c ON v.cliente_id = c.id
       WHERE v.id=$1 AND v.taller_id=$2`,
      [id, session.tallerId],
    ),
    queryOne<VehiculoStats>(
      `SELECT COUNT(*) AS total_ordenes, MAX(created_at) AS ultima_visita,
              (SELECT km_proxima FROM ordenes_trabajo
               WHERE vehiculo_id=$1 AND taller_id=$2 AND km_proxima IS NOT NULL
               ORDER BY created_at DESC LIMIT 1) AS km_proxima,
              (SELECT fecha_proxima FROM ordenes_trabajo
               WHERE vehiculo_id=$1 AND taller_id=$2 AND fecha_proxima IS NOT NULL
               ORDER BY created_at DESC LIMIT 1) AS fecha_proxima
       FROM ordenes_trabajo WHERE vehiculo_id=$1 AND taller_id=$2`,
      [id, session.tallerId],
    ),
    query<OrdenTimeline>(
      `SELECT ot.*,
              COALESCE(
                json_agg(
                  json_build_object('nombre', s.nombre, 'precio_aplicado', ots.precio_aplicado)
                ) FILTER (WHERE s.id IS NOT NULL),
                '[]'::json
              ) AS servicios,
              (SELECT COUNT(*) FROM ordenes_checklist oc
               WHERE oc.orden_id = ot.id AND oc.estado = 'observacion') AS observaciones_count
       FROM ordenes_trabajo ot
       LEFT JOIN ordenes_trabajo_servicios ots ON ots.orden_id = ot.id
       LEFT JOIN servicios s ON s.id = ots.servicio_id
       WHERE ot.vehiculo_id=$1 AND ot.taller_id=$2
       GROUP BY ot.id ORDER BY ot.created_at DESC`,
      [id, session.tallerId],
    ),
    query<CitaProxima>(
      `SELECT c.id, c.fecha_hora, c.duracion_min, c.tipo_servicio, c.estado, u.nombre AS mecanico_nombre
       FROM citas c
       LEFT JOIN usuarios u ON u.id = c.mecanico_id
       WHERE c.vehiculo_id=$1 AND c.taller_id=$2
         AND c.estado NOT IN ('cancelada','completada','no_asistio')
         AND c.fecha_hora >= NOW()
       ORDER BY c.fecha_hora ASC LIMIT 3`,
      [id, session.tallerId],
    ).catch(() => [] as CitaProxima[]),
  ])

  if (!vehiculo) notFound()

  return (
    <AppShell session={session}>
      <div className="shell">

        {/* ── Back ── */}
        <div style={{ marginBottom: 16 }}>
          <Link href="/vehiculos" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', textDecoration: 'none' }}>
            <ArrowLeft size={14} /> Volver a vehículos
          </Link>
        </div>

        {/* ── Header ── */}
        <div className="fichaHeader">
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--panel-strong)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Car size={26} style={{ color: 'var(--brand)' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 900, fontFamily: 'monospace', letterSpacing: 2, color: 'var(--text)', lineHeight: 1 }}>
                {vehiculo.patente}
              </h1>
              <p style={{ fontSize: 16, color: 'var(--muted)', marginTop: 4 }}>
                {vehiculo.marca} {vehiculo.modelo}{vehiculo.anio ? ` · ${vehiculo.anio}` : ''}{vehiculo.color ? ` · ${vehiculo.color}` : ''}
              </p>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                Propietario:{' '}
                <Link href="/clientes" style={{ color: 'var(--brand)', fontWeight: 600, textDecoration: 'none' }}>
                  {vehiculo.cliente_nombre}
                </Link>
              </p>
            </div>
          </div>
          <Link
            href={`/ordenes-trabajo?vehiculo_id=${vehiculo.id}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#e6f4f3', color: 'var(--brand-dark)', border: '1px solid #c4dedd', borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            <Plus size={14} /> Nueva orden de trabajo
          </Link>
        </div>

        {/* ── Stats ── */}
        <div className="fichaBadgeStats">
          <div className="fichaStatCard">
            <div className="fichaStatLabel">Mantenciones realizadas</div>
            <div className="fichaStatValue">{Number(stats?.total_ordenes ?? 0)}</div>
          </div>
          <div className="fichaStatCard">
            <div className="fichaStatLabel">Último ingreso</div>
            <div className="fichaStatValue" style={{ fontSize: 15 }}>{FECHA(stats?.ultima_visita ?? null)}</div>
          </div>
          <div className="fichaStatCard">
            <div className="fichaStatLabel">Próx. mantención (KM)</div>
            <div className="fichaStatValue" style={{ fontSize: 15 }}>
              {stats?.km_proxima ? `${Number(stats.km_proxima).toLocaleString('es-CL')} km` : 'No registrada'}
            </div>
          </div>
          <div className="fichaStatCard">
            <div className="fichaStatLabel">Próx. mantención (fecha)</div>
            <div className="fichaStatValue" style={{ fontSize: 15 }}>
              {FECHA(stats?.fecha_proxima ?? null)}
            </div>
          </div>
        </div>

        {/* ── Próximas citas ── */}
        <div className="gridPanel" style={{ padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={15} style={{ color: 'var(--brand)' }} /> Próximas citas
            </p>
            <Link href={`/agenda/nueva?vehiculo_id=${vehiculo!.id}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '5px 12px', background: '#e6f4f3', color: 'var(--brand-dark)', border: '1px solid #c4dedd', borderRadius: 6, fontWeight: 600, textDecoration: 'none' }}>
              <Plus size={12} /> Agendar cita
            </Link>
          </div>
          {citasProximas.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Sin citas agendadas. <Link href={`/agenda/nueva?vehiculo_id=${vehiculo!.id}`} style={{ color: 'var(--brand)', fontWeight: 600 }}>Agendar ahora →</Link></p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {citasProximas.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--panel-strong)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {new Date(c.fecha_hora).toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' })}
                      {' '}&middot;{' '}
                      {new Date(c.fecha_hora).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                      {' '}
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>({c.duracion_min} min)</span>
                    </div>
                    {c.tipo_servicio && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{c.tipo_servicio}</div>}
                    {c.mecanico_nombre && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Mecánico: {c.mecanico_nombre}</div>}
                  </div>
                  <span className={`estado-cita ${c.estado}`}>{c.estado}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Timeline ── */}
        <div className="gridPanel" style={{ padding: '20px 24px' }}>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>
            Historial de mantenciones
          </p>

          {ordenes.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Este vehículo no tiene órdenes de trabajo registradas.</p>
          ) : (
            <div className="timeline">
              {ordenes.map(o => (
                <div key={o.id} className="timeline-item">
                  <div className="timeline-dot" style={{ background: o.estado === 'entregada' ? 'var(--ok)' : o.estado === 'en_progreso' ? '#3b82f6' : 'var(--brand)' }} />

                  <div style={{ background: 'var(--panel-strong)', border: '1px solid var(--line)', borderRadius: 8, padding: '14px 16px' }}>
                    {/* header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>#{o.id}</span>
                        <span className={`estadoBadge ${o.estado}`}>{ESTADO_LABELS[o.estado as EstadoOrden]}</span>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{FECHA(o.created_at)}</span>
                    </div>

                    {/* descripcion */}
                    <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>{o.descripcion}</p>

                    {/* km row */}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
                      {o.km_ingreso != null && (
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          KM ingreso: <strong style={{ color: 'var(--text)' }}>{o.km_ingreso.toLocaleString('es-CL')}</strong>
                        </span>
                      )}
                      {o.km_salida != null && (
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          KM salida: <strong style={{ color: 'var(--text)' }}>{o.km_salida.toLocaleString('es-CL')}</strong>
                        </span>
                      )}
                      {o.costo_total != null && (
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          Costo: <strong style={{ color: 'var(--ok)' }}>{CLP(o.costo_total)}</strong>
                        </span>
                      )}
                    </div>

                    {/* servicios */}
                    {o.servicios.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {o.servicios.map((s, i) => (
                          <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#e6f4f3', color: 'var(--brand-dark)', fontWeight: 600 }}>
                            {s.nombre}{s.precio_aplicado ? ` · ${CLP(s.precio_aplicado)}` : ''}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* checklist badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                      {o.checklist_completado ? (
                        <Link href={`/ordenes-trabajo/${o.id}/checklist`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#d1fae5', color: '#065f46', fontWeight: 700, textDecoration: 'none' }}>
                          <ClipboardCheck size={10} /> ✓ Checklist
                        </Link>
                      ) : (
                        <Link href={`/ordenes-trabajo/${o.id}/checklist`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--panel-strong)', color: 'var(--muted)', border: '1px solid var(--line)', textDecoration: 'none' }}>
                          <ClipboardCheck size={10} /> Ver checklist
                        </Link>
                      )}
                      {Number(o.observaciones_count) > 0 && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
                          ⚠ {o.observaciones_count} observ.
                        </span>
                      )}
                    </div>

                    {/* notas internas */}
                    {o.notas_internas && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', borderTop: '1px solid var(--line)', paddingTop: 8, marginTop: 8 }}>
                        <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>Nota interna: </span>
                        {o.notas_internas}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </AppShell>
  )
}

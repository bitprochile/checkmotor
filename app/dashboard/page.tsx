import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api-session'
import { initDB, query } from '@/lib/db'
import AppShell from '@/app/app-shell'
import { ClipboardList, TrendingUp, AlertTriangle, Package, Calendar } from 'lucide-react'
import IngresoChart from './ingreso-chart'
import type { OrdenTrabajoCompleta, EstadoOrden, EstadoCita } from '@/lib/db'

export const metadata = { title: 'Dashboard — TallerPro' }

const CLP  = (n: number | string | null) =>
  Number(n ?? 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })
const FECHA = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString('es-CL') : '—'

const ESTADO_LABELS: Record<EstadoOrden, string> = {
  presupuestada: 'Presupuestada',
  pendiente:   'Pendiente',
  en_progreso: 'En progreso',
  completada:  'Completada',
  entregada:   'Entregada',
  rechazada:   'Rechazada',
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  await initDB()

  const [
    [kpiIngreso],
    [kpiActivas],
    [kpiTicket],
    [kpiVehiculos],
    porEstado,
    topServicios,
    ingresosMeses,
    recientes,
    alertasStock,
    [kpiCitasHoy],
    [kpiCitasSemana],
    agendaHoy,
  ] = await Promise.all([
    query<{ ingresos: string }>(
      `SELECT COALESCE(SUM(costo_total),0) AS ingresos
       FROM ordenes_trabajo
       WHERE taller_id=$1 AND estado IN ('completada','entregada')
         AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', NOW())`,
      [session.tallerId],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM ordenes_trabajo
       WHERE taller_id=$1 AND estado IN ('pendiente','en_progreso')`,
      [session.tallerId],
    ),
    query<{ avg: string }>(
      `SELECT COALESCE(AVG(costo_total),0) AS avg
       FROM ordenes_trabajo
       WHERE taller_id=$1 AND estado IN ('completada','entregada')
         AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', NOW())`,
      [session.tallerId],
    ),
    query<{ count: string }>(
      `SELECT COUNT(DISTINCT vehiculo_id) AS count
       FROM ordenes_trabajo WHERE taller_id=$1
         AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`,
      [session.tallerId],
    ),
    query<{ estado: EstadoOrden; total: string }>(
      `SELECT estado, COUNT(*) AS total FROM ordenes_trabajo
       WHERE taller_id=$1 GROUP BY estado ORDER BY total DESC`,
      [session.tallerId],
    ),
    query<{ nombre: string; usos: string; ingresos: string }>(
      `SELECT s.nombre, COUNT(*) AS usos, COALESCE(SUM(ots.precio_aplicado),0) AS ingresos
       FROM ordenes_trabajo_servicios ots
       JOIN servicios s ON ots.servicio_id = s.id
       JOIN ordenes_trabajo ot ON ots.orden_id = ot.id
       WHERE ot.taller_id=$1
         AND DATE_TRUNC('month', ot.updated_at) = DATE_TRUNC('month', NOW())
       GROUP BY s.id, s.nombre ORDER BY usos DESC LIMIT 5`,
      [session.tallerId],
    ),
    query<{ mes_label: string; ingresos: string }>(
      `WITH meses AS (
         SELECT generate_series(
           DATE_TRUNC('month', NOW()) - INTERVAL '5 months',
           DATE_TRUNC('month', NOW()), INTERVAL '1 month'
         ) AS mes
       ),
       ing AS (
         SELECT DATE_TRUNC('month', updated_at) AS mes, SUM(costo_total) AS total
         FROM ordenes_trabajo
         WHERE taller_id=$1 AND estado IN ('completada','entregada')
           AND updated_at >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
         GROUP BY 1
       )
       SELECT TO_CHAR(m.mes,'Mon YY') AS mes_label, COALESCE(i.total,0) AS ingresos
       FROM meses m LEFT JOIN ing i ON m.mes = i.mes ORDER BY m.mes`,
      [session.tallerId],
    ),
    query<OrdenTrabajoCompleta>(
      `SELECT ot.*, v.patente, v.marca, v.modelo,
              c.nombre AS cliente_nombre, u.nombre AS mecanico_nombre
       FROM ordenes_trabajo ot
       JOIN vehiculos v ON ot.vehiculo_id = v.id
       JOIN clientes  c ON v.cliente_id   = c.id
       LEFT JOIN usuarios u ON ot.mecanico_id = u.id
       WHERE ot.taller_id=$1 ORDER BY ot.created_at DESC LIMIT 5`,
      [session.tallerId],
    ),
    query<{ nombre: string; codigo: string | null; stock_actual: string; stock_minimo: string; unidad: string }>(
      `SELECT nombre, codigo, stock_actual::float, stock_minimo::float, unidad
       FROM repuestos
       WHERE taller_id=$1 AND activo=true AND stock_actual <= stock_minimo
       ORDER BY CASE WHEN stock_actual=0 THEN 0 ELSE 1 END,
                (stock_actual::float / NULLIF(stock_minimo::float, 0)) ASC
       LIMIT 5`,
      [session.tallerId],
    ).catch(() => [] as never[]),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM citas
       WHERE taller_id=$1 AND estado NOT IN ('cancelada','no_asistio')
         AND DATE(fecha_hora AT TIME ZONE 'America/Santiago') = CURRENT_DATE`,
      [session.tallerId],
    ).catch(() => [{ count: '0' }]),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM citas
       WHERE taller_id=$1 AND estado NOT IN ('cancelada','no_asistio')
         AND DATE_TRUNC('week', fecha_hora AT TIME ZONE 'America/Santiago') = DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Santiago')`,
      [session.tallerId],
    ).catch(() => [{ count: '0' }]),
    query<{ fecha_hora: Date; duracion_min: number; tipo_servicio: string | null; estado: EstadoCita; patente: string; marca: string; modelo: string; cliente_nombre: string; cliente_telefono: string | null }>(
      `SELECT c.fecha_hora, c.duracion_min, c.tipo_servicio, c.estado,
              v.patente, v.marca, v.modelo, cl.nombre AS cliente_nombre, cl.telefono AS cliente_telefono
       FROM citas c
       JOIN vehiculos v  ON v.id = c.vehiculo_id
       JOIN clientes cl  ON cl.id = v.cliente_id
       WHERE c.taller_id=$1
         AND DATE(c.fecha_hora AT TIME ZONE 'America/Santiago') = CURRENT_DATE
         AND c.estado NOT IN ('cancelada','no_asistio')
       ORDER BY c.fecha_hora ASC`,
      [session.tallerId],
    ).catch(() => []),
  ])

  const hora   = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const chartData = ingresosMeses.map(m => ({ mes_label: m.mes_label, ingresos: Number(m.ingresos) }))

  return (
    <AppShell session={session}>
      <div className="shell">
        <div className="topbar">
          <h1>Dashboard</h1>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            {saludo}, {session.nombre.split(' ')[0]}
          </span>
        </div>

        {/* ── KPIs ── */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Ingresos del mes</div>
            <div className="kpi-value" style={{ fontSize: '1.4rem' }}>{CLP(kpiIngreso?.ingresos)}</div>
            <div className="kpi-sub">Órdenes completadas/entregadas</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Órdenes activas</div>
            <div className="kpi-value">{Number(kpiActivas?.count ?? 0)}</div>
            <div className="kpi-sub">Pendiente + En progreso</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Ticket promedio</div>
            <div className="kpi-value" style={{ fontSize: '1.4rem' }}>{CLP(kpiTicket?.avg)}</div>
            <div className="kpi-sub">Este mes</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Vehículos atendidos</div>
            <div className="kpi-value">{Number(kpiVehiculos?.count ?? 0)}</div>
            <div className="kpi-sub">Este mes</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Citas hoy</div>
            <div className="kpi-value">{Number(kpiCitasHoy?.count ?? 0)}</div>
            <div className="kpi-sub">Activas (excluye canceladas)</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Citas esta semana</div>
            <div className="kpi-value">{Number(kpiCitasSemana?.count ?? 0)}</div>
            <div className="kpi-sub">Lun – Dom</div>
          </div>
        </div>

        {/* ── Acceso rápido reportes (admin) ── */}
        {session.rol === 'admin' && (
          <a href="/reportes" className="panel-link" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
            <TrendingUp size={22} style={{ color: 'var(--brand)', flexShrink: 0 }} />
            <div>
              <div className="panel-link-label">Módulo de reportes</div>
              <div className="panel-link-value">Rentabilidad y análisis financiero</div>
              <div className="panel-link-cta">Ver reportes →</div>
            </div>
          </a>
        )}

        {/* ── Alertas de stock ── */}
        {alertasStock.length === 0 ? (
          <div className="notice" style={{ marginBottom: 20, display:'flex', alignItems:'center', gap:10 }}>
            <Package size={15} style={{ flexShrink:0 }} />
            Inventario en orden — ningún repuesto está bajo el stock mínimo.
          </div>
        ) : (
          <div className="warningBox" style={{ marginBottom: 20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, fontWeight:700 }}>
              <AlertTriangle size={15} />
              {alertasStock.length} repuesto{alertasStock.length > 1 ? 's' : ''} bajo el stock mínimo
            </div>
            <table className="entityTable" style={{ marginTop:0 }}>
              <thead><tr><th>Nombre</th><th>Código</th><th>Stock actual</th><th>Mínimo</th><th>Unidad</th></tr></thead>
              <tbody>
                {alertasStock.map((r, i) => (
                  <tr key={i}>
                    <td><strong>{r.nombre}</strong></td>
                    <td style={{ fontFamily:'monospace', color:'var(--muted)' }}>{r.codigo ?? '—'}</td>
                    <td style={{ color: Number(r.stock_actual) === 0 ? 'var(--danger)' : 'var(--accent)', fontWeight:700 }}>{r.stock_actual}</td>
                    <td style={{ color:'var(--muted)' }}>{r.stock_minimo}</td>
                    <td style={{ color:'var(--muted)' }}>{r.unidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <a href="/repuestos" style={{ display:'inline-block', marginTop:10, fontSize:12, color:'var(--brand-dark)', fontWeight:600 }}>
              Ver inventario completo →
            </a>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* ── Órdenes por estado ── */}
          <div className="gridPanel">
            <div className="toolbar">
              <ClipboardList size={15} style={{ color: 'var(--brand)' }} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Órdenes por estado</span>
            </div>
            {porEstado.length === 0 ? (
              <div style={{ padding: '24px 16px', color: 'var(--muted)', fontSize: 13 }}>Sin datos</div>
            ) : (
              <table className="entityTable">
                <thead><tr><th>Estado</th><th>Cantidad</th></tr></thead>
                <tbody>
                  {porEstado.map(r => (
                    <tr key={r.estado}>
                      <td><span className={`estadoBadge ${r.estado}`}>{ESTADO_LABELS[r.estado] ?? r.estado}</span></td>
                      <td style={{ fontWeight: 700 }}>{r.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Top servicios del mes ── */}
          <div className="gridPanel">
            <div className="toolbar">
              <TrendingUp size={15} style={{ color: 'var(--brand)' }} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Top servicios del mes</span>
            </div>
            {topServicios.length === 0 ? (
              <div style={{ padding: '24px 16px', color: 'var(--muted)', fontSize: 13 }}>Sin datos este mes</div>
            ) : (
              <table className="entityTable">
                <thead><tr><th>Servicio</th><th>Usos</th><th>Ingresos</th></tr></thead>
                <tbody>
                  {topServicios.map((s, i) => (
                    <tr key={i}>
                      <td>{s.nombre}</td>
                      <td style={{ fontWeight: 700 }}>{s.usos}</td>
                      <td style={{ fontWeight: 600, color: 'var(--ok)' }}>{CLP(s.ingresos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Ingresos últimos 6 meses ── */}
        <div className="gridPanel" style={{ marginBottom: 20 }}>
          <div className="toolbar">
            <TrendingUp size={15} style={{ color: 'var(--brand)' }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Ingresos últimos 6 meses</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, padding: '16px 20px', alignItems: 'start' }}>
            <IngresoChart data={chartData} />
            <table className="entityTable" style={{ width: 'auto', minWidth: 200 }}>
              <thead><tr><th>Mes</th><th>Ingresos</th></tr></thead>
              <tbody>
                {ingresosMeses.map((m, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--muted)' }}>{m.mes_label}</td>
                    <td style={{ fontWeight: 600 }}>{CLP(m.ingresos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Órdenes recientes ── */}
        <div className="gridPanel">
          <div className="toolbar">
            <ClipboardList size={15} style={{ color: 'var(--brand)' }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Órdenes recientes</span>
          </div>
          {recientes.length === 0 ? (
            <div style={{ padding: '24px 16px', color: 'var(--muted)', fontSize: 13 }}>Sin órdenes aún</div>
          ) : (
            <table className="entityTable">
              <thead>
                <tr>
                  <th>#</th><th>Patente</th><th>Cliente</th>
                  <th>Estado</th><th>Costo</th><th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recientes.map(o => (
                  <tr key={o.id}>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>#{o.id}</td>
                    <td><strong style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{o.patente}</strong></td>
                    <td style={{ color: 'var(--muted)' }}>{o.cliente_nombre}</td>
                    <td><span className={`estadoBadge ${o.estado}`}>{ESTADO_LABELS[o.estado]}</span></td>
                    <td style={{ fontWeight: 600 }}>{CLP(o.costo_total)}</td>
                    <td style={{ color: 'var(--muted)' }}>{FECHA(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Agenda de hoy ── */}
        <div className="gridPanel" style={{ marginTop: 20 }}>
          <div className="toolbar">
            <Calendar size={15} style={{ color: 'var(--brand)' }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Agenda de hoy</span>
            <a href="/agenda" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--brand)', fontWeight: 600, textDecoration: 'none' }}>Ver agenda completa →</a>
          </div>
          {agendaHoy.length === 0 ? (
            <div style={{ padding: '20px 16px' }}>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>Sin citas para hoy.</p>
              <a href="/agenda/nueva" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 13, padding: '7px 14px', background: '#e6f4f3', color: 'var(--brand-dark)', border: '1px solid #c4dedd', borderRadius: 6, fontWeight: 600, textDecoration: 'none' }}>
                + Agendar cita
              </a>
            </div>
          ) : (
            <table className="entityTable">
              <thead>
                <tr><th>Hora</th><th>Vehículo</th><th>Cliente</th><th>Servicio</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {agendaHoy.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {new Date(c.fecha_hora).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                      <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 4 }}>({c.duracion_min}min)</span>
                    </td>
                    <td><strong style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{c.patente}</strong> <span style={{ color: 'var(--muted)', fontSize: 12 }}>{c.marca} {c.modelo}</span></td>
                    <td style={{ color: 'var(--muted)' }}>{c.cliente_nombre}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{c.tipo_servicio ?? '—'}</td>
                    <td><span className={`estado-cita ${c.estado}`}>{c.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </AppShell>
  )
}

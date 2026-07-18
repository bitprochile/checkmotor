import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/api-session'
import { initDB, queryOne } from '@/lib/db'
import AppShell from '@/app/app-shell'
import ChecklistForm from '@/app/components/ChecklistForm'
import { ArrowLeft, ClipboardCheck } from 'lucide-react'
import type { OrdenTrabajoCompleta } from '@/lib/db'

const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente', en_progreso: 'En progreso',
  completada: 'Completada', entregada: 'Entregada',
}
const CLP = (n: number | string | null) =>
  Number(n ?? 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })
const FECHA = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString('es-CL') : '—'

type Params = { params: Promise<{ id: string }> }

export default async function OrdenDetallePage({ params }: Params) {
  const session = await getSession()
  if (!session) redirect('/login')
  const { id } = await params
  await initDB()

  const orden = await queryOne<OrdenTrabajoCompleta>(
    `SELECT ot.*, v.patente, v.marca, v.modelo,
            c.nombre AS cliente_nombre, u.nombre AS mecanico_nombre
     FROM ordenes_trabajo ot
     JOIN vehiculos v  ON v.id = ot.vehiculo_id
     JOIN clientes  c  ON c.id = v.cliente_id
     LEFT JOIN usuarios u ON u.id = ot.mecanico_id
     WHERE ot.id=$1 AND ot.taller_id=$2`,
    [id, session.tallerId],
  )
  if (!orden) notFound()

  const soloLectura = ['completada', 'entregada'].includes(orden.estado)

  const clRow = await queryOne<{ total: string; revisados: string }>(
    `SELECT COUNT(*) AS total,
            COUNT(CASE WHEN estado != 'pendiente' THEN 1 END) AS revisados
     FROM ordenes_checklist WHERE orden_id=$1`,
    [id],
  )
  const clTotal    = Number(clRow?.total ?? 0)
  const clRevisados = Number(clRow?.revisados ?? 0)
  const checklistBadge =
    clTotal === 0           ? 'sin-iniciar' as const
    : orden.checklist_completado ? 'completado'  as const
    : clRevisados > 0       ? 'en-progreso' as const
    :                          'sin-iniciar' as const

  return (
    <AppShell session={session}>
      <div className="shell">
        <div style={{ marginBottom: 16 }}>
          <Link href="/ordenes-trabajo" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', textDecoration: 'none' }}>
            <ArrowLeft size={14} /> Volver a órdenes
          </Link>
        </div>

        <div className="topbar">
          <div>
            <h1>Orden #{orden.id}</h1>
            <span className={`estadoBadge ${orden.estado}`} style={{ marginTop: 4, display: 'inline-block' }}>
              {ESTADO_LABELS[orden.estado]}
            </span>
          </div>
          <Link href={`/ordenes-trabajo/${id}/checklist`}
            style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 14px', background:'#e6f4f3', color:'var(--brand-dark)', border:'1px solid #c4dedd', borderRadius:6, fontSize:13, fontWeight:600, textDecoration:'none' }}>
            <ClipboardCheck size={14} /> Checklist completo
          </Link>
        </div>

        {/* Datos de la orden */}
        <div className="gridPanel" style={{ padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>Vehículo</div>
              <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, letterSpacing: 2 }}>{orden.patente}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{orden.marca} {orden.modelo}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>Cliente</div>
              <div style={{ fontWeight: 600 }}>{orden.cliente_nombre}</div>
            </div>
            {orden.mecanico_nombre && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>Mecánico</div>
                <div style={{ fontWeight: 600 }}>{orden.mecanico_nombre}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>Fecha ingreso</div>
              <div>{FECHA(orden.created_at)}</div>
            </div>
            {orden.km_ingreso && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>KM ingreso</div>
                <div>{Number(orden.km_ingreso).toLocaleString('es-CL')} km</div>
              </div>
            )}
            {orden.costo_total && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>Costo total</div>
                <div style={{ fontWeight: 700, color: 'var(--ok)' }}>{CLP(orden.costo_total)}</div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Trabajo solicitado</div>
            <p style={{ fontSize: 13 }}>{orden.descripcion}</p>
          </div>
        </div>

        {/* Checklist embebido */}
        <div className="gridPanel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <ClipboardCheck size={16} style={{ color: 'var(--brand)' }} />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Checklist de recepción</span>
            <span className={`checklist-badge ${checklistBadge}`}>
              {checklistBadge === 'completado'  && '✓ Completado'}
              {checklistBadge === 'en-progreso' && 'En progreso'}
              {checklistBadge === 'sin-iniciar' && 'Sin iniciar'}
            </span>
          </div>
          <ChecklistForm ordenId={orden.id} soloLectura={soloLectura} />
        </div>
      </div>
    </AppShell>
  )
}

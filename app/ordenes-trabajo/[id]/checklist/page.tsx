import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/api-session'
import { initDB, queryOne } from '@/lib/db'
import AppShell from '@/app/app-shell'
import ChecklistForm from '@/app/components/ChecklistForm'
import { ArrowLeft, Printer, ClipboardCheck } from 'lucide-react'
import type { OrdenTrabajoCompleta } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export default async function ChecklistPage({ params }: Params) {
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

  return (
    <AppShell session={session}>
      <div className="shell">
        <div style={{ marginBottom: 16 }}>
          <Link href={`/ordenes-trabajo/${id}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', textDecoration: 'none' }}>
            <ArrowLeft size={14} /> Volver a orden #{id}
          </Link>
        </div>

        <div className="topbar">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardCheck size={18} style={{ color: 'var(--brand)' }} />
              <h1>Checklist de recepción — Orden #{id}</h1>
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: 'var(--muted)' }}>
              {orden.patente} · {orden.marca} {orden.modelo} · {orden.cliente_nombre}
            </div>
          </div>
          <Link
            href={`/ordenes-trabajo/${id}/checklist/imprimir`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)',
              borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            <Printer size={14} /> Ver acta imprimible
          </Link>
        </div>

        <div className="gridPanel" style={{ padding: '20px 24px' }}>
          <ChecklistForm ordenId={orden.id} soloLectura={soloLectura} />
        </div>
      </div>
    </AppShell>
  )
}

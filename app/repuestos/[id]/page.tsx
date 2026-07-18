import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api-session'
import { initDB, queryOne, query } from '@/lib/db'
import AppShell from '@/app/app-shell'
import RepuestoFicha, { type MovimientoConUser } from './repuesto-ficha'
import type { Repuesto } from '@/lib/db'

export const metadata = { title: 'Repuesto — TallerPro' }

type Params = { params: Promise<{ id: string }> }

export default async function RepuestoPage({ params }: Params) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  await initDB()

  const repuesto = await queryOne<Repuesto>(
    'SELECT * FROM repuestos WHERE id=$1 AND taller_id=$2',
    [id, session.tallerId],
  )
  if (!repuesto) redirect('/repuestos')

  const movimientos = await query<MovimientoConUser>(
    `SELECT m.*, u.nombre AS usuario_nombre
     FROM movimientos_stock m
     LEFT JOIN usuarios u ON u.id = m.usuario_id
     WHERE m.repuesto_id=$1 AND m.taller_id=$2
     ORDER BY m.created_at DESC LIMIT 20`,
    [id, session.tallerId],
  )

  return (
    <AppShell session={session}>
      <div className="shell">
        <RepuestoFicha repuesto={repuesto} movimientos={movimientos} />
      </div>
    </AppShell>
  )
}

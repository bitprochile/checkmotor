import { NextRequest, NextResponse } from 'next/server'
import { initDB, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  await initDB()

  const orden = await queryOne<{ id: number; estado: string }>(
    'SELECT id, estado FROM ordenes_trabajo WHERE id=$1 AND taller_id=$2',
    [id, session.tallerId],
  )
  if (!orden) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (!['pendiente', 'en_progreso'].includes(orden.estado))
    return NextResponse.json({ error: 'Solo se puede reiniciar en órdenes pendientes o en progreso' }, { status: 422 })

  await query(
    `UPDATE ordenes_checklist SET estado='pendiente', nota=NULL, revisado_en=NULL WHERE orden_id=$1`,
    [id],
  )
  await query(
    `UPDATE ordenes_trabajo SET checklist_completado=false WHERE id=$1`,
    [id],
  )
  return NextResponse.json({ ok: true })
}

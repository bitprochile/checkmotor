import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api-session'
import { initDB, queryOne, OrdenTrabajo } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.rol !== 'admin' && session.rol !== 'recepcion')
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  await initDB()
  const { id } = await params

  const actual = await queryOne<{ estado: string }>(
    `SELECT estado FROM ordenes_trabajo WHERE id = $1 AND taller_id = $2`,
    [id, session.tallerId],
  )
  if (!actual) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (actual.estado !== 'presupuestada')
    return NextResponse.json(
      { error: 'Solo se pueden aprobar órdenes en estado presupuestada' },
      { status: 422 },
    )

  const orden = await queryOne<OrdenTrabajo>(
    `UPDATE ordenes_trabajo
       SET estado = 'pendiente', aprobado_en = NOW(), updated_at = NOW()
     WHERE id = $1 AND taller_id = $2
     RETURNING *`,
    [id, session.tallerId],
  )
  return NextResponse.json({ orden })
}

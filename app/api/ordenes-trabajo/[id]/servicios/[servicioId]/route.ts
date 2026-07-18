import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession } from '@/lib/api-session'

type Params = { params: Promise<{ id: string; servicioId: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id, servicioId } = await params
  await query(
    `DELETE FROM ordenes_trabajo_servicios
     WHERE orden_id=$1 AND servicio_id=$2
       AND EXISTS (SELECT 1 FROM ordenes_trabajo WHERE id=$1 AND taller_id=$3)`,
    [id, servicioId, session.tallerId],
  )
  return NextResponse.json({ ok: true })
}

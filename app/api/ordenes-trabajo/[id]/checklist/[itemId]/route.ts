import { NextRequest, NextResponse } from 'next/server'
import { initDB, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'
import type { OrdenChecklistConItem } from '@/lib/db'

type Params = { params: Promise<{ id: string; itemId: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id, itemId } = await params
  await initDB()

  const { estado, nota } = await req.json()
  if (!['ok', 'observacion', 'no_aplica'].includes(estado))
    return NextResponse.json({ error: 'estado inválido' }, { status: 400 })

  // Verify order belongs to taller
  const orden = await queryOne<{ id: number }>(
    'SELECT id FROM ordenes_trabajo WHERE id=$1 AND taller_id=$2', [id, session.tallerId],
  )
  if (!orden) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const item = await queryOne<OrdenChecklistConItem>(
    `WITH upd AS (
       UPDATE ordenes_checklist
       SET estado=$1, nota=$2, revisado_en=NOW()
       WHERE orden_id=$3 AND item_id=$4
       RETURNING *
     )
     SELECT upd.*,
       ci.categoria, ci.nombre AS item_nombre,
       ci.descripcion AS item_descripcion, ci.orden AS item_orden
     FROM upd JOIN checklist_items ci ON ci.id = upd.item_id`,
    [estado, nota?.trim() || null, id, itemId],
  )
  if (!item) return NextResponse.json({ error: 'Ítem no encontrado en checklist' }, { status: 404 })

  // Recalculate checklist_completado
  const [{ pendientes }] = await query<{ pendientes: string }>(
    `SELECT COUNT(*) AS pendientes FROM ordenes_checklist
     WHERE orden_id=$1 AND estado='pendiente'`,
    [id],
  )
  const completado = Number(pendientes) === 0
  await query(
    `UPDATE ordenes_trabajo SET checklist_completado=$1 WHERE id=$2`,
    [completado, id],
  )

  return NextResponse.json({ item, checklist_completado: completado })
}

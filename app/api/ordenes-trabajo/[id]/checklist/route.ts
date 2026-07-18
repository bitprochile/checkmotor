import { NextRequest, NextResponse } from 'next/server'
import { initDB, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'
import type { OrdenChecklistConItem } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

const CHECKLIST_QUERY = `
  SELECT
    oc.*,
    ci.categoria,
    ci.nombre      AS item_nombre,
    ci.descripcion AS item_descripcion,
    ci.orden       AS item_orden
  FROM ordenes_checklist oc
  JOIN checklist_items ci ON ci.id = oc.item_id
  WHERE oc.orden_id = $1
  ORDER BY ci.categoria ASC, ci.orden ASC
`

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  await initDB()

  // Verify order belongs to taller
  const orden = await queryOne<{ id: number }>(
    'SELECT id FROM ordenes_trabajo WHERE id=$1 AND taller_id=$2', [id, session.tallerId],
  )
  if (!orden) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const items = await query<OrdenChecklistConItem>(CHECKLIST_QUERY, [id])
  return NextResponse.json({ items, inicializado: items.length > 0 })
}

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  await initDB()

  const orden = await queryOne<{ id: number }>(
    'SELECT id FROM ordenes_trabajo WHERE id=$1 AND taller_id=$2', [id, session.tallerId],
  )
  if (!orden) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await query(
    `INSERT INTO ordenes_checklist (orden_id, item_id, estado)
     SELECT $1, ci.id, 'pendiente'
     FROM checklist_items ci
     WHERE ci.taller_id=$2 AND ci.activo=true
     ON CONFLICT (orden_id, item_id) DO NOTHING`,
    [id, session.tallerId],
  )

  const items = await query<OrdenChecklistConItem>(CHECKLIST_QUERY, [id])
  return NextResponse.json({ items, inicializado: true }, { status: 201 })
}

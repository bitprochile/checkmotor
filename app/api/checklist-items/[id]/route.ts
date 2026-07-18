import { NextRequest, NextResponse } from 'next/server'
import { initDB, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'
import type { ChecklistItem } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  await initDB()

  const { categoria, nombre, descripcion, orden, activo } = await req.json()
  if (!categoria?.trim() || !nombre?.trim())
    return NextResponse.json({ error: 'categoria y nombre son requeridos' }, { status: 400 })

  const item = await queryOne<ChecklistItem>(
    `UPDATE checklist_items
     SET categoria=$1, nombre=$2, descripcion=$3, orden=$4, activo=$5
     WHERE id=$6 AND taller_id=$7 RETURNING *`,
    [
      categoria.trim(), nombre.trim(), descripcion?.trim() || null,
      Number(orden), activo ?? true, id, session.tallerId,
    ],
  )
  if (!item) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ item })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  await initDB()

  await queryOne(
    `UPDATE checklist_items SET activo=false WHERE id=$1 AND taller_id=$2`,
    [id, session.tallerId],
  )
  return NextResponse.json({ ok: true })
}

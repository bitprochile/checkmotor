import { NextRequest, NextResponse } from 'next/server'
import { initDB, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'
import type { ChecklistItem } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()

  const activo = req.nextUrl.searchParams.get('activo')
  const params: unknown[] = [session.tallerId]
  let filtro = ''
  if (activo !== null) { params.push(activo === 'true'); filtro = ` AND activo = $2` }

  const items = await query<ChecklistItem>(
    `SELECT * FROM checklist_items WHERE taller_id=$1${filtro} ORDER BY categoria ASC, orden ASC`,
    params,
  )
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()

  const { categoria, nombre, descripcion, orden } = await req.json()
  if (!categoria?.trim() || !nombre?.trim())
    return NextResponse.json({ error: 'categoria y nombre son requeridos' }, { status: 400 })

  let ordn = Number(orden)
  if (!orden) {
    const [{ max }] = await query<{ max: string | null }>(
      'SELECT MAX(orden) AS max FROM checklist_items WHERE taller_id=$1', [session.tallerId],
    )
    ordn = (Number(max ?? 0)) + 1
  }

  const item = await queryOne<ChecklistItem>(
    `INSERT INTO checklist_items (taller_id, categoria, nombre, descripcion, orden)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [session.tallerId, categoria.trim(), nombre.trim(), descripcion?.trim() || null, ordn],
  )
  return NextResponse.json({ item }, { status: 201 })
}

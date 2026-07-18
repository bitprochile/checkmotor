import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, Servicio } from '@/lib/db'
import { getSession } from '@/lib/api-session'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  const { nombre, descripcion, precio_base, activo } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  const servicio = await queryOne<Servicio>(
    `UPDATE servicios SET nombre=$1, descripcion=$2, precio_base=$3, activo=$4
     WHERE id=$5 AND taller_id=$6 RETURNING *`,
    [nombre.trim(), descripcion || null, precio_base || null, activo ?? true, id, session.tallerId],
  )
  if (!servicio) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ servicio })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  await query('DELETE FROM servicios WHERE id=$1 AND taller_id=$2', [id, session.tallerId])
  return NextResponse.json({ ok: true })
}

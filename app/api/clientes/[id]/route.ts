import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, Cliente } from '@/lib/db'
import { getSession } from '@/lib/api-session'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  const { nombre, rut, email, telefono } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  const cliente = await queryOne<Cliente>(
    `UPDATE clientes SET nombre=$1, rut=$2, email=$3, telefono=$4
     WHERE id=$5 AND taller_id=$6 RETURNING *`,
    [nombre.trim(), rut || null, email || null, telefono || null, id, session.tallerId],
  )
  if (!cliente) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ cliente })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  await query('DELETE FROM clientes WHERE id=$1 AND taller_id=$2', [id, session.tallerId])
  return NextResponse.json({ ok: true })
}

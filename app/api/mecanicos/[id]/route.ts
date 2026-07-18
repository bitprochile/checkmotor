import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'
import bcrypt from 'bcryptjs'
import type { Usuario } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

const COLS = 'id, taller_id, nombre, email, rol, activo, created_at'

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  const { nombre, email, activo, password } = await req.json()
  if (!nombre?.trim() || !email?.trim())
    return NextResponse.json({ error: 'Nombre y email son requeridos' }, { status: 400 })

  let mecanico: Usuario | null
  if (password?.trim()) {
    const hash = await bcrypt.hash(password, 10)
    mecanico = await queryOne<Usuario>(
      `UPDATE usuarios SET nombre=$1, email=$2, activo=$3, password_hash=$4
       WHERE id=$5 AND taller_id=$6 AND rol='mecanico' RETURNING ${COLS}`,
      [nombre.trim(), email.trim().toLowerCase(), activo ?? true, hash, id, session.tallerId],
    )
  } else {
    mecanico = await queryOne<Usuario>(
      `UPDATE usuarios SET nombre=$1, email=$2, activo=$3
       WHERE id=$4 AND taller_id=$5 AND rol='mecanico' RETURNING ${COLS}`,
      [nombre.trim(), email.trim().toLowerCase(), activo ?? true, id, session.tallerId],
    )
  }
  if (!mecanico) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ mecanico })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  await query(
    "DELETE FROM usuarios WHERE id=$1 AND taller_id=$2 AND rol='mecanico'",
    [id, session.tallerId],
  )
  return NextResponse.json({ ok: true })
}

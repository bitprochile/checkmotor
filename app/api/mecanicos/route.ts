import { NextRequest, NextResponse } from 'next/server'
import { initDB, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'
import bcrypt from 'bcryptjs'
import type { Usuario } from '@/lib/db'

const COLS = 'id, taller_id, nombre, email, rol, activo, created_at'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()
  const mecanicos = await query<Usuario>(
    `SELECT ${COLS} FROM usuarios WHERE taller_id=$1 AND rol='mecanico' ORDER BY nombre ASC`,
    [session.tallerId],
  )
  return NextResponse.json({ mecanicos })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { nombre, email, password } = await req.json()
  if (!nombre?.trim() || !email?.trim() || !password?.trim())
    return NextResponse.json({ error: 'Nombre, email y contraseña son requeridos' }, { status: 400 })
  try {
    const hash      = await bcrypt.hash(password, 10)
    const mecanico  = await queryOne<Usuario>(
      `INSERT INTO usuarios (taller_id, nombre, email, password_hash, rol)
       VALUES ($1,$2,$3,$4,'mecanico') RETURNING ${COLS}`,
      [session.tallerId, nombre.trim(), email.trim().toLowerCase(), hash],
    )
    return NextResponse.json({ mecanico }, { status: 201 })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505')
      return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 })
    throw err
  }
}

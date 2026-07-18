import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { initDB, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'

type Params = { params: Promise<{ id: string }> }

async function requireSuperAdmin() {
  const session = await getSession()
  if (!session || !session.superadmin) return null
  return session
}

export async function GET(_req: NextRequest, { params }: Params) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  await initDB()
  const { id } = await params

  const usuarios = await query<{
    id: number; nombre: string; email: string; rol: string
    activo: boolean; superadmin: boolean; created_at: Date
  }>(
    `SELECT id, nombre, email, rol, activo, superadmin, created_at
     FROM usuarios WHERE taller_id = $1 ORDER BY rol, nombre`,
    [id],
  )

  return NextResponse.json({ usuarios })
}

export async function POST(req: NextRequest, { params }: Params) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  await initDB()
  const { id } = await params

  const taller = await queryOne('SELECT id FROM talleres WHERE id = $1', [id])
  if (!taller) return NextResponse.json({ error: 'Taller no encontrado' }, { status: 404 })

  const { nombre, email, password, rol } = await req.json()
  if (!nombre?.trim() || !email?.trim() || !password?.trim())
    return NextResponse.json({ error: 'Nombre, email y contraseña son requeridos' }, { status: 400 })

  const rolesValidos = ['admin', 'mecanico', 'recepcion']
  if (!rolesValidos.includes(rol))
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })

  const existing = await queryOne('SELECT id FROM usuarios WHERE email = $1', [email.toLowerCase().trim()])
  if (existing) return NextResponse.json({ error: 'El email ya está en uso' }, { status: 409 })

  const hash = await bcrypt.hash(password, 10)
  const usuario = await queryOne<{ id: number }>(
    `INSERT INTO usuarios (taller_id, nombre, email, password_hash, rol, activo, superadmin)
     VALUES ($1,$2,$3,$4,$5,true,false) RETURNING id`,
    [id, nombre.trim(), email.toLowerCase().trim(), hash, rol],
  )

  return NextResponse.json({ ok: true, id: usuario!.id }, { status: 201 })
}

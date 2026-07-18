import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { initDB, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'

async function requireSuperAdmin() {
  const session = await getSession()
  if (!session || !session.superadmin) return null
  return session
}

export async function GET() {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  await initDB()

  const talleres = await query<{
    id: number; nombre: string; activo: boolean; email: string | null
    telefono: string | null; direccion: string | null; created_at: Date
    usuarios_count: string; ordenes_activas: string
  }>(`
    SELECT t.id, t.nombre, t.activo, t.email, t.telefono, t.direccion, t.created_at,
      COUNT(DISTINCT u.id)  FILTER (WHERE u.activo = true)                              AS usuarios_count,
      COUNT(DISTINCT ot.id) FILTER (WHERE ot.estado NOT IN ('entregada','rechazada'))   AS ordenes_activas
    FROM talleres t
    LEFT JOIN usuarios u ON u.taller_id = t.id
    LEFT JOIN ordenes_trabajo ot ON ot.taller_id = t.id
    GROUP BY t.id
    ORDER BY t.id
  `)

  return NextResponse.json({ talleres })
}

export async function POST(req: NextRequest) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  await initDB()

  const body = await req.json()
  const { nombre, email, telefono, direccion, admin_nombre, admin_email, admin_password } = body

  if (!nombre?.trim())
    return NextResponse.json({ error: 'El nombre del taller es requerido' }, { status: 400 })
  if (!admin_email?.trim() || !admin_password?.trim())
    return NextResponse.json({ error: 'Email y contraseña del administrador son requeridos' }, { status: 400 })

  const existing = await queryOne('SELECT id FROM usuarios WHERE email = $1', [admin_email.toLowerCase().trim()])
  if (existing) return NextResponse.json({ error: 'El email del administrador ya está en uso' }, { status: 409 })

  const taller = await queryOne<{ id: number }>(
    `INSERT INTO talleres (nombre, email, telefono, direccion, activo)
     VALUES ($1, $2, $3, $4, true) RETURNING id`,
    [nombre.trim(), email?.trim() || null, telefono?.trim() || null, direccion?.trim() || null],
  )

  const hash = await bcrypt.hash(admin_password, 10)
  await query(
    `INSERT INTO usuarios (taller_id, nombre, email, password_hash, rol, activo, superadmin)
     VALUES ($1,$2,$3,$4,'admin',true,false)`,
    [taller!.id, (admin_nombre?.trim() || 'Administrador'), admin_email.toLowerCase().trim(), hash],
  )

  return NextResponse.json({ ok: true, id: taller!.id }, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { initDB, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'

type Params = { params: Promise<{ id: string; uid: string }> }

async function requireSuperAdmin() {
  const session = await getSession()
  if (!session || !session.superadmin) return null
  return session
}

export async function PUT(req: NextRequest, { params }: Params) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  await initDB()
  const { id, uid } = await params

  const { nombre, rol, activo, password } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

  const rolesValidos = ['admin', 'mecanico', 'recepcion']
  if (!rolesValidos.includes(rol)) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })

  if (password?.trim()) {
    const hash = await bcrypt.hash(password, 10)
    await query(
      `UPDATE usuarios SET nombre=$1, rol=$2, activo=$3, password_hash=$4
       WHERE id=$5 AND taller_id=$6`,
      [nombre.trim(), rol, activo !== false, hash, uid, id],
    )
  } else {
    await query(
      `UPDATE usuarios SET nombre=$1, rol=$2, activo=$3 WHERE id=$4 AND taller_id=$5`,
      [nombre.trim(), rol, activo !== false, uid, id],
    )
  }

  const usuario = await queryOne('SELECT id FROM usuarios WHERE id=$1 AND taller_id=$2', [uid, id])
  if (!usuario) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  await initDB()
  const { id, uid } = await params

  const usuario = await queryOne<{ superadmin: boolean }>(
    'SELECT superadmin FROM usuarios WHERE id=$1 AND taller_id=$2', [uid, id],
  )
  if (!usuario) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  if (usuario.superadmin) return NextResponse.json({ error: 'No se puede eliminar un superadmin' }, { status: 400 })

  await query('DELETE FROM usuarios WHERE id=$1 AND taller_id=$2', [uid, id])
  return NextResponse.json({ ok: true })
}

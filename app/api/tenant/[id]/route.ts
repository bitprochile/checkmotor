import { NextRequest, NextResponse } from 'next/server'
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

  const taller = await queryOne<{
    id: number; nombre: string; activo: boolean; email: string | null
    telefono: string | null; direccion: string | null; created_at: Date
  }>('SELECT id, nombre, activo, email, telefono, direccion, created_at FROM talleres WHERE id = $1', [id])

  if (!taller) return NextResponse.json({ error: 'Taller no encontrado' }, { status: 404 })

  const usuarios = await query<{
    id: number; nombre: string; email: string; rol: string
    activo: boolean; superadmin: boolean; created_at: Date
  }>(
    `SELECT id, nombre, email, rol, activo, superadmin, created_at
     FROM usuarios WHERE taller_id = $1 ORDER BY rol, nombre`,
    [id],
  )

  return NextResponse.json({ taller, usuarios })
}

export async function PUT(req: NextRequest, { params }: Params) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  await initDB()
  const { id } = await params

  const { nombre, email, telefono, direccion, activo } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

  const taller = await queryOne<{ id: number }>(
    `UPDATE talleres SET nombre=$1, email=$2, telefono=$3, direccion=$4, activo=$5
     WHERE id=$6 RETURNING id`,
    [nombre.trim(), email?.trim() || null, telefono?.trim() || null, direccion?.trim() || null,
     activo !== false, id],
  )

  if (!taller) return NextResponse.json({ error: 'Taller no encontrado' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  await initDB()
  const { id } = await params

  if (id === '1') return NextResponse.json({ error: 'No se puede eliminar el taller principal' }, { status: 400 })

  const [{ count: clientes }] = await query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM clientes WHERE taller_id = $1', [id],
  )
  const [{ count: ordenes }] = await query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM ordenes_trabajo WHERE taller_id = $1', [id],
  )

  if (Number(clientes) > 0 || Number(ordenes) > 0) {
    return NextResponse.json({
      error: `No se puede eliminar: el taller tiene ${clientes} cliente(s) y ${ordenes} orden(es). Desactívalo en su lugar.`,
    }, { status: 409 })
  }

  await query('DELETE FROM usuarios WHERE taller_id = $1', [id])
  await query('DELETE FROM talleres WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}

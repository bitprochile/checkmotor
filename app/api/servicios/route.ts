import { NextRequest, NextResponse } from 'next/server'
import { initDB, query, queryOne, Servicio } from '@/lib/db'
import { getSession } from '@/lib/api-session'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()
  const servicios = await query<Servicio>(
    'SELECT * FROM servicios WHERE taller_id=$1 ORDER BY nombre ASC',
    [session.tallerId],
  )
  return NextResponse.json({ servicios })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()
  const { nombre, descripcion, precio_base, activo = true } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  const servicio = await queryOne<Servicio>(
    `INSERT INTO servicios (taller_id, nombre, descripcion, precio_base, activo)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [session.tallerId, nombre.trim(), descripcion || null, precio_base || null, activo],
  )
  return NextResponse.json({ servicio }, { status: 201 })
}

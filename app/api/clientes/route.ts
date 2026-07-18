import { NextRequest, NextResponse } from 'next/server'
import { initDB, query, queryOne, Cliente } from '@/lib/db'
import { getSession } from '@/lib/api-session'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()
  const clientes = await query<Cliente>(
    'SELECT * FROM clientes WHERE taller_id = $1 ORDER BY nombre ASC',
    [session.tallerId],
  )
  return NextResponse.json({ clientes })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()
  const { nombre, rut, email, telefono } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  const cliente = await queryOne<Cliente>(
    `INSERT INTO clientes (taller_id, nombre, rut, email, telefono)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [session.tallerId, nombre.trim(), rut || null, email || null, telefono || null],
  )
  return NextResponse.json({ cliente }, { status: 201 })
}

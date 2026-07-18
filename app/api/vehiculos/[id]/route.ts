import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, Vehiculo } from '@/lib/db'
import { getSession } from '@/lib/api-session'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  const vehiculo = await queryOne<Vehiculo>(
    `SELECT v.*, c.nombre AS cliente_nombre FROM vehiculos v JOIN clientes c ON c.id = v.cliente_id
     WHERE v.id=$1 AND v.taller_id=$2`,
    [id, session.tallerId],
  )
  if (!vehiculo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ vehiculo })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  const { cliente_id, patente, marca, modelo, anio, color } = await req.json()
  if (!cliente_id || !patente?.trim() || !marca?.trim() || !modelo?.trim())
    return NextResponse.json({ error: 'Cliente, patente, marca y modelo son requeridos' }, { status: 400 })
  const vehiculo = await queryOne<Vehiculo>(
    `UPDATE vehiculos SET cliente_id=$1, patente=$2, marca=$3, modelo=$4, anio=$5, color=$6
     WHERE id=$7 AND taller_id=$8 RETURNING *`,
    [cliente_id, patente.trim().toUpperCase(), marca.trim(), modelo.trim(), anio || null, color || null, id, session.tallerId],
  )
  if (!vehiculo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ vehiculo })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  await query('DELETE FROM vehiculos WHERE id=$1 AND taller_id=$2', [id, session.tallerId])
  return NextResponse.json({ ok: true })
}

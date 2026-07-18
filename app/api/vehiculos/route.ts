import { NextRequest, NextResponse } from 'next/server'
import { initDB, query, queryOne, VehiculoConCliente, Vehiculo } from '@/lib/db'
import { getSession } from '@/lib/api-session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()
  const clienteId = req.nextUrl.searchParams.get('cliente_id')
  const params: unknown[] = [session.tallerId]
  let extra = ''
  if (clienteId) { params.push(Number(clienteId)); extra = ` AND v.cliente_id = $2` }
  const vehiculos = await query<VehiculoConCliente>(
    `SELECT v.*, c.nombre AS cliente_nombre
     FROM vehiculos v JOIN clientes c ON v.cliente_id = c.id
     WHERE v.taller_id = $1${extra} ORDER BY v.created_at DESC`,
    params,
  )
  return NextResponse.json({ vehiculos })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()
  const { cliente_id, patente, marca, modelo, anio, color } = await req.json()
  if (!cliente_id || !patente?.trim() || !marca?.trim() || !modelo?.trim())
    return NextResponse.json({ error: 'Cliente, patente, marca y modelo son requeridos' }, { status: 400 })
  const vehiculo = await queryOne<Vehiculo>(
    `INSERT INTO vehiculos (taller_id, cliente_id, patente, marca, modelo, anio, color)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [session.tallerId, cliente_id, patente.trim().toUpperCase(), marca.trim(), modelo.trim(), anio || null, color || null],
  )
  return NextResponse.json({ vehiculo }, { status: 201 })
}

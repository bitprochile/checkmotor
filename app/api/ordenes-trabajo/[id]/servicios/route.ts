import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, OrdenServicioConNombre } from '@/lib/db'
import { getSession } from '@/lib/api-session'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  const servicios = await query<OrdenServicioConNombre>(
    `SELECT ots.*, s.nombre, s.precio_base
     FROM ordenes_trabajo_servicios ots
     JOIN servicios s ON ots.servicio_id = s.id
     JOIN ordenes_trabajo ot ON ots.orden_id = ot.id
     WHERE ots.orden_id=$1 AND ot.taller_id=$2
     ORDER BY s.nombre ASC`,
    [id, session.tallerId],
  )
  return NextResponse.json({ servicios })
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  const { servicio_id, precio_aplicado } = await req.json()
  if (!servicio_id) return NextResponse.json({ error: 'servicio_id requerido' }, { status: 400 })

  const item = await queryOne<OrdenServicioConNombre>(
    `INSERT INTO ordenes_trabajo_servicios (orden_id, servicio_id, precio_aplicado)
     VALUES ($1,$2,$3)
     ON CONFLICT (orden_id, servicio_id) DO UPDATE SET precio_aplicado=EXCLUDED.precio_aplicado
     RETURNING *`,
    [id, servicio_id, precio_aplicado ?? null],
  )
  return NextResponse.json({ item }, { status: 201 })
}

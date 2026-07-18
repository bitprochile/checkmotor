import { NextRequest, NextResponse } from 'next/server'
import { initDB, query, queryOne, OrdenTrabajoCompleta, OrdenTrabajo } from '@/lib/db'
import { getSession } from '@/lib/api-session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()

  const sp     = req.nextUrl.searchParams
  const estado = sp.get('estado')
  const desde  = sp.get('desde')
  const hasta  = sp.get('hasta')

  const conditions: string[] = ['ot.taller_id = $1']
  const values: unknown[]    = [session.tallerId]
  let p = 2

  if (estado) { conditions.push(`ot.estado = $${p++}`); values.push(estado) }
  if (desde)  { conditions.push(`ot.created_at >= $${p++}`); values.push(desde) }
  if (hasta)  { conditions.push(`ot.created_at <= $${p++}`); values.push(`${hasta}T23:59:59`) }

  const ordenes = await query<OrdenTrabajoCompleta>(
    `SELECT ot.*, v.patente, v.marca, v.modelo,
            c.nombre AS cliente_nombre, u.nombre AS mecanico_nombre
     FROM ordenes_trabajo ot
     JOIN vehiculos v ON ot.vehiculo_id = v.id
     JOIN clientes  c ON v.cliente_id   = c.id
     LEFT JOIN usuarios u ON ot.mecanico_id = u.id
     WHERE ${conditions.join(' AND ')} ORDER BY ot.created_at DESC`,
    values,
  )
  return NextResponse.json({ ordenes })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()

  const {
    vehiculo_id, descripcion, estado = 'pendiente',
    km_ingreso, km_salida, km_proxima, fecha_proxima,
    mecanico_id, notas_internas, costo_total,
  } = await req.json()

  if (!vehiculo_id || !descripcion?.trim())
    return NextResponse.json({ error: 'Vehículo y descripción son requeridos' }, { status: 400 })

  // Una orden nueva solo puede nacer como presupuesto o como pendiente
  const estadoInicial = estado === 'presupuestada' ? 'presupuestada' : 'pendiente'

  const orden = await queryOne<OrdenTrabajo>(
    `INSERT INTO ordenes_trabajo
       (taller_id, vehiculo_id, descripcion, estado,
        km_ingreso, km_salida, km_proxima, fecha_proxima,
        mecanico_id, notas_internas, costo_total)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      session.tallerId, vehiculo_id, descripcion.trim(), estadoInicial,
      km_ingreso || null, km_salida || null, km_proxima || null, fecha_proxima || null,
      mecanico_id || null, notas_internas || null, costo_total || null,
    ],
  )
  return NextResponse.json({ orden }, { status: 201 })
}

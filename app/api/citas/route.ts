import { NextRequest, NextResponse } from 'next/server'
import { initDB, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'
import type { CitaConDetalle, ConfiguracionTaller } from '@/lib/db'

const CITA_JOIN = `
  SELECT
    c.*,
    cl.nombre   AS cliente_nombre,
    cl.telefono AS cliente_telefono,
    v.patente   AS vehiculo_patente,
    v.marca     AS vehiculo_marca,
    v.modelo    AS vehiculo_modelo,
    u.nombre    AS mecanico_nombre
  FROM citas c
  JOIN vehiculos v   ON v.id = c.vehiculo_id
  JOIN clientes  cl  ON cl.id = v.cliente_id
  LEFT JOIN usuarios u ON u.id = c.mecanico_id
`

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()

  const p       = req.nextUrl.searchParams
  const semana  = p.get('semana')
  const fecha   = p.get('fecha')
  const estado  = p.get('estado')
  const vidStr  = p.get('vehiculo_id')

  const params: unknown[] = [session.tallerId]
  const where: string[]   = ['c.taller_id = $1']

  if (semana) {
    const inicio = new Date(semana + 'T00:00:00')
    const fin    = new Date(inicio); fin.setDate(fin.getDate() + 7)
    params.push(inicio, fin)
    where.push(`c.fecha_hora >= $${params.length - 1} AND c.fecha_hora < $${params.length}`)
  } else if (fecha) {
    const inicio = new Date(fecha + 'T00:00:00')
    const fin    = new Date(fecha + 'T23:59:59')
    params.push(inicio, fin)
    where.push(`c.fecha_hora >= $${params.length - 1} AND c.fecha_hora < $${params.length}`)
  }
  if (estado)  { params.push(estado);      where.push(`c.estado = $${params.length}`) }
  if (vidStr)  { params.push(Number(vidStr)); where.push(`c.vehiculo_id = $${params.length}`) }

  const citas = await query<CitaConDetalle>(
    `${CITA_JOIN} WHERE ${where.join(' AND ')} ORDER BY c.fecha_hora ASC`,
    params,
  )
  return NextResponse.json({ citas })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()

  const { vehiculo_id, mecanico_id, fecha_hora, duracion_min = 60, tipo_servicio, observaciones } = await req.json()
  if (!vehiculo_id || !fecha_hora)
    return NextResponse.json({ error: 'vehiculo_id y fecha_hora son requeridos' }, { status: 400 })

  // Obtener capacidad
  await query(
    `INSERT INTO configuracion_taller (taller_id) VALUES ($1) ON CONFLICT (taller_id) DO NOTHING`,
    [session.tallerId],
  )
  const config = await queryOne<ConfiguracionTaller>(
    'SELECT * FROM configuracion_taller WHERE taller_id = $1',
    [session.tallerId],
  )
  const capacidad = config?.capacidad_boxes ?? 3

  const inicio = new Date(fecha_hora)
  const fin    = new Date(inicio.getTime() + duracion_min * 60_000)

  const [{ ocupadas }] = await query<{ ocupadas: string }>(
    `SELECT COUNT(*) AS ocupadas FROM citas
     WHERE taller_id=$1
       AND estado NOT IN ('cancelada','no_asistio')
       AND fecha_hora < $2
       AND (fecha_hora + (duracion_min || ' minutes')::interval) > $3`,
    [session.tallerId, fin.toISOString(), inicio.toISOString()],
  )
  if (Number(ocupadas) >= capacidad)
    return NextResponse.json({ error: 'No hay boxes disponibles en ese horario' }, { status: 409 })

  const cita = await queryOne<CitaConDetalle>(
    `WITH ins AS (
       INSERT INTO citas (taller_id, vehiculo_id, mecanico_id, fecha_hora, duracion_min, tipo_servicio, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
     )
     SELECT ins.*,
       cl.nombre   AS cliente_nombre,
       cl.telefono AS cliente_telefono,
       v.patente   AS vehiculo_patente,
       v.marca     AS vehiculo_marca,
       v.modelo    AS vehiculo_modelo,
       u.nombre    AS mecanico_nombre
     FROM ins
     JOIN vehiculos v  ON v.id = ins.vehiculo_id
     JOIN clientes cl  ON cl.id = v.cliente_id
     LEFT JOIN usuarios u ON u.id = ins.mecanico_id`,
    [
      session.tallerId, Number(vehiculo_id), mecanico_id ? Number(mecanico_id) : null,
      inicio.toISOString(), Number(duracion_min),
      tipo_servicio || null, observaciones || null,
    ],
  )
  return NextResponse.json({ cita }, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { initDB, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'
import type { CitaConDetalle, ConfiguracionTaller } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

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

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  await initDB()

  const cita = await queryOne<CitaConDetalle>(
    `${CITA_JOIN} WHERE c.id=$1 AND c.taller_id=$2`,
    [id, session.tallerId],
  )
  if (!cita) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ cita })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  await initDB()

  const body = await req.json()
  const { mecanico_id, fecha_hora, duracion_min, tipo_servicio, observaciones, estado } = body

  // Si cambia fecha_hora, re-validar disponibilidad
  if (fecha_hora) {
    const config = await queryOne<ConfiguracionTaller>(
      'SELECT * FROM configuracion_taller WHERE taller_id=$1',
      [session.tallerId],
    )
    const capacidad = config?.capacidad_boxes ?? 3
    const dur       = Number(duracion_min ?? 60)
    const inicio    = new Date(fecha_hora)
    const fin       = new Date(inicio.getTime() + dur * 60_000)

    const [{ ocupadas }] = await query<{ ocupadas: string }>(
      `SELECT COUNT(*) AS ocupadas FROM citas
       WHERE taller_id=$1 AND id <> $2
         AND estado NOT IN ('cancelada','no_asistio')
         AND fecha_hora < $3
         AND (fecha_hora + (duracion_min || ' minutes')::interval) > $4`,
      [session.tallerId, id, fin.toISOString(), inicio.toISOString()],
    )
    if (Number(ocupadas) >= capacidad)
      return NextResponse.json({ error: 'No hay boxes disponibles en ese horario' }, { status: 409 })
  }

  const cita = await queryOne<CitaConDetalle>(
    `WITH upd AS (
       UPDATE citas SET
         mecanico_id   = COALESCE($3, mecanico_id),
         fecha_hora    = COALESCE($4, fecha_hora),
         duracion_min  = COALESCE($5, duracion_min),
         tipo_servicio = COALESCE($6, tipo_servicio),
         observaciones = COALESCE($7, observaciones),
         estado        = COALESCE($8, estado),
         updated_at    = NOW()
       WHERE id=$1 AND taller_id=$2
       RETURNING *
     )
     SELECT upd.*,
       cl.nombre   AS cliente_nombre,
       cl.telefono AS cliente_telefono,
       v.patente   AS vehiculo_patente,
       v.marca     AS vehiculo_marca,
       v.modelo    AS vehiculo_modelo,
       u.nombre    AS mecanico_nombre
     FROM upd
     JOIN vehiculos v  ON v.id = upd.vehiculo_id
     JOIN clientes cl  ON cl.id = v.cliente_id
     LEFT JOIN usuarios u ON u.id = upd.mecanico_id`,
    [
      id, session.tallerId,
      mecanico_id !== undefined ? (mecanico_id ? Number(mecanico_id) : null) : undefined,
      fecha_hora   ? new Date(fecha_hora).toISOString() : undefined,
      duracion_min ? Number(duracion_min)               : undefined,
      tipo_servicio ?? undefined,
      observaciones ?? undefined,
      estado        ?? undefined,
    ],
  )
  if (!cita) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ cita })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  await initDB()

  await query(
    `UPDATE citas SET estado='cancelada', updated_at=NOW() WHERE id=$1 AND taller_id=$2`,
    [id, session.tallerId],
  )
  return NextResponse.json({ ok: true })
}

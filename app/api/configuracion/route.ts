import { NextRequest, NextResponse } from 'next/server'
import { initDB, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'
import type { ConfiguracionTaller } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()

  await query(
    `INSERT INTO configuracion_taller (taller_id) VALUES ($1) ON CONFLICT (taller_id) DO NOTHING`,
    [session.tallerId],
  )
  const config = await queryOne<ConfiguracionTaller>(
    'SELECT * FROM configuracion_taller WHERE taller_id = $1',
    [session.tallerId],
  )
  return NextResponse.json({ config })
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()

  const { hora_apertura, hora_cierre, dias_atencion, capacidad_boxes, duracion_slot_min } = await req.json()

  if (hora_apertura >= hora_cierre)
    return NextResponse.json({ error: 'La hora de apertura debe ser anterior a la hora de cierre' }, { status: 422 })
  if (!capacidad_boxes || Number(capacidad_boxes) < 1)
    return NextResponse.json({ error: 'La capacidad de boxes debe ser al menos 1' }, { status: 422 })

  const config = await queryOne<ConfiguracionTaller>(
    `INSERT INTO configuracion_taller (taller_id, hora_apertura, hora_cierre, dias_atencion, capacidad_boxes, duracion_slot_min)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (taller_id) DO UPDATE
       SET hora_apertura=EXCLUDED.hora_apertura,
           hora_cierre=EXCLUDED.hora_cierre,
           dias_atencion=EXCLUDED.dias_atencion,
           capacidad_boxes=EXCLUDED.capacidad_boxes,
           duracion_slot_min=EXCLUDED.duracion_slot_min,
           updated_at=NOW()
     RETURNING *`,
    [
      session.tallerId,
      hora_apertura,
      hora_cierre,
      dias_atencion,
      Number(capacidad_boxes),
      Number(duracion_slot_min),
    ],
  )
  return NextResponse.json({ config })
}

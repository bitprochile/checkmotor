import { NextRequest, NextResponse } from 'next/server'
import { initDB, withTransaction } from '@/lib/db'
import { getSession } from '@/lib/api-session'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  await initDB()

  return withTransaction(async (client) => {
    // Obtener cita con JOIN
    const { rows: citaRows } = await client.query(
      `SELECT c.*, v.id AS vid, v.taller_id AS v_taller_id
       FROM citas c JOIN vehiculos v ON v.id = c.vehiculo_id
       WHERE c.id=$1 AND c.taller_id=$2`,
      [id, session.tallerId],
    )
    const cita = citaRows[0]
    if (!cita) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
    if (cita.orden_id) return NextResponse.json({ error: 'Esta cita ya tiene una orden de trabajo asociada' }, { status: 409 })

    // Crear orden de trabajo
    const { rows: ordenRows } = await client.query(
      `INSERT INTO ordenes_trabajo (taller_id, vehiculo_id, descripcion, estado, mecanico_id)
       VALUES ($1,$2,$3,'pendiente',$4) RETURNING id`,
      [
        session.tallerId,
        cita.vehiculo_id,
        cita.tipo_servicio || 'Trabajo proveniente de cita agendada',
        cita.mecanico_id ?? null,
      ],
    )
    const orden_id = ordenRows[0].id

    // Actualizar cita
    await client.query(
      `UPDATE citas SET orden_id=$1, estado='en_curso', updated_at=NOW() WHERE id=$2`,
      [orden_id, id],
    )

    return NextResponse.json({ orden_id })
  })
}

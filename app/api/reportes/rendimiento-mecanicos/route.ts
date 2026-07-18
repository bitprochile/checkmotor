import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api-session'
import { initDB, query } from '@/lib/db'
import { parseFiltro } from '@/lib/reportes'
import type { RendimientoMecanico } from '@/lib/reportes'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session)               return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.rol !== 'admin') return NextResponse.json({ error: 'Sin acceso' },    { status: 403 })
  await initDB()

  const { desde, hasta } = parseFiltro(new URL(req.url).searchParams)
  const hastaFin = hasta + ' 23:59:59'

  const rows = await query<{
    mecanico_id: string; mecanico_nombre: string; ordenes_completadas: string
    ingresos_generados: string; ticket_promedio: string
    tiempo_promedio_horas: string | null; servicio_mas_frecuente: string | null
  }>(
    `SELECT
       u.id                                                   AS mecanico_id,
       u.nombre                                               AS mecanico_nombre,
       COUNT(o.id)                                            AS ordenes_completadas,
       COALESCE(SUM(o.costo_total), 0)                        AS ingresos_generados,
       COALESCE(AVG(o.costo_total), 0)                        AS ticket_promedio,
       EXTRACT(EPOCH FROM AVG(o.updated_at - o.created_at))
         / 3600                                               AS tiempo_promedio_horas,
       (SELECT s.nombre
        FROM ordenes_trabajo_servicios ots2
        JOIN servicios s ON s.id = ots2.servicio_id
        WHERE ots2.orden_id IN (
          SELECT id FROM ordenes_trabajo
          WHERE mecanico_id = u.id AND taller_id = $1
            AND estado IN ('completada','entregada')
            AND updated_at >= $2 AND updated_at <= $3
        )
        GROUP BY s.id, s.nombre
        ORDER BY COUNT(*) DESC LIMIT 1
       )                                                      AS servicio_mas_frecuente
     FROM usuarios u
     JOIN ordenes_trabajo o ON o.mecanico_id = u.id
     WHERE u.taller_id = $1
       AND u.rol = 'mecanico'
       AND o.taller_id = $1
       AND o.estado IN ('completada','entregada')
       AND o.updated_at >= $2 AND o.updated_at <= $3
     GROUP BY u.id, u.nombre
     ORDER BY ingresos_generados DESC`,
    [session.tallerId, desde, hastaFin],
  ).catch(() => [])

  const mecanicos: RendimientoMecanico[] = rows.map(r => ({
    mecanico_id:           parseInt(r.mecanico_id),
    mecanico_nombre:       r.mecanico_nombre,
    ordenes_completadas:   parseInt(r.ordenes_completadas),
    ingresos_generados:    parseFloat(r.ingresos_generados),
    ticket_promedio:       parseFloat(r.ticket_promedio),
    tiempo_promedio_horas: r.tiempo_promedio_horas != null ? parseFloat(r.tiempo_promedio_horas) : null,
    servicio_mas_frecuente: r.servicio_mas_frecuente ?? null,
  }))

  return NextResponse.json({ mecanicos, desde, hasta })
}

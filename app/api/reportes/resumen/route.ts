import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api-session'
import { initDB, query, queryOne } from '@/lib/db'
import { parseFiltro } from '@/lib/reportes'
import type { ResumenPeriodo } from '@/lib/reportes'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session)              return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.rol !== 'admin') return NextResponse.json({ error: 'Sin acceso' },    { status: 403 })
  await initDB()

  const { desde, hasta } = parseFiltro(new URL(req.url).searchParams)
  const hastaFin = hasta + ' 23:59:59'

  const base = await queryOne<{
    ingresos_total: string; ordenes_total: string; ticket_promedio: string
    clientes_atendidos: string; vehiculos_atendidos: string
  }>(
    `SELECT
       COALESCE(SUM(o.costo_total), 0)      AS ingresos_total,
       COUNT(o.id)                           AS ordenes_total,
       COALESCE(AVG(o.costo_total), 0)       AS ticket_promedio,
       COUNT(DISTINCT v.cliente_id)          AS clientes_atendidos,
       COUNT(DISTINCT o.vehiculo_id)         AS vehiculos_atendidos
     FROM ordenes_trabajo o
     JOIN vehiculos v ON v.id = o.vehiculo_id
     WHERE o.taller_id = $1
       AND o.estado IN ('completada','entregada')
       AND o.updated_at >= $2 AND o.updated_at <= $3`,
    [session.tallerId, desde, hastaFin],
  )

  const [estrellaRow] = await query<{ nombre: string }>(
    `SELECT s.nombre
     FROM ordenes_trabajo_servicios ots
     JOIN ordenes_trabajo o ON o.id = ots.orden_id
     JOIN servicios s ON s.id = ots.servicio_id
     WHERE o.taller_id = $1
       AND o.estado IN ('completada','entregada')
       AND o.updated_at >= $2 AND o.updated_at <= $3
     GROUP BY s.id, s.nombre
     ORDER BY COUNT(*) DESC LIMIT 1`,
    [session.tallerId, desde, hastaFin],
  ).catch(() => [] as { nombre: string }[])

  const [margenRow] = await query<{ nombre: string }>(
    `SELECT s.nombre
     FROM ordenes_trabajo_servicios ots
     JOIN ordenes_trabajo o ON o.id = ots.orden_id
     JOIN servicios s ON s.id = ots.servicio_id
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(or2.precio_aplicado * or2.cantidad), 0) AS costo
       FROM ordenes_repuestos or2 WHERE or2.orden_id = o.id
     ) costos ON true
     WHERE o.taller_id = $1
       AND o.estado IN ('completada','entregada')
       AND o.updated_at >= $2 AND o.updated_at <= $3
     GROUP BY s.id, s.nombre
     HAVING SUM(ots.precio_aplicado) > 0
     ORDER BY
       (SUM(ots.precio_aplicado) - SUM(costos.costo)) / SUM(ots.precio_aplicado) DESC
     LIMIT 1`,
    [session.tallerId, desde, hastaFin],
  ).catch(() => [] as { nombre: string }[])

  const resumen: ResumenPeriodo = {
    ingresos_total:     parseFloat(base?.ingresos_total     ?? '0'),
    ordenes_total:      parseInt(base?.ordenes_total         ?? '0'),
    ticket_promedio:    parseFloat(base?.ticket_promedio     ?? '0'),
    clientes_atendidos: parseInt(base?.clientes_atendidos    ?? '0'),
    vehiculos_atendidos: parseInt(base?.vehiculos_atendidos  ?? '0'),
    servicio_estrella:  estrellaRow?.nombre ?? null,
    mejor_margen:       margenRow?.nombre   ?? null,
  }

  return NextResponse.json({ resumen, desde, hasta })
}

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api-session'
import { initDB, query } from '@/lib/db'
import { parseFiltro } from '@/lib/reportes'
import type { RentabilidadServicio } from '@/lib/reportes'

const ORDENES_VALIDAS = ['margen', 'ingresos', 'frecuencia'] as const
type OrdenParam = typeof ORDENES_VALIDAS[number]

function orderByClause(orden: OrdenParam) {
  if (orden === 'ingresos')   return 'ingresos_total DESC'
  if (orden === 'frecuencia') return 'veces_realizado DESC'
  return 'margen_bruto DESC'
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session)               return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.rol !== 'admin') return NextResponse.json({ error: 'Sin acceso' },    { status: 403 })
  await initDB()

  const sp    = new URL(req.url).searchParams
  const { desde, hasta } = parseFiltro(sp)
  const hastaFin = hasta + ' 23:59:59'
  const ordenParam = (sp.get('orden') ?? 'margen') as OrdenParam
  const orden = ORDENES_VALIDAS.includes(ordenParam) ? ordenParam : 'margen'

  const rows = await query<{
    servicio_id: string; servicio_nombre: string; veces_realizado: string
    ingresos_total: string; costo_repuestos: string
    margen_bruto: string; margen_porcentaje: string; ticket_promedio: string
  }>(
    `SELECT
       s.id                                                AS servicio_id,
       s.nombre                                            AS servicio_nombre,
       COUNT(ots.id)                                       AS veces_realizado,
       COALESCE(SUM(ots.precio_aplicado), 0)               AS ingresos_total,
       COALESCE(SUM(rep_costos.costo_orden), 0)            AS costo_repuestos,
       COALESCE(SUM(ots.precio_aplicado), 0)
         - COALESCE(SUM(rep_costos.costo_orden), 0)        AS margen_bruto,
       CASE
         WHEN COALESCE(SUM(ots.precio_aplicado), 0) = 0 THEN 0
         ELSE ROUND(
           (COALESCE(SUM(ots.precio_aplicado), 0)
             - COALESCE(SUM(rep_costos.costo_orden), 0))
           / COALESCE(SUM(ots.precio_aplicado), 0) * 100, 1)
       END                                                  AS margen_porcentaje,
       COALESCE(AVG(ots.precio_aplicado), 0)               AS ticket_promedio
     FROM servicios s
     JOIN ordenes_trabajo_servicios ots ON ots.servicio_id = s.id
     JOIN ordenes_trabajo o ON o.id = ots.orden_id
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(or2.precio_aplicado * or2.cantidad), 0) AS costo_orden
       FROM ordenes_repuestos or2 WHERE or2.orden_id = o.id
     ) rep_costos ON true
     WHERE s.taller_id = $1
       AND o.taller_id = $1
       AND o.estado IN ('completada','entregada')
       AND o.updated_at >= $2 AND o.updated_at <= $3
     GROUP BY s.id, s.nombre
     ORDER BY ${orderByClause(orden)}`,
    [session.tallerId, desde, hastaFin],
  ).catch(() => [])

  const servicios: RentabilidadServicio[] = rows.map(r => ({
    servicio_id:       parseInt(r.servicio_id),
    servicio_nombre:   r.servicio_nombre,
    veces_realizado:   parseInt(r.veces_realizado),
    ingresos_total:    parseFloat(r.ingresos_total),
    costo_repuestos:   parseFloat(r.costo_repuestos),
    margen_bruto:      parseFloat(r.margen_bruto),
    margen_porcentaje: parseFloat(r.margen_porcentaje),
    ticket_promedio:   parseFloat(r.ticket_promedio),
  }))

  return NextResponse.json({ servicios, desde, hasta, orden })
}

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/api-session'
import { initDB, query } from '@/lib/db'
import { ultimos12Meses, mesLabel } from '@/lib/reportes'
import type { IngresosMensuales } from '@/lib/reportes'

export async function GET() {
  const session = await getSession()
  if (!session)               return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.rol !== 'admin') return NextResponse.json({ error: 'Sin acceso' },    { status: 403 })
  await initDB()

  const meses = ultimos12Meses()
  const desde = meses[0] + '-01'
  const hastaFin = meses[meses.length - 1] + '-31 23:59:59'

  const rows = await query<{
    mes: string; ingresos: string; ordenes_completadas: string; ticket_promedio: string
  }>(
    `SELECT
       TO_CHAR(DATE_TRUNC('month', updated_at), 'YYYY-MM') AS mes,
       COALESCE(SUM(costo_total), 0)                       AS ingresos,
       COUNT(*)                                            AS ordenes_completadas,
       COALESCE(AVG(costo_total), 0)                       AS ticket_promedio
     FROM ordenes_trabajo
     WHERE taller_id = $1
       AND estado IN ('completada','entregada')
       AND updated_at >= $2 AND updated_at <= $3
     GROUP BY DATE_TRUNC('month', updated_at)
     ORDER BY mes`,
    [session.tallerId, desde, hastaFin],
  ).catch(() => [])

  const byMes = new Map(rows.map(r => [r.mes, r]))

  const ingresos: IngresosMensuales[] = meses.map(m => {
    const r = byMes.get(m)
    return {
      mes:                m,
      mes_label:          mesLabel(m),
      ingresos:           parseFloat(r?.ingresos           ?? '0'),
      ordenes_completadas: parseInt(r?.ordenes_completadas ?? '0'),
      ticket_promedio:    parseFloat(r?.ticket_promedio    ?? '0'),
    }
  })

  return NextResponse.json({ ingresos })
}

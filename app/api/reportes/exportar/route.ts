import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api-session'
import { initDB, query } from '@/lib/db'
import { parseFiltro, ultimos12Meses, mesLabel } from '@/lib/reportes'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session)               return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.rol !== 'admin') return NextResponse.json({ error: 'Sin acceso' },    { status: 403 })
  await initDB()

  const { desde, hasta } = parseFiltro(new URL(req.url).searchParams)
  const hastaFin = hasta + ' 23:59:59'

  const [resumenRow, serviciosRows, ingresosRows, mecanicosRows] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(costo_total),0) AS ingresos, COUNT(*) AS ordenes,
              COALESCE(AVG(costo_total),0) AS ticket
       FROM ordenes_trabajo
       WHERE taller_id=$1 AND estado IN ('completada','entregada')
         AND updated_at>=$2 AND updated_at<=$3`,
      [session.tallerId, desde, hastaFin],
    ).catch(() => []),

    query(
      `SELECT s.nombre AS servicio, COUNT(ots.id) AS veces,
              COALESCE(SUM(ots.precio_aplicado),0) AS ingresos
       FROM servicios s
       JOIN ordenes_trabajo_servicios ots ON ots.servicio_id=s.id
       JOIN ordenes_trabajo o ON o.id=ots.orden_id
       WHERE s.taller_id=$1 AND o.estado IN ('completada','entregada')
         AND o.updated_at>=$2 AND o.updated_at<=$3
       GROUP BY s.nombre ORDER BY ingresos DESC`,
      [session.tallerId, desde, hastaFin],
    ).catch(() => []),

    query(
      `SELECT TO_CHAR(DATE_TRUNC('month', updated_at),'YYYY-MM') AS mes,
              COALESCE(SUM(costo_total),0) AS ingresos, COUNT(*) AS ordenes
       FROM ordenes_trabajo
       WHERE taller_id=$1 AND estado IN ('completada','entregada')
         AND updated_at>=$2 AND updated_at<=$3
       GROUP BY DATE_TRUNC('month', updated_at) ORDER BY mes`,
      [session.tallerId, desde, hastaFin],
    ).catch(() => []),

    query(
      `SELECT u.nombre AS mecanico, COUNT(o.id) AS ordenes,
              COALESCE(SUM(o.costo_total),0) AS ingresos
       FROM usuarios u
       JOIN ordenes_trabajo o ON o.mecanico_id=u.id
       WHERE u.taller_id=$1 AND u.rol='mecanico'
         AND o.estado IN ('completada','entregada')
         AND o.updated_at>=$2 AND o.updated_at<=$3
       GROUP BY u.nombre ORDER BY ingresos DESC`,
      [session.tallerId, desde, hastaFin],
    ).catch(() => []),
  ])

  // Fill missing months
  const meses = ultimos12Meses()
  const byMes = new Map((ingresosRows as { mes: string }[]).map((r: any) => [r.mes, r]))
  const ingresosCompletos = meses.map(m => {
    const r = byMes.get(m) as any
    return { Mes: mesLabel(m), Ingresos: r ? parseFloat(r.ingresos) : 0, Órdenes: r ? parseInt(r.ordenes) : 0 }
  })

  const resumen = (resumenRow as any[])[0] ?? {}

  const wb = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([{
      'Período': `${desde} al ${hasta}`,
      'Ingresos totales': parseFloat(resumen.ingresos ?? '0'),
      'Órdenes completadas': parseInt(resumen.ordenes ?? '0'),
      'Ticket promedio': parseFloat(resumen.ticket ?? '0'),
    }]),
    'Resumen',
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      (serviciosRows as any[]).map(r => ({
        Servicio: r.servicio,
        'Veces realizado': parseInt(r.veces),
        'Ingresos ($)': parseFloat(r.ingresos),
      })),
    ),
    'Rentabilidad Servicios',
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(ingresosCompletos),
    'Ingresos Mensuales',
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      (mecanicosRows as any[]).map(r => ({
        Mecánico: r.mecanico,
        'Órdenes': parseInt(r.ordenes),
        'Ingresos ($)': parseFloat(r.ingresos),
      })),
    ),
    'Rendimiento Mecánicos',
  )

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="reportes-${desde}-${hasta}.xlsx"`,
    },
  })
}

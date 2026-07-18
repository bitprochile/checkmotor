import { NextRequest, NextResponse } from 'next/server'
import { withTransaction, query } from '@/lib/db'
import { getSession } from '@/lib/api-session'

type Params = { params: Promise<{ id: string }> }

const RECALC = `
  UPDATE ordenes_trabajo SET costo_total = (
    SELECT COALESCE(SUM(precio_aplicado),0) FROM ordenes_trabajo_servicios WHERE orden_id=$1
  ) + (
    SELECT COALESCE(SUM(precio_aplicado * cantidad),0) FROM ordenes_repuestos WHERE orden_id=$1
  ) WHERE id=$1`

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params

  const repuestos = await query(
    `SELECT or2.id, or2.orden_id, or2.repuesto_id,
            or2.cantidad::float AS cantidad,
            or2.precio_aplicado::float AS precio_aplicado,
            r.nombre, r.unidad, r.codigo
     FROM ordenes_repuestos or2
     JOIN repuestos r ON r.id = or2.repuesto_id
     WHERE or2.orden_id = $1`,
    [id],
  )
  return NextResponse.json({ repuestos })
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id: ordenId } = await params
  const { repuesto_id, cantidad, precio_aplicado } = await req.json()

  const qty    = parseFloat(cantidad)
  const precio = parseFloat(precio_aplicado)
  if (isNaN(qty) || qty <= 0 || isNaN(precio))
    return NextResponse.json({ error: 'Cantidad y precio deben ser válidos' }, { status: 400 })

  try {
    await withTransaction(async (client) => {
      const { rows: ordenRows } = await client.query(
        'SELECT id FROM ordenes_trabajo WHERE id=$1 AND taller_id=$2',
        [ordenId, session.tallerId],
      )
      if (!ordenRows.length) throw Object.assign(new Error('Orden no encontrada'), { status: 404 })

      const { rows: repRows } = await client.query(
        'SELECT stock_actual, nombre FROM repuestos WHERE id=$1 AND taller_id=$2 FOR UPDATE',
        [repuesto_id, session.tallerId],
      )
      if (!repRows.length) throw Object.assign(new Error('Repuesto no encontrado'), { status: 404 })

      const stockActual = parseFloat(repRows[0].stock_actual)
      if (stockActual < qty)
        throw Object.assign(new Error(`Stock insuficiente. Disponible: ${stockActual}`), { status: 422 })

      await client.query(
        `INSERT INTO ordenes_repuestos (orden_id, repuesto_id, cantidad, precio_aplicado)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (orden_id, repuesto_id)
         DO UPDATE SET cantidad=$3, precio_aplicado=$4`,
        [ordenId, repuesto_id, qty, precio],
      )

      const stockDespues = stockActual - qty
      await client.query('UPDATE repuestos SET stock_actual=$1, updated_at=NOW() WHERE id=$2', [stockDespues, repuesto_id])
      await client.query(
        `INSERT INTO movimientos_stock (taller_id, repuesto_id, orden_id, tipo, cantidad, stock_antes, stock_despues, motivo)
         VALUES ($1,$2,$3,'salida',$4,$5,$6,$7)`,
        [session.tallerId, repuesto_id, ordenId, qty, stockActual, stockDespues, `Uso en orden #${ordenId}`],
      )
      await client.query(RECALC, [ordenId])
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    if (e.status === 404) return NextResponse.json({ error: e.message }, { status: 404 })
    if (e.status === 422) return NextResponse.json({ error: e.message }, { status: 422 })
    throw err
  }
}

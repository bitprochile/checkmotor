import { NextRequest, NextResponse } from 'next/server'
import { withTransaction } from '@/lib/db'
import { getSession } from '@/lib/api-session'

type Params = { params: Promise<{ id: string; repuestoId: string }> }

const RECALC = `
  UPDATE ordenes_trabajo SET costo_total = (
    SELECT COALESCE(SUM(precio_aplicado),0) FROM ordenes_trabajo_servicios WHERE orden_id=$1
  ) + (
    SELECT COALESCE(SUM(precio_aplicado * cantidad),0) FROM ordenes_repuestos WHERE orden_id=$1
  ) WHERE id=$1`

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id: ordenId, repuestoId } = await params

  await withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT cantidad FROM ordenes_repuestos WHERE orden_id=$1 AND repuesto_id=$2',
      [ordenId, repuestoId],
    )
    if (!rows.length) return

    const qty = parseFloat(rows[0].cantidad)
    const { rows: repRows } = await client.query(
      'SELECT stock_actual FROM repuestos WHERE id=$1 FOR UPDATE', [repuestoId],
    )
    const stockAntes  = parseFloat(repRows[0].stock_actual)
    const stockDespues = stockAntes + qty

    await client.query('DELETE FROM ordenes_repuestos WHERE orden_id=$1 AND repuesto_id=$2', [ordenId, repuestoId])
    await client.query('UPDATE repuestos SET stock_actual=$1, updated_at=NOW() WHERE id=$2', [stockDespues, repuestoId])
    await client.query(
      `INSERT INTO movimientos_stock (taller_id, repuesto_id, orden_id, tipo, cantidad, stock_antes, stock_despues, motivo)
       VALUES ($1,$2,$3,'entrada',$4,$5,$6,$7)`,
      [session.tallerId, repuestoId, ordenId, qty, stockAntes, stockDespues, `Devolución desde orden #${ordenId}`],
    )
    await client.query(RECALC, [ordenId])
  })

  return NextResponse.json({ ok: true })
}

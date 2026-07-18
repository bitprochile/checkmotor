import { NextRequest, NextResponse } from 'next/server'
import { withTransaction } from '@/lib/db'
import { getSession } from '@/lib/api-session'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  const { tipo, cantidad, motivo } = await req.json()

  if (!['entrada', 'salida', 'ajuste'].includes(tipo))
    return NextResponse.json({ error: 'Tipo de movimiento inválido' }, { status: 400 })
  const qty = parseFloat(cantidad)
  if (isNaN(qty) || qty <= 0)
    return NextResponse.json({ error: 'Cantidad debe ser mayor a cero' }, { status: 400 })

  try {
    const stockActual = await withTransaction(async (client) => {
      const { rows } = await client.query(
        'SELECT stock_actual FROM repuestos WHERE id=$1 AND taller_id=$2 FOR UPDATE',
        [id, session.tallerId],
      )
      if (!rows.length) throw Object.assign(new Error('Repuesto no encontrado'), { status: 404 })

      const stockAntes = parseFloat(rows[0].stock_actual)
      let stockDespues: number

      if (tipo === 'entrada')      stockDespues = stockAntes + qty
      else if (tipo === 'ajuste')  stockDespues = qty
      else {
        stockDespues = stockAntes - qty
        if (stockDespues < 0) throw Object.assign(new Error('Stock insuficiente para esta salida'), { status: 422 })
      }

      await client.query('UPDATE repuestos SET stock_actual=$1, updated_at=NOW() WHERE id=$2', [stockDespues, id])
      await client.query(
        `INSERT INTO movimientos_stock (taller_id, repuesto_id, tipo, cantidad, stock_antes, stock_despues, motivo)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [session.tallerId, id, tipo, qty, stockAntes, stockDespues, motivo?.trim() || null],
      )
      return stockDespues
    })
    return NextResponse.json({ stock_actual: stockActual })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    if (e.status === 404) return NextResponse.json({ error: e.message }, { status: 404 })
    if (e.status === 422) return NextResponse.json({ error: e.message }, { status: 422 })
    throw err
  }
}

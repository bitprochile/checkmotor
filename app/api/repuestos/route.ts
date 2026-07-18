import { NextRequest, NextResponse } from 'next/server'
import { initDB, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'
import type { Repuesto } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()

  const { searchParams } = req.nextUrl
  const activo = searchParams.get('activo')
  const alerta = searchParams.get('alerta')
  const q      = searchParams.get('q')

  const conds: string[] = ['taller_id = $1']
  const params: unknown[] = [session.tallerId]
  let n = 2

  if (activo !== null) { conds.push(`activo = $${n++}`); params.push(activo === 'true') }
  if (alerta === '1')  { conds.push('stock_actual <= stock_minimo') }
  if (q?.trim()) {
    conds.push(`(nombre ILIKE $${n} OR codigo ILIKE $${n})`)
    params.push(`%${q.trim()}%`); n++
  }

  const repuestos = await query<Repuesto>(
    `SELECT * FROM repuestos WHERE ${conds.join(' AND ')} ORDER BY nombre ASC`,
    params,
  )
  return NextResponse.json({ repuestos })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()

  const body = await req.json()
  const { codigo, nombre, descripcion, unidad, stock_actual, stock_minimo, precio_costo, precio_venta } = body
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

  const stockI = parseFloat(stock_actual ?? 0)

  const repuesto = await queryOne<Repuesto>(
    `INSERT INTO repuestos (taller_id, codigo, nombre, descripcion, unidad, stock_actual, stock_minimo, precio_costo, precio_venta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      session.tallerId,
      codigo?.trim() || null,
      nombre.trim(),
      descripcion?.trim() || null,
      unidad || 'unidad',
      stockI,
      parseFloat(stock_minimo ?? 0),
      parseFloat(precio_costo ?? 0),
      parseFloat(precio_venta ?? 0),
    ],
  )

  if (repuesto && stockI > 0) {
    await query(
      `INSERT INTO movimientos_stock (taller_id, repuesto_id, tipo, cantidad, stock_antes, stock_despues, motivo)
       VALUES ($1,$2,'entrada',$3,0,$4,'Stock inicial')`,
      [session.tallerId, repuesto.id, stockI, stockI],
    )
  }

  return NextResponse.json({ repuesto }, { status: 201 })
}

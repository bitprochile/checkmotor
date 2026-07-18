import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'
import type { Repuesto, MovimientoStock } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }
interface MovimientoConUser extends MovimientoStock { usuario_nombre: string | null }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params

  const repuesto = await queryOne<Repuesto>(
    'SELECT * FROM repuestos WHERE id=$1 AND taller_id=$2', [id, session.tallerId],
  )
  if (!repuesto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const movimientos = await query<MovimientoConUser>(
    `SELECT m.*, u.nombre AS usuario_nombre
     FROM movimientos_stock m
     LEFT JOIN usuarios u ON u.id = m.usuario_id
     WHERE m.repuesto_id=$1 AND m.taller_id=$2
     ORDER BY m.created_at DESC LIMIT 20`,
    [id, session.tallerId],
  )

  return NextResponse.json({ repuesto, movimientos })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const { codigo, nombre, descripcion, unidad, stock_minimo, precio_costo, precio_venta, activo } = body
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

  const repuesto = await queryOne<Repuesto>(
    `UPDATE repuestos
     SET codigo=$1, nombre=$2, descripcion=$3, unidad=$4, stock_minimo=$5,
         precio_costo=$6, precio_venta=$7, activo=$8, updated_at=NOW()
     WHERE id=$9 AND taller_id=$10 RETURNING *`,
    [
      codigo?.trim() || null,
      nombre.trim(),
      descripcion?.trim() || null,
      unidad || 'unidad',
      parseFloat(stock_minimo ?? 0),
      parseFloat(precio_costo ?? 0),
      parseFloat(precio_venta ?? 0),
      activo ?? true,
      id,
      session.tallerId,
    ],
  )
  if (!repuesto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ repuesto })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params

  const [movs] = await query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM movimientos_stock WHERE repuesto_id=$1', [id],
  )
  if (Number(movs?.count ?? 0) > 0)
    return NextResponse.json({ error: 'No se puede eliminar: el repuesto tiene movimientos registrados' }, { status: 409 })

  await query('UPDATE repuestos SET activo=false WHERE id=$1 AND taller_id=$2', [id, session.tallerId])
  return NextResponse.json({ ok: true })
}

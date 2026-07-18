import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, OrdenTrabajo, EstadoOrden } from '@/lib/db'
import { getSession } from '@/lib/api-session'

type Params = { params: Promise<{ id: string }> }

const TRANSICIONES_VALIDAS: Record<EstadoOrden, EstadoOrden[]> = {
  presupuestada: ['pendiente', 'rechazada'],
  rechazada:     ['presupuestada'],
  pendiente:     ['en_progreso', 'presupuestada'],
  en_progreso:   ['completada', 'pendiente'],
  completada:    ['entregada', 'en_progreso'],
  entregada:     [],
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params

  const {
    vehiculo_id, descripcion, estado,
    km_ingreso, km_salida, km_proxima, fecha_proxima,
    mecanico_id, notas_internas, costo_total,
    incluir_iva, forma_pago, monto_pagado,
    subtotal, iva, total_con_iva,
  } = await req.json()

  if (!vehiculo_id || !descripcion?.trim())
    return NextResponse.json({ error: 'Vehículo y descripción son requeridos' }, { status: 400 })

  // Validar transición de estado
  const actual = await queryOne<{ estado: EstadoOrden }>(
    `SELECT estado FROM ordenes_trabajo WHERE id = $1 AND taller_id = $2`,
    [id, session.tallerId],
  )
  if (!actual) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const nuevoEstado = estado as EstadoOrden
  if (nuevoEstado && nuevoEstado !== actual.estado) {
    const permitidas = TRANSICIONES_VALIDAS[actual.estado] ?? []
    if (!permitidas.includes(nuevoEstado))
      return NextResponse.json(
        { error: `Transición de estado no permitida: ${actual.estado} → ${nuevoEstado}` },
        { status: 422 },
      )
  }

  const orden = await queryOne<OrdenTrabajo>(
    `UPDATE ordenes_trabajo SET
       vehiculo_id=$1, descripcion=$2, estado=$3,
       km_ingreso=$4, km_salida=$5, km_proxima=$6, fecha_proxima=$7,
       mecanico_id=$8, notas_internas=$9, costo_total=$10,
       incluir_iva=$11, forma_pago=$12, monto_pagado=$13,
       subtotal=$14, iva=$15, total_con_iva=$16, updated_at=NOW()
     WHERE id=$17 AND taller_id=$18 RETURNING *`,
    [
      vehiculo_id, descripcion.trim(), estado,
      km_ingreso || null, km_salida || null, km_proxima || null, fecha_proxima || null,
      mecanico_id || null, notas_internas || null, costo_total || null,
      incluir_iva ?? false, forma_pago || null,
      monto_pagado != null && monto_pagado !== '' ? monto_pagado : null,
      subtotal != null && subtotal !== '' ? subtotal : null,
      iva != null && iva !== '' ? iva : null,
      total_con_iva != null && total_con_iva !== '' ? total_con_iva : null,
      id, session.tallerId,
    ],
  )
  if (!orden) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ orden })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  await query('DELETE FROM ordenes_trabajo WHERE id=$1 AND taller_id=$2', [id, session.tallerId])
  return NextResponse.json({ ok: true })
}

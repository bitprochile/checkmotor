import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api-session'
import { initDB, query, queryOne, siguienteNumeroDocumento } from '@/lib/db'
import { cargarDatosDocumento } from '@/lib/documento-data'
import { generarHTMLDocumento, generarPDF } from '@/lib/pdf'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()
  const { id } = await params

  const bundle = await cargarDatosDocumento(id, session.tallerId)
  if (!bundle) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

  // Asignar número correlativo si aún no tiene
  const existing = await queryOne<{ numero_documento: number | null }>(
    `SELECT numero_documento FROM ordenes_trabajo WHERE id = $1 AND taller_id = $2`,
    [id, session.tallerId],
  )
  let numero = existing?.numero_documento ?? null
  if (numero == null) {
    numero = await siguienteNumeroDocumento(session.tallerId, 'presupuesto')
    await query(
      `UPDATE ordenes_trabajo
         SET numero_documento = $1, presupuesto_enviado_en = NOW(),
             subtotal = $2, iva = $3, total_con_iva = $4
       WHERE id = $5 AND taller_id = $6`,
      [numero, bundle.datosBase.subtotal, bundle.datosBase.iva, bundle.datosBase.total, id, session.tallerId],
    )
  } else {
    await query(
      `UPDATE ordenes_trabajo
         SET subtotal = $1, iva = $2, total_con_iva = $3
       WHERE id = $4 AND taller_id = $5`,
      [bundle.datosBase.subtotal, bundle.datosBase.iva, bundle.datosBase.total, id, session.tallerId],
    )
  }

  const html = generarHTMLDocumento({
    ...bundle.datosBase,
    tipo: 'presupuesto',
    numero,
    fecha: new Date(),
    validez_dias: 15,
  })

  const pdf = await generarPDF(html)

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="presupuesto-${String(numero).padStart(6, '0')}.pdf"`,
    },
  })
}

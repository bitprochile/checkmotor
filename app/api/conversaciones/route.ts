import { NextRequest, NextResponse } from 'next/server'
import { initDB, query } from '@/lib/db'
import { getSession } from '@/lib/api-session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()

  const { searchParams } = req.nextUrl
  const modo = searchParams.get('modo')

  const whereExtra = modo && modo !== 'todas' ? `AND c.modo = '${modo}'` : ''

  const conversaciones = await query<{
    id: number; whatsapp_id: string; nombre_contacto: string | null
    modo: string; mensajes_no_leidos: number; created_at: string
    ultimo_mensaje: string | null; ultimo_mensaje_en: string | null
  }>(`
    SELECT c.id, c.whatsapp_id, c.nombre_contacto, c.modo,
           c.mensajes_no_leidos, c.created_at,
           m.contenido  AS ultimo_mensaje,
           m.enviado_en AS ultimo_mensaje_en
    FROM whatsapp_conversaciones c
    LEFT JOIN LATERAL (
      SELECT contenido, enviado_en
      FROM whatsapp_mensajes
      WHERE conversacion_id = c.id
      ORDER BY enviado_en DESC LIMIT 1
    ) m ON true
    WHERE c.taller_id = $1 ${whereExtra}
    ORDER BY COALESCE(m.enviado_en, c.created_at) DESC
    LIMIT 100
  `, [session.tallerId])

  // Conteo para badge sidebar
  const [{ count: sinLeer }] = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM whatsapp_conversaciones
     WHERE taller_id = $1 AND modo = 'humano' AND mensajes_no_leidos > 0`,
    [session.tallerId],
  )

  return NextResponse.json({ conversaciones, sinLeer: Number(sinLeer) })
}

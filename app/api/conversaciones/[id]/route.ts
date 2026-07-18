import { NextRequest, NextResponse } from 'next/server'
import { initDB, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()
  const { id } = await params

  const conv = await queryOne<{
    id: number; whatsapp_id: string; nombre_contacto: string | null; modo: string; created_at: string
  }>('SELECT id, whatsapp_id, nombre_contacto, modo, created_at FROM whatsapp_conversaciones WHERE id=$1 AND taller_id=$2', [id, session.tallerId])

  if (!conv) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const mensajes = await query<{
    id: number; direccion: string; contenido: string; tipo: string; enviado_en: string
  }>(
    `SELECT id, direccion, contenido, tipo, enviado_en
     FROM whatsapp_mensajes WHERE conversacion_id = $1 ORDER BY enviado_en ASC`,
    [id],
  )

  // Marcar como leído
  await query(
    'UPDATE whatsapp_conversaciones SET mensajes_no_leidos = 0 WHERE id = $1',
    [id],
  )

  return NextResponse.json({ conv, mensajes })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()
  const { id } = await params

  const { modo } = await req.json()
  const modosValidos = ['bot', 'humano', 'cerrada']
  if (!modosValidos.includes(modo)) return NextResponse.json({ error: 'Modo inválido' }, { status: 400 })

  const conv = await queryOne(
    `UPDATE whatsapp_conversaciones SET modo=$1 WHERE id=$2 AND taller_id=$3 RETURNING id`,
    [modo, id, session.tallerId],
  )
  if (!conv) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

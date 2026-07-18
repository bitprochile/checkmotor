import { NextRequest, NextResponse } from 'next/server'
import { initDB, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'
import { enviarMensajeAPI } from '@/lib/whatsapp'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()
  const { id } = await params

  const conv = await queryOne<{
    id: number; whatsapp_id: string; taller_id: number; modo: string
  }>('SELECT id, whatsapp_id, taller_id, modo FROM whatsapp_conversaciones WHERE id=$1 AND taller_id=$2', [id, session.tallerId])

  if (!conv) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
  if (conv.modo !== 'humano') return NextResponse.json({ error: 'Solo puedes enviar mensajes en modo humano' }, { status: 400 })

  const { texto } = await req.json()
  if (!texto?.trim()) return NextResponse.json({ error: 'El mensaje no puede estar vacío' }, { status: 400 })

  const config = await queryOne<{ phone_number_id: string; access_token: string; activo: boolean }>(
    'SELECT phone_number_id, access_token, activo FROM whatsapp_config WHERE taller_id = $1',
    [session.tallerId],
  )

  if (!config?.activo) return NextResponse.json({ error: 'WhatsApp no está configurado o activo para este taller' }, { status: 400 })

  await enviarMensajeAPI({
    phoneNumberId: config.phone_number_id,
    accessToken:   config.access_token,
    to:            conv.whatsapp_id,
    texto:         texto.trim(),
  })

  await query(
    `INSERT INTO whatsapp_mensajes (conversacion_id, taller_id, direccion, contenido, tipo)
     VALUES ($1,$2,'saliente',$3,'texto')`,
    [conv.id, session.tallerId, texto.trim()],
  )

  return NextResponse.json({ ok: true })
}

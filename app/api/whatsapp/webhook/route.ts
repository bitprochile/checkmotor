import { NextRequest, NextResponse } from 'next/server'
import { initDB, query, queryOne } from '@/lib/db'
import { enviarMensajeAPI, extraerTexto } from '@/lib/whatsapp'
import { procesarMensaje } from '@/lib/ai-agent'

// GET — verificación del webhook por Meta
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
  if (mode !== 'subscribe' || !challenge || !verifyToken || token !== verifyToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return new NextResponse(challenge, { status: 200 })
}

// POST — mensajes entrantes desde Meta
export async function POST(req: NextRequest) {
  // Siempre responder 200 primero para evitar reintentos de Meta
  const body = await req.json().catch(() => null)
  procesarPayload(body).catch(err => console.error('[webhook]', err))
  return NextResponse.json({ status: 'ok' })
}

async function procesarPayload(body: unknown) {
  if (!body || typeof body !== 'object') return
  const payload = body as Record<string, unknown>
  if (payload.object !== 'whatsapp_business_account') return

  await initDB()

  const entries = (payload.entry as unknown[]) ?? []
  for (const entry of entries) {
    const changes = ((entry as Record<string, unknown>).changes as unknown[]) ?? []
    for (const change of changes) {
      const value = (change as Record<string, unknown>).value as Record<string, unknown>
      if (!value || (change as Record<string, unknown>).field !== 'messages') continue

      const metadata = value.metadata as Record<string, string> | undefined
      const phoneNumberId = metadata?.phone_number_id
      if (!phoneNumberId) continue

      // Encontrar el taller por phone_number_id
      const config = await queryOne<{ taller_id: number; access_token: string; phone_number_id: string }>(
        'SELECT taller_id, access_token, phone_number_id FROM whatsapp_config WHERE phone_number_id = $1 AND activo = true',
        [phoneNumberId],
      )
      if (!config) continue

      const mensajes  = (value.messages  as unknown[]) ?? []
      const contactos = (value.contacts  as unknown[]) ?? []

      for (const msg of mensajes) {
        const m    = msg as Record<string, unknown>
        const from = m.from as string
        const wamid = m.id as string
        const texto = extraerTexto(m)
        if (!texto) continue

        const contacto  = contactos.find(c => (c as Record<string, unknown>).wa_id === from) as Record<string, unknown> | undefined
        const perfil    = contacto?.profile as Record<string, unknown> | undefined
        const nombre    = (perfil?.name as string | undefined) ?? null

        // Obtener o crear conversación
        await query(
          `INSERT INTO whatsapp_conversaciones (taller_id, whatsapp_id, nombre_contacto)
           VALUES ($1,$2,$3)
           ON CONFLICT (taller_id, whatsapp_id) DO UPDATE SET
             nombre_contacto = COALESCE($3, whatsapp_conversaciones.nombre_contacto),
             mensajes_no_leidos = whatsapp_conversaciones.mensajes_no_leidos + 1`,
          [config.taller_id, from, nombre],
        )

        const conv = await queryOne<{ id: number; modo: string }>(
          'SELECT id, modo FROM whatsapp_conversaciones WHERE taller_id = $1 AND whatsapp_id = $2',
          [config.taller_id, from],
        )
        if (!conv) continue

        // Guardar mensaje entrante
        await query(
          `INSERT INTO whatsapp_mensajes (conversacion_id, taller_id, direccion, contenido, tipo, wamid)
           VALUES ($1,$2,'entrante',$3,'texto',$4)`,
          [conv.id, config.taller_id, texto, wamid],
        )

        if (conv.modo !== 'bot') continue

        // Procesar con IA
        const historial = await query<{ direccion: 'entrante' | 'saliente'; contenido: string }>(
          `SELECT direccion, contenido FROM whatsapp_mensajes
           WHERE conversacion_id = $1 ORDER BY enviado_en DESC LIMIT 20`,
          [conv.id],
        )

        const { respuesta, transferirHumano } = await procesarMensaje({
          tallerId:       config.taller_id,
          conversacionId: conv.id,
          whatsappId:     from,
          mensaje:        texto,
          historial:      historial.reverse(),
        })

        // Enviar respuesta
        await enviarMensajeAPI({
          phoneNumberId: config.phone_number_id,
          accessToken:   config.access_token,
          to:            from,
          texto:         respuesta,
        })

        // Guardar mensaje saliente
        await query(
          `INSERT INTO whatsapp_mensajes (conversacion_id, taller_id, direccion, contenido, tipo)
           VALUES ($1,$2,'saliente',$3,'texto')`,
          [conv.id, config.taller_id, respuesta],
        )

        if (transferirHumano) {
          await query(
            `UPDATE whatsapp_conversaciones SET modo = 'humano', mensajes_no_leidos = 1 WHERE id = $1`,
            [conv.id],
          )
        }
      }
    }
  }
}

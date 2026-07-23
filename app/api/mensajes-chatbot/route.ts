import { NextRequest, NextResponse } from 'next/server'
import { initDB, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'

interface MensajeChatbot {
  tipo: string; nombre: string; descripcion: string | null; plantilla: string; activo: boolean
}

export async function GET() {
  const session = await getSession()
  if (!session?.superadmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  await initDB()
  const mensajes = await query<MensajeChatbot>(
    'SELECT tipo, nombre, descripcion, plantilla, activo FROM mensajes_chatbot ORDER BY tipo',
  )
  return NextResponse.json({ mensajes })
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session?.superadmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  await initDB()

  const { tipo, plantilla, activo } = await req.json()
  if (!tipo || !plantilla?.trim())
    return NextResponse.json({ error: 'tipo y plantilla son requeridos' }, { status: 400 })

  const existing = await queryOne<{ tipo: string }>('SELECT tipo FROM mensajes_chatbot WHERE tipo = $1', [tipo])
  if (!existing) return NextResponse.json({ error: 'Tipo de mensaje no encontrado' }, { status: 404 })

  await query(
    'UPDATE mensajes_chatbot SET plantilla = $1, activo = $2 WHERE tipo = $3',
    [plantilla.trim(), activo !== false, tipo],
  )
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { initDB, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'

interface ConfigRow {
  phone_number_id: string
  access_token:    string
  verify_token:    string
  activo:          boolean
  nombre_agente:   string
}

export async function GET() {
  const session = await getSession()
  if (!session || session.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  await initDB()

  const config = await queryOne<ConfigRow>(
    'SELECT phone_number_id, access_token, verify_token, activo, nombre_agente FROM whatsapp_config WHERE taller_id = $1',
    [session.tallerId],
  )

  if (!config) return NextResponse.json({ config: null })

  return NextResponse.json({
    config: {
      phone_number_id:  config.phone_number_id,
      verify_token:     config.verify_token,
      activo:           config.activo,
      nombre_agente:    config.nombre_agente,
      has_access_token: config.access_token.trim().length > 0,
    },
  })
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session || session.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  await initDB()

  const { phone_number_id, access_token, verify_token, activo, nombre_agente } = await req.json()

  await query(
    `INSERT INTO whatsapp_config (taller_id, phone_number_id, access_token, verify_token, activo, nombre_agente, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6, NOW())
     ON CONFLICT (taller_id) DO UPDATE SET
       phone_number_id = $2,
       access_token    = CASE WHEN $3 = '' THEN whatsapp_config.access_token ELSE $3 END,
       verify_token    = $4,
       activo          = $5,
       nombre_agente   = $6,
       updated_at      = NOW()`,
    [
      session.tallerId,
      phone_number_id ?? '',
      access_token    ?? '',
      verify_token    ?? '',
      activo !== false,
      nombre_agente   ?? 'Asistente',
    ],
  )

  return NextResponse.json({ ok: true })
}

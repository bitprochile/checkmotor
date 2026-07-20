import { NextRequest, NextResponse } from 'next/server'
import { initDB, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'

type Params = { params: Promise<{ id: string }> }

async function requireSuperAdmin() {
  const session = await getSession()
  if (!session || !session.superadmin) return null
  return session
}

export async function GET(_req: NextRequest, { params }: Params) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  await initDB()
  const { id } = await params

  const config = await queryOne<{ phone_number_id: string; access_token: string; activo: boolean }>(
    'SELECT phone_number_id, access_token, activo FROM whatsapp_config WHERE taller_id = $1',
    [id],
  )

  if (!config) return NextResponse.json({ config: null })

  return NextResponse.json({
    config: {
      phone_number_id:  config.phone_number_id,
      activo:           config.activo,
      has_access_token: config.access_token.trim().length > 0,
    },
  })
}

export async function PUT(req: NextRequest, { params }: Params) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  await initDB()
  const { id } = await params
  const { phone_number_id, access_token, activo } = await req.json()

  await query(
    `INSERT INTO whatsapp_config (taller_id, phone_number_id, access_token, verify_token, activo, updated_at)
     VALUES ($1,$2,$3,'',$4, NOW())
     ON CONFLICT (taller_id) DO UPDATE SET
       phone_number_id = $2,
       access_token    = CASE WHEN $3 = '' THEN whatsapp_config.access_token ELSE $3 END,
       activo          = $4,
       updated_at      = NOW()`,
    [id, phone_number_id ?? '', access_token ?? '', activo !== false],
  )

  return NextResponse.json({ ok: true })
}

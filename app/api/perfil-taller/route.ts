import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api-session'
import { initDB, query, queryOne, PerfilTaller } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()

  let perfil = await queryOne<PerfilTaller>(
    `SELECT * FROM perfil_taller WHERE taller_id = $1`,
    [session.tallerId],
  )

  if (!perfil) {
    await query(
      `INSERT INTO perfil_taller (taller_id, nombre) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [session.tallerId, 'Mi Taller'],
    )
    perfil = await queryOne<PerfilTaller>(`SELECT * FROM perfil_taller WHERE taller_id = $1`, [session.tallerId])
  }

  return NextResponse.json({ perfil })
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.rol !== 'admin') return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  await initDB()

  const body = await req.json()
  const { nombre, rut, direccion, telefono, email, website, logo_url, pie_pagina } = body

  const perfil = await queryOne<PerfilTaller>(
    `INSERT INTO perfil_taller (taller_id, nombre, rut, direccion, telefono, email, website, logo_url, pie_pagina, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (taller_id) DO UPDATE SET
       nombre = EXCLUDED.nombre, rut = EXCLUDED.rut, direccion = EXCLUDED.direccion,
       telefono = EXCLUDED.telefono, email = EXCLUDED.email, website = EXCLUDED.website,
       logo_url = EXCLUDED.logo_url, pie_pagina = EXCLUDED.pie_pagina, updated_at = NOW()
     RETURNING *`,
    [session.tallerId, nombre || 'Mi Taller', rut || null, direccion || null,
      telefono || null, email || null, website || null, logo_url || null, pie_pagina || null],
  )

  return NextResponse.json({ perfil })
}

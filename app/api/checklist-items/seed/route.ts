import { NextResponse } from 'next/server'
import { initDB, seedChecklistItems } from '@/lib/db'
import { getSession } from '@/lib/api-session'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.rol !== 'admin') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  await initDB()
  await seedChecklistItems(session.tallerId)
  return NextResponse.json({ ok: true })
}

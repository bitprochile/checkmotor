import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession } from '@/lib/api-session'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const mecanicos = await query<{ id: number; nombre: string }>(
    `SELECT id, nombre FROM usuarios
     WHERE taller_id=$1 AND rol='mecanico' AND activo=true
     ORDER BY nombre ASC`,
    [session.tallerId],
  )
  return NextResponse.json({ mecanicos })
}

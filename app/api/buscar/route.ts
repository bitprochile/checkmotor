import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession } from '@/lib/api-session'

interface Resultado {
  tipo: 'cliente' | 'vehiculo'
  id: number
  label: string
  sub: string
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ resultados: [] })

  const like = `%${q}%`

  const [clientes, vehiculos] = await Promise.all([
    query<Resultado>(
      `SELECT 'cliente' AS tipo, id, nombre AS label, COALESCE(rut, '') AS sub
       FROM clientes WHERE taller_id=$1 AND (nombre ILIKE $2 OR rut ILIKE $2)
       LIMIT 4`,
      [session.tallerId, like],
    ),
    query<Resultado>(
      `SELECT 'vehiculo' AS tipo, id, patente AS label, (marca || ' ' || modelo) AS sub
       FROM vehiculos WHERE taller_id=$1
         AND (patente ILIKE $2 OR marca ILIKE $2 OR modelo ILIKE $2)
       LIMIT 4`,
      [session.tallerId, like],
    ),
  ])

  const resultados = [...clientes, ...vehiculos].slice(0, 8)
  return NextResponse.json({ resultados })
}

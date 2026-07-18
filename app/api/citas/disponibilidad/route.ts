import { NextRequest, NextResponse } from 'next/server'
import { initDB, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/api-session'
import type { ConfiguracionTaller } from '@/lib/db'

export interface Slot { hora: string; disponible: boolean; boxes_libres: number }

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  await initDB()

  const p           = req.nextUrl.searchParams
  const fecha       = p.get('fecha')
  const duracion    = Number(p.get('duracion_min') || 60)

  if (!fecha) return NextResponse.json({ error: 'Parámetro fecha requerido' }, { status: 400 })

  // Obtener config
  await query(
    `INSERT INTO configuracion_taller (taller_id) VALUES ($1) ON CONFLICT (taller_id) DO NOTHING`,
    [session.tallerId],
  )
  const config = await queryOne<ConfiguracionTaller>(
    'SELECT * FROM configuracion_taller WHERE taller_id = $1',
    [session.tallerId],
  )
  const apertura  = (config?.hora_apertura ?? '08:00:00').slice(0, 5)
  const cierre    = (config?.hora_cierre   ?? '18:00:00').slice(0, 5)
  const capacidad = config?.capacidad_boxes    ?? 3
  const slotMin   = config?.duracion_slot_min  ?? 60
  const diasAten  = config?.dias_atencion ?? [1, 2, 3, 4, 5]

  // Verificar que el día esté en dias_atencion
  // PostgreSQL: 1=lunes..7=domingo; JS Date.getDay(): 0=domingo..6=sábado
  const d      = new Date(fecha + 'T12:00:00') // mediodía para evitar timezone
  const jsDow  = d.getDay() // 0=dom, 1=lun...6=sab
  const pgDow  = jsDow === 0 ? 7 : jsDow   // convertir: pg 1=lun..7=dom
  if (!diasAten.includes(pgDow))
    return NextResponse.json({ slots: [], cerrado: true })

  // Generar slots
  const [apH, apM] = apertura.split(':').map(Number)
  const [cH,  cM]  = cierre.split(':').map(Number)
  const aperturaMin = apH * 60 + apM
  const cierreMin   = cH * 60 + cM

  const slots: Slot[] = []
  for (let min = aperturaMin; min + duracion <= cierreMin; min += slotMin) {
    const hh    = String(Math.floor(min / 60)).padStart(2, '0')
    const mm    = String(min % 60).padStart(2, '0')
    const inicio = new Date(`${fecha}T${hh}:${mm}:00`)
    const fin    = new Date(inicio.getTime() + duracion * 60_000)

    const [{ ocupadas }] = await query<{ ocupadas: string }>(
      `SELECT COUNT(*) AS ocupadas FROM citas
       WHERE taller_id=$1
         AND estado NOT IN ('cancelada','no_asistio')
         AND fecha_hora < $2
         AND (fecha_hora + (duracion_min || ' minutes')::interval) > $3`,
      [session.tallerId, fin.toISOString(), inicio.toISOString()],
    )
    const libres = capacidad - Number(ocupadas)
    slots.push({ hora: `${hh}:${mm}`, disponible: libres > 0, boxes_libres: Math.max(0, libres) })
  }

  return NextResponse.json({ slots })
}

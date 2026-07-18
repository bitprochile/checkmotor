export interface RentabilidadServicio {
  servicio_id: number
  servicio_nombre: string
  veces_realizado: number
  ingresos_total: number
  costo_repuestos: number
  margen_bruto: number
  margen_porcentaje: number
  ticket_promedio: number
}

export interface IngresosMensuales {
  mes: string
  mes_label: string
  ingresos: number
  ordenes_completadas: number
  ticket_promedio: number
}

export interface RendimientoMecanico {
  mecanico_id: number
  mecanico_nombre: string
  ordenes_completadas: number
  ingresos_generados: number
  ticket_promedio: number
  tiempo_promedio_horas: number | null
  servicio_mas_frecuente: string | null
}

export interface ResumenPeriodo {
  ingresos_total: number
  ordenes_total: number
  ticket_promedio: number
  clientes_atendidos: number
  vehiculos_atendidos: number
  servicio_estrella: string | null
  mejor_margen: string | null
}

export interface FiltroReporte {
  desde: string
  hasta: string
}

// Defaults: primer día del mes actual hasta hoy
export function defaultFiltro(): FiltroReporte {
  const hoy   = new Date()
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
  const hasta = hoy.toISOString().slice(0, 10)
  return { desde, hasta }
}

export function parseFiltro(searchParams: URLSearchParams): FiltroReporte {
  const def   = defaultFiltro()
  const desde = searchParams.get('desde') || def.desde
  const hasta = searchParams.get('hasta') || def.hasta
  return { desde, hasta }
}

// Formatea 'YYYY-MM' → 'Ene 2025'
export function mesLabel(yyyyMm: string): string {
  return new Date(yyyyMm + '-01').toLocaleDateString('es-CL', { month: 'short', year: 'numeric' })
}

// Genera array de los últimos N meses como 'YYYY-MM'
export function ultimos12Meses(): string[] {
  const meses: string[] = []
  const hoy = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return meses
}

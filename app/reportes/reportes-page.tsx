'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, Users, FileText, Star, Award, Download, BarChart2 } from 'lucide-react'
import BarChartSVG from '@/app/components/BarChartSVG'
import type { RentabilidadServicio, IngresosMensuales, RendimientoMecanico, ResumenPeriodo } from '@/lib/reportes'

type Tab = 'rentabilidad' | 'ingresos' | 'mecanicos'
type OrdenServicio = 'margen' | 'ingresos' | 'frecuencia'

function hoy() { return new Date().toISOString().slice(0, 10) }
function primerDiaMes() {
  const d = new Date(); d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function CLP(v: number) {
  return v.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

function MargenBarra({ pct }: { pct: number }) {
  const nivel = pct >= 60 ? 'alto' : pct >= 30 ? 'medio' : 'bajo'
  return (
    <div className="margen-barra-wrap">
      <div className="margen-barra-bg">
        <div className={`margen-barra-fill ${nivel}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="margen-barra-pct" style={{ color: nivel === 'alto' ? 'var(--ok)' : nivel === 'medio' ? '#b45309' : 'var(--danger)' }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}

function SkeletonKPI() {
  return (
    <div className="kpi-grid">
      {[1,2,3,4,5].map(i => <div key={i} className="skeleton skeleton-kpi" />)}
    </div>
  )
}

export default function ReportesPageClient() {
  const [tab, setTab] = useState<Tab>('rentabilidad')
  const [desde, setDesde] = useState(primerDiaMes)
  const [hasta, setHasta] = useState(hoy)
  const [orden, setOrden] = useState<OrdenServicio>('margen')
  const [exportando, setExportando] = useState(false)

  const [resumen, setResumen] = useState<ResumenPeriodo | null>(null)
  const [servicios, setServicios] = useState<RentabilidadServicio[]>([])
  const [ingresos, setIngresos] = useState<IngresosMensuales[]>([])
  const [mecanicos, setMecanicos] = useState<RendimientoMecanico[]>([])
  const [loadingResumen, setLoadingResumen] = useState(true)
  const [loadingTab, setLoadingTab] = useState(true)
  const [error, setError] = useState('')

  const fetchResumen = useCallback(async () => {
    setLoadingResumen(true)
    try {
      const r = await fetch(`/api/reportes/resumen?desde=${desde}&hasta=${hasta}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setResumen(d.resumen)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoadingResumen(false)
    }
  }, [desde, hasta])

  const fetchRentabilidad = useCallback(async () => {
    setLoadingTab(true)
    try {
      const r = await fetch(`/api/reportes/rentabilidad-servicios?desde=${desde}&hasta=${hasta}&orden=${orden}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setServicios(d.servicios)
    } finally {
      setLoadingTab(false)
    }
  }, [desde, hasta, orden])

  const fetchIngresos = useCallback(async () => {
    setLoadingTab(true)
    try {
      const r = await fetch('/api/reportes/ingresos-mensuales')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setIngresos(d.ingresos)
    } finally {
      setLoadingTab(false)
    }
  }, [])

  const fetchMecanicos = useCallback(async () => {
    setLoadingTab(true)
    try {
      const r = await fetch(`/api/reportes/rendimiento-mecanicos?desde=${desde}&hasta=${hasta}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setMecanicos(d.mecanicos)
    } finally {
      setLoadingTab(false)
    }
  }, [desde, hasta])

  useEffect(() => { fetchResumen() }, [fetchResumen])

  useEffect(() => {
    if (tab === 'rentabilidad') fetchRentabilidad()
    else if (tab === 'ingresos') fetchIngresos()
    else fetchMecanicos()
  }, [tab, fetchRentabilidad, fetchIngresos, fetchMecanicos])

  async function handleExportar() {
    setExportando(true)
    try {
      const r = await fetch(`/api/reportes/exportar?desde=${desde}&hasta=${hasta}`)
      if (!r.ok) throw new Error('Error al exportar')
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `reportes-${desde}-${hasta}.xlsx`
      a.click(); URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="shell">
      <div className="topbar">
        <div>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>Reportes de Rentabilidad</h1>
          <p style={{ margin: '2px 0 0', fontSize: '.82rem', color: 'var(--muted)' }}>Análisis financiero del taller</p>
        </div>
        <button className="button amber" onClick={handleExportar} disabled={exportando} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Download size={15} />
          {exportando ? 'Exportando…' : 'Exportar Excel'}
        </button>
      </div>

      {error && <div className="warningBox" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Filtros de período */}
      <div className="report-filtros">
        <label>Desde <input type="date" value={desde} onChange={e => setDesde(e.target.value)} /></label>
        <label>Hasta <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} /></label>
      </div>

      {/* KPI resumen */}
      {loadingResumen ? <SkeletonKPI /> : resumen && (
        <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="kpi-card">
            <div className="kpi-label">Ingresos totales</div>
            <div className="kpi-value">{CLP(resumen.ingresos_total)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Órdenes completadas</div>
            <div className="kpi-value">{resumen.ordenes_total}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Ticket promedio</div>
            <div className="kpi-value">{CLP(resumen.ticket_promedio)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Clientes atendidos</div>
            <div className="kpi-value">{resumen.clientes_atendidos}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Vehículos atendidos</div>
            <div className="kpi-value">{resumen.vehiculos_atendidos}</div>
          </div>
        </div>
      )}

      {/* Insight cards */}
      {resumen && (resumen.servicio_estrella || resumen.mejor_margen) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: '1.5rem' }}>
          {resumen.servicio_estrella && (
            <div className="insight-card">
              <div className="insight-icon"><Star size={18} /></div>
              <div className="insight-body">
                <div className="insight-label">Servicio más frecuente</div>
                <div className="insight-value">{resumen.servicio_estrella}</div>
              </div>
            </div>
          )}
          {resumen.mejor_margen && (
            <div className="insight-card">
              <div className="insight-icon"><Award size={18} /></div>
              <div className="insight-body">
                <div className="insight-label">Mejor margen</div>
                <div className="insight-value">{resumen.mejor_margen}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="report-tabs">
        {([['rentabilidad','Rentabilidad Servicios'],['ingresos','Ingresos Mensuales'],['mecanicos','Rendimiento Mecánicos']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} className={`report-tab${tab === t ? ' activo' : ''}`} onClick={() => setTab(t)}>{label}</button>
        ))}
      </div>

      {/* Tab: Rentabilidad servicios */}
      {tab === 'rentabilidad' && (
        <div className="gridPanel">
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Ordenar por:</span>
            {(['margen','ingresos','frecuencia'] as OrdenServicio[]).map(o => (
              <button key={o} className={`button${orden === o ? ' teal' : ''}`} style={{ padding: '4px 12px', fontSize: '.8rem' }}
                onClick={() => setOrden(o)}>
                {o === 'margen' ? 'Margen' : o === 'ingresos' ? 'Ingresos' : 'Frecuencia'}
              </button>
            ))}
          </div>
          {loadingTab ? (
            <div style={{ padding: '1rem' }}>
              {[1,2,3,4,5].map(i => <div key={i} className="skeleton skeleton-table-row" />)}
            </div>
          ) : servicios.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
              Sin datos para el período seleccionado
            </div>
          ) : (
            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Servicio</th>
                    <th className="ordenable" onClick={() => setOrden('frecuencia')}>Veces</th>
                    <th className="ordenable" onClick={() => setOrden('ingresos')}>Ingresos</th>
                    <th>Costo repuestos</th>
                    <th className="ordenable" onClick={() => setOrden('margen')}>Margen</th>
                    <th>Ticket prom.</th>
                  </tr>
                </thead>
                <tbody>
                  {servicios.map(s => (
                    <tr key={s.servicio_id}>
                      <td style={{ fontWeight: 500 }}>{s.servicio_nombre}</td>
                      <td>{s.veces_realizado}</td>
                      <td>{CLP(s.ingresos_total)}</td>
                      <td>{CLP(s.costo_repuestos)}</td>
                      <td><MargenBarra pct={s.margen_porcentaje} /></td>
                      <td>{CLP(s.ticket_promedio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Ingresos mensuales */}
      {tab === 'ingresos' && (
        <div>
          {loadingTab ? (
            <div className="skeleton skeleton-chart" />
          ) : (
            <>
              <div className="gridPanel" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>Ingresos últimos 12 meses</h3>
                <BarChartSVG
                  data={ingresos.map(m => ({ label: m.mes_label.slice(0,3), value: m.ingresos }))}
                  height={180}
                />
              </div>
              <div className="report-table-wrap gridPanel">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Mes</th>
                      <th>Ingresos</th>
                      <th>Órdenes</th>
                      <th>Ticket prom.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingresos.map((m, idx) => {
                      const prev = idx > 0 ? ingresos[idx - 1].ingresos : null
                      const diff = prev != null && prev > 0 ? ((m.ingresos - prev) / prev) * 100 : null
                      return (
                        <tr key={m.mes}>
                          <td style={{ fontWeight: 500 }}>{m.mes_label}</td>
                          <td>
                            {CLP(m.ingresos)}
                            {diff != null && (
                              <span className={`variacion ${diff >= 0 ? 'sube' : 'baja'}`} style={{ marginLeft: 6 }}>
                                {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}%
                              </span>
                            )}
                          </td>
                          <td>{m.ordenes_completadas}</td>
                          <td>{m.ordenes_completadas > 0 ? CLP(m.ticket_promedio) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: Rendimiento mecánicos */}
      {tab === 'mecanicos' && (
        <div className="gridPanel">
          {loadingTab ? (
            <div style={{ padding: '1rem' }}>
              {[1,2,3].map(i => <div key={i} className="skeleton skeleton-table-row" />)}
            </div>
          ) : mecanicos.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
              Sin datos para el período seleccionado
            </div>
          ) : (() => {
              const maxIngreso = Math.max(...mecanicos.map(m => m.ingresos_generados), 1)
              return (
                <div className="report-table-wrap">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Mecánico</th>
                        <th>Órdenes</th>
                        <th>Ingresos</th>
                        <th>Desempeño</th>
                        <th>T. promedio</th>
                        <th>Servicio frecuente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mecanicos.map(m => (
                        <tr key={m.mecanico_id}>
                          <td style={{ fontWeight: 500 }}>{m.mecanico_nombre}</td>
                          <td>{m.ordenes_completadas}</td>
                          <td>{CLP(m.ingresos_generados)}</td>
                          <td>
                            <div className="mecanico-barra-wrap">
                              <div className="mecanico-barra-bg">
                                <div className="mecanico-barra-fill" style={{ width: `${(m.ingresos_generados / maxIngreso) * 100}%` }} />
                              </div>
                            </div>
                          </td>
                          <td>
                            {m.tiempo_promedio_horas != null
                              ? `${m.tiempo_promedio_horas.toFixed(1)}h`
                              : '—'}
                          </td>
                          <td style={{ color: 'var(--muted)', fontSize: '.82rem' }}>
                            {m.servicio_mas_frecuente ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()
          }
        </div>
      )}
    </div>
  )
}

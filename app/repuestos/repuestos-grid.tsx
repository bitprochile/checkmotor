'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Package, Plus, Search, AlertTriangle, X, Eye } from 'lucide-react'
import type { Repuesto } from '@/lib/db'

const CLP = (n: number | string | null) =>
  Number(n ?? 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })

function stockClass(r: Repuesto): string {
  const a = parseFloat(String(r.stock_actual))
  const m = parseFloat(String(r.stock_minimo))
  if (m === 0 || a > m) return 'stock-ok'
  if (a === 0 || a <= m * 0.5) return 'stock-critico'
  return 'stock-bajo'
}

export default function RepuestosGrid() {
  const router = useRouter()
  const [repuestos,  setRepuestos]  = useState<Repuesto[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filtroQ,    setFiltroQ]    = useState('')
  const [filtroAlerta, setFiltroAlerta] = useState(false)
  const [filtroActivo, setFiltroActivo] = useState<string>('true')
  // Inline movement form
  const [movRowId,  setMovRowId]  = useState<number | null>(null)
  const [movTipo,   setMovTipo]   = useState<'entrada'|'salida'|'ajuste'>('entrada')
  const [movCant,   setMovCant]   = useState('')
  const [movMotivo, setMovMotivo] = useState('')
  const [movSaving, setMovSaving] = useState(false)
  const [movError,  setMovError]  = useState('')

  async function load() {
    setLoading(true)
    const p = new URLSearchParams()
    p.set('activo', filtroActivo)
    if (filtroAlerta) p.set('alerta', '1')
    if (filtroQ.trim()) p.set('q', filtroQ.trim())
    const res  = await fetch(`/api/repuestos?${p}`)
    const data = await res.json()
    setRepuestos(data.repuestos ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilters() { load() }

  async function handleMov(repId: number) {
    const qty = parseFloat(movCant)
    if (isNaN(qty) || qty <= 0) { setMovError('Cantidad inválida'); return }
    setMovSaving(true); setMovError('')
    const res  = await fetch(`/api/repuestos/${repId}/movimientos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: movTipo, cantidad: qty, motivo: movMotivo }),
    })
    const data = await res.json()
    if (!res.ok) { setMovError(data.error ?? 'Error'); setMovSaving(false); return }
    setMovRowId(null); setMovCant(''); setMovMotivo(''); setMovSaving(false)
    load()
  }

  // KPIs computed from loaded data
  const totalActivos = repuestos.filter(r => r.activo).length
  const bajoStock    = repuestos.filter(r => {
    const a = parseFloat(String(r.stock_actual)), m = parseFloat(String(r.stock_minimo))
    return r.activo && m > 0 && a <= m
  }).length
  const valorTotal   = repuestos
    .filter(r => r.activo)
    .reduce((s, r) => s + parseFloat(String(r.stock_actual)) * parseFloat(String(r.precio_costo)), 0)

  return (
    <div>
      {/* ── KPI cards ── */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-label">Repuestos activos</div>
          <div className="kpi-value">{totalActivos}</div>
          <div className="kpi-sub">En catálogo</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: bajoStock > 0 ? '3px solid var(--danger)' : undefined }}>
          <div className="kpi-label">Bajo stock mínimo</div>
          <div className="kpi-value" style={{ color: bajoStock > 0 ? 'var(--danger)' : undefined }}>
            {bajoStock > 0 && <AlertTriangle size={18} style={{ display:'inline', marginRight:6 }} />}
            {bajoStock}
          </div>
          <div className="kpi-sub">{bajoStock > 0 ? 'Requieren reposición' : 'Inventario en orden'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Valor inventario</div>
          <div className="kpi-value" style={{ fontSize: '1.2rem' }}>{CLP(valorTotal)}</div>
          <div className="kpi-sub">A precio costo</div>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="filterBar" style={{ marginBottom: 16 }}>
        <Search size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
        <input
          value={filtroQ}
          onChange={e => setFiltroQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && applyFilters()}
          placeholder="Buscar por nombre o código…"
          style={{ flex: 1 }}
        />
        <select value={filtroActivo} onChange={e => setFiltroActivo(e.target.value)}>
          <option value="true">Solo activos</option>
          <option value="">Todos</option>
          <option value="false">Inactivos</option>
        </select>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>
          <input type="checkbox" checked={filtroAlerta} onChange={e => setFiltroAlerta(e.target.checked)} style={{ width:'auto' }} />
          Solo con alerta
        </label>
        <button className="button teal" onClick={applyFilters}>Buscar</button>
        <button className="button teal" onClick={() => router.push('/repuestos/new')} style={{ marginLeft:'auto' }}>
          <Plus size={14} /> Nuevo repuesto
        </button>
      </div>

      {/* ── Tabla ── */}
      <div className="gridPanel">
        {loading ? (
          <div className="emptyState"><p>Cargando…</p></div>
        ) : repuestos.length === 0 ? (
          <div className="emptyState">
            <Package size={36} style={{ margin:'0 auto 14px', opacity:0.25 }} />
            <p>Sin repuestos en el catálogo</p>
            <p>Agrega el primero con el botón de arriba.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="entityTable">
              <thead>
                <tr>
                  <th>Código</th><th>Nombre</th><th>Unidad</th>
                  <th>Stock actual</th><th>Mínimo</th>
                  <th>P. Costo</th><th>P. Venta</th><th>Estado</th><th></th>
                </tr>
              </thead>
              <tbody>
                {repuestos.map(r => (
                  <>
                    <tr key={r.id} style={{ whiteSpace:'nowrap', cursor:'pointer' }} onClick={() => router.push(`/repuestos/${r.id}`)}>
                      <td style={{ color:'var(--muted)', fontFamily:'monospace' }}>{r.codigo ?? '—'}</td>
                      <td><strong>{r.nombre}</strong></td>
                      <td style={{ color:'var(--muted)' }}>{r.unidad}</td>
                      <td>
                        <span className={stockClass(r)}>
                          {parseFloat(String(r.stock_actual)) <= parseFloat(String(r.stock_minimo)) && parseFloat(String(r.stock_minimo)) > 0 && '⚠ '}
                          {parseFloat(String(r.stock_actual))}
                        </span>
                      </td>
                      <td style={{ color:'var(--muted)' }}>{parseFloat(String(r.stock_minimo))}</td>
                      <td>{CLP(r.precio_costo)}</td>
                      <td style={{ fontWeight:600 }}>{CLP(r.precio_venta)}</td>
                      <td>
                        <span style={{
                          display:'inline-block', padding:'2px 10px', borderRadius:20,
                          fontSize:11, fontWeight:700, textTransform:'uppercase',
                          background: r.activo ? '#dcfce7' : '#f3f4f6',
                          color: r.activo ? '#14532d' : 'var(--muted)',
                        }}>
                          {r.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={{ display:'flex', gap:6 }} onClick={e => e.stopPropagation()}>
                        <button className="button" style={{ padding:'4px 10px' }} title="Ver / Editar" onClick={() => router.push(`/repuestos/${r.id}`)}>
                          <Eye size={13} />
                        </button>
                        <button
                          className={movRowId === r.id ? 'button softDanger' : 'button teal'}
                          style={{ padding:'4px 10px', fontSize:11 }}
                          onClick={() => { setMovRowId(movRowId === r.id ? null : r.id); setMovError(''); setMovCant(''); setMovMotivo('') }}
                        >
                          {movRowId === r.id ? <X size={13} /> : '± Stock'}
                        </button>
                      </td>
                    </tr>

                    {/* Inline movement form */}
                    {movRowId === r.id && (
                      <tr key={`mov-${r.id}`}>
                        <td colSpan={9} style={{ background:'#f0f9f8', padding:'12px 16px', borderBottom:'2px solid var(--brand)' }}>
                          <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }}>
                            <label style={{ display:'grid', gap:4 }}>
                              <span style={{ fontSize:11, color:'var(--muted)' }}>Tipo</span>
                              <select value={movTipo} onChange={e => setMovTipo(e.target.value as typeof movTipo)} style={{ width:120 }}>
                                <option value="entrada">Entrada</option>
                                <option value="salida">Salida</option>
                                <option value="ajuste">Ajuste</option>
                              </select>
                            </label>
                            <label style={{ display:'grid', gap:4 }}>
                              <span style={{ fontSize:11, color:'var(--muted)' }}>Cantidad</span>
                              <input type="number" min="0.01" step="0.01" value={movCant} onChange={e => setMovCant(e.target.value)} style={{ width:100 }} placeholder="0" />
                            </label>
                            <label style={{ display:'grid', gap:4, flex:1, minWidth:160 }}>
                              <span style={{ fontSize:11, color:'var(--muted)' }}>Motivo</span>
                              <input value={movMotivo} onChange={e => setMovMotivo(e.target.value)} placeholder="Motivo del movimiento" />
                            </label>
                            <button className="button teal" disabled={movSaving || !movCant} onClick={() => handleMov(r.id)}>
                              {movSaving ? 'Registrando…' : 'Registrar'}
                            </button>
                          </div>
                          {movError && <p style={{ color:'var(--danger)', fontSize:12, marginTop:8 }}>{movError}</p>}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

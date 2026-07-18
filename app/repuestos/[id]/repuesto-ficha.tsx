'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react'
import type { Repuesto, MovimientoStock } from '@/lib/db'

export interface MovimientoConUser extends MovimientoStock { usuario_nombre: string | null }

interface Props { repuesto: Repuesto; movimientos: MovimientoConUser[] }

const CLP  = (n: number | string | null) => Number(n ?? 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })
const FECHA = (d: Date | string) => new Date(d).toLocaleString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })

function stockClass(actual: number, minimo: number): string {
  if (minimo === 0 || actual > minimo) return 'stock-ok'
  if (actual === 0 || actual <= minimo * 0.5) return 'stock-critico'
  return 'stock-bajo'
}

function calcMargen(costo: number, venta: number): string {
  if (venta <= 0) return '—'
  return `${((venta - costo) / venta * 100).toFixed(1)} %`
}

type EditForm = { codigo: string; nombre: string; descripcion: string; unidad: string; stock_minimo: string; precio_costo: string; precio_venta: string; activo: boolean }

const MOV_ICON = { entrada: TrendingUp, salida: TrendingDown, ajuste: ArrowUpDown }

export default function RepuestoFicha({ repuesto: initial, movimientos: initialMovs }: Props) {
  const router = useRouter()
  const [rep,       setRep]       = useState(initial)
  const [movs,      setMovs]      = useState(initialMovs)
  const [editOk,    setEditOk]    = useState(false)
  const [editError, setEditError] = useState('')
  const [editSaving,setEditSaving]= useState(false)
  const [movOk,     setMovOk]     = useState(false)
  const [movError,  setMovError]  = useState('')
  const [movSaving, setMovSaving] = useState(false)
  const [movTipo,   setMovTipo]   = useState<'entrada'|'salida'|'ajuste'>('entrada')
  const [movCant,   setMovCant]   = useState('')
  const [movMotivo, setMovMotivo] = useState('')

  const [form, setForm] = useState<EditForm>({
    codigo:       rep.codigo ?? '',
    nombre:       rep.nombre,
    descripcion:  rep.descripcion ?? '',
    unidad:       rep.unidad,
    stock_minimo: String(parseFloat(String(rep.stock_minimo))),
    precio_costo: String(parseFloat(String(rep.precio_costo))),
    precio_venta: String(parseFloat(String(rep.precio_venta))),
    activo:       rep.activo,
  })

  const field = (k: keyof EditForm, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))
  const margenLive = () => calcMargen(parseFloat(form.precio_costo||'0'), parseFloat(form.precio_venta||'0'))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setEditSaving(true); setEditError(''); setEditOk(false)
    const res = await fetch(`/api/repuestos/${rep.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo:       form.codigo || null,
        nombre:       form.nombre,
        descripcion:  form.descripcion || null,
        unidad:       form.unidad,
        stock_minimo: parseFloat(form.stock_minimo || '0'),
        precio_costo: parseFloat(form.precio_costo || '0'),
        precio_venta: parseFloat(form.precio_venta || '0'),
        activo:       form.activo,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setEditError(data.error ?? 'Error al guardar'); setEditSaving(false); return }
    setRep(data.repuesto)
    setEditOk(true); setEditSaving(false)
    setTimeout(() => setEditOk(false), 3000)
  }

  async function handleMov(e: React.FormEvent) {
    e.preventDefault()
    const qty = parseFloat(movCant)
    if (isNaN(qty) || qty <= 0) { setMovError('Cantidad inválida'); return }
    setMovSaving(true); setMovError(''); setMovOk(false)
    const res = await fetch(`/api/repuestos/${rep.id}/movimientos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: movTipo, cantidad: qty, motivo: movMotivo }),
    })
    const data = await res.json()
    if (!res.ok) { setMovError(data.error ?? 'Error al registrar'); setMovSaving(false); return }
    // Refetch repuesto + history
    const refresh = await fetch(`/api/repuestos/${rep.id}`).then(r => r.json())
    setRep(refresh.repuesto)
    setMovs(refresh.movimientos)
    setMovCant(''); setMovMotivo(''); setMovOk(true); setMovSaving(false)
    setTimeout(() => setMovOk(false), 3000)
  }

  const stockA = parseFloat(String(rep.stock_actual))
  const stockM = parseFloat(String(rep.stock_minimo))
  const sc     = stockClass(stockA, stockM)

  return (
    <div>
      {/* ── Header ── */}
      <div className="topbar">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button className="iconButton" onClick={() => router.push('/repuestos')}><ArrowLeft size={16} /></button>
          <div>
            <h1 style={{ fontSize:20 }}>{rep.nombre}</h1>
            {rep.codigo && <span style={{ fontSize:12, color:'var(--muted)' }}>Cód. {rep.codigo}</span>}
          </div>
          <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700,
            background: rep.activo ? '#dcfce7' : '#f3f4f6', color: rep.activo ? '#14532d' : 'var(--muted)' }}>
            {rep.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="statsGrid" style={{ marginBottom:20 }}>
        <div className="statCard">
          <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5 }}>Stock actual</div>
          <div style={{ fontSize:28, fontWeight:800 }} className={sc}>{stockA} {rep.unidad}</div>
          {stockA <= stockM && stockM > 0 && <div style={{ fontSize:12, color:'var(--danger)' }}>⚠ Bajo el mínimo ({stockM})</div>}
        </div>
        <div className="statCard">
          <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5 }}>Precio costo</div>
          <div style={{ fontSize:22, fontWeight:700 }}>{CLP(rep.precio_costo)}</div>
        </div>
        <div className="statCard">
          <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5 }}>Precio venta</div>
          <div style={{ fontSize:22, fontWeight:700 }}>{CLP(rep.precio_venta)}</div>
        </div>
        <div className="statCard">
          <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5 }}>Margen bruto</div>
          <div style={{ fontSize:22, fontWeight:700, color:'var(--ok)' }}>
            {calcMargen(parseFloat(String(rep.precio_costo)), parseFloat(String(rep.precio_venta)))}
          </div>
        </div>
      </div>

      <div className="workspace">
        {/* ── Left: historial ── */}
        <div className="gridPanel">
          <div className="toolbar">
            <span style={{ fontWeight:700, fontSize:14 }}>Historial de movimientos</span>
          </div>
          {movs.length === 0 ? (
            <div className="emptyState"><p>Sin movimientos registrados aún.</p></div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table className="entityTable">
                <thead>
                  <tr><th>Fecha</th><th>Tipo</th><th>Cantidad</th><th>Antes → Después</th><th>Motivo</th><th>Usuario</th></tr>
                </thead>
                <tbody>
                  {movs.map(m => {
                    const Icon = MOV_ICON[m.tipo]
                    return (
                      <tr key={m.id} style={{ whiteSpace:'nowrap' }}>
                        <td style={{ color:'var(--muted)', fontSize:12 }}>{FECHA(m.created_at)}</td>
                        <td><span className={`mov-${m.tipo}`}><Icon size={11} style={{ display:'inline', marginRight:4 }} />{m.tipo}</span></td>
                        <td style={{ fontWeight:700 }}>{parseFloat(String(m.cantidad))} {rep.unidad}</td>
                        <td className="stock-arrow">
                          <span>{parseFloat(String(m.stock_antes))}</span>
                          {' → '}
                          <span>{parseFloat(String(m.stock_despues))}</span>
                        </td>
                        <td style={{ color:'var(--muted)' }}>{m.motivo ?? '—'}</td>
                        <td style={{ color:'var(--muted)', fontSize:12 }}>{m.usuario_nombre ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Right: edit + movement ── */}
        <div style={{ display:'grid', gap:16, alignContent:'start' }}>
          {/* Edit form */}
          <div className="detailPanel">
            <div className="detailPanelHead"><h2>Editar repuesto</h2></div>
            {editOk  && <div className="notice" style={{ marginBottom:12 }}>Cambios guardados.</div>}
            {editError && <div className="warningBox" style={{ marginBottom:12 }}>{editError}</div>}
            <form className="entityForm" onSubmit={handleSave}>
              <label><span>Código</span><input value={form.codigo} onChange={e => field('codigo', e.target.value)} placeholder="REP-001" /></label>
              <label><span>Nombre *</span><input value={form.nombre} onChange={e => field('nombre', e.target.value)} required /></label>
              <label><span>Descripción</span><textarea rows={2} value={form.descripcion} onChange={e => field('descripcion', e.target.value)} style={{ resize:'vertical' }} /></label>
              <label>
                <span>Unidad</span>
                <select value={form.unidad} onChange={e => field('unidad', e.target.value)}>
                  <option value="unidad">Unidad</option>
                  <option value="litro">Litro</option>
                  <option value="kg">Kg</option>
                  <option value="metro">Metro</option>
                  <option value="par">Par</option>
                  <option value="juego">Juego</option>
                </select>
              </label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <label><span>Stock mínimo</span><input type="number" min="0" step="0.01" value={form.stock_minimo} onChange={e => field('stock_minimo', e.target.value)} /></label>
                <div style={{ display:'flex', alignItems:'flex-end', gap:6, fontSize:12, color:'var(--muted)', paddingBottom:2 }}>
                  <span>Margen: <strong style={{ color:'var(--brand-dark)' }}>{margenLive()}</strong></span>
                </div>
                <label><span>Precio costo ($)</span><input type="number" min="0" step="1" value={form.precio_costo} onChange={e => field('precio_costo', e.target.value)} /></label>
                <label><span>Precio venta ($)</span><input type="number" min="0" step="1" value={form.precio_venta} onChange={e => field('precio_venta', e.target.value)} /></label>
              </div>
              <label className="toggleSwitch" style={{ flexDirection:'row', alignItems:'center', cursor:'pointer' }}>
                <input type="checkbox" checked={form.activo} onChange={e => field('activo', e.target.checked)} />
                <span /><em>Repuesto activo</em>
              </label>
              <div className="formActions">
                <button type="submit" className="button teal" disabled={editSaving}>
                  <Save size={14} />{editSaving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>

          {/* Movement panel */}
          <div className="detailPanel">
            <div className="detailPanelHead"><h2>Registrar movimiento</h2></div>
            {movOk    && <div className="notice" style={{ marginBottom:12 }}>Movimiento registrado.</div>}
            {movError && <div className="warningBox" style={{ marginBottom:12 }}>{movError}</div>}
            <form className="entityForm" onSubmit={handleMov}>
              <label>
                <span>Tipo</span>
                <select value={movTipo} onChange={e => setMovTipo(e.target.value as typeof movTipo)}>
                  <option value="entrada">Entrada (suma stock)</option>
                  <option value="salida">Salida (resta stock)</option>
                  <option value="ajuste">Ajuste (reemplaza stock)</option>
                </select>
              </label>
              <label>
                <span>Cantidad *</span>
                <input type="number" min="0.01" step="0.01" value={movCant} onChange={e => setMovCant(e.target.value)} placeholder="0" required />
              </label>
              <label>
                <span>Motivo</span>
                <input value={movMotivo} onChange={e => setMovMotivo(e.target.value)} placeholder="Compra, ajuste de inventario…" />
              </label>
              <div className="formActions">
                <button type="submit" className="button teal" disabled={movSaving}>
                  {movSaving ? 'Registrando…' : 'Registrar movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

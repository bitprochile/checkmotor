'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, ArrowLeft } from 'lucide-react'

type FormData = {
  codigo: string; nombre: string; descripcion: string; unidad: string
  stock_actual: string; stock_minimo: string; precio_costo: string; precio_venta: string
}
const EMPTY: FormData = { codigo:'', nombre:'', descripcion:'', unidad:'unidad', stock_actual:'0', stock_minimo:'0', precio_costo:'0', precio_venta:'0' }

export default function NuevoRepuestoForm() {
  const router = useRouter()
  const [form,   setForm]   = useState<FormData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const field = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }))

  const margen = () => {
    const c = parseFloat(form.precio_costo || '0')
    const v = parseFloat(form.precio_venta || '0')
    if (v <= 0) return '—'
    return `${((v - c) / v * 100).toFixed(1)} %`
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const res  = await fetch('/api/repuestos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo:       form.codigo || null,
        nombre:       form.nombre,
        descripcion:  form.descripcion || null,
        unidad:       form.unidad,
        stock_actual: parseFloat(form.stock_actual || '0'),
        stock_minimo: parseFloat(form.stock_minimo || '0'),
        precio_costo: parseFloat(form.precio_costo || '0'),
        precio_venta: parseFloat(form.precio_venta || '0'),
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Error al guardar'); setSaving(false); return }
    router.push('/repuestos')
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <button className="button" style={{ marginBottom:16 }} onClick={() => router.push('/repuestos')}>
        <ArrowLeft size={14} /> Volver al inventario
      </button>

      {error && <div className="warningBox" style={{ marginBottom:16 }}>{error}</div>}

      <div className="gridPanel" style={{ padding:24 }}>
        <form className="entityForm" onSubmit={handleSave}>
          <label>
            <span>Código</span>
            <input value={form.codigo} onChange={e => field('codigo', e.target.value)} placeholder="REP-001" />
          </label>
          <label>
            <span>Nombre *</span>
            <input value={form.nombre} onChange={e => field('nombre', e.target.value)} placeholder="Ej: Filtro de aceite" required />
          </label>
          <label>
            <span>Descripción</span>
            <textarea rows={2} value={form.descripcion} onChange={e => field('descripcion', e.target.value)} placeholder="Descripción opcional…" style={{ resize:'vertical' }} />
          </label>
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
            <label>
              <span>Stock inicial</span>
              <input type="number" min="0" step="0.01" value={form.stock_actual} onChange={e => field('stock_actual', e.target.value)} />
            </label>
            <label>
              <span>Stock mínimo</span>
              <input type="number" min="0" step="0.01" value={form.stock_minimo} onChange={e => field('stock_minimo', e.target.value)} />
            </label>
            <label>
              <span>Precio costo ($)</span>
              <input type="number" min="0" step="1" value={form.precio_costo} onChange={e => field('precio_costo', e.target.value)} />
            </label>
            <label>
              <span>Precio venta ($)</span>
              <input type="number" min="0" step="1" value={form.precio_venta} onChange={e => field('precio_venta', e.target.value)} />
            </label>
          </div>

          <div style={{ background:'var(--panel-strong)', border:'1px solid var(--line)', borderRadius:6, padding:'10px 14px', fontSize:13 }}>
            <span style={{ color:'var(--muted)' }}>Margen bruto estimado: </span>
            <strong style={{ color:'var(--brand-dark)' }}>{margen()}</strong>
          </div>

          <div className="formActions">
            <button type="submit" className="button teal" disabled={saving}>
              <Save size={14} />{saving ? 'Guardando…' : 'Crear repuesto'}
            </button>
            <button type="button" className="button" onClick={() => router.push('/repuestos')}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

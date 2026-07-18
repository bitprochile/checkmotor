'use client'

import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'

const DIAS = [
  { label: 'Lun', val: 1 }, { label: 'Mar', val: 2 }, { label: 'Mié', val: 3 },
  { label: 'Jue', val: 4 }, { label: 'Vie', val: 5 }, { label: 'Sáb', val: 6 }, { label: 'Dom', val: 7 },
]
const SLOTS = [30, 60, 90, 120]

export default function ConfiguracionPage() {
  const [form, setForm] = useState({
    hora_apertura: '08:00', hora_cierre: '18:00',
    dias_atencion: [1, 2, 3, 4, 5], capacidad_boxes: 3, duracion_slot_min: 60,
  })
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [ok,      setOk]      = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    fetch('/api/configuracion').then(r => r.json()).then(d => {
      if (d.config) setForm({
        hora_apertura:    d.config.hora_apertura?.slice(0, 5) ?? '08:00',
        hora_cierre:      d.config.hora_cierre?.slice(0, 5)   ?? '18:00',
        dias_atencion:    d.config.dias_atencion ?? [1,2,3,4,5],
        capacidad_boxes:  d.config.capacidad_boxes   ?? 3,
        duracion_slot_min: d.config.duracion_slot_min ?? 60,
      })
      setLoading(false)
    })
  }, [])

  function toggleDia(val: number) {
    setForm(f => ({
      ...f,
      dias_atencion: f.dias_atencion.includes(val)
        ? f.dias_atencion.filter(d => d !== val)
        : [...f.dias_atencion, val].sort(),
    }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setOk(false); setError('')
    const res  = await fetch('/api/configuracion', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Error al guardar'); setSaving(false); return }
    setOk(true); setSaving(false)
    setTimeout(() => setOk(false), 3000)
  }

  if (loading) return <div className="emptyState"><p>Cargando…</p></div>

  return (
    <div style={{ maxWidth: 520 }}>
      <div className="topbar"><h1>Configuración del taller</h1></div>

      {ok    && <div className="notice"   style={{ marginBottom: 16 }}>Configuración guardada correctamente.</div>}
      {error && <div className="warningBox" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="gridPanel" style={{ padding: 24 }}>
        <form className="entityForm" onSubmit={handleSave}>
          <div>
            <p style={{ fontWeight: 700, marginBottom: 12 }}>Horario de atención</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label>
                <span>Hora apertura</span>
                <input type="time" value={form.hora_apertura} onChange={e => setForm(f => ({ ...f, hora_apertura: e.target.value }))} required />
              </label>
              <label>
                <span>Hora cierre</span>
                <input type="time" value={form.hora_cierre} onChange={e => setForm(f => ({ ...f, hora_cierre: e.target.value }))} required />
              </label>
            </div>
          </div>

          <div>
            <p style={{ fontWeight: 700, marginBottom: 10 }}>Días de atención</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {DIAS.map(d => (
                <label key={d.val} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 44, height: 44, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  border: `2px solid ${form.dias_atencion.includes(d.val) ? 'var(--brand)' : 'var(--line)'}`,
                  background: form.dias_atencion.includes(d.val) ? '#e6f4f3' : 'transparent',
                  color: form.dias_atencion.includes(d.val) ? 'var(--brand-dark)' : 'var(--muted)',
                }}>
                  <input type="checkbox" checked={form.dias_atencion.includes(d.val)} onChange={() => toggleDia(d.val)} style={{ display: 'none' }} />
                  {d.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontWeight: 700, marginBottom: 12 }}>Capacidad</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label>
                <span>Número de boxes</span>
                <input type="number" min="1" max="20" value={form.capacidad_boxes}
                  onChange={e => setForm(f => ({ ...f, capacidad_boxes: Number(e.target.value) }))} required />
              </label>
              <label>
                <span>Duración del slot</span>
                <select value={form.duracion_slot_min}
                  onChange={e => setForm(f => ({ ...f, duracion_slot_min: Number(e.target.value) }))}>
                  {SLOTS.map(s => <option key={s} value={s}>{s} min</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="formActions">
            <button type="submit" className="button teal" disabled={saving}>
              <Save size={14} />{saving ? 'Guardando…' : 'Guardar configuración'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

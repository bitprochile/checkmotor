'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Wrench, Save, X } from 'lucide-react'
import type { Servicio } from '@/lib/db'

type FormData = { nombre: string; descripcion: string; precio_base: string; activo: boolean }
const EMPTY: FormData = { nombre: '', descripcion: '', precio_base: '', activo: true }

function toForm(s: Servicio): FormData {
  return {
    nombre: s.nombre,
    descripcion: s.descripcion ?? '',
    precio_base: s.precio_base ? String(s.precio_base) : '',
    activo: s.activo,
  }
}

function formatCLP(n: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)
}

export default function ServiciosGrid() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [selected,  setSelected]  = useState<Servicio | null>(null)
  const [isNew,     setIsNew]     = useState(true)
  const [form,      setForm]      = useState<FormData>(EMPTY)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  async function load() {
    setLoading(true)
    const res  = await fetch('/api/servicios')
    const data = await res.json()
    setServicios(data.servicios ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() { setSelected(null); setIsNew(true); setForm(EMPTY); setError('') }

  function openEdit(s: Servicio) {
    setSelected(s); setIsNew(false); setForm(toForm(s)); setError('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      nombre:      form.nombre,
      descripcion: form.descripcion || null,
      precio_base: form.precio_base ? Number(form.precio_base) : null,
      activo:      form.activo,
    }
    const url    = isNew ? '/api/servicios' : `/api/servicios/${selected!.id}`
    const method = isNew ? 'POST' : 'PUT'
    const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Error al guardar'); setSaving(false); return }
    await load()
    openNew()
    setSaving(false)
  }

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('¿Eliminar este servicio?')) return
    await fetch(`/api/servicios/${id}`, { method: 'DELETE' })
    if (selected?.id === id) openNew()
    load()
  }

  const field = (key: keyof FormData, val: string | boolean) => setForm(f => ({ ...f, [key]: val }))

  return (
    <div className="workspace">
      {/* ── Grid panel ── */}
      <div className="gridPanel">
        <div className="toolbar">
          <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>Catálogo de servicios</span>
          <button className="button teal" onClick={openNew}>
            <Plus size={14} /> Nuevo servicio
          </button>
        </div>

        {loading ? (
          <div className="emptyState"><p>Cargando...</p></div>
        ) : servicios.length === 0 ? (
          <div className="emptyState">
            <Wrench size={36} style={{ margin: '0 auto 14px', opacity: 0.25 }} />
            <p>Sin servicios aún</p>
            <p>Agrega los servicios que ofrece tu taller.</p>
          </div>
        ) : (
          <table className="entityTable">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Precio base</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {servicios.map(s => (
                <tr key={s.id} className={selected?.id === s.id ? 'selected' : ''} onClick={() => openEdit(s)}>
                  <td><strong>{s.nombre}</strong></td>
                  <td style={{ color: 'var(--muted)', maxWidth: 240 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.descripcion ?? '—'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatCLP(s.precio_base)}</td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
                      background: s.activo ? '#dcfce7' : '#f3f4f6',
                      color: s.activo ? '#14532d' : 'var(--muted)',
                    }}>
                      {s.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <button className="button softDanger" style={{ padding: '4px 10px' }} onClick={e => handleDelete(s.id, e)}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Detail / form panel ── */}
      <div className="detailPanel">
        <div className="detailPanelHead">
          <h2>{isNew ? 'Nuevo servicio' : 'Editar servicio'}</h2>
          <button className="iconButton" onClick={openNew}><X size={15} /></button>
        </div>

          {error && <div className="warningBox" style={{ marginBottom: 14 }}>{error}</div>}

          <form className="entityForm" onSubmit={handleSave}>
            <label>
              <span>Nombre *</span>
              <input
                value={form.nombre}
                onChange={e => field('nombre', e.target.value)}
                placeholder="Ej: Cambio de aceite"
                required
              />
            </label>
            <label>
              <span>Descripción</span>
              <textarea
                rows={2}
                value={form.descripcion}
                onChange={e => field('descripcion', e.target.value)}
                placeholder="Detalle del servicio…"
                style={{ resize: 'vertical' }}
              />
            </label>
            <label>
              <span>Precio base ($)</span>
              <input
                type="number" min="0" step="1"
                value={form.precio_base}
                onChange={e => field('precio_base', e.target.value)}
                placeholder="25000"
              />
            </label>
            <label className="toggleSwitch" style={{ flexDirection: 'row', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.activo}
                onChange={e => field('activo', e.target.checked)}
              />
              <span />
              <em>Servicio activo</em>
            </label>

            <div className="formActions">
              <button type="submit" className="button teal" disabled={saving}>
                <Save size={14} />{saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button type="button" className="button" onClick={openNew}>
                <X size={14} />Cancelar
              </button>
            </div>
          </form>
        </div>
    </div>
  )
}

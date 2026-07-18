'use client'

import { useState, useEffect } from 'react'
import { Trash2, UserCog, Save, X } from 'lucide-react'
import type { Usuario } from '@/lib/db'

type FormData = { nombre: string; email: string; password: string; activo: boolean }
const EMPTY: FormData = { nombre: '', email: '', password: '', activo: true }

function toForm(m: Usuario): FormData {
  return { nombre: m.nombre, email: m.email, password: '', activo: m.activo }
}

export default function MecanicosGrid() {
  const [mecanicos, setMecanicos] = useState<Usuario[]>([])
  const [selected,  setSelected]  = useState<Usuario | null>(null)
  const [isNew,     setIsNew]     = useState(true)
  const [form,      setForm]      = useState<FormData>(EMPTY)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  async function load() {
    setLoading(true)
    const res  = await fetch('/api/mecanicos')
    const data = await res.json()
    setMecanicos(data.mecanicos ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() { setSelected(null); setIsNew(true); setForm(EMPTY); setError('') }

  function openEdit(m: Usuario) {
    setSelected(m); setIsNew(false); setForm(toForm(m)); setError('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const payload = { nombre: form.nombre, email: form.email, activo: form.activo, password: form.password || undefined }
    const url    = isNew ? '/api/mecanicos' : `/api/mecanicos/${selected!.id}`
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
    if (!confirm('¿Eliminar este mecánico?')) return
    await fetch(`/api/mecanicos/${id}`, { method: 'DELETE' })
    if (selected?.id === id) openNew()
    load()
  }

  const field = (key: keyof FormData, val: string | boolean) => setForm(f => ({ ...f, [key]: val }))

  return (
    <div className="workspace">
      {/* ── Grid ── */}
      <div className="gridPanel">
        <div className="toolbar">
          <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>Lista de mecánicos</span>
          <button className="button teal" onClick={openNew}>
            <UserCog size={14} /> Nuevo mecánico
          </button>
        </div>

        {loading ? (
          <div className="emptyState"><p>Cargando...</p></div>
        ) : mecanicos.length === 0 ? (
          <div className="emptyState">
            <UserCog size={36} style={{ margin: '0 auto 14px', opacity: 0.25 }} />
            <p>Sin mecánicos registrados</p>
            <p>Agrega el primero con el formulario.</p>
          </div>
        ) : (
          <table className="entityTable">
            <thead>
              <tr><th>Nombre</th><th>Email</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {mecanicos.map(m => (
                <tr key={m.id} className={selected?.id === m.id ? 'selected' : ''} onClick={() => openEdit(m)}>
                  <td><strong>{m.nombre}</strong></td>
                  <td style={{ color: 'var(--muted)' }}>{m.email}</td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      background: m.activo ? '#dcfce7' : '#f3f4f6',
                      color: m.activo ? '#14532d' : 'var(--muted)',
                    }}>
                      {m.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <button className="button softDanger" style={{ padding: '4px 10px' }} onClick={e => handleDelete(m.id, e)}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Form ── */}
      <div className="detailPanel">
        <div className="detailPanelHead">
          <h2>{isNew ? 'Nuevo mecánico' : 'Editar mecánico'}</h2>
          {!isNew && <button className="iconButton" onClick={openNew}><X size={15} /></button>}
        </div>

        {error && <div className="warningBox" style={{ marginBottom: 14 }}>{error}</div>}

        <form className="entityForm" onSubmit={handleSave}>
          <label>
            <span>Nombre *</span>
            <input value={form.nombre} onChange={e => field('nombre', e.target.value)} placeholder="Nombre completo" required />
          </label>
          <label>
            <span>Email *</span>
            <input type="email" value={form.email} onChange={e => field('email', e.target.value)} placeholder="mecanico@taller.com" required />
          </label>
          <label>
            <span>{isNew ? 'Contraseña *' : 'Nueva contraseña'}</span>
            <input
              type="password"
              value={form.password}
              onChange={e => field('password', e.target.value)}
              placeholder={isNew ? 'Contraseña de acceso' : 'Dejar vacío para no cambiar'}
              required={isNew}
            />
          </label>
          {!isNew && (
            <label className="toggleSwitch" style={{ flexDirection: 'row', alignItems: 'center' }}>
              <input type="checkbox" checked={form.activo} onChange={e => field('activo', e.target.checked)} />
              <span />
              <em>Mecánico activo</em>
            </label>
          )}

          <div className="formActions">
            <button type="submit" className="button teal" disabled={saving}>
              <Save size={14} />{saving ? 'Guardando...' : 'Guardar'}
            </button>
            {!isNew && (
              <button type="button" className="button" onClick={openNew}><X size={14} />Cancelar</button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

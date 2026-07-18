'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Users, Save, X } from 'lucide-react'
import type { Cliente } from '@/lib/db'

type FormData = { nombre: string; rut: string; email: string; telefono: string }
const EMPTY: FormData = { nombre: '', rut: '', email: '', telefono: '' }

function toForm(c: Cliente): FormData {
  return { nombre: c.nombre, rut: c.rut ?? '', email: c.email ?? '', telefono: c.telefono ?? '' }
}

export default function ClientesGrid() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [selected, setSelected] = useState<Cliente | null>(null)
  const [isNew, setIsNew] = useState(true)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const res = await fetch('/api/clientes')
    const data = await res.json()
    setClientes(data.clientes ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setSelected(null)
    setIsNew(true)
    setForm(EMPTY)
    setError('')
  }

  function openEdit(c: Cliente) {
    setSelected(c)
    setIsNew(false)
    setForm(toForm(c))
    setError('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const url    = isNew ? '/api/clientes' : `/api/clientes/${selected!.id}`
    const method = isNew ? 'POST' : 'PUT'
    const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Error al guardar'); setSaving(false); return }
    await load()
    openNew()
    setSaving(false)
  }

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('¿Eliminar este cliente? Esta acción no se puede deshacer.')) return
    await fetch(`/api/clientes/${id}`, { method: 'DELETE' })
    if (selected?.id === id) openNew()
    load()
  }

  const field = (key: keyof FormData, val: string) => setForm(f => ({ ...f, [key]: val }))

  return (
    <div className="workspace">
      {/* ── Grid panel ── */}
      <div className="gridPanel">
        <div className="toolbar">
          <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>Lista de clientes</span>
          <button className="button teal" onClick={openNew}>
            <Plus size={14} /> Nuevo cliente
          </button>
        </div>

        {loading ? (
          <div className="emptyState"><p>Cargando...</p></div>
        ) : clientes.length === 0 ? (
          <div className="emptyState">
            <Users size={36} style={{ margin: '0 auto 14px', opacity: 0.25 }} />
            <p>Sin clientes aún</p>
            <p>Agrega el primero con el botón de arriba.</p>
          </div>
        ) : (
          <table className="entityTable">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>RUT</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clientes.map(c => (
                <tr key={c.id} className={selected?.id === c.id ? 'selected' : ''} onClick={() => openEdit(c)}>
                  <td><strong>{c.nombre}</strong></td>
                  <td style={{ color: 'var(--muted)' }}>{c.rut ?? '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>{c.email ?? '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>{c.telefono ?? '—'}</td>
                  <td>
                    <button className="button softDanger" style={{ padding: '4px 10px' }} onClick={e => handleDelete(c.id, e)}>
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
          <h2>{isNew ? 'Nuevo cliente' : 'Editar cliente'}</h2>
          <button className="iconButton" onClick={openNew}><X size={15} /></button>
        </div>

          {error && <div className="warningBox" style={{ marginBottom: 14 }}>{error}</div>}

          <form className="entityForm" onSubmit={handleSave}>
            <label>
              <span>Nombre *</span>
              <input
                value={form.nombre}
                onChange={e => field('nombre', e.target.value)}
                placeholder="Nombre completo"
                required
              />
            </label>
            <label>
              <span>RUT</span>
              <input
                value={form.rut}
                onChange={e => field('rut', e.target.value)}
                placeholder="12.345.678-9"
              />
            </label>
            <label>
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={e => field('email', e.target.value)}
                placeholder="cliente@ejemplo.com"
              />
            </label>
            <label>
              <span>Teléfono</span>
              <input
                value={form.telefono}
                onChange={e => field('telefono', e.target.value)}
                placeholder="+56 9 1234 5678"
              />
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

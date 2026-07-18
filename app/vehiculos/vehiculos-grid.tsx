'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Car, Save, X, FileText } from 'lucide-react'
import type { VehiculoConCliente, Cliente } from '@/lib/db'

type FormData = {
  cliente_id: string; patente: string; marca: string
  modelo: string; anio: string; color: string
}
const EMPTY: FormData = { cliente_id: '', patente: '', marca: '', modelo: '', anio: '', color: '' }

function toForm(v: VehiculoConCliente): FormData {
  return {
    cliente_id: String(v.cliente_id),
    patente: v.patente, marca: v.marca, modelo: v.modelo,
    anio: v.anio ? String(v.anio) : '', color: v.color ?? '',
  }
}

export default function VehiculosGrid() {
  const router = useRouter()
  const [vehiculos, setVehiculos] = useState<VehiculoConCliente[]>([])
  const [clientes,  setClientes]  = useState<Cliente[]>([])
  const [selected, setSelected]   = useState<VehiculoConCliente | null>(null)
  const [isNew, setIsNew]         = useState(true)
  const [form, setForm]           = useState<FormData>(EMPTY)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function load() {
    setLoading(true)
    const [vRes, cRes] = await Promise.all([fetch('/api/vehiculos'), fetch('/api/clientes')])
    const [vData, cData] = await Promise.all([vRes.json(), cRes.json()])
    setVehiculos(vData.vehiculos ?? [])
    setClientes(cData.clientes ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() { setSelected(null); setIsNew(true); setForm(EMPTY); setError('') }
  function openEdit(v: VehiculoConCliente) { setSelected(v); setIsNew(false); setForm(toForm(v)); setError('') }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      ...form,
      cliente_id: Number(form.cliente_id),
      anio: form.anio ? Number(form.anio) : null,
      color: form.color || null,
    }
    const url    = isNew ? '/api/vehiculos' : `/api/vehiculos/${selected!.id}`
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
    if (!confirm('¿Eliminar este vehículo?')) return
    await fetch(`/api/vehiculos/${id}`, { method: 'DELETE' })
    if (selected?.id === id) openNew()
    load()
  }

  const field = (key: keyof FormData, val: string) => setForm(f => ({ ...f, [key]: val }))

  return (
    <div className="workspace">
      <div className="gridPanel">
        <div className="toolbar">
          <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>Lista de vehículos</span>
          <button className="button teal" onClick={openNew}>
            <Plus size={14} /> Nuevo vehículo
          </button>
        </div>

        {loading ? (
          <div className="emptyState"><p>Cargando...</p></div>
        ) : vehiculos.length === 0 ? (
          <div className="emptyState">
            <Car size={36} style={{ margin: '0 auto 14px', opacity: 0.25 }} />
            <p>Sin vehículos aún</p>
            <p>Registra el primero con el botón de arriba.</p>
          </div>
        ) : (
          <table className="entityTable">
            <thead>
              <tr>
                <th>Patente</th><th>Marca / Modelo</th>
                <th>Año</th><th>Color</th><th>Cliente</th><th></th>
              </tr>
            </thead>
            <tbody>
              {vehiculos.map(v => (
                <tr key={v.id} className={selected?.id === v.id ? 'selected' : ''} onClick={() => openEdit(v)}>
                  <td><strong style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{v.patente}</strong></td>
                  <td>{v.marca} {v.modelo}</td>
                  <td style={{ color: 'var(--muted)' }}>{v.anio ?? '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>{v.color ?? '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>{v.cliente_nombre}</td>
                  <td style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                    <button
                      className="button"
                      style={{ padding: '4px 10px' }}
                      title="Ver ficha"
                      onClick={() => router.push(`/vehiculos/${v.id}`)}
                    >
                      <FileText size={13} />
                    </button>
                    <button className="button softDanger" style={{ padding: '4px 10px' }} onClick={e => handleDelete(v.id, e)}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="detailPanel">
        <div className="detailPanelHead">
          <h2>{isNew ? 'Nuevo vehículo' : 'Editar vehículo'}</h2>
          <button className="iconButton" onClick={openNew}><X size={15} /></button>
        </div>

          {error && <div className="warningBox" style={{ marginBottom: 14 }}>{error}</div>}

          <form className="entityForm" onSubmit={handleSave}>
            <label>
              <span>Cliente *</span>
              <select value={form.cliente_id} onChange={e => field('cliente_id', e.target.value)} required>
                <option value="">Selecciona un cliente…</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
            <label>
              <span>Patente *</span>
              <input value={form.patente} onChange={e => field('patente', e.target.value.toUpperCase())} placeholder="ABCD12" required />
            </label>
            <label>
              <span>Marca *</span>
              <input value={form.marca} onChange={e => field('marca', e.target.value)} placeholder="Toyota" required />
            </label>
            <label>
              <span>Modelo *</span>
              <input value={form.modelo} onChange={e => field('modelo', e.target.value)} placeholder="Corolla" required />
            </label>
            <label>
              <span>Año</span>
              <input type="number" min="1900" max={new Date().getFullYear() + 1} value={form.anio} onChange={e => field('anio', e.target.value)} placeholder="2020" />
            </label>
            <label>
              <span>Color</span>
              <input value={form.color} onChange={e => field('color', e.target.value)} placeholder="Blanco" />
            </label>

            <div className="formActions">
              <button type="submit" className="button teal" disabled={saving}>
                <Save size={14} />{saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button type="button" className="button" onClick={openNew}><X size={14} />Cancelar</button>
            </div>
          </form>
        </div>
    </div>
  )
}

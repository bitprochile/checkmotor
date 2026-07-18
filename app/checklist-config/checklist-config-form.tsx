'use client'

import { useState, useEffect } from 'react'
import { Plus, RefreshCw, ChevronUp, ChevronDown, Pencil, Trash2, Check, X } from 'lucide-react'
import type { ChecklistItem } from '@/lib/db'

function groupBy<T>(arr: T[], key: (x: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, x) => {
    const k = key(x); (acc[k] = acc[k] ?? []).push(x); return acc
  }, {})
}

interface FormEdicion {
  nombre: string
  categoria: string
  descripcion: string
}

export default function ChecklistConfigForm() {
  const [items,          setItems]          = useState<ChecklistItem[]>([])
  const [loading,        setLoading]        = useState(true)
  const [restaurando,    setRestaurando]    = useState(false)
  const [editandoId,     setEditandoId]     = useState<number | null>(null)
  const [formEdicion,    setFormEdicion]    = useState<FormEdicion>({ nombre: '', categoria: '', descripcion: '' })
  const [guardando,      setGuardando]      = useState(false)
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const [nuevoNombre,    setNuevoNombre]    = useState('')
  const [nuevaDesc,      setNuevaDesc]      = useState('')
  const [agregando,      setAgregando]      = useState(false)
  const [mostrarForm,    setMostrarForm]    = useState(false)
  const [msg,            setMsg]            = useState('')

  async function load() {
    setLoading(true)
    const res  = await fetch('/api/checklist-items?activo=true')
    const data = await res.json()
    setItems(data.items ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleToggleActivo(item: ChecklistItem) {
    await fetch(`/api/checklist-items/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !item.activo }),
    })
    load()
  }

  async function handleEliminar(id: number) {
    if (!confirm('¿Eliminar este ítem? Esta acción no afecta checklists ya completados.')) return
    await fetch(`/api/checklist-items/${id}`, { method: 'DELETE' })
    load()
  }

  function startEdit(item: ChecklistItem) {
    setEditandoId(item.id)
    setFormEdicion({ nombre: item.nombre, categoria: item.categoria, descripcion: item.descripcion ?? '' })
  }

  async function handleGuardarEdit() {
    if (!editandoId) return
    setGuardando(true)
    await fetch(`/api/checklist-items/${editandoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formEdicion),
    })
    setEditandoId(null)
    setGuardando(false)
    load()
  }

  async function handleMover(item: ChecklistItem, direccion: 'up' | 'down') {
    const catItems = items.filter(i => i.categoria === item.categoria && i.activo).sort((a, b) => a.orden - b.orden)
    const idx = catItems.findIndex(i => i.id === item.id)
    const swapWith = direccion === 'up' ? catItems[idx - 1] : catItems[idx + 1]
    if (!swapWith) return

    await Promise.all([
      fetch(`/api/checklist-items/${item.id}`,    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orden: swapWith.orden }) }),
      fetch(`/api/checklist-items/${swapWith.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orden: item.orden }) }),
    ])
    load()
  }

  async function handleAgregar() {
    if (!nuevoNombre.trim() || !nuevaCategoria.trim()) return
    setAgregando(true)
    const res = await fetch('/api/checklist-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nuevoNombre.trim(), categoria: nuevaCategoria.trim(), descripcion: nuevaDesc.trim() || null }),
    })
    if (res.ok) {
      setNuevoNombre(''); setNuevaCategoria(''); setNuevaDesc(''); setMostrarForm(false)
    }
    setAgregando(false)
    load()
  }

  async function handleRestaurar() {
    if (!confirm('¿Restaurar los 33 ítems por defecto? Solo se agregan los que no existan — no se elimina nada.')) return
    setRestaurando(true)
    const res  = await fetch('/api/checklist-items/seed', { method: 'POST' })
    const data = await res.json()
    setMsg(data.message ?? 'Completado')
    setTimeout(() => setMsg(''), 4000)
    setRestaurando(false)
    load()
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--muted)', fontSize: 13 }}>Cargando ítems…</div>

  const grouped   = groupBy(items.filter(i => i.activo), i => i.categoria)
  const categorias = Object.keys(grouped).sort()

  return (
    <div>
      {msg && <div className="notice" style={{ marginBottom: 16 }}>{msg}</div>}

      <div className="topbar">
        <h1>Configuración del Checklist</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="button" onClick={() => setMostrarForm(!mostrarForm)}>
            <Plus size={14} /> Nuevo ítem
          </button>
          <button className="button" onClick={handleRestaurar} disabled={restaurando}>
            <RefreshCw size={14} /> {restaurando ? 'Restaurando…' : 'Restaurar por defecto'}
          </button>
        </div>
      </div>

      {/* Formulario nuevo ítem */}
      {mostrarForm && (
        <div className="gridPanel" style={{ padding: '16px 20px', marginBottom: 20 }}>
          <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Agregar ítem</p>
          <div className="entityForm">
            <label>
              Categoría
              <input
                value={nuevaCategoria}
                onChange={e => setNuevaCategoria(e.target.value)}
                placeholder="ej. Carrocería exterior"
                list="cat-existentes"
              />
              <datalist id="cat-existentes">
                {categorias.map(c => <option key={c} value={c} />)}
              </datalist>
            </label>
            <label>
              Nombre del ítem
              <input
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                placeholder="ej. Limpia parabrisas"
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Descripción (opcional)
              <input
                value={nuevaDesc}
                onChange={e => setNuevaDesc(e.target.value)}
                placeholder="Descripción adicional"
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="button teal" onClick={handleAgregar} disabled={agregando || !nuevoNombre.trim() || !nuevaCategoria.trim()}>
              {agregando ? 'Agregando…' : 'Agregar ítem'}
            </button>
            <button className="button" onClick={() => setMostrarForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Ítems por categoría */}
      {categorias.map(cat => {
        const catItems = grouped[cat].sort((a, b) => a.orden - b.orden)
        return (
          <div key={cat} className="gridPanel" style={{ marginBottom: 14, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: 'var(--panel-strong)', borderBottom: '1px solid var(--line)', fontWeight: 700, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {cat}
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>{catItems.length} ítems</span>
            </div>
            {catItems.map((item, idx) => (
              <div key={item.id} style={{ borderBottom: idx < catItems.length - 1 ? '1px solid var(--line)' : 'none' }}>
                {editandoId === item.id ? (
                  <div style={{ padding: '12px 16px', background: '#f0faf9', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      value={formEdicion.nombre}
                      onChange={e => setFormEdicion(p => ({ ...p, nombre: e.target.value }))}
                      placeholder="Nombre"
                      style={{ fontSize: 13, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 6, background: '#fff' }}
                    />
                    <input
                      value={formEdicion.categoria}
                      onChange={e => setFormEdicion(p => ({ ...p, categoria: e.target.value }))}
                      placeholder="Categoría"
                      style={{ fontSize: 13, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 6, background: '#fff' }}
                    />
                    <input
                      value={formEdicion.descripcion}
                      onChange={e => setFormEdicion(p => ({ ...p, descripcion: e.target.value }))}
                      placeholder="Descripción (opcional)"
                      style={{ fontSize: 13, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 6, background: '#fff' }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="button teal" style={{ fontSize: 12, padding: '4px 10px' }} onClick={handleGuardarEdit} disabled={guardando}>
                        <Check size={12} /> {guardando ? 'Guardando…' : 'Guardar'}
                      </button>
                      <button className="button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setEditandoId(null)}>
                        <X size={12} /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}>
                    {/* Reorder */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button className="iconButton" style={{ width: 22, height: 22, padding: 0 }}
                        onClick={() => handleMover(item, 'up')} disabled={idx === 0}>
                        <ChevronUp size={12} />
                      </button>
                      <button className="iconButton" style={{ width: 22, height: 22, padding: 0 }}
                        onClick={() => handleMover(item, 'down')} disabled={idx === catItems.length - 1}>
                        <ChevronDown size={12} />
                      </button>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{item.nombre}</div>
                      {item.descripcion && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{item.descripcion}</div>}
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button className="iconButton" title="Editar" onClick={() => startEdit(item)}><Pencil size={13} /></button>
                      <button className="iconButton" title="Eliminar" style={{ color: 'var(--danger)' }} onClick={() => handleEliminar(item.id)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      })}

      {items.length === 0 && (
        <div className="gridPanel" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          <p>No hay ítems de checklist configurados.</p>
          <button className="button teal" style={{ marginTop: 12 }} onClick={handleRestaurar} disabled={restaurando}>
            <RefreshCw size={14} /> Cargar ítems por defecto
          </button>
        </div>
      )}
    </div>
  )
}

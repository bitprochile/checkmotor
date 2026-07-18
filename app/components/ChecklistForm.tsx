'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown, ChevronRight, RotateCcw, ClipboardCheck } from 'lucide-react'
import type { OrdenChecklistConItem } from '@/lib/db'

interface ChecklistFormProps {
  ordenId: number
  soloLectura?: boolean
}

type EstadoItem = 'ok' | 'observacion' | 'no_aplica' | 'pendiente'

interface ItemLocal extends OrdenChecklistConItem {
  _saving?: boolean
}

function groupBy<T>(arr: T[], key: (x: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, x) => {
    const k = key(x); (acc[k] = acc[k] ?? []).push(x); return acc
  }, {})
}

export default function ChecklistForm({ ordenId, soloLectura = false }: ChecklistFormProps) {
  const [items,       setItems]       = useState<ItemLocal[]>([])
  const [inicializado, setInicializado] = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [iniciando,   setIniciando]   = useState(false)
  const [reseteando,  setReseteando]  = useState(false)
  const [completado,  setCompletado]  = useState(false)
  const [colapsadas,  setColapsadas]  = useState<Set<string>>(new Set())
  const notaTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const load = useCallback(async () => {
    const res  = await fetch(`/api/ordenes-trabajo/${ordenId}/checklist`)
    const data = await res.json()
    setItems(data.items ?? [])
    setInicializado(data.inicializado ?? false)
    setCompletado(data.items?.every((i: OrdenChecklistConItem) => i.estado !== 'pendiente') ?? false)
    setLoading(false)
  }, [ordenId])

  useEffect(() => { load() }, [load])

  async function handleIniciar() {
    setIniciando(true)
    const res  = await fetch(`/api/ordenes-trabajo/${ordenId}/checklist`, { method: 'POST' })
    const data = await res.json()
    setItems(data.items ?? [])
    setInicializado(true)
    setIniciando(false)
  }

  async function handleEstado(itemId: number, nuevoEstado: EstadoItem) {
    // Optimistic update
    setItems(prev => prev.map(i => i.item_id === itemId ? { ...i, estado: nuevoEstado, _saving: true } : i))
    const nota = items.find(i => i.item_id === itemId)?.nota ?? null
    const res  = await fetch(`/api/ordenes-trabajo/${ordenId}/checklist/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado, nota }),
    })
    const data = await res.json()
    if (res.ok) {
      setItems(prev => prev.map(i => i.item_id === itemId ? { ...data.item, _saving: false } : i))
      setCompletado(data.checklist_completado)
    } else {
      // Revert
      setItems(prev => prev.map(i => i.item_id === itemId ? { ...i, _saving: false } : i))
    }
  }

  function handleNotaChange(itemId: number, nota: string) {
    setItems(prev => prev.map(i => i.item_id === itemId ? { ...i, nota } : i))
    clearTimeout(notaTimers.current[itemId])
    notaTimers.current[itemId] = setTimeout(async () => {
      const item = items.find(i => i.item_id === itemId)
      if (!item || item.estado === 'pendiente') return
      await fetch(`/api/ordenes-trabajo/${ordenId}/checklist/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: item.estado, nota }),
      })
    }, 800)
  }

  async function handleReset() {
    if (!confirm('¿Reiniciar todos los ítems del checklist a estado pendiente?')) return
    setReseteando(true)
    await fetch(`/api/ordenes-trabajo/${ordenId}/checklist/reset`, { method: 'POST' })
    await load()
    setReseteando(false)
  }

  function toggleCategoria(cat: string) {
    setColapsadas(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  if (loading) return <div style={{ padding: '24px 0', color: 'var(--muted)', fontSize: 13 }}>Cargando checklist…</div>

  if (!inicializado) {
    return (
      <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          El checklist de recepción no ha sido iniciado para esta orden.
        </p>
        {!soloLectura && (
          <button className="button teal" onClick={handleIniciar} disabled={iniciando}>
            <ClipboardCheck size={14} />
            {iniciando ? 'Iniciando…' : 'Iniciar checklist de recepción'}
          </button>
        )}
      </div>
    )
  }

  const revisados = items.filter(i => i.estado !== 'pendiente').length
  const total     = items.length
  const pct       = total > 0 ? Math.round((revisados / total) * 100) : 0
  const grouped   = groupBy(items, i => i.categoria)
  const categorias = Object.keys(grouped).sort()

  return (
    <div>
      {/* Progreso */}
      <div className="checklist-progress">
        <div className="checklist-progress-label">
          <span><strong>{revisados}</strong> de {total} ítems revisados</span>
          {completado
            ? <span className="checklist-badge completado">✓ Completado</span>
            : <span style={{ color: 'var(--muted)' }}>{pct}%</span>
          }
        </div>
        <div className="checklist-progress-bar-wrap">
          <div className="checklist-progress-bar" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Botón reset */}
      {!soloLectura && inicializado && (
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="button" style={{ fontSize: 11, padding: '4px 10px' }} onClick={handleReset} disabled={reseteando}>
            <RotateCcw size={11} /> {reseteando ? 'Reiniciando…' : 'Reiniciar checklist'}
          </button>
        </div>
      )}

      {/* Categorías */}
      {categorias.map(cat => {
        const catItems    = grouped[cat]
        const catRevisados = catItems.filter(i => i.estado !== 'pendiente').length
        const colapsada   = colapsadas.has(cat)
        return (
          <div key={cat} className="checklist-categoria">
            <div className="checklist-categoria-header" onClick={() => toggleCategoria(cat)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {colapsada ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                {cat}
              </span>
              <span className="cat-conteo">{catRevisados}/{catItems.length}</span>
            </div>

            {!colapsada && (
              <div style={{ border: '.5px solid var(--line)', borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
                {catItems.map(item => (
                  <div key={item.item_id} className="checklist-item">
                    <div style={{ flex: 1 }}>
                      <span className={`checklist-item-nombre${item.estado !== 'pendiente' ? ' revisado' : ''}`}>
                        {item.item_nombre}
                      </span>
                      {item.estado === 'observacion' && !soloLectura && (
                        <textarea
                          className="checklist-nota"
                          placeholder="Describe la observación…"
                          value={item.nota ?? ''}
                          onChange={e => handleNotaChange(item.item_id, e.target.value)}
                          onBlur={e => handleNotaChange(item.item_id, e.target.value)}
                        />
                      )}
                      {item.estado === 'observacion' && soloLectura && item.nota && (
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{item.nota}</p>
                      )}
                    </div>
                    {soloLectura ? (
                      <div style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0, paddingTop: 2 }}>
                        {item.estado === 'ok'          && <span style={{ color: '#065f46', fontWeight: 600 }}>✓ OK</span>}
                        {item.estado === 'observacion' && <span style={{ color: '#92400e', fontWeight: 600 }}>⚠ Observación</span>}
                        {item.estado === 'no_aplica'   && <span style={{ color: '#6b7280' }}>— No aplica</span>}
                        {item.estado === 'pendiente'   && <span style={{ color: 'var(--muted)' }}>Pendiente</span>}
                      </div>
                    ) : (
                      <div className="estado-btns">
                        <button
                          className={`estado-btn ok${item.estado === 'ok' ? ' activo' : ''}`}
                          disabled={item._saving}
                          onClick={() => handleEstado(item.item_id, item.estado === 'ok' ? 'pendiente' : 'ok')}>
                          ✓ OK
                        </button>
                        <button
                          className={`estado-btn obs${item.estado === 'observacion' ? ' activo' : ''}`}
                          disabled={item._saving}
                          onClick={() => handleEstado(item.item_id, item.estado === 'observacion' ? 'pendiente' : 'observacion')}>
                          ⚠ Obs.
                        </button>
                        <button
                          className={`estado-btn na${item.estado === 'no_aplica' ? ' activo' : ''}`}
                          disabled={item._saving}
                          onClick={() => handleEstado(item.item_id, item.estado === 'no_aplica' ? 'pendiente' : 'no_aplica')}>
                          — N/A
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Check, ChevronRight, ChevronDown, ChevronUp, X } from 'lucide-react'

interface ClienteResult { tipo: 'cliente'; id: number; label: string; sub: string }
interface Vehiculo { id: number; patente: string; marca: string; modelo: string }
interface Mecanico { id: number; nombre: string }
interface Slot { hora: string; disponible: boolean; boxes_libres: number }
interface Servicio { id: number; nombre: string; descripcion: string | null; activo: boolean }

const DURACIONES = [
  { label: '30 min', val: 30 }, { label: '1 h', val: 60 }, { label: '1.5 h', val: 90 },
  { label: '2 h', val: 120 }, { label: '3 h', val: 180 }, { label: '4 h+', val: 240 },
]

function groupByCategoria(servicios: Servicio[]): Record<string, Servicio[]> {
  return servicios.reduce<Record<string, Servicio[]>>((acc, s) => {
    const cat = s.descripcion ?? 'Sin categoría'
    ;(acc[cat] = acc[cat] ?? []).push(s)
    return acc
  }, {})
}

export default function NuevaCitaForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const preVehId     = searchParams.get('vehiculo_id') ?? ''

  // Paso 1
  const [paso, setPaso]                 = useState(preVehId ? 2 : 1)
  const [q, setQ]                       = useState('')
  const [resultados, setResultados]     = useState<ClienteResult[]>([])
  const [vehiculos, setVehiculos]       = useState<Vehiculo[]>([])
  const [selectedVeh, setSelectedVeh]   = useState<Vehiculo | null>(null)

  // Paso 2
  const [mecanicos, setMecanicos]               = useState<Mecanico[]>([])
  const [servicios, setServicios]               = useState<Servicio[]>([])
  const [serviciosSelec, setServiciosSelec]     = useState<number[]>([])
  const [pickerAbierto, setPickerAbierto]       = useState(false)
  const [slots, setSlots]                       = useState<Slot[]>([])
  const [fecha, setFecha]                       = useState('')
  const [horaSeleccionada, setHoraSeleccionada] = useState('')
  const [duracion, setDuracion]                 = useState(60)
  const [mecanicoId, setMecanicoId]             = useState('')
  const [observaciones, setObservaciones]       = useState('')
  const [saving, setSaving]                     = useState(false)
  const [error, setError]                       = useState('')
  const [loadingSlots, setLoadingSlots]         = useState(false)

  const categorias = useMemo(() => groupByCategoria(servicios.filter(s => s.activo)), [servicios])

  // Cargar vehículo pre-seleccionado, mecánicos y servicios
  useEffect(() => {
    if (preVehId) {
      fetch(`/api/vehiculos/${preVehId}`).then(r => r.json()).then(d => {
        if (d.vehiculo) { setSelectedVeh(d.vehiculo); setPaso(2) }
      })
    }
    fetch('/api/usuarios/mecanicos').then(r => r.json()).then(d => setMecanicos(d.mecanicos ?? []))
    fetch('/api/servicios').then(r => r.json()).then(d => setServicios(d.servicios ?? []))
  }, [preVehId])

  // Búsqueda de clientes con debounce
  useEffect(() => {
    if (q.length < 2) { setResultados([]); return }
    const t = setTimeout(async () => {
      const res  = await fetch(`/api/buscar?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResultados((data.resultados ?? []).filter((r: ClienteResult) => r.tipo === 'cliente'))
    }, 280)
    return () => clearTimeout(t)
  }, [q])

  // Slots al cambiar fecha o duración
  useEffect(() => {
    if (!fecha) { setSlots([]); return }
    setLoadingSlots(true); setHoraSeleccionada('')
    fetch(`/api/citas/disponibilidad?fecha=${fecha}&duracion_min=${duracion}`)
      .then(r => r.json())
      .then(d => { setSlots(d.slots ?? []); setLoadingSlots(false) })
      .catch(() => setLoadingSlots(false))
  }, [fecha, duracion])

  async function selectCliente(r: ClienteResult) {
    const res  = await fetch(`/api/vehiculos?cliente_id=${r.id}`)
    const data = await res.json()
    setVehiculos(data.vehiculos ?? [])
    setResultados([])
    setQ(r.label)
  }

  function toggleServicio(id: number) {
    setServiciosSelec(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function quitarServicio(id: number) {
    setServiciosSelec(prev => prev.filter(x => x !== id))
  }

  const nombresSeleccionados = serviciosSelec
    .map(id => servicios.find(s => s.id === id)?.nombre ?? '')
    .filter(Boolean)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedVeh || !fecha || !horaSeleccionada) { setError('Completa todos los campos requeridos'); return }
    setSaving(true); setError('')
    const fecha_hora  = `${fecha}T${horaSeleccionada}:00`
    const tipo_servicio = nombresSeleccionados.length > 0
      ? nombresSeleccionados.join(' + ')
      : undefined
    const res = await fetch('/api/citas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehiculo_id:  selectedVeh.id,
        mecanico_id:  mecanicoId ? Number(mecanicoId) : undefined,
        fecha_hora, duracion_min: duracion,
        tipo_servicio,
        observaciones: observaciones || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Error al agendar'); setSaving(false); return }
    router.push('/agenda')
  }

  return (
    <div style={{ maxWidth: 580 }}>
      {error && <div className="warningBox" style={{ marginBottom: 16 }}>{error}</div>}

      {/* ── Paso 1 — Vehículo ── */}
      {paso === 1 && (
        <div className="gridPanel" style={{ padding: 24 }}>
          <p style={{ fontWeight: 700, marginBottom: 16 }}>Paso 1 — Seleccionar cliente y vehículo</p>

          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar cliente por nombre…" style={{ paddingLeft: 30 }} />
            {resultados.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 6, boxShadow: 'var(--shadow)', zIndex: 20 }}>
                {resultados.map(r => (
                  <button key={r.id} type="button" onClick={() => selectCliente(r)}
                    style={{ display: 'block', width: '100%', padding: '9px 12px', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13 }}>
                    <strong>{r.label}</strong>
                    {r.sub && <span style={{ color: 'var(--muted)', marginLeft: 8, fontSize: 12 }}>{r.sub}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {vehiculos.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Selecciona el vehículo:</p>
              {vehiculos.map(v => (
                <button key={v.id} type="button" onClick={() => { setSelectedVeh(v); setPaso(2) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--panel-strong)', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{v.patente}</strong>
                    <span style={{ color: 'var(--muted)', marginLeft: 8, fontSize: 13 }}>{v.marca} {v.modelo}</span>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Paso 2 — Fecha / hora / detalle ── */}
      {paso === 2 && selectedVeh && (
        <div className="gridPanel" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <p style={{ fontWeight: 700 }}>Paso 2 — Fecha y detalles</p>
            {!preVehId && (
              <button type="button" className="button" style={{ fontSize: 12 }}
                onClick={() => { setPaso(1); setSelectedVeh(null); setVehiculos([]); setQ('') }}>
                ← Cambiar vehículo
              </button>
            )}
          </div>

          <div style={{ background: '#e6f4f3', border: '1px solid #c4dedd', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13 }}>
            <strong style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{selectedVeh.patente}</strong>
            <span style={{ color: 'var(--muted)', marginLeft: 8 }}>{selectedVeh.marca} {selectedVeh.modelo}</span>
          </div>

          <form className="entityForm" onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label>
                <span>Fecha *</span>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required
                  min={new Date().toISOString().slice(0, 10)} />
              </label>
              <label>
                <span>Duración estimada</span>
                <select value={duracion} onChange={e => setDuracion(Number(e.target.value))}>
                  {DURACIONES.map(d => <option key={d.val} value={d.val}>{d.label}</option>)}
                </select>
              </label>
            </div>

            {fecha && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                  Hora disponible *
                </p>
                {loadingSlots ? (
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>Cargando disponibilidad…</p>
                ) : slots.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--danger)' }}>Sin slots disponibles para este día.</p>
                ) : (
                  <div className="slots-grid">
                    {slots.map(s => (
                      <button key={s.hora} type="button"
                        className={`slot-btn${horaSeleccionada === s.hora ? ' selected' : ''}`}
                        disabled={!s.disponible}
                        onClick={() => setHoraSeleccionada(s.hora)}
                        title={s.disponible
                          ? `${s.boxes_libres} box${s.boxes_libres > 1 ? 'es' : ''} libre${s.boxes_libres > 1 ? 's' : ''}`
                          : 'Sin disponibilidad'}>
                        {s.hora}
                        {horaSeleccionada === s.hora && <Check size={10} style={{ display: 'inline', marginLeft: 2 }} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <label>
              <span>Mecánico asignado</span>
              <select value={mecanicoId} onChange={e => setMecanicoId(e.target.value)}>
                <option value="">Sin asignar</option>
                {mecanicos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </label>

            {/* ── Selector multi-servicio ── */}
            <div>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Servicios a realizar
              </span>

              {/* Tags de seleccionados */}
              {serviciosSelec.length > 0 && (
                <div className="servicio-seleccionados" style={{ marginBottom: 8 }}>
                  {serviciosSelec.map(id => {
                    const s = servicios.find(x => x.id === id)
                    if (!s) return null
                    return (
                      <span key={id} className="servicio-tag">
                        {s.nombre}
                        <button type="button" onClick={() => quitarServicio(id)} title="Quitar">
                          <X size={11} />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Panel collapsible del catálogo */}
              <div className="servicio-picker">
                <div className="servicio-picker-header" onClick={() => setPickerAbierto(p => !p)}>
                  <span>
                    {serviciosSelec.length === 0
                      ? 'Seleccionar servicios del catálogo'
                      : `${serviciosSelec.length} servicio${serviciosSelec.length > 1 ? 's' : ''} seleccionado${serviciosSelec.length > 1 ? 's' : ''}`}
                  </span>
                  {pickerAbierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>

                {pickerAbierto && (
                  <div className="servicio-picker-body">
                    {Object.entries(categorias).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => (
                      <div key={cat}>
                        <div className="servicio-cat-label">{cat}</div>
                        <div className="servicio-chips">
                          {items.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              className={`servicio-chip${serviciosSelec.includes(s.id) ? ' sel' : ''}`}
                              onClick={() => toggleServicio(s.id)}>
                              {serviciosSelec.includes(s.id) && <Check size={10} style={{ display: 'inline', marginRight: 3 }} />}
                              {s.nombre}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {servicios.length === 0 && (
                      <p style={{ fontSize: 12, color: 'var(--muted)' }}>No hay servicios configurados.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <label>
              <span>Observaciones</span>
              <textarea rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)}
                style={{ resize: 'vertical' }} />
            </label>

            <div className="formActions">
              <button type="submit" className="button teal" disabled={saving || !horaSeleccionada}>
                {saving ? 'Guardando…' : 'Confirmar cita'}
              </button>
              <button type="button" className="button" onClick={() => router.push('/agenda')}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, X, MessageCircle, ClipboardList } from 'lucide-react'
import type { CitaConDetalle, EstadoCita } from '@/lib/db'
import { generarLinkWhatsApp } from '@/lib/whatsapp'

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const ESTADO_LABELS: Record<EstadoCita, string> = {
  pendiente:   'Pendiente',
  confirmada:  'Confirmada',
  en_curso:    'En curso',
  completada:  'Completada',
  cancelada:   'Cancelada',
  no_asistio:  'No asistió',
}

function getLunesDe(d: Date): Date {
  const date = new Date(d)
  const dow  = date.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatHora(d: Date | string): string {
  return new Date(d).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

function formatFechaHora(d: Date | string): string {
  return new Date(d).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AgendaSemanal() {
  const router = useRouter()
  const [semana,   setSemana]   = useState<Date>(() => getLunesDe(new Date()))
  const [citas,    setCitas]    = useState<CitaConDetalle[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<CitaConDetalle | null>(null)
  const [editEstado, setEditEstado] = useState<EstadoCita | ''>('')
  const [saving,   setSaving]   = useState(false)
  const [convirtiendo, setConvirtiendo] = useState(false)
  const [panelOk,  setPanelOk]  = useState('')

  const loadCitas = useCallback(async (lunes: Date) => {
    setLoading(true)
    const res  = await fetch(`/api/citas?semana=${isoDate(lunes)}`)
    const data = await res.json()
    setCitas(data.citas ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadCitas(semana) }, [semana, loadCitas])

  function prevSemana() { setSemana(d => addDays(d, -7)); setSelected(null) }
  function nextSemana() { setSemana(d => addDays(d, 7));  setSelected(null) }
  function irHoy()      { setSemana(getLunesDe(new Date())); setSelected(null) }

  function selectCita(c: CitaConDetalle) {
    setSelected(c); setEditEstado(c.estado); setPanelOk('')
  }

  async function handleEstado() {
    if (!selected || !editEstado) return
    setSaving(true)
    const res  = await fetch(`/api/citas/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: editEstado }),
    })
    const data = await res.json()
    if (res.ok) {
      setCitas(prev => prev.map(c => c.id === selected.id ? data.cita : c))
      setSelected(data.cita)
      setPanelOk('Estado actualizado')
      setTimeout(() => setPanelOk(''), 2500)
    }
    setSaving(false)
  }

  async function handleConvertir() {
    if (!selected) return
    setConvirtiendo(true)
    const res  = await fetch(`/api/citas/${selected.id}/convertir-orden`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      router.push('/ordenes-trabajo')
    } else {
      setPanelOk(data.error ?? 'Error')
      setTimeout(() => setPanelOk(''), 3000)
    }
    setConvirtiendo(false)
  }

  async function handleCancelar() {
    if (!selected || !confirm('¿Cancelar esta cita?')) return
    await fetch(`/api/citas/${selected.id}`, { method: 'DELETE' })
    setCitas(prev => prev.filter(c => c.id !== selected.id))
    setSelected(null)
    loadCitas(semana)
  }

  // Construir días de la semana mostrada
  const diasMostrados = Array.from({ length: 7 }, (_, i) => addDays(semana, i))
  const hoy           = isoDate(new Date())

  // Horas a mostrar (7 a 20)
  const horas = Array.from({ length: 14 }, (_, i) => i + 7)

  // Agrupar citas por día y hora
  function citasEnCelda(dia: Date, hora: number): CitaConDetalle[] {
    const diaStr = isoDate(dia)
    return citas.filter(c => {
      const cd = new Date(c.fecha_hora)
      return isoDate(cd) === diaStr && cd.getHours() === hora
    })
  }

  // WhatsApp
  function waLink(cita: CitaConDetalle, tipo: 'confirmacion' | 'recordatorio') {
    if (!cita.cliente_telefono) return null
    return generarLinkWhatsApp(tipo, {
      telefono:         cita.cliente_telefono,
      cliente_nombre:   cita.cliente_nombre,
      vehiculo_patente: cita.vehiculo_patente,
      vehiculo_marca:   cita.vehiculo_marca,
      vehiculo_modelo:  cita.vehiculo_modelo,
      fecha_hora:       new Date(cita.fecha_hora),
    })
  }

  const semanaLabel = `${addDays(semana, 0).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })} – ${addDays(semana, 6).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}`

  return (
    <div>
      {/* ── Topbar ── */}
      <div className="topbar" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="iconButton" onClick={prevSemana}><ChevronLeft size={16} /></button>
          <span style={{ fontWeight: 700, fontSize: 15, minWidth: 200, textAlign: 'center' }}>{semanaLabel}</span>
          <button className="iconButton" onClick={nextSemana}><ChevronRight size={16} /></button>
          <button className="button" style={{ fontSize: 12 }} onClick={irHoy}>Hoy</button>
        </div>
        <button className="button teal" onClick={() => router.push('/agenda/nueva')}>
          <Plus size={14} /> Nueva cita
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* ── Grilla semanal ── */}
        <div className="gridPanel" style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div className="emptyState"><p>Cargando agenda…</p></div>
          ) : (
            <table className="agenda-grid">
              <thead>
                <tr>
                  <th style={{ width: 52 }}></th>
                  {diasMostrados.map((d, i) => (
                    <th key={i} className={isoDate(d) === hoy ? 'hoy' : ''}>
                      <div>{DIAS_SEMANA[i]}</div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{d.getDate()}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {horas.map(h => (
                  <tr key={h}>
                    <td>{String(h).padStart(2, '0')}:00</td>
                    {diasMostrados.map((d, i) => {
                      const cCs = citasEnCelda(d, h)
                      return (
                        <td key={i} style={{ background: isoDate(d) === hoy ? '#f9fffe' : undefined }}>
                          {cCs.map(c => (
                            <div key={c.id}
                              className={`cita-bloque cita-${c.estado}`}
                              onClick={() => selectCita(c)}
                              title={`${c.cliente_nombre} — ${c.vehiculo_patente}\n${c.tipo_servicio ?? ''}`}>
                              {formatHora(c.fecha_hora)} {c.vehiculo_patente}
                              {c.tipo_servicio && ` · ${c.tipo_servicio}`}
                            </div>
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Panel lateral ── */}
        {selected && (
          <div className="agenda-panel" style={{ flexShrink: 0 }}>
            <div className="agenda-panel-header">
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Detalle de cita</h2>
              <button className="agenda-panel-close" onClick={() => setSelected(null)}>
                <X size={18} />
              </button>
            </div>

            {panelOk && (
              <div className={panelOk.includes('Error') || panelOk.includes('ya tiene') ? 'warningBox' : 'notice'} style={{ marginBottom: 12, fontSize: 13 }}>
                {panelOk}
              </div>
            )}

            <div style={{ display: 'grid', gap: 8, fontSize: 13, marginBottom: 16 }}>
              <div>
                <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>Cliente</span>
                <p style={{ fontWeight: 700, marginTop: 2 }}>{selected.cliente_nombre}</p>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>Vehículo</span>
                <p style={{ marginTop: 2 }}>
                  <strong style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{selected.vehiculo_patente}</strong>
                  {' '}{selected.vehiculo_marca} {selected.vehiculo_modelo}
                </p>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>Fecha y hora</span>
                <p style={{ marginTop: 2 }}>{formatFechaHora(selected.fecha_hora)}</p>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div>
                  <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>Duración</span>
                  <p style={{ marginTop: 2 }}>{selected.duracion_min} min</p>
                </div>
                {selected.mecanico_nombre && (
                  <div>
                    <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>Mecánico</span>
                    <p style={{ marginTop: 2 }}>{selected.mecanico_nombre}</p>
                  </div>
                )}
              </div>
              {selected.tipo_servicio && (
                <div>
                  <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>Servicio</span>
                  <p style={{ marginTop: 2 }}>{selected.tipo_servicio}</p>
                </div>
              )}
              {selected.observaciones && (
                <div>
                  <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>Observaciones</span>
                  <p style={{ marginTop: 2, color: 'var(--muted)' }}>{selected.observaciones}</p>
                </div>
              )}
              {selected.orden_id && (
                <div>
                  <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>Orden vinculada</span>
                  <p style={{ marginTop: 2, color: 'var(--brand-dark)', fontWeight: 600 }}>#{selected.orden_id}</p>
                </div>
              )}
            </div>

            {/* Estado */}
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Estado</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <select value={editEstado} onChange={e => setEditEstado(e.target.value as EstadoCita)} style={{ flex: 1 }}>
                  {(Object.keys(ESTADO_LABELS) as EstadoCita[]).map(k => (
                    <option key={k} value={k}>{ESTADO_LABELS[k]}</option>
                  ))}
                </select>
                <button className="button teal" style={{ padding: '6px 12px', fontSize: 12 }} disabled={saving || editEstado === selected.estado} onClick={handleEstado}>
                  {saving ? '…' : 'OK'}
                </button>
              </div>
            </div>

            {/* Acciones */}
            <div style={{ display: 'grid', gap: 8 }}>
              {!selected.orden_id && (
                <button className="button teal" style={{ justifyContent: 'center' }} disabled={convirtiendo} onClick={handleConvertir}>
                  <ClipboardList size={14} />{convirtiendo ? 'Convirtiendo…' : 'Convertir a orden de trabajo'}
                </button>
              )}
              {selected.cliente_telefono && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <a href={waLink(selected, 'confirmacion') ?? '#'} target="_blank" rel="noopener noreferrer"
                    className="button" style={{ justifyContent: 'center', textDecoration: 'none', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MessageCircle size={13} /> Confirmar
                  </a>
                  <a href={waLink(selected, 'recordatorio') ?? '#'} target="_blank" rel="noopener noreferrer"
                    className="button" style={{ justifyContent: 'center', textDecoration: 'none', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MessageCircle size={13} /> Recordatorio
                  </a>
                </div>
              )}
              {!selected.cliente_telefono && (
                <p style={{ fontSize: 11, color: 'var(--muted)' }}>Sin teléfono registrado (WhatsApp no disponible)</p>
              )}
              <button className="button" style={{ justifyContent: 'center' }}
                onClick={() => router.push(`/agenda/nueva?vehiculo_id=${selected.vehiculo_id}`)}>
                Editar / reagendar
              </button>
              {selected.estado !== 'cancelada' && (
                <button className="button softDanger" style={{ justifyContent: 'center' }} onClick={handleCancelar}>
                  Cancelar cita
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

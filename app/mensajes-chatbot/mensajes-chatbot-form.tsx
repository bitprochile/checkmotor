'use client'

import { useState, useEffect } from 'react'
import { Save, MessageSquare, Power } from 'lucide-react'

interface MensajeChatbot {
  tipo: string; nombre: string; descripcion: string | null; plantilla: string; activo: boolean
}

export default function MensajesChatbotForm() {
  const [mensajes, setMensajes] = useState<MensajeChatbot[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState<string | null>(null)
  const [ok,       setOk]       = useState<string | null>(null)
  const [error,    setError]    = useState('')

  useEffect(() => {
    fetch('/api/mensajes-chatbot')
      .then(r => r.json())
      .then(d => { setMensajes(d.mensajes ?? []); setLoading(false) })
      .catch(() => { setError('No se pudieron cargar los mensajes'); setLoading(false) })
  }, [])

  function setPlantilla(tipo: string, val: string) {
    setMensajes(ms => ms.map(m => m.tipo === tipo ? { ...m, plantilla: val } : m))
  }

  function toggleActivo(tipo: string) {
    setMensajes(ms => ms.map(m => m.tipo === tipo ? { ...m, activo: !m.activo } : m))
  }

  async function guardar(e: React.FormEvent, msg: MensajeChatbot) {
    e.preventDefault()
    setSaving(msg.tipo); setOk(null); setError('')
    const res  = await fetch('/api/mensajes-chatbot', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: msg.tipo, plantilla: msg.plantilla, activo: msg.activo }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Error al guardar'); setSaving(null); return }
    setOk(msg.tipo); setSaving(null)
    setTimeout(() => setOk(null), 3000)
  }

  if (loading) return <div className="emptyState"><p>Cargando…</p></div>

  return (
    <div style={{ maxWidth: 620 }}>
      <div className="topbar">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageSquare size={20} /> Mensajes Chatbot
          </h1>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            Mensajes automáticos enviados por WhatsApp según eventos del sistema
          </span>
        </div>
      </div>

      {error && <div className="warningBox" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {mensajes.map(msg => (
          <div key={msg.tipo} className="gridPanel" style={{ padding: 24 }}>
            <form onSubmit={e => guardar(e, msg)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>{msg.nombre}</p>
                  <span style={{
                    display: 'inline-block', marginTop: 4,
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                    background: msg.activo ? 'rgba(15,118,110,.12)' : 'rgba(102,112,106,.12)',
                    color: msg.activo ? 'var(--brand-dark)' : 'var(--muted)',
                  }}>
                    {msg.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <button
                  type="button"
                  className={`button${msg.activo ? ' softDanger' : ' teal'}`}
                  style={{ padding: '5px 12px', fontSize: 12 }}
                  onClick={() => toggleActivo(msg.tipo)}
                >
                  <Power size={12} />{msg.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>

              {msg.descripcion && (
                <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--panel-strong)', borderRadius: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                  {msg.descripcion}
                </div>
              )}

              <div className="entityForm">
                <label>
                  <span>Plantilla del mensaje</span>
                  <textarea
                    rows={4}
                    value={msg.plantilla}
                    onChange={e => setPlantilla(msg.tipo, e.target.value)}
                    required
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </label>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {ok === msg.tipo && (
                    <div className="notice" style={{ padding: '6px 14px', fontSize: 12 }}>✅ Guardado correctamente</div>
                  )}
                  <div style={{ marginLeft: 'auto' }}>
                    <button type="submit" className="button teal" disabled={saving === msg.tipo} style={{ minWidth: 140 }}>
                      <Save size={14} />{saving === msg.tipo ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        ))}

        {mensajes.length === 0 && (
          <div className="emptyState">
            <MessageSquare size={32} style={{ opacity: .2, marginBottom: 8 }} />
            <p>No hay mensajes configurados</p>
          </div>
        )}
      </div>
    </div>
  )
}

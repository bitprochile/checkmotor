'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquare, Bot, User, X, RefreshCw, Settings, Send, Power, CheckCheck } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface Conversacion {
  id: number; whatsapp_id: string; nombre_contacto: string | null
  modo: 'bot' | 'humano' | 'cerrada'; mensajes_no_leidos: number
  created_at: string; ultimo_mensaje: string | null; ultimo_mensaje_en: string | null
}

interface Mensaje {
  id: number; direccion: 'entrante' | 'saliente'; contenido: string
  tipo: string; enviado_en: string
}

interface WaConfig {
  phone_number_id: string; verify_token: string; activo: boolean
  has_access_token: boolean
}

type Filtro  = 'todas' | 'bot' | 'humano' | 'cerrada'
type Panel   = 'idle' | 'chat' | 'config'

// ── Helpers ────────────────────────────────────────────────────────────────

const MODO_LABEL: Record<string, string>  = { bot: 'Bot', humano: 'Humano', cerrada: 'Cerrada' }
const MODO_COLOR: Record<string, string>  = {
  bot:    'rgba(15,118,110,.12)',
  humano: 'rgba(180,83,9,.12)',
  cerrada:'rgba(102,112,106,.12)',
}
const MODO_TEXT: Record<string, string> = {
  bot:    'var(--brand-dark)',
  humano: 'var(--accent)',
  cerrada:'var(--muted)',
}

function hora(d: string | null) {
  if (!d) return ''
  const dt = new Date(d)
  const hoy = new Date()
  if (dt.toDateString() === hoy.toDateString())
    return dt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  return dt.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
}

function nombreCorto(conv: Conversacion) {
  return conv.nombre_contacto ?? `+${conv.whatsapp_id}`
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ConversacionesGrid() {
  const [convs,      setConvs]      = useState<Conversacion[]>([])
  const [selected,   setSelected]   = useState<Conversacion | null>(null)
  const [mensajes,   setMensajes]   = useState<Mensaje[]>([])
  const [panel,      setPanel]      = useState<Panel>('idle')
  const [filtro,     setFiltro]     = useState<Filtro>('todas')
  const [loading,    setLoading]    = useState(true)
  const [sending,    setSending]    = useState(false)
  const [texto,      setTexto]      = useState('')
  const [error,      setError]      = useState('')
  const [config,      setConfig]     = useState<WaConfig>({ phone_number_id: '', verify_token: '', activo: false, has_access_token: false })
  const [accessToken, setAccessToken] = useState('')
  const [savingCfg,  setSavingCfg]  = useState(false)
  const [cfgOk,      setCfgOk]      = useState(false)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)

  // ── Load conversation list ───────────────────────────────────────────────

  const cargarConvs = useCallback(async () => {
    try {
      const url = filtro === 'todas' ? '/api/conversaciones' : `/api/conversaciones?modo=${filtro}`
      const res  = await fetch(url)
      const data = await res.json()
      setConvs(data.conversaciones ?? [])
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [filtro])

  useEffect(() => {
    setLoading(true)
    cargarConvs()
    const t = setInterval(cargarConvs, 8000)
    return () => clearInterval(t)
  }, [cargarConvs])

  // ── Load messages ────────────────────────────────────────────────────────

  const cargarMensajes = useCallback(async (id: number) => {
    const res  = await fetch(`/api/conversaciones/${id}`)
    const data = await res.json()
    setMensajes(data.mensajes ?? [])
    if (data.conv) {
      setSelected(prev => prev?.id === id ? { ...prev, ...data.conv, mensajes_no_leidos: 0 } : prev)
      setConvs(prev => prev.map(c => c.id === id ? { ...c, mensajes_no_leidos: 0 } : c))
    }
  }, [])

  useEffect(() => {
    if (!selected || panel !== 'chat') return
    const t = setInterval(() => cargarMensajes(selected.id), 3500)
    return () => clearInterval(t)
  }, [selected, panel, cargarMensajes])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  // ── Load config ──────────────────────────────────────────────────────────

  async function cargarConfig() {
    const res  = await fetch('/api/whatsapp/config')
    const data = await res.json()
    if (data.config) setConfig(data.config)
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  async function seleccionar(conv: Conversacion) {
    setSelected(conv); setPanel('chat'); setError(''); setTexto('')
    await cargarMensajes(conv.id)
  }

  async function cambiarModo(modo: 'bot' | 'humano' | 'cerrada') {
    if (!selected) return
    const res = await fetch(`/api/conversaciones/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modo }),
    })
    if (res.ok) {
      setSelected(s => s ? { ...s, modo } : null)
      setConvs(prev => prev.map(c => c.id === selected.id ? { ...c, modo } : c))
    }
  }

  async function enviarMensaje(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim() || !selected || sending) return
    setSending(true); setError('')
    try {
      const res  = await fetch(`/api/conversaciones/${selected.id}/mensajes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al enviar'); return }
      setTexto('')
      await cargarMensajes(selected.id)
      inputRef.current?.focus()
    } catch { setError('Error de conexión') }
    finally { setSending(false) }
  }

  async function guardarConfig(e: React.FormEvent) {
    e.preventDefault(); setSavingCfg(true)
    try {
      await fetch('/api/whatsapp/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: config.phone_number_id,
          verify_token:    config.verify_token,
          activo:          config.activo,
          access_token:    accessToken,  // "" = mantener existente
        }),
      })
      setCfgOk(true); setTimeout(() => setCfgOk(false), 3000)
      setAccessToken('')
      await cargarConfig()
    } catch { /* silencioso */ }
    finally { setSavingCfg(false) }
  }

  function abrirConfig() {
    setPanel('config'); cargarConfig()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const convsFiltradas = convs

  return (
    <div className="shell">
      {/* ── Topbar ── */}
      <div className="topbar">
        <div>
          <h1>Conversaciones WhatsApp</h1>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            {convs.filter(c => c.modo === 'humano').length} requieren atención humana
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="iconButton" onClick={cargarConvs} title="Actualizar"><RefreshCw size={15} /></button>
          <button className="iconButton" onClick={abrirConfig} title="Configurar WhatsApp"><Settings size={15} /></button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Left: conversation list ── */}
        <div className="gridPanel" style={{ overflow: 'hidden' }}>
          {/* Filter tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', background: 'var(--panel-strong)' }}>
            {(['todas','bot','humano','cerrada'] as Filtro[]).map(f => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                style={{
                  flex: 1, padding: '9px 4px', fontSize: 11, fontWeight: filtro === f ? 700 : 500,
                  border: 'none', background: 'none', cursor: 'pointer',
                  color:      filtro === f ? 'var(--brand)' : 'var(--muted)',
                  borderBottom: filtro === f ? '2px solid var(--brand)' : '2px solid transparent',
                  textTransform: 'capitalize',
                }}
              >
                {f === 'todas' ? 'Todas' : MODO_LABEL[f]}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Cargando…</div>
          ) : convsFiltradas.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              <MessageSquare size={28} style={{ opacity: .3, marginBottom: 8 }} />
              <p>Sin conversaciones</p>
            </div>
          ) : (
            <div style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
              {convsFiltradas.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => seleccionar(conv)}
                  style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--line)', cursor: 'pointer',
                    background: selected?.id === conv.id ? 'rgba(15,118,110,.07)' : 'var(--panel)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {/* Avatar */}
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                      background: MODO_COLOR[conv.modo], color: MODO_TEXT[conv.modo],
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                    }}>
                      {conv.modo === 'bot' ? <Bot size={16} /> : <User size={16} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {nombreCorto(conv)}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          {conv.mensajes_no_leidos > 0 && (
                            <span style={{ background: 'var(--ok)', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                              {conv.mensajes_no_leidos}
                            </span>
                          )}
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{hora(conv.ultimo_mensaje_en)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8,
                          background: MODO_COLOR[conv.modo], color: MODO_TEXT[conv.modo],
                        }}>
                          {MODO_LABEL[conv.modo]}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {conv.ultimo_mensaje ?? 'Sin mensajes aún'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right panel ── */}
        <div className="gridPanel" style={{ overflow: 'hidden', minHeight: 500 }}>

          {/* idle */}
          {panel === 'idle' && (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--muted)' }}>
              <MessageSquare size={40} style={{ opacity: .2, marginBottom: 12 }} />
              <p style={{ fontSize: 14 }}>Selecciona una conversación</p>
              <p style={{ fontSize: 12, marginTop: 6 }}>o configura WhatsApp con el botón ⚙️ arriba</p>
            </div>
          )}

          {/* chat */}
          {panel === 'chat' && selected && (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)' }}>
              {/* Header */}
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--panel-strong)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{nombreCorto(selected)}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>+{selected.whatsapp_id}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10,
                    background: MODO_COLOR[selected.modo], color: MODO_TEXT[selected.modo],
                  }}>
                    {selected.modo === 'bot' ? <><Bot size={10} style={{ marginRight: 4 }} />Bot activo</> : selected.modo === 'humano' ? <><User size={10} style={{ marginRight: 4 }} />Humano</> : 'Cerrada'}
                  </span>

                  {selected.modo === 'bot' && (
                    <button className="button" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => cambiarModo('humano')}>
                      <User size={12} /> Tomar control
                    </button>
                  )}
                  {selected.modo === 'humano' && (
                    <button className="button" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => cambiarModo('bot')}>
                      <Bot size={12} /> Devolver al bot
                    </button>
                  )}
                  {selected.modo !== 'cerrada' && (
                    <button className="button softDanger" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => cambiarModo('cerrada')}>
                      <Power size={12} /> Cerrar
                    </button>
                  )}
                  {selected.modo === 'cerrada' && (
                    <button className="button teal" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => cambiarModo('bot')}>
                      Reabrir
                    </button>
                  )}
                  <button className="iconButton" onClick={() => { setPanel('idle'); setSelected(null) }}><X size={14} /></button>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mensajes.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 40 }}>Sin mensajes aún</div>
                )}
                {mensajes.map(m => (
                  <div key={m.id} style={{ display: 'flex', flexDirection: m.direccion === 'saliente' ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{
                      maxWidth: '72%', padding: '9px 14px', borderRadius: m.direccion === 'saliente' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                      background: m.direccion === 'saliente' ? 'var(--brand)' : 'var(--panel-strong)',
                      color:      m.direccion === 'saliente' ? '#fff' : 'var(--text)',
                      fontSize: 13, lineHeight: 1.5,
                      boxShadow: '0 1px 3px rgba(0,0,0,.08)',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {m.contenido}
                      <div style={{ fontSize: 10, opacity: .65, textAlign: 'right', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                        {new Date(m.enviado_en).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                        {m.direccion === 'saliente' && <CheckCheck size={11} />}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              {selected.modo === 'humano' ? (
                <form onSubmit={enviarMensaje} style={{ borderTop: '1px solid var(--line)', padding: '12px 16px', display: 'flex', gap: 8, background: 'var(--panel-strong)' }}>
                  <textarea
                    ref={inputRef}
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(e as unknown as React.FormEvent) } }}
                    placeholder="Escribe un mensaje… (Enter para enviar, Shift+Enter para nueva línea)"
                    rows={2}
                    style={{ flex: 1, resize: 'none', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13, fontFamily: 'inherit', background: 'var(--panel)' }}
                    disabled={sending}
                  />
                  <button type="submit" className="iconButton" disabled={sending || !texto.trim()} style={{ background: 'var(--brand)', color: '#fff', alignSelf: 'flex-end' }}>
                    <Send size={16} />
                  </button>
                </form>
              ) : (
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', background: 'var(--panel-strong)', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
                  {selected.modo === 'bot'
                    ? '🤖 El bot está respondiendo automáticamente. Haz clic en "Tomar control" para responder manualmente.'
                    : '🔒 Conversación cerrada. Haz clic en "Reabrir" para continuar.'}
                </div>
              )}

              {error && <div className="warningBox" style={{ margin: '0 16px 12px' }}>{error}</div>}
            </div>
          )}

          {/* config */}
          {panel === 'config' && (
            <div style={{ padding: '20px 24px', maxWidth: 540 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Configuración WhatsApp</h2>
                <button className="iconButton" onClick={() => setPanel('idle')}><X size={14} /></button>
              </div>

              <div className="notice" style={{ marginBottom: 20, fontSize: 12 }}>
                <strong>URL del webhook para Meta:</strong>{' '}
                <code style={{ background: 'rgba(0,0,0,.06)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>
                  {typeof window !== 'undefined' ? `${window.location.origin}/api/whatsapp/webhook` : '/api/whatsapp/webhook'}
                </code>
              </div>

              {cfgOk && <div className="notice" style={{ marginBottom: 16 }}>✅ Configuración guardada</div>}

              <form onSubmit={guardarConfig}>
                <div className="entityForm">
                  <label>
                    <span>Phone Number ID</span>
                    <input
                      value={config.phone_number_id}
                      onChange={e => setConfig(c => ({ ...c, phone_number_id: e.target.value }))}
                      placeholder="1234567890123456"
                      required
                    />
                  </label>
                  <label>
                    <span>
                      Access Token (permanente){' '}
                      {config.has_access_token
                        ? <span style={{ color: 'var(--ok)', fontSize: 11, fontWeight: 600 }}>✓ configurado</span>
                        : <span style={{ color: 'var(--danger)', fontSize: 11, fontWeight: 600 }}>sin configurar</span>}
                    </span>
                    <input
                      type="password"
                      value={accessToken}
                      onChange={e => setAccessToken(e.target.value)}
                      placeholder={config.has_access_token ? 'Dejar vacío para mantener el actual' : 'EAAxxxxx…'}
                    />
                  </label>
                  <label>
                    <span>Verify Token (para el webhook)</span>
                    <input
                      value={config.verify_token}
                      onChange={e => setConfig(c => ({ ...c, verify_token: e.target.value }))}
                      placeholder="mi-token-secreto-123"
                      required
                    />
                  </label>
                  <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={config.activo} onChange={e => setConfig(c => ({ ...c, activo: e.target.checked }))} style={{ width: 'auto', margin: 0 }} />
                    <span style={{ fontWeight: 500 }}>Activar integración WhatsApp</span>
                  </label>
                </div>

                <div style={{ marginTop: 20 }}>
                  <button type="submit" className="button teal" disabled={savingCfg} style={{ minWidth: 160 }}>
                    {savingCfg ? 'Guardando…' : 'Guardar configuración'}
                  </button>
                </div>
              </form>

              <div style={{ marginTop: 28, padding: '16px 20px', background: 'var(--panel-strong)', borderRadius: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
                <strong style={{ color: 'var(--text)' }}>Variable de entorno requerida</strong><br />
                El agente de IA usa <code>OPENAI_API_KEY</code> configurada en el servidor. El modelo es <strong>gpt-4o-mini</strong> y puede agendar citas, verificar disponibilidad y transferir a un asesor humano.
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

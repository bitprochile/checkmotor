'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, RefreshCw, Power, Users, Building2, X, Check, MessageSquare, Eye, EyeOff } from 'lucide-react'

interface TallerRow {
  id: number; nombre: string; activo: boolean; email: string | null
  telefono: string | null; direccion: string | null; created_at: string
  usuarios_count: string; ordenes_activas: string
}

interface UsuarioTenant {
  id: number; nombre: string; email: string; rol: string
  activo: boolean; superadmin: boolean; created_at: string
}

type PanelMode = 'idle' | 'view' | 'create-taller' | 'edit-taller' | 'create-user' | 'edit-user' | 'whatsapp'

const ROL: Record<string, string> = { admin: 'Admin', mecanico: 'Mecánico', recepcion: 'Recepción' }
const FECHA = (d: string | Date | null) => d ? new Date(d).toLocaleDateString('es-CL') : '—'

const EMPTY_TALLER = { nombre: '', email: '', telefono: '', direccion: '', activo: true, admin_nombre: '', admin_email: '', admin_password: '' }
const EMPTY_USER   = { nombre: '', email: '', password: '', rol: 'admin', activo: true }
const EMPTY_WA     = { phone_number_id: '', access_token: '', activo: true }

export default function TenantGrid() {
  const [talleres,   setTalleres]   = useState<TallerRow[]>([])
  const [selected,   setSelected]   = useState<TallerRow | null>(null)
  const [usuarios,   setUsuarios]   = useState<UsuarioTenant[]>([])
  const [mode,       setMode]       = useState<PanelMode>('idle')
  const [editUser,   setEditUser]   = useState<UsuarioTenant | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [notice,     setNotice]     = useState('')
  const [confirm,    setConfirm]    = useState<null | { label: string; action: () => Promise<void> }>(null)
  const [tf,         setTf]         = useState(EMPTY_TALLER)
  const [uf,         setUf]         = useState(EMPTY_USER)
  const [wf,         setWf]         = useState(EMPTY_WA)
  const [waHasToken, setWaHasToken] = useState(false)
  const [showToken,  setShowToken]  = useState(false)

  const loadTalleres = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/tenant')
      const data = await res.json()
      setTalleres(data.talleres ?? [])
    } catch { setError('No se pudo cargar la lista') }
    finally  { setLoading(false) }
  }, [])

  useEffect(() => { loadTalleres() }, [loadTalleres])

  async function selectTaller(t: TallerRow) {
    setSelected(t); setMode('view'); setError(''); setNotice('')
    const res  = await fetch(`/api/tenant/${t.id}`)
    const data = await res.json()
    setUsuarios(data.usuarios ?? [])
  }

  function flash(msg: string) { setNotice(msg); setTimeout(() => setNotice(''), 3000) }

  // ── Taller actions ────────────────────────────────────────────────────────

  function startCreate() { setTf(EMPTY_TALLER); setMode('create-taller'); setSelected(null); setError(''); setNotice('') }
  function startEdit()   { if (!selected) return; setTf({ nombre: selected.nombre, email: selected.email ?? '', telefono: selected.telefono ?? '', direccion: selected.direccion ?? '', activo: selected.activo, admin_nombre: '', admin_email: '', admin_password: '' }); setMode('edit-taller'); setError('') }

  async function saveTaller(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const url    = mode === 'create-taller' ? '/api/tenant' : `/api/tenant/${selected!.id}`
      const method = mode === 'create-taller' ? 'POST' : 'PUT'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tf) })
      const data   = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
      await loadTalleres()
      if (mode === 'create-taller') { setMode('idle'); setSelected(null); flash('Empresa creada exitosamente') }
      else { setSelected({ ...selected!, ...tf }); setMode('view'); flash('Cambios guardados') }
    } catch { setError('Error de conexión') }
    finally { setSaving(false) }
  }

  async function toggleActivo() {
    if (!selected) return; setSaving(true)
    try {
      const res = await fetch(`/api/tenant/${selected.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selected, activo: !selected.activo }),
      })
      if (res.ok) {
        const upd = { ...selected, activo: !selected.activo }
        setSelected(upd)
        setTalleres(prev => prev.map(t => t.id === selected.id ? { ...t, activo: !t.activo } : t))
        flash(upd.activo ? 'Empresa activada' : 'Empresa desactivada')
      }
    } catch { setError('Error al cambiar estado') }
    finally { setSaving(false) }
  }

  async function deleteTaller() {
    if (!selected) return; setSaving(true); setConfirm(null)
    try {
      const res  = await fetch(`/api/tenant/${selected.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'No se pudo eliminar'); setSaving(false); return }
      await loadTalleres(); setSelected(null); setMode('idle'); flash('Empresa eliminada')
    } catch { setError('Error de conexión') }
    finally { setSaving(false) }
  }

  // ── WhatsApp actions ──────────────────────────────────────────────────────

  async function startWhatsApp() {
    if (!selected) return
    setMode('whatsapp'); setError(''); setShowToken(false)
    setWf(EMPTY_WA); setWaHasToken(false)
    const res  = await fetch(`/api/tenant/${selected.id}/whatsapp`)
    const data = await res.json()
    if (data.config) {
      setWf({ phone_number_id: data.config.phone_number_id, access_token: '', activo: data.config.activo })
      setWaHasToken(data.config.has_access_token)
    }
  }

  async function saveWhatsApp(e: React.FormEvent) {
    e.preventDefault(); if (!selected) return; setSaving(true); setError('')
    try {
      const res  = await fetch(`/api/tenant/${selected.id}/whatsapp`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(wf),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
      flash('Configuración WhatsApp guardada'); setMode('view')
    } catch { setError('Error de conexión') }
    finally { setSaving(false) }
  }

  // ── User actions ──────────────────────────────────────────────────────────

  function startCreateUser() { setUf(EMPTY_USER); setEditUser(null); setMode('create-user'); setError('') }
  function startEditUser(u: UsuarioTenant) { setUf({ nombre: u.nombre, email: u.email, password: '', rol: u.rol, activo: u.activo }); setEditUser(u); setMode('edit-user'); setError('') }

  async function saveUser(e: React.FormEvent) {
    e.preventDefault(); if (!selected) return; setSaving(true); setError('')
    try {
      const url    = mode === 'create-user' ? `/api/tenant/${selected.id}/usuarios` : `/api/tenant/${selected.id}/usuarios/${editUser!.id}`
      const method = mode === 'create-user' ? 'POST' : 'PUT'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(uf) })
      const data   = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
      const r2 = await fetch(`/api/tenant/${selected.id}`)
      const d2 = await r2.json()
      setUsuarios(d2.usuarios ?? [])
      setMode('view'); flash(mode === 'create-user' ? 'Usuario creado' : 'Usuario actualizado')
    } catch { setError('Error de conexión') }
    finally { setSaving(false) }
  }

  async function deleteUser(u: UsuarioTenant) {
    if (!selected) return; setSaving(true); setConfirm(null)
    try {
      const res  = await fetch(`/api/tenant/${selected.id}/usuarios/${u.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'No se pudo eliminar'); setSaving(false); return }
      setUsuarios(prev => prev.filter(x => x.id !== u.id)); flash('Usuario eliminado')
    } catch { setError('Error de conexión') }
    finally { setSaving(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="shell">
      <div className="topbar">
        <div>
          <h1>Gestión de Tenants</h1>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            {talleres.length} empresa{talleres.length !== 1 ? 's' : ''} registrada{talleres.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="iconButton" onClick={loadTalleres} title="Actualizar"><RefreshCw size={15} /></button>
          <button className="button teal" onClick={startCreate}><Plus size={15} /> Nueva empresa</button>
        </div>
      </div>

      {notice && (
        <div className="notice" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={14} /> {notice}
        </div>
      )}

      <div className="workspace">

        {/* ── Left: taller list ── */}
        <div className="gridPanel">
          {loading ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Cargando…</div>
          ) : talleres.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              <Building2 size={32} style={{ opacity: .3, marginBottom: 8 }} />
              <p>Sin empresas registradas</p>
              <button className="button teal" style={{ marginTop: 12 }} onClick={startCreate}><Plus size={14} /> Crear primera empresa</button>
            </div>
          ) : (
            <table className="entityTable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Empresa</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'center' }}>Usuarios</th>
                  <th style={{ textAlign: 'center' }}>Órdenes act.</th>
                  <th>Creada</th>
                </tr>
              </thead>
              <tbody>
                {talleres.map(t => (
                  <tr
                    key={t.id}
                    onClick={() => selectTaller(t)}
                    style={{ cursor: 'pointer', background: selected?.id === t.id ? 'rgba(15,118,110,.07)' : undefined }}
                  >
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>#{t.id}</td>
                    <td>
                      <strong>{t.nombre}</strong>
                      {t.email && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.email}</div>}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                        background: t.activo ? 'rgba(21,128,61,.12)' : 'rgba(102,112,106,.12)',
                        color:      t.activo ? 'var(--ok)'           : 'var(--muted)',
                      }}>
                        {t.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{t.usuarios_count}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: Number(t.ordenes_activas) > 0 ? 'var(--brand)' : 'var(--muted)' }}>
                      {t.ordenes_activas}
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{FECHA(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Right: detail panel ── */}
        <div className="detailPanel">

          {/* idle */}
          {mode === 'idle' && (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              <Building2 size={32} style={{ opacity: .25, marginBottom: 8 }} />
              <p>Selecciona una empresa para ver sus detalles</p>
            </div>
          )}

          {/* view detail */}
          {mode === 'view' && selected && (
            <div>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.nombre}</div>
                    <span style={{
                      display: 'inline-block', marginTop: 4, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                      background: selected.activo ? 'rgba(21,128,61,.12)' : 'rgba(102,112,106,.12)',
                      color:      selected.activo ? 'var(--ok)'           : 'var(--muted)',
                    }}>
                      {selected.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="iconButton" onClick={startWhatsApp} title="WhatsApp API"><MessageSquare size={14} /></button>
                    <button className="iconButton" onClick={startEdit} title="Editar"><Pencil size={14} /></button>
                    <button
                      className="iconButton" title={selected.activo ? 'Desactivar' : 'Activar'}
                      onClick={toggleActivo} disabled={saving}
                      style={{ color: selected.activo ? 'var(--danger)' : 'var(--ok)' }}
                    >
                      <Power size={14} />
                    </button>
                    {selected.id !== 1 && (
                      <button
                        className="iconButton" title="Eliminar" style={{ color: 'var(--danger)' }}
                        onClick={() => setConfirm({ label: `¿Eliminar la empresa "${selected.nombre}"? Esta acción no se puede deshacer.`, action: deleteTaller })}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {(selected.email || selected.telefono || selected.direccion) && (
                  <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {selected.email     && <span>{selected.email}</span>}
                    {selected.telefono  && <span>{selected.telefono}</span>}
                    {selected.direccion && <span>{selected.direccion}</span>}
                  </div>
                )}
              </div>

              {error && <div className="warningBox" style={{ margin: '12px 16px' }}>{error}</div>}

              {/* users section */}
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={14} style={{ color: 'var(--brand)' }} /> Usuarios ({usuarios.length})
                </span>
                <button className="button teal" style={{ padding: '5px 12px', fontSize: 12 }} onClick={startCreateUser}>
                  <Plus size={12} /> Nuevo
                </button>
              </div>

              {usuarios.length === 0 ? (
                <div style={{ padding: '20px', fontSize: 13, color: 'var(--muted)' }}>Sin usuarios registrados</div>
              ) : (
                <div>
                  {usuarios.map(u => (
                    <div key={u.id} style={{ padding: '10px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {u.nombre}
                          {u.superadmin && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: 'rgba(180,83,9,.12)', color: 'var(--accent)' }}>
                              SUPER
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.email}</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: 'rgba(15,118,110,.1)', color: 'var(--brand-dark)' }}>
                            {ROL[u.rol] ?? u.rol}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8,
                            background: u.activo ? 'rgba(21,128,61,.1)' : 'rgba(102,112,106,.12)',
                            color:      u.activo ? 'var(--ok)'         : 'var(--muted)',
                          }}>
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                      </div>
                      {!u.superadmin && (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button className="iconButton" style={{ width: 30, height: 30 }} onClick={() => startEditUser(u)} title="Editar">
                            <Pencil size={12} />
                          </button>
                          <button
                            className="iconButton" style={{ width: 30, height: 30, color: 'var(--danger)' }} title="Eliminar"
                            onClick={() => setConfirm({ label: `¿Eliminar al usuario "${u.nombre}"?`, action: () => deleteUser(u) })}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* create taller */}
          {mode === 'create-taller' && (
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Nueva empresa</span>
                <button className="iconButton" onClick={() => setMode('idle')}><X size={14} /></button>
              </div>
              {error && <div className="warningBox" style={{ marginBottom: 12 }}>{error}</div>}
              <form onSubmit={saveTaller}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>Datos de la empresa</div>
                <div className="entityForm" style={{ marginBottom: 20 }}>
                  <label>
                    <span>Nombre *</span>
                    <input value={tf.nombre} onChange={e => setTf(f => ({ ...f, nombre: e.target.value }))} required placeholder="Ej: Taller García" />
                  </label>
                  <label>
                    <span>Email</span>
                    <input type="email" value={tf.email} onChange={e => setTf(f => ({ ...f, email: e.target.value }))} placeholder="contacto@taller.com" />
                  </label>
                  <label>
                    <span>Teléfono</span>
                    <input value={tf.telefono} onChange={e => setTf(f => ({ ...f, telefono: e.target.value }))} placeholder="+56 9 1234 5678" />
                  </label>
                  <label>
                    <span>Dirección</span>
                    <input value={tf.direccion} onChange={e => setTf(f => ({ ...f, direccion: e.target.value }))} placeholder="Av. Principal 123" />
                  </label>
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>Administrador inicial</div>
                <div className="entityForm" style={{ marginBottom: 20 }}>
                  <label>
                    <span>Nombre</span>
                    <input value={tf.admin_nombre} onChange={e => setTf(f => ({ ...f, admin_nombre: e.target.value }))} placeholder="Administrador" />
                  </label>
                  <label>
                    <span>Email *</span>
                    <input type="email" value={tf.admin_email} onChange={e => setTf(f => ({ ...f, admin_email: e.target.value }))} required placeholder="admin@empresa.com" />
                  </label>
                  <label>
                    <span>Contraseña *</span>
                    <input type="password" value={tf.admin_password} onChange={e => setTf(f => ({ ...f, admin_password: e.target.value }))} required placeholder="••••••••" />
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="button teal" disabled={saving} style={{ flex: 1 }}>
                    {saving ? 'Creando…' : 'Crear empresa'}
                  </button>
                  <button type="button" className="button" onClick={() => setMode('idle')} disabled={saving}>Cancelar</button>
                </div>
              </form>
            </div>
          )}

          {/* edit taller */}
          {mode === 'edit-taller' && selected && (
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Editar empresa</span>
                <button className="iconButton" onClick={() => setMode('view')}><X size={14} /></button>
              </div>
              {error && <div className="warningBox" style={{ marginBottom: 12 }}>{error}</div>}
              <form onSubmit={saveTaller}>
                <div className="entityForm" style={{ marginBottom: 20 }}>
                  <label>
                    <span>Nombre *</span>
                    <input value={tf.nombre} onChange={e => setTf(f => ({ ...f, nombre: e.target.value }))} required />
                  </label>
                  <label>
                    <span>Email</span>
                    <input type="email" value={tf.email} onChange={e => setTf(f => ({ ...f, email: e.target.value }))} />
                  </label>
                  <label>
                    <span>Teléfono</span>
                    <input value={tf.telefono} onChange={e => setTf(f => ({ ...f, telefono: e.target.value }))} />
                  </label>
                  <label>
                    <span>Dirección</span>
                    <input value={tf.direccion} onChange={e => setTf(f => ({ ...f, direccion: e.target.value }))} />
                  </label>
                  <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={tf.activo} onChange={e => setTf(f => ({ ...f, activo: e.target.checked }))} style={{ width: 'auto', margin: 0 }} />
                    <span style={{ fontWeight: 500 }}>Empresa activa</span>
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="button teal" disabled={saving} style={{ flex: 1 }}>
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                  <button type="button" className="button" onClick={() => setMode('view')} disabled={saving}>Cancelar</button>
                </div>
              </form>
            </div>
          )}

          {/* whatsapp config */}
          {mode === 'whatsapp' && selected && (
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MessageSquare size={16} style={{ color: 'var(--brand)' }} />
                  WhatsApp API — {selected.nombre}
                </span>
                <button className="iconButton" onClick={() => setMode('view')}><X size={14} /></button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
                Credenciales de Meta Cloud API para este taller.
              </p>
              {error && <div className="warningBox" style={{ marginBottom: 12 }}>{error}</div>}
              <form onSubmit={saveWhatsApp}>
                <div className="entityForm" style={{ marginBottom: 20 }}>
                  <label>
                    <span>Phone Number ID *</span>
                    <input
                      value={wf.phone_number_id}
                      onChange={e => setWf(f => ({ ...f, phone_number_id: e.target.value }))}
                      required placeholder="Ej: 123456789012345"
                      style={{ fontFamily: 'monospace', fontSize: 13 }}
                    />
                  </label>
                  <label>
                    <span>
                      Access Token {waHasToken && <span style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 600 }}>✓ ya configurado</span>}
                    </span>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showToken ? 'text' : 'password'}
                        value={wf.access_token}
                        onChange={e => setWf(f => ({ ...f, access_token: e.target.value }))}
                        placeholder={waHasToken ? 'Dejar vacío para mantener el actual' : 'EAAx…'}
                        style={{ fontFamily: 'monospace', fontSize: 12, paddingRight: 36 }}
                      />
                      <button type="button" onClick={() => setShowToken(v => !v)}
                        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0 }}>
                        {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </label>
                  <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={wf.activo} onChange={e => setWf(f => ({ ...f, activo: e.target.checked }))} style={{ width: 'auto', margin: 0 }} />
                    <span style={{ fontWeight: 500 }}>WhatsApp activo para este taller</span>
                  </label>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, padding: '10px 12px', background: 'var(--panel-strong)', borderRadius: 6, border: '1px solid var(--line)' }}>
                  <strong style={{ display: 'block', marginBottom: 4 }}>URL del webhook:</strong>
                  <code style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--brand-dark)' }}>
                    https://portal.checkmotor.app/api/whatsapp/webhook
                  </code>
                  <strong style={{ display: 'block', marginTop: 8, marginBottom: 2 }}>Token de verificación:</strong>
                  <span style={{ fontSize: 11 }}>Ver variable <code>WHATSAPP_VERIFY_TOKEN</code> en el servidor.</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="button teal" disabled={saving} style={{ flex: 1 }}>
                    {saving ? 'Guardando…' : 'Guardar configuración'}
                  </button>
                  <button type="button" className="button" onClick={() => setMode('view')} disabled={saving}>Cancelar</button>
                </div>
              </form>
            </div>
          )}

          {/* create / edit user */}
          {(mode === 'create-user' || mode === 'edit-user') && (
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  {mode === 'create-user' ? 'Nuevo usuario' : `Editar: ${editUser?.nombre}`}
                </span>
                <button className="iconButton" onClick={() => setMode('view')}><X size={14} /></button>
              </div>
              {error && <div className="warningBox" style={{ marginBottom: 12 }}>{error}</div>}
              <form onSubmit={saveUser}>
                <div className="entityForm" style={{ marginBottom: 20 }}>
                  <label>
                    <span>Nombre *</span>
                    <input value={uf.nombre} onChange={e => setUf(f => ({ ...f, nombre: e.target.value }))} required placeholder="Nombre completo" />
                  </label>
                  {mode === 'create-user' && (
                    <label>
                      <span>Email *</span>
                      <input type="email" value={uf.email} onChange={e => setUf(f => ({ ...f, email: e.target.value }))} required placeholder="usuario@taller.com" />
                    </label>
                  )}
                  <label>
                    <span>{mode === 'create-user' ? 'Contraseña *' : 'Nueva contraseña'}</span>
                    <input
                      type="password"
                      value={uf.password}
                      onChange={e => setUf(f => ({ ...f, password: e.target.value }))}
                      required={mode === 'create-user'}
                      placeholder={mode === 'edit-user' ? 'Dejar vacío para no cambiar' : '••••••••'}
                    />
                  </label>
                  <label>
                    <span>Rol *</span>
                    <select value={uf.rol} onChange={e => setUf(f => ({ ...f, rol: e.target.value }))}>
                      <option value="admin">Administrador</option>
                      <option value="mecanico">Mecánico</option>
                      <option value="recepcion">Recepción</option>
                    </select>
                  </label>
                  {mode === 'edit-user' && (
                    <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={uf.activo} onChange={e => setUf(f => ({ ...f, activo: e.target.checked }))} style={{ width: 'auto', margin: 0 }} />
                      <span style={{ fontWeight: 500 }}>Usuario activo</span>
                    </label>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="button teal" disabled={saving} style={{ flex: 1 }}>
                    {saving ? 'Guardando…' : mode === 'create-user' ? 'Crear usuario' : 'Guardar cambios'}
                  </button>
                  <button type="button" className="button" onClick={() => setMode('view')} disabled={saving}>Cancelar</button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>

      {/* ── Confirm dialog ── */}
      {confirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: 'var(--panel)', borderRadius: 12, padding: '28px 32px', maxWidth: 400, width: '90%', boxShadow: 'var(--shadow)' }}>
            <p style={{ fontSize: 15, marginBottom: 20, lineHeight: 1.5 }}>{confirm.label}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="button" onClick={() => setConfirm(null)}>Cancelar</button>
              <button className="button softDanger" onClick={async () => { await confirm.action() }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

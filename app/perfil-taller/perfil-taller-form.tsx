'use client'

import { useState, useEffect } from 'react'
import { Save, Building2 } from 'lucide-react'

interface PerfilForm {
  nombre: string
  rut: string
  direccion: string
  telefono: string
  email: string
  website: string
  logo_url: string
  pie_pagina: string
}

const EMPTY: PerfilForm = {
  nombre: '', rut: '', direccion: '', telefono: '',
  email: '', website: '', logo_url: '', pie_pagina: '',
}

export default function PerfilTallerForm() {
  const [form, setForm]       = useState<PerfilForm>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [ok, setOk]           = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    fetch('/api/perfil-taller')
      .then(r => r.json())
      .then(d => {
        if (d.perfil) {
          setForm({
            nombre:     d.perfil.nombre ?? '',
            rut:        d.perfil.rut ?? '',
            direccion:  d.perfil.direccion ?? '',
            telefono:   d.perfil.telefono ?? '',
            email:      d.perfil.email ?? '',
            website:    d.perfil.website ?? '',
            logo_url:   d.perfil.logo_url ?? '',
            pie_pagina: d.perfil.pie_pagina ?? '',
          })
        }
        setLoading(false)
      })
      .catch(() => { setError('No se pudo cargar el perfil'); setLoading(false) })
  }, [])

  function field(key: keyof PerfilForm, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setOk(false); setError('')
    const res  = await fetch('/api/perfil-taller', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Error al guardar'); setSaving(false); return }
    setOk(true); setSaving(false)
    setTimeout(() => setOk(false), 3000)
  }

  if (loading) return <div className="emptyState"><p>Cargando…</p></div>

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="topbar">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Building2 size={20} /> Perfil del taller
        </h1>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        Estos datos aparecen en todos los imprimibles del sistema: presupuestos, boletas PDF y actas de checklist.
      </p>

      {ok    && <div className="notice"     style={{ marginBottom: 16 }}>Perfil guardado correctamente.</div>}
      {error && <div className="warningBox" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="gridPanel" style={{ padding: 24 }}>
        <form className="entityForm" onSubmit={handleSave}>
          <label>
            <span>Nombre del taller *</span>
            <input value={form.nombre} onChange={e => field('nombre', e.target.value)} placeholder="Mi Taller" required />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label>
              <span>RUT</span>
              <input value={form.rut} onChange={e => field('rut', e.target.value)} placeholder="76.123.456-7" />
            </label>
            <label>
              <span>Teléfono</span>
              <input value={form.telefono} onChange={e => field('telefono', e.target.value)} placeholder="+56 9 1234 5678" />
            </label>
          </div>

          <label>
            <span>Dirección</span>
            <input value={form.direccion} onChange={e => field('direccion', e.target.value)} placeholder="Av. Siempre Viva 742, Santiago" />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label>
              <span>Email</span>
              <input type="email" value={form.email} onChange={e => field('email', e.target.value)} placeholder="contacto@taller.cl" />
            </label>
            <label>
              <span>Sitio web</span>
              <input value={form.website} onChange={e => field('website', e.target.value)} placeholder="www.taller.cl" />
            </label>
          </div>

          <label>
            <span>URL del logo</span>
            <input value={form.logo_url} onChange={e => field('logo_url', e.target.value)} placeholder="https://…/logo.png" />
          </label>
          {form.logo_url && (
            <div style={{ padding: '12px 14px', background: 'var(--panel-strong)', border: '1px solid var(--line)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.logo_url}
                alt="Preview logo"
                style={{ maxHeight: 60, maxWidth: 180, objectFit: 'contain', display: 'block' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Preview del logo</span>
            </div>
          )}

          <label>
            <span>Pie de página (documentos)</span>
            <textarea rows={3} value={form.pie_pagina} onChange={e => field('pie_pagina', e.target.value)}
              placeholder="Gracias por su preferencia. Garantía de 3 meses en mano de obra." style={{ resize: 'vertical' }} />
          </label>

          <div className="formActions">
            <button type="submit" className="button teal" disabled={saving}>
              <Save size={14} />{saving ? 'Guardando…' : 'Guardar perfil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

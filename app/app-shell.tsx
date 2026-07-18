'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { LayoutDashboard, ClipboardList, Users, Car, Settings, UserCog, Package, Calendar, LogOut, Search, ClipboardCheck, TrendingUp, Building2, Globe, MessageSquare } from 'lucide-react'

interface AppShellProps {
  children: React.ReactNode
  session: { nombre: string; email: string; rol: string; superadmin?: boolean }
}

const NAV: { href: string; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { href: '/dashboard',       label: 'Dashboard',          icon: LayoutDashboard },
  { href: '/agenda',          label: 'Agenda',             icon: Calendar        },
  { href: '/conversaciones',  label: 'Conversaciones',     icon: MessageSquare   },
  { href: '/reportes',        label: 'Reportes',           icon: TrendingUp,  adminOnly: true },
  { href: '/ordenes-trabajo', label: 'Órdenes de trabajo', icon: ClipboardList   },
  { href: '/clientes',        label: 'Clientes',           icon: Users           },
  { href: '/vehiculos',       label: 'Vehículos',          icon: Car             },
  { href: '/servicios',       label: 'Servicios',          icon: Settings        },
  { href: '/repuestos',       label: 'Inventario',         icon: Package         },
  { href: '/mecanicos',       label: 'Mecánicos',          icon: UserCog         },
]

interface SearchResult {
  tipo: 'cliente' | 'vehiculo'
  id: number
  label: string
  sub: string
}

function GlobalSearch() {
  const router   = useRouter()
  const wrapRef  = useRef<HTMLDivElement>(null)
  const [q,        setQ]        = useState('')
  const [results,  setResults]  = useState<SearchResult[]>([])
  const [showDrop, setShowDrop] = useState(false)

  useEffect(() => {
    if (q.length < 2) { setResults([]); setShowDrop(false); return }
    const t = setTimeout(async () => {
      const res  = await fetch(`/api/buscar?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.resultados ?? [])
      setShowDrop(true)
    }, 280)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDrop(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function navigate(r: SearchResult) {
    setQ(''); setShowDrop(false)
    router.push(`/${r.tipo === 'cliente' ? 'clientes' : 'vehiculos'}/${r.id}`)
  }

  return (
    <div className="search-wrap" ref={wrapRef}>
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
        <input
          className="search-input"
          style={{ paddingLeft: 28 }}
          placeholder="Buscar cliente o vehículo…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setShowDrop(true)}
        />
      </div>
      {showDrop && results.length > 0 && (
        <div className="search-dropdown">
          {results.map(r => (
            <button
              key={`${r.tipo}-${r.id}`}
              className="search-result"
              onClick={() => navigate(r)}
            >
              <span className={`search-result-tipo ${r.tipo}`}>{r.tipo}</span>
              <span className="search-result-label">{r.label}</span>
              {r.sub && <span className="search-result-sub">{r.sub}</span>}
            </button>
          ))}
        </div>
      )}
      {showDrop && results.length === 0 && q.length >= 2 && (
        <div className="search-dropdown">
          <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--muted)' }}>Sin resultados</div>
        </div>
      )}
    </div>
  )
}

export default function AppShell({ children, session }: AppShellProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const [alertaStock, setAlertaStock] = useState(0)
  const [alertaCitas, setAlertaCitas] = useState(0)
  const [alertaChat,  setAlertaChat]  = useState(0)

  useEffect(() => {
    fetch('/api/repuestos?alerta=1&activo=true')
      .then(r => r.json())
      .then(d => setAlertaStock((d.repuestos ?? []).length))
      .catch(() => {})
    const hoy = new Date().toISOString().slice(0, 10)
    fetch(`/api/citas?fecha=${hoy}&estado=pendiente`)
      .then(r => r.json())
      .then(d => setAlertaCitas((d.citas ?? []).length))
      .catch(() => {})
    const cargarChat = () =>
      fetch('/api/conversaciones')
        .then(r => r.json())
        .then(d => setAlertaChat(d.sinLeer ?? 0))
        .catch(() => {})
    cargarChat()
    const timer = setInterval(cargarChat, 15000)
    return () => clearInterval(timer)
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
  }

  const initials = session.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const roleLabel: Record<string, string> = {
    admin: 'Administrador', mecanico: 'Mecánico', recepcion: 'Recepción',
  }

  return (
    <div className="appLayout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebarBrand">
          <img src="/checkmotor-logo.svg" alt="Checkmotor" className="sidebarLogo" />
        </div>

        {/* ── Búsqueda global ── */}
        <div style={{ paddingTop: 12 }}>
          <GlobalSearch />
        </div>

        <nav className="sidebarNav">
          <div className="sidebarSection">Módulos</div>
          {NAV.filter(n => !n.adminOnly || session.rol === 'admin').map(({ href, label, icon: Icon }) => (
            <a key={href} href={href} className={`sidebarLink${pathname.startsWith(href) && (href !== '/dashboard' || pathname === '/dashboard') ? ' active' : ''}`}>
              <Icon size={16} />
              {label}
              {href === '/agenda'         && alertaCitas > 0 && <span className="navBadge" style={{ width: 'auto', borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 700 }}>{alertaCitas}</span>}
              {href === '/repuestos'      && alertaStock > 0 && <span className="navBadge">{alertaStock}</span>}
              {href === '/conversaciones' && alertaChat  > 0 && <span className="navBadge" style={{ width: 'auto', borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 700, background: 'var(--accent)' }}>{alertaChat}</span>}
            </a>
          ))}
          {session.rol === 'admin' && (
            <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
              <a href="/checklist-config" className={`sidebarLink${pathname.startsWith('/checklist-config') ? ' active' : ''}`}>
                <ClipboardCheck size={16} />
                Config. Checklist
              </a>
              <a href="/perfil-taller" className={`sidebarLink${pathname.startsWith('/perfil-taller') ? ' active' : ''}`}>
                <Building2 size={16} />
                Perfil del taller
              </a>
              <a href="/configuracion" className={`sidebarLink${pathname.startsWith('/configuracion') ? ' active' : ''}`}>
                <Settings size={16} />
                Configuración
              </a>
            </div>
          )}
          {session.superadmin && (
            <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
              <div className="sidebarSection">Plataforma</div>
              <a href="/tenant" className={`sidebarLink${pathname.startsWith('/tenant') ? ' active' : ''}`}>
                <Globe size={16} />
                Tenants
              </a>
            </div>
          )}
        </nav>

        <div className="sidebarFooter">
          <div className="sidebarUser">
            <div className="sidebarUserAvatar">{initials}</div>
            <div className="sidebarUserInfo">
              <div className="sidebarUserName">{session.nombre}</div>
              <div className="sidebarUserRole">{roleLabel[session.rol] ?? session.rol}</div>
            </div>
          </div>
          <button className="sidebarLogout" onClick={handleLogout}>
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Content ── */}
      <div className="pageContent">{children}</div>
    </div>
  )
}

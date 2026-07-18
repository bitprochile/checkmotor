'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Eye, EyeOff,
  AlertCircle,
  FlaskConical,
  ClipboardList,
  Users,
  Car,
  Settings2,
} from 'lucide-react'

const TEST_USERS = [
  { email: 'admin@taller.com',     password: 'admin123', role: 'Administrador' },
  { email: 'mecanico@taller.com',  password: 'mec123',   role: 'Mecánico'     },
  { email: 'recepcion@taller.com', password: 'rec123',   role: 'Recepción'    },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al iniciar sesión')
        return
      }
      router.replace('/dashboard')
    } catch (err) {
      const isNetworkError = err instanceof TypeError && err.message.toLowerCase().includes('fetch')
      setError(isNetworkError
        ? 'No se pudo conectar al servidor. Verifica que el servidor de desarrollo esté corriendo.'
        : 'Respuesta inesperada del servidor. Revisa la consola del servidor.')
    } finally {
      setLoading(false)
    }
  }

  function fillUser(u: typeof TEST_USERS[0]) {
    setEmail(u.email)
    setPassword(u.password)
    setError('')
  }

  return (
    <div className="loginLayout">

      {/* ── Left: Brand ── */}
      <aside className="loginBrand">
        {/* decorative gear */}
        <div className="loginBrandGearBg" aria-hidden>
          <Settings2 size={280} strokeWidth={0.6} />
        </div>

        <div className="loginBrandTop">
          <img src="/checkmotor-logo.svg" alt="Checkmotor" className="loginBrandLogo" />
        </div>

        <div className="loginBrandCenter">
          <h2 className="loginBrandHeadline">
            Tu taller,<br />
            bajo <em>control total</em>
          </h2>
          <p className="loginBrandDesc">
            Administra órdenes de trabajo, historial de clientes
            y flota de vehículos en una plataforma moderna y segura.
          </p>
          <div className="loginBrandFeatures">
            <div className="loginBrandFeature">
              <div className="loginBrandFeatureIcon"><ClipboardList size={14} /></div>
              Órdenes de trabajo en tiempo real
            </div>
            <div className="loginBrandFeature">
              <div className="loginBrandFeatureIcon"><Users size={14} /></div>
              Historial completo de clientes
            </div>
            <div className="loginBrandFeature">
              <div className="loginBrandFeatureIcon"><Car size={14} /></div>
              Registro de vehículos por cliente
            </div>
          </div>
        </div>

        <div className="loginBrandBottom">
          Multi-taller · Seguro · En la nube
        </div>
      </aside>

      {/* ── Right: Form ── */}
      <main className="loginFormPanel">
        <div className="loginCard">
          <h1 className="loginCardTitle">Iniciar sesión</h1>
          <p className="loginCardSubtitle">Ingresa tus credenciales para continuar</p>

          <form onSubmit={handleSubmit}>
            <div className="loginFields">
              <div className="loginField">
                <span className="loginFieldLabel">Correo electrónico</span>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="usuario@taller.com"
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>

              <div className="loginField">
                <span className="loginFieldLabel">Contraseña</span>
                <div className="loginPasswordRow">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="loginPasswordToggle"
                    onClick={() => setShowPass(p => !p)}
                    tabIndex={-1}
                    aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="loginError">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button type="submit" className="primary" disabled={loading}>
              {loading ? 'Ingresando…' : 'Ingresar al sistema'}
            </button>
          </form>

          {/* Test users */}
          <div className="loginTestUsers">
            <div className="loginTestHeader">
              <FlaskConical size={11} />
              Usuarios de prueba — clic para completar
            </div>
            {TEST_USERS.map(u => (
              <div key={u.email} className="loginTestRow" onClick={() => fillUser(u)}>
                <div className="loginTestRowLeft">
                  <span className="loginTestEmail">{u.email}</span>
                  <span className="loginTestRole">{u.role}</span>
                </div>
                <span className="loginTestPass">{u.password}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

    </div>
  )
}

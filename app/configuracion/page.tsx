import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api-session'
import AppShell from '@/app/app-shell'
import ConfiguracionForm from './configuracion-form'

export const metadata = { title: 'Configuración — TallerPro' }

export default async function ConfiguracionPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.rol !== 'admin') redirect('/dashboard')
  return (
    <AppShell session={session}>
      <div className="shell">
        <ConfiguracionForm />
      </div>
    </AppShell>
  )
}

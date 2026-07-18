import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api-session'
import AppShell from '@/app/app-shell'
import PerfilTallerForm from './perfil-taller-form'

export const metadata = { title: 'Perfil del taller — TallerPro' }

export default async function PerfilTallerPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.rol !== 'admin') redirect('/dashboard')
  return (
    <AppShell session={session}>
      <div className="shell">
        <PerfilTallerForm />
      </div>
    </AppShell>
  )
}

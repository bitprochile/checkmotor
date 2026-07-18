import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api-session'
import AppShell from '@/app/app-shell'
import NuevaCitaForm from './nueva-cita-form'

export const metadata = { title: 'Nueva cita — TallerPro' }

export default async function NuevaCitaPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return (
    <AppShell session={session}>
      <div className="shell">
        <div className="topbar"><h1>Nueva cita</h1></div>
        <NuevaCitaForm />
      </div>
    </AppShell>
  )
}

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api-session'
import AppShell from '@/app/app-shell'
import NuevoRepuestoForm from './nuevo-form'

export const metadata = { title: 'Nuevo repuesto — TallerPro' }

export default async function NuevoRepuestoPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return (
    <AppShell session={session}>
      <div className="shell">
        <div className="topbar" style={{ marginBottom: 20 }}>
          <h1>Nuevo repuesto</h1>
        </div>
        <NuevoRepuestoForm />
      </div>
    </AppShell>
  )
}

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api-session'
import AppShell from '@/app/app-shell'
import ServiciosGrid from './servicios-grid'

export const metadata = { title: 'Servicios — TallerPro' }

export default async function ServiciosPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return (
    <AppShell session={session}>
      <div className="shell">
        <div className="topbar">
          <h1>Servicios</h1>
        </div>
        <ServiciosGrid />
      </div>
    </AppShell>
  )
}

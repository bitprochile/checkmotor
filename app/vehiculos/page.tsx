import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api-session'
import AppShell from '@/app/app-shell'
import VehiculosGrid from './vehiculos-grid'

export const metadata = { title: 'Vehículos — TallerPro' }

export default async function VehiculosPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return (
    <AppShell session={session}>
      <div className="shell">
        <div className="topbar">
          <h1>Vehículos</h1>
        </div>
        <VehiculosGrid />
      </div>
    </AppShell>
  )
}

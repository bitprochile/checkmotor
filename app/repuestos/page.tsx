import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api-session'
import AppShell from '@/app/app-shell'
import RepuestosGrid from './repuestos-grid'

export const metadata = { title: 'Inventario — TallerPro' }

export default async function RepuestosPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return (
    <AppShell session={session}>
      <div className="shell">
        <div className="topbar"><h1>Inventario</h1></div>
        <RepuestosGrid />
      </div>
    </AppShell>
  )
}

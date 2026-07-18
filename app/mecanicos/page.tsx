import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api-session'
import AppShell from '@/app/app-shell'
import MecanicosGrid from './mecanicos-grid'

export const metadata = { title: 'Mecánicos — TallerPro' }

export default async function MecanicosPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return (
    <AppShell session={session}>
      <div className="shell">
        <div className="topbar"><h1>Mecánicos</h1></div>
        <MecanicosGrid />
      </div>
    </AppShell>
  )
}

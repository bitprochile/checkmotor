import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api-session'
import AppShell from '@/app/app-shell'
import ClientesGrid from './clientes-grid'

export const metadata = { title: 'Clientes — TallerPro' }

export default async function ClientesPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return (
    <AppShell session={session}>
      <div className="shell">
        <div className="topbar">
          <h1>Clientes</h1>
        </div>
        <ClientesGrid />
      </div>
    </AppShell>
  )
}

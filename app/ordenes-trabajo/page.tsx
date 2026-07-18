import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api-session'
import AppShell from '@/app/app-shell'
import OrdenesGrid from './ordenes-grid'

export const metadata = { title: 'Órdenes de trabajo — TallerPro' }

export default async function OrdenesTrabajPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return (
    <AppShell session={session}>
      <div className="shell">
        <div className="topbar">
          <h1>Órdenes de trabajo</h1>
        </div>
        <OrdenesGrid />
      </div>
    </AppShell>
  )
}

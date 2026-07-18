import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api-session'
import AppShell from '@/app/app-shell'
import TenantGrid from './tenant-grid'

export const metadata = { title: 'Gestión de Tenants — TallerPro' }

export default async function TenantPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.superadmin) redirect('/dashboard')

  return (
    <AppShell session={session}>
      <TenantGrid />
    </AppShell>
  )
}

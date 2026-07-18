import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api-session'
import AppShell from '@/app/app-shell'
import ReportesPageClient from './reportes-page'

export const metadata = { title: 'Reportes — TallerPro' }

export default async function Page() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.rol !== 'admin') redirect('/dashboard')
  return (
    <AppShell session={session}>
      <ReportesPageClient />
    </AppShell>
  )
}

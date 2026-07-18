import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api-session'
import AppShell from '@/app/app-shell'
import AgendaSemanal from './agenda-semanal'

export const metadata = { title: 'Agenda — TallerPro' }

export default async function AgendaPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return (
    <AppShell session={session}>
      <div className="shell">
        <AgendaSemanal />
      </div>
    </AppShell>
  )
}

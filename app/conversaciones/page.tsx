import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api-session'
import AppShell from '@/app/app-shell'
import ConversacionesGrid from './conversaciones-grid'

export const metadata = { title: 'Conversaciones WhatsApp — TallerPro' }

export default async function ConversacionesPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <AppShell session={session}>
      <ConversacionesGrid />
    </AppShell>
  )
}

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api-session'
import AppShell from '@/app/app-shell'
import MensajesChatbotForm from './mensajes-chatbot-form'

export const metadata = { title: 'Mensajes Chatbot — TallerPro' }

export default async function MensajesChatbotPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.superadmin) redirect('/dashboard')
  return (
    <AppShell session={session}>
      <div className="shell">
        <MensajesChatbotForm />
      </div>
    </AppShell>
  )
}

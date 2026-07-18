import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api-session'
import AppShell from '@/app/app-shell'
import ChecklistConfigForm from './checklist-config-form'

export default async function ChecklistConfigPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.rol !== 'admin') redirect('/dashboard')

  return (
    <AppShell session={session}>
      <div className="shell">
        <ChecklistConfigForm />
      </div>
    </AppShell>
  )
}

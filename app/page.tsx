import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // This page should never render - proxy.ts handles redirects
  // This is a fallback for direct server-side renders
  if (!user) {
    redirect('/login')
  }

  // Proxy will handle the role-based redirect
  redirect('/patient/dashboard')
}

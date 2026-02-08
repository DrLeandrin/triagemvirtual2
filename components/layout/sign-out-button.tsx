'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface SignOutButtonProps {
  className?: string
}

export function SignOutButton({ className = '' }: SignOutButtonProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleSignOut}
      className={`text-text-secondary hover:text-danger transition ${className}`}
    >
      Sair
    </button>
  )
}

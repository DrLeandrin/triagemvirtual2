'use client'

import Link from 'next/link'
import { SignOutButton } from './sign-out-button'
import { usePathname } from 'next/navigation'

export function PatientHeader() {
  const pathname = usePathname()

  return (
    <header className="bg-surface border-b border-border h-16 px-6 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <div className="text-primary font-semibold text-xl">Triagem Virtual</div>
        <nav className="flex gap-6">
          <Link
            href="/patient/dashboard"
            className={`text-text-secondary hover:text-primary transition ${
              pathname === '/patient/dashboard' ? 'text-primary font-medium' : ''
            }`}
          >
            Inicio
          </Link>
          <Link
            href="/patient/triage"
            className={`text-text-secondary hover:text-primary transition ${
              pathname === '/patient/triage' ? 'text-primary font-medium' : ''
            }`}
          >
            Nova Triagem
          </Link>
        </nav>
      </div>
      <SignOutButton />
    </header>
  )
}

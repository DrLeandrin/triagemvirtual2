'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SignOutButton } from './sign-out-button'

export function DoctorSidebar() {
  const pathname = usePathname()

  const navItems = [
    { label: 'Fila de Pacientes', href: '/doctor/dashboard', active: true },
    { label: 'Historico', href: '/doctor/history', active: false },
    { label: 'Configuracoes', href: '/doctor/settings', active: false },
  ]

  return (
    <aside className="w-64 bg-surface-dark text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-white/10">
        <div className="text-xl font-semibold">Triagem Virtual</div>
        <div className="text-sm text-white/60 mt-1">Painel Medico</div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-4 py-3 rounded-lg hover:bg-white/10 transition ${
              pathname === item.href ? 'bg-white/10 text-white font-medium' : 'text-white/80'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <SignOutButton className="text-white/80 hover:text-white w-full text-left" />
      </div>
    </aside>
  )
}

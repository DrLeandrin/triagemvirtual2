import { DoctorSidebar } from '@/components/layout/doctor-sidebar'

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <DoctorSidebar />
      <main className="flex-1 min-w-0 overflow-x-clip px-8 py-8 bg-surface-secondary min-h-screen">
        {children}
      </main>
    </div>
  )
}

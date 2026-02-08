import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UrgencyBadge } from '@/components/doctor/urgency-badge'
import type { ConsultationWithPatient } from '@/types/database.types'

const URGENCY_ORDER: Record<string, number> = {
  emergency: 0,
  urgent: 1,
  less_urgent: 2,
  non_urgent: 3,
}

const STATUS_LABELS: Record<string, string> = {
  waiting: 'Aguardando',
  in_review: 'Em Revisao',
  contacted: 'Contato Realizado',
  completed: 'Finalizado',
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}min atras`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h atras`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d atras`
}

export default async function DoctorDashboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: consultations } = await supabase
    .from('consultations')
    .select('*, patients(full_name, birth_date, phone)')
    .in('status', ['waiting', 'in_review'])
    .order('created_at', { ascending: true })

  const sorted = ((consultations ?? []) as ConsultationWithPatient[]).sort((a, b) => {
    const urgA = URGENCY_ORDER[a.urgency ?? 'non_urgent'] ?? 4
    const urgB = URGENCY_ORDER[b.urgency ?? 'non_urgent'] ?? 4
    if (urgA !== urgB) return urgA - urgB
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Fila de Pacientes</h1>
        <p className="text-text-secondary mt-2">
          {sorted.length === 0
            ? 'Pacientes aguardando revisao medica'
            : `${sorted.length} paciente(s) aguardando revisao`}
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-6">
          <p className="text-text-muted">Nenhum paciente na fila no momento.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((c) => (
            <Link
              key={c.id}
              href={`/doctor/consultation/${c.id}`}
              className="block bg-surface border border-border rounded-lg p-5 hover:border-primary transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-text-primary">
                      {c.patients?.full_name ?? 'Paciente'}
                    </span>
                    <UrgencyBadge urgency={c.urgency} />
                    <span className="text-xs px-2 py-0.5 rounded bg-surface-secondary text-text-secondary">
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </div>
                  {c.summary?.queixa_principal && (
                    <p className="text-sm text-text-secondary truncate">
                      {c.summary.queixa_principal}
                    </p>
                  )}
                </div>
                <span className="text-xs text-text-muted whitespace-nowrap">
                  {timeAgo(c.created_at)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

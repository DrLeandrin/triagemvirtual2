import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UrgencyBadge } from '@/components/doctor/urgency-badge'

const STATUS_LABELS: Record<string, string> = {
  waiting: 'Aguardando revisao',
  in_review: 'Em revisao',
  contacted: 'Contato realizado',
  completed: 'Finalizado',
}

export default async function PatientDashboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: patient } = await supabase
    .from('patients')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single()

  if (!patient) redirect('/login')

  const { data: consultations } = await supabase
    .from('consultations')
    .select('id, status, urgency, summary, created_at')
    .eq('patient_id', patient.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const recentConsultations = consultations ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Bem-vindo, {patient.full_name.split(' ')[0]}
        </h1>
        <p className="text-text-secondary mt-2">
          Sua saude e nossa prioridade. Inicie uma nova triagem quando precisar.
        </p>
      </div>

      <div>
        <Link
          href="/patient/triage"
          className="inline-block bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition"
        >
          Iniciar Triagem
        </Link>
      </div>

      <div className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Suas consultas recentes
        </h2>

        {recentConsultations.length === 0 ? (
          <p className="text-text-muted">Nenhuma consulta realizada ainda.</p>
        ) : (
          <div className="space-y-3">
            {recentConsultations.map((c: any) => (
              <Link
                key={c.id}
                href={`/patient/consultation/${c.id}`}
                className="flex items-center justify-between border border-border rounded-lg p-4 hover:border-primary transition"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <UrgencyBadge urgency={c.urgency} />
                    <span className="text-xs text-text-secondary">
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </div>
                  {c.summary?.queixa_principal && (
                    <p className="text-sm text-text-secondary truncate">
                      {c.summary.queixa_principal}
                    </p>
                  )}
                </div>
                <span className="text-xs text-text-muted whitespace-nowrap ml-4">
                  {new Date(c.created_at).toLocaleDateString('pt-BR')}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UrgencyBadge } from '@/components/doctor/urgency-badge'
import type { Consultation } from '@/types/database.types'

const STATUS_LABELS: Record<string, string> = {
  waiting: 'Aguardando revisao',
  in_review: 'Em revisao',
  contacted: 'Contato realizado',
  completed: 'Finalizado',
}

export default async function PatientConsultationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // RLS ensures patient can only see their own consultations
  const { data: consultation } = await supabase
    .from('consultations')
    .select('*')
    .eq('id', id)
    .single()

  if (!consultation) notFound()

  const c = consultation as Consultation

  return (
    <div className="space-y-6 max-w-3xl break-words">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/patient/dashboard"
          className="text-primary hover:text-primary-dark text-sm font-medium transition"
        >
          &larr; Voltar ao Dashboard
        </Link>
        <div className="flex items-center gap-3">
          <UrgencyBadge urgency={c.urgency} />
          <span className="text-xs px-2 py-0.5 rounded bg-surface-secondary text-text-secondary">
            {STATUS_LABELS[c.status] ?? c.status}
          </span>
        </div>
      </div>

      {/* Date */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <h1 className="text-xl font-semibold text-text-primary">Detalhes da Consulta</h1>
        <p className="text-sm text-text-muted mt-1">
          {new Date(c.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      {/* Summary */}
      {c.summary && (
        <div className="bg-surface border border-border rounded-lg p-5 space-y-3">
          <h2 className="text-lg font-semibold text-text-primary">Resumo da Triagem</h2>
          {c.summary.queixa_principal && (
            <p className="text-sm text-text-muted">
              <span className="font-medium">Queixa principal:</span> {c.summary.queixa_principal}
            </p>
          )}
          <p className="text-text-secondary text-sm">{c.summary.resumo_geral}</p>
        </div>
      )}

      {/* Transcript */}
      {c.transcript ? (
        <div className="bg-surface border border-border rounded-lg p-5 space-y-3">
          <h2 className="text-lg font-semibold text-text-primary">Transcricao da Conversa</h2>
          <div className="space-y-3">
            {c.transcript.split('\n').map((line, i) => {
              const isPatient = line.startsWith('Paciente:')
              const isAssistant = line.startsWith('Assistente:')
              const text = line.replace(/^(Paciente|Assistente):\s*/, '')

              if (!isPatient && !isAssistant) {
                return (
                  <p key={i} className="text-sm text-text-secondary">
                    {line}
                  </p>
                )
              }

              return (
                <div
                  key={i}
                  className={`flex ${isPatient ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      isPatient
                        ? 'bg-primary text-white'
                        : 'bg-surface-secondary text-text-primary'
                    }`}
                  >
                    <p className="text-xs font-medium mb-1 opacity-70">
                      {isPatient ? 'Voce' : 'Assistente'}
                    </p>
                    <p className="text-sm">{text}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg p-5">
          <p className="text-text-muted">Transcricao nao disponivel.</p>
        </div>
      )}
    </div>
  )
}

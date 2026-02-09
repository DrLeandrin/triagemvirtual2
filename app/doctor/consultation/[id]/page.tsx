import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UrgencyBadge } from '@/components/doctor/urgency-badge'
import { StatusActions } from '@/components/doctor/status-actions'
import type { ConsultationWithPatient } from '@/types/database.types'

const STATUS_LABELS: Record<string, string> = {
  waiting: 'Aguardando',
  in_review: 'Em Revisao',
  contacted: 'Contato Realizado',
  completed: 'Finalizado',
}

const PROBABILITY_LABELS: Record<string, { label: string; className: string }> = {
  alta: { label: 'Alta', className: 'text-danger font-semibold' },
  media: { label: 'Media', className: 'text-warning font-semibold' },
  baixa: { label: 'Baixa', className: 'text-text-secondary' },
}

export default async function ConsultationDetailPage({
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

  const { data: consultation } = await supabase
    .from('consultations')
    .select('*, patients(full_name, birth_date, phone)')
    .eq('id', id)
    .single()

  if (!consultation) notFound()

  const c = consultation as ConsultationWithPatient

  return (
    <div className="space-y-6 max-w-4xl break-words">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/doctor/dashboard"
          className="text-primary hover:text-primary-dark text-sm font-medium transition"
        >
          &larr; Voltar para fila
        </Link>
        <div className="flex items-center gap-3">
          <UrgencyBadge urgency={c.urgency} />
          <span className="text-xs px-2 py-0.5 rounded bg-surface-secondary text-text-secondary">
            {STATUS_LABELS[c.status] ?? c.status}
          </span>
        </div>
      </div>

      {/* Patient info */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">
              {c.patients?.full_name ?? 'Paciente'}
            </h1>
            {c.patients?.birth_date && (
              <p className="text-sm text-text-secondary mt-1">
                Data de nascimento: {new Date(c.patients.birth_date).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
          <p className="text-sm text-text-muted">
            {new Date(c.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      {/* Summary */}
      {c.summary ? (
        <>
          {/* General summary */}
          <div className="bg-surface border border-border rounded-lg p-5 space-y-2">
            <h2 className="text-lg font-semibold text-text-primary">Resumo Geral</h2>
            <p className="text-text-secondary whitespace-pre-line leading-relaxed">{c.summary.resumo_geral}</p>
            {c.summary.queixa_principal && (
              <p className="text-sm text-text-muted">
                <span className="font-medium">Queixa principal:</span> {c.summary.queixa_principal}
              </p>
            )}
          </div>

          {/* SOAP Note */}
          <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
            <h2 className="text-lg font-semibold text-text-primary">Nota SOAP</h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">
                  S — Subjetivo
                </h3>
                <p className="text-text-secondary mt-1 text-sm whitespace-pre-line">
                  {c.summary.soap.subjetivo}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">
                  O — Objetivo
                </h3>
                <p className="text-text-secondary mt-1 text-sm whitespace-pre-line">
                  {c.summary.soap.objetivo}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">
                  A — Avaliacao
                </h3>
                <p className="text-text-secondary mt-1 text-sm whitespace-pre-line">
                  {c.summary.soap.avaliacao}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">
                  P — Plano
                </h3>
                <p className="text-text-secondary mt-1 text-sm whitespace-pre-line">
                  {c.summary.soap.plano}
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-surface border border-border rounded-lg p-5">
          <p className="text-text-muted">
            Resumo clinico ainda nao disponivel. A analise pode estar em processamento.
          </p>
        </div>
      )}

      {/* Hypotheses */}
      {c.hypotheses && c.hypotheses.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-5 space-y-3">
          <h2 className="text-lg font-semibold text-text-primary">Hipoteses Diagnosticas</h2>
          <div className="space-y-3">
            {c.hypotheses.map((h, i) => {
              const prob = PROBABILITY_LABELS[h.probability]
              return (
                <div key={i} className="border-l-4 border-primary/30 pl-4 py-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">{h.hypothesis}</span>
                    {prob && (
                      <span className={`text-xs ${prob.className}`}>({prob.label})</span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary mt-0.5">{h.justification}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Transcript (collapsible) */}
      {c.transcript && (
        <details className="bg-surface border border-border rounded-lg">
          <summary className="p-5 cursor-pointer text-lg font-semibold text-text-primary hover:text-primary transition">
            Transcricao Completa
          </summary>
          <div className="px-5 pb-5 border-t border-border pt-4">
            <div className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">
              {c.transcript}
            </div>
          </div>
        </details>
      )}

      {/* Actions */}
      <div className="bg-surface border border-border rounded-lg p-5 space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Acoes</h2>
        <StatusActions consultationId={c.id} currentStatus={c.status} />
      </div>
    </div>
  )
}

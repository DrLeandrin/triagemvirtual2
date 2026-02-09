import type { ConsultationSummary, DiagnosticHypothesis } from '@/types/database.types'

const PROBABILITY_LABELS: Record<string, { label: string; className: string }> = {
  alta: { label: 'Alta', className: 'text-danger font-semibold' },
  media: { label: 'Media', className: 'text-warning font-semibold' },
  baixa: { label: 'Baixa', className: 'text-text-secondary' },
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold text-text-primary mb-4">{children}</h2>
  )
}

function SOAPEntry({ letter, label, content }: { letter: string; label: string; content: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">
        {letter} — {label}
      </h3>
      <div className="text-text-secondary mt-1 text-sm whitespace-pre-line leading-relaxed">
        {content}
      </div>
    </div>
  )
}

export function ClinicalSummary({
  summary,
  hypotheses,
  transcript,
}: {
  summary: ConsultationSummary | null
  hypotheses: DiagnosticHypothesis[] | null
  transcript: string | null
}) {
  if (!summary) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6">
        <p className="text-text-muted">
          Resumo clinico ainda nao disponivel. A analise pode estar em processamento.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* General summary */}
      <section className="bg-surface border border-border rounded-lg p-6">
        <SectionTitle>Resumo Geral</SectionTitle>
        <div className="text-text-secondary whitespace-pre-line leading-relaxed">
          {summary.resumo_geral}
        </div>
        {summary.queixa_principal && (
          <div className="mt-4 pt-4 border-t border-border">
            <span className="text-sm font-medium text-text-primary">Queixa principal: </span>
            <span className="text-sm text-text-secondary">{summary.queixa_principal}</span>
          </div>
        )}
      </section>

      {/* SOAP Note */}
      <section className="bg-surface border border-border rounded-lg p-6">
        <SectionTitle>Nota SOAP</SectionTitle>
        <div className="space-y-5">
          <SOAPEntry letter="S" label="Subjetivo" content={summary.soap.subjetivo} />
          <SOAPEntry letter="O" label="Objetivo" content={summary.soap.objetivo} />
          <SOAPEntry letter="A" label="Avaliacao" content={summary.soap.avaliacao} />
          <SOAPEntry letter="P" label="Plano" content={summary.soap.plano} />
        </div>
      </section>

      {/* Hypotheses */}
      {hypotheses && hypotheses.length > 0 && (
        <section className="bg-surface border border-border rounded-lg p-6">
          <SectionTitle>Hipoteses Diagnosticas</SectionTitle>
          <div className="space-y-3">
            {hypotheses.map((h, i) => {
              const prob = PROBABILITY_LABELS[h.probability]
              return (
                <div key={i} className="border-l-4 border-primary/30 pl-4 py-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">{h.hypothesis}</span>
                    {prob && (
                      <span className={`text-xs ${prob.className}`}>({prob.label})</span>
                    )}
                  </div>
                  <div className="text-sm text-text-secondary mt-0.5">{h.justification}</div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Transcript (collapsible) */}
      {transcript && (
        <details className="bg-surface border border-border rounded-lg">
          <summary className="p-6 cursor-pointer text-lg font-semibold text-text-primary hover:text-primary transition">
            Transcricao Completa
          </summary>
          <div className="px-6 pb-6 border-t border-border pt-4">
            <div className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">
              {transcript}
            </div>
          </div>
        </details>
      )}
    </div>
  )
}

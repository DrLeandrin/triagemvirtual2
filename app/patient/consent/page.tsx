'use client'

import { useActionState } from 'react'
import { recordConsent } from './actions'

export default function ConsentPage() {
  const [state, formAction, isPending] = useActionState(recordConsent, {
    error: '',
  })

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-surface rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-semibold text-text-primary mb-2">
          Consentimento para Coleta de Dados de Saude
        </h1>
        <p className="text-text-secondary mb-6">
          Antes de iniciar a triagem, leia atentamente o termo abaixo.
        </p>

        <div
          className="border border-border rounded-lg p-5 h-80 overflow-y-auto mb-6 bg-surface-secondary text-sm text-text-primary leading-relaxed"
          tabIndex={0}
        >
          <h2 className="font-semibold mb-3 text-base">
            Termo de Consentimento para Coleta e Tratamento de Dados de Saude
          </h2>

          <h3 className="font-semibold mt-4 mb-1">1. Finalidade</h3>
          <p className="mb-3">
            Seus dados de saude serao coletados exclusivamente para realizar
            triagem virtual por meio de inteligencia artificial e
            encaminha-lo(a) a um medico para avaliacao.
          </p>

          <h3 className="font-semibold mt-4 mb-1">2. Dados Coletados</h3>
          <ul className="list-disc list-inside mb-3 space-y-1">
            <li>Sintomas e queixas relatadas durante a triagem</li>
            <li>
              Historico medico informado (alergias, medicamentos, condicoes
              pre-existentes)
            </li>
            <li>Classificacao de urgencia gerada pelo sistema</li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">3. Base Legal</h3>
          <p className="mb-3">
            O tratamento e realizado com base no seu consentimento explicito,
            conforme Art. 11, I da Lei Geral de Protecao de Dados (Lei
            13.709/2018 — LGPD).
          </p>

          <h3 className="font-semibold mt-4 mb-1">4. Compartilhamento</h3>
          <p className="mb-3">
            Seus dados serao compartilhados apenas com o medico responsavel pela
            analise da sua triagem, dentro desta plataforma.
          </p>

          <h3 className="font-semibold mt-4 mb-1">5. Retencao</h3>
          <p className="mb-3">
            Os registros medicos serao mantidos pelo prazo minimo de 20 anos,
            conforme exigencia do Conselho Federal de Medicina (CFM).
          </p>

          <h3 className="font-semibold mt-4 mb-1">6. Seus Direitos</h3>
          <p className="mb-2">Voce pode, a qualquer momento:</p>
          <ul className="list-disc list-inside mb-3 space-y-1">
            <li>Solicitar acesso aos seus dados</li>
            <li>Solicitar correcao de dados incompletos ou inexatos</li>
            <li>
              Revogar este consentimento (a revogacao nao afeta o tratamento ja
              realizado)
            </li>
          </ul>

          <p className="text-text-secondary text-xs mt-4 italic">
            Documento sujeito a revisao juridica.
          </p>
        </div>

        {state.error && (
          <div className="text-danger text-sm mb-4">{state.error}</div>
        )}

        <form action={formAction}>
          <div className="flex gap-4">
            <button
              type="submit"
              name="action"
              value="accept"
              disabled={isPending}
              className="flex-1 bg-primary text-white py-3 px-6 rounded-lg font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Processando...' : 'Aceitar e Continuar'}
            </button>
            <button
              type="submit"
              name="action"
              value="reject"
              disabled={isPending}
              className="flex-1 bg-surface text-text-primary border border-border py-3 px-6 rounded-lg font-medium hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Recusar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

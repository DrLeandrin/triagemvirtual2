'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createHash } from 'crypto'

const CONSENT_VERSION = 'v1.0'

// Placeholder — needs legal review before production
const CONSENT_TEXT = `TERMO DE CONSENTIMENTO PARA COLETA E TRATAMENTO DE DADOS DE SAÚDE

1. FINALIDADE
Seus dados de saúde serão coletados exclusivamente para realizar triagem virtual por meio de inteligência artificial e encaminhá-lo(a) a um médico para avaliação.

2. DADOS COLETADOS
- Sintomas e queixas relatadas durante a triagem
- Histórico médico informado (alergias, medicamentos, condições pré-existentes)
- Classificação de urgência gerada pelo sistema

3. BASE LEGAL
O tratamento é realizado com base no seu consentimento explícito, conforme Art. 11, I da Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).

4. COMPARTILHAMENTO
Seus dados serão compartilhados apenas com o médico responsável pela análise da sua triagem, dentro desta plataforma.

5. RETENÇÃO
Os registros médicos serão mantidos pelo prazo mínimo de 20 anos, conforme exigência do Conselho Federal de Medicina (CFM).

6. SEUS DIREITOS
Você pode, a qualquer momento:
- Solicitar acesso aos seus dados
- Solicitar correção de dados incompletos ou inexatos
- Revogar este consentimento (a revogação não afeta o tratamento já realizado)

Para exercer seus direitos, entre em contato através das configurações da sua conta.

[DOCUMENTO SUJEITO A REVISÃO JURÍDICA]`

export async function recordConsent(
  prevState: { error: string },
  formData: FormData
): Promise<{ error: string }> {
  const action = formData.get('action') as string
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Não autenticado' }
  }

  if (action === 'reject') {
    redirect('/patient/consent/rejected')
  }

  // Hash IP for privacy
  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for') ||
    headersList.get('x-real-ip') ||
    '0.0.0.0'
  const ipHash = createHash('sha256').update(ip).digest('hex')

  const { error } = await supabase.from('consent_records').insert({
    user_id: user.id,
    consent_type: 'health_data_collection',
    ip_address_hash: ipHash,
    version: CONSENT_VERSION,
    consent_text: CONSENT_TEXT,
    user_agent: headersList.get('user-agent') || 'unknown',
  })

  if (error) {
    return { error: 'Erro ao registrar consentimento. Tente novamente.' }
  }

  redirect('/patient/dashboard')
}

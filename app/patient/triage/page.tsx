import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TriageVoice } from '@/components/triage/triage-voice'

export default async function TriagePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: patient } = await supabase
    .from('patients')
    .select('full_name')
    .eq('user_id', user.id)
    .single()

  if (!patient) {
    redirect('/login')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Nova Triagem</h1>
        <p className="text-text-secondary mt-2">
          Converse com nosso assistente virtual. Ele vai fazer perguntas sobre seus sintomas
          para ajudar o medico na avaliacao.
        </p>
      </div>

      <TriageVoice patientName={patient.full_name} />
    </div>
  )
}

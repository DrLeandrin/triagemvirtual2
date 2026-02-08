'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateConsultationStatus(
  consultationId: string,
  newStatus: 'in_review' | 'contacted' | 'completed'
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Nao autenticado' }

  const { data: doctor } = await supabase
    .from('doctors')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!doctor) return { error: 'Medico nao encontrado' }

  const { error } = await supabase
    .from('consultations')
    .update({
      status: newStatus,
      doctor_id: doctor.id,
    })
    .eq('id', consultationId)

  if (error) return { error: 'Erro ao atualizar status' }

  revalidatePath('/doctor/dashboard')
  revalidatePath(`/doctor/consultation/${consultationId}`)

  return { success: true }
}

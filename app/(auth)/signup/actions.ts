'use server'

import { createClient } from '@/lib/supabase/server'

export async function signup(
  prevState: { error: string; success: string },
  formData: FormData
): Promise<{ error: string; success: string }> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const fullName = formData.get('fullName') as string
  const cpf = formData.get('cpf') as string

  // Validation: all fields required
  if (!email || !password || !confirmPassword || !fullName || !cpf) {
    return { error: 'Todos os campos são obrigatórios', success: '' }
  }

  // Validation: password min 6 chars
  if (password.length < 6) {
    return { error: 'A senha deve ter pelo menos 6 caracteres', success: '' }
  }

  // Validation: passwords match
  if (password !== confirmPassword) {
    return { error: 'As senhas não coincidem', success: '' }
  }

  // Validation: CPF basic format (11 digits)
  const cpfDigits = cpf.replace(/\D/g, '')
  if (cpfDigits.length !== 11) {
    return { error: 'CPF deve ter 11 dígitos', success: '' }
  }

  // Email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { error: 'Formato de e-mail inválido', success: '' }
  }

  // Create Supabase client
  const supabase = await createClient()

  // Sign up with metadata
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        cpf: cpfDigits,
      },
    },
  })

  if (error) {
    return { error: error.message, success: '' }
  }

  const userId = data.user?.id

  // If user was created (email confirmation disabled or auto-confirmed),
  // create patient record and assign role immediately
  if (userId) {
    const { error: patientError } = await supabase.from('patients').insert({
      user_id: userId,
      full_name: fullName,
      cpf: cpfDigits,
    })

    if (patientError && !patientError.message.includes('duplicate')) {
      console.error('Error creating patient record:', patientError)
    }

    const { error: roleError } = await supabase.from('user_roles').insert({
      user_id: userId,
      role: 'patient',
    })

    if (roleError && !roleError.message.includes('duplicate')) {
      console.error('Error creating user role:', roleError)
    }
  }

  return {
    error: '',
    success: 'Conta criada! Verifique seu e-mail para confirmar.',
  }
}

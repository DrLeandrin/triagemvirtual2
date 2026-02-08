'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(
  prevState: { error: string },
  formData: FormData
): Promise<{ error: string }> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Basic validation
  if (!email || !password) {
    return { error: 'E-mail e senha são obrigatórios' }
  }

  // Email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { error: 'Formato de e-mail inválido' }
  }

  // Create Supabase client
  const supabase = await createClient()

  // Attempt sign in
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: 'E-mail ou senha incorretos' }
  }

  // Redirect to patient dashboard (proxy will handle doctor redirect later)
  redirect('/patient/dashboard')
}

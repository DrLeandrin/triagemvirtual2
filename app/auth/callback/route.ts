import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/patient/dashboard'

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=Código de confirmação ausente', request.url)
    )
  }

  const supabase = await createClient()

  // Exchange code for session
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code
  )

  if (exchangeError) {
    return NextResponse.redirect(
      new URL('/login?error=Erro ao confirmar e-mail', request.url)
    )
  }

  // Get the authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.redirect(
      new URL('/login?error=Erro ao obter usuário', request.url)
    )
  }

  // Extract metadata
  const fullName = user.user_metadata?.full_name
  const cpf = user.user_metadata?.cpf

  if (!fullName || !cpf) {
    return NextResponse.redirect(
      new URL('/login?error=Dados de cadastro incompletos', request.url)
    )
  }

  // Insert into patients table
  const { error: patientError } = await supabase.from('patients').insert({
    user_id: user.id,
    full_name: fullName,
    cpf: cpf,
  })

  if (patientError) {
    // If patient already exists, that's OK (user might be re-confirming)
    if (!patientError.message.includes('duplicate')) {
      console.error('Error creating patient record:', patientError)
    }
  }

  // Insert into user_roles table
  const { error: roleError } = await supabase.from('user_roles').insert({
    user_id: user.id,
    role: 'patient',
  })

  if (roleError) {
    // If role already exists, that's OK
    if (!roleError.message.includes('duplicate')) {
      console.error('Error creating user role:', roleError)
    }
  }

  // Handle forwardedHost for production deployments
  const forwardedHost = request.headers.get('x-forwarded-host')
  const origin = forwardedHost ? `https://${forwardedHost}` : request.url

  return NextResponse.redirect(new URL(next, origin))
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!role || role.role !== 'patient') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID } = serverEnv()

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${ELEVENLABS_AGENT_ID}`,
    {
      headers: { 'xi-api-key': ELEVENLABS_API_KEY },
    }
  )

  if (!response.ok) {
    return NextResponse.json(
      { error: 'Failed to get signed URL' },
      { status: 502 }
    )
  }

  const data = await response.json()

  return NextResponse.json({ signedUrl: data.signed_url })
}

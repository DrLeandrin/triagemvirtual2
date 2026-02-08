import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { serverEnv } from '@/lib/env'
import { SOAP_SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompts/soap'

export async function POST(request: Request) {
  const supabase = await createClient()

  // 1. Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Verify patient role
  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!role || role.role !== 'patient') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Get patient_id
  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  // 4. Parse request body
  const body = await request.json()
  const { transcript } = body as { transcript: string }

  if (!transcript || transcript.trim().length === 0) {
    return NextResponse.json({ error: 'Transcript is required' }, { status: 400 })
  }

  // 5. INSERT consultation with transcript (two-phase save — transcript is never lost)
  const { data: consultation, error: insertError } = await supabase
    .from('consultations')
    .insert({
      patient_id: patient.id,
      transcript,
      status: 'waiting' as const,
    })
    .select('id')
    .single()

  if (insertError || !consultation) {
    console.error('[triage/process] Insert failed:', insertError)
    return NextResponse.json({ error: 'Failed to save consultation' }, { status: 500 })
  }

  // 6. Call Claude Haiku for SOAP processing
  try {
    const { ANTHROPIC_API_KEY } = serverEnv()
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

    const aiResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SOAP_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(transcript),
        },
      ],
    })

    const rawText = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : ''

    // Strip potential markdown fences
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const parsed = JSON.parse(jsonText)

    // 7. UPDATE consultation with AI results (service client — bypasses RLS)
    const serviceClient = createServiceClient()

    const { error: updateError } = await serviceClient
      .from('consultations')
      .update({
        summary: parsed.summary,
        urgency: parsed.urgency,
        hypotheses: parsed.hypotheses,
      })
      .eq('id', consultation.id)

    if (updateError) {
      console.error('[triage/process] Update failed:', updateError)
      // Consultation still saved with transcript
      return NextResponse.json({
        consultation_id: consultation.id,
        status: 'saved_without_analysis',
      })
    }

    return NextResponse.json({
      consultation_id: consultation.id,
      status: 'processed',
      urgency: parsed.urgency,
    })
  } catch (error) {
    console.error('[triage/process] AI processing failed:', error)
    // Consultation is already saved with transcript — return degraded success
    return NextResponse.json({
      consultation_id: consultation.id,
      status: 'saved_without_analysis',
    })
  }
}

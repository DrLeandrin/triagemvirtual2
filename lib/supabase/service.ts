import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { serverEnv } from '@/lib/env'

export function createServiceClient() {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

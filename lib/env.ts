import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
})

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
})

const serverEnvSchema = z.object({
  ELEVENLABS_API_KEY: z.string().min(1),
  ELEVENLABS_AGENT_ID: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})

let _serverEnv: z.infer<typeof serverEnvSchema> | null = null

export function serverEnv() {
  if (!_serverEnv) {
    _serverEnv = serverEnvSchema.parse({
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
      ELEVENLABS_AGENT_ID: process.env.ELEVENLABS_AGENT_ID,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
  }
  return _serverEnv
}

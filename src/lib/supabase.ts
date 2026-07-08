/**
 * Supabase client — auth + database.
 *
 * Supabase Auth handles login/accounts; the same client runs DB queries with
 * the signed-in user's session. The `supabase` singleton persists the session,
 * auto-refreshes tokens, and detects the OAuth code in the URL on redirect back
 * from Google.
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

/** True when the client-side Supabase env vars look real (build-time VITE_).
 *  Rejects the obvious `.env.example` placeholders so a stale placeholder shows
 *  the setup screen instead of failing later with a cryptic "Invalid API key". */
export const supabaseConfigured =
  !!SUPABASE_URL &&
  /^https:\/\/[a-z0-9-]+\.supabase\.co/i.test(SUPABASE_URL) &&
  !SUPABASE_URL.includes('your-project') &&
  !!SUPABASE_ANON_KEY &&
  SUPABASE_ANON_KEY.length > 30 &&
  SUPABASE_ANON_KEY !== 'eyJ...'

/** Singleton browser client — persists the session, used for both auth and DB. */
export const supabase = createClient(SUPABASE_URL || 'http://placeholder.local', SUPABASE_ANON_KEY || 'placeholder', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Back-compat factory (a few call sites still create per-token clients). */
export function makeSupabaseClient(token: string | null) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    auth: { persistSession: false },
  })
}

export type SupabaseDb = ReturnType<typeof makeSupabaseClient>

// ── TypeScript types derived from the schema ──────────────────────────────────

export type CampaignStatus = 'draft' | 'rendering' | 'ready' | 'published'
export type ScenePhase = 'idle' | 'working' | 'done' | 'error'

export interface Campaign {
  id: string
  user_id: string
  name: string
  product_image_url: string | null
  product_description: string | null
  style: string | null
  quality: string
  status: CampaignStatus
  created_at: string
  updated_at: string
}

export interface Scene {
  id: string
  campaign_id: string
  user_id: string
  label: string
  style: string
  order_index: number
  phase: ScenePhase
  request_id: string | null
  director_prompt: string | null
  video_url: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

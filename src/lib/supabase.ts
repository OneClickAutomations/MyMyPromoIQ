/**
 * Supabase client factory.
 *
 * We use Clerk for auth and Supabase for the database. Each request passes
 * the Clerk JWT as a Bearer token so Supabase RLS rules can verify the user.
 *
 * Usage (inside a component):
 *   const getClient = useSupabaseClient()
 *   const { data } = await (await getClient()).from('campaigns').select()
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export function makeSupabaseClient(token: string | null): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    auth: { persistSession: false },
  })
}

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

export interface Database {
  public: {
    Tables: {
      campaigns: { Row: Campaign; Insert: Partial<Campaign>; Update: Partial<Campaign> }
      scenes: { Row: Scene; Insert: Partial<Scene>; Update: Partial<Scene> }
    }
  }
}

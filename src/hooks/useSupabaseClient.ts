/**
 * Returns the authenticated Supabase client. With Supabase Auth the browser
 * client persists the session, so queries are automatically authorized as the
 * signed-in user (RLS sees `auth.uid()`) — no manual token passing needed.
 *
 * Kept as a hook returning an async factory so existing call sites
 * (`const getClient = useSupabaseClient(); await getClient()`) work unchanged.
 */
import { useCallback } from 'react'
import { supabase, type SupabaseDb } from '../lib/supabase'

export function useSupabaseClient() {
  return useCallback(async (): Promise<SupabaseDb> => supabase as unknown as SupabaseDb, [])
}

/**
 * Returns an async function that creates a Supabase client authenticated with
 * the current Clerk session token. Call `await getClient()` before each query
 * so the token is always fresh (Clerk auto-refreshes it).
 *
 * Requires a Clerk JWT template named "supabase" — see setup instructions in
 * supabase/schema.sql and the README.
 */
import { useAuth } from '@clerk/clerk-react'
import { useCallback } from 'react'
import { makeSupabaseClient, type SupabaseDb } from '../lib/supabase'

export function useSupabaseClient() {
  const { getToken } = useAuth()

  return useCallback(async (): Promise<SupabaseDb> => {
    const token = await getToken({ template: 'supabase' })
    return makeSupabaseClient(token)
  }, [getToken])
}

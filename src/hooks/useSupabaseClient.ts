/**
 * Returns an async function that creates a Supabase client authenticated with
 * the current Clerk session token. Call `await getClient()` before each query
 * so the token is always fresh (Clerk auto-refreshes it).
 *
 * Token strategy (resilient to either Clerk → Supabase setup):
 *   1. Try the legacy JWT template named "supabase" (Clerk's old approach).
 *   2. If that template doesn't exist, fall back to the plain Clerk session
 *      token (the modern "native third-party auth" integration — no template
 *      required). Supabase reads the Clerk user id from `sub` either way.
 *
 * This means generation never crashes with "No JWT template exists with name
 * Supabase" — it just uses whichever token Clerk can mint.
 */
import { useAuth } from '@clerk/clerk-react'
import { useCallback } from 'react'
import { makeSupabaseClient, type SupabaseDb } from '../lib/supabase'

export function useSupabaseClient() {
  const { getToken } = useAuth()

  return useCallback(async (): Promise<SupabaseDb> => {
    let token: string | null = null
    try {
      // Legacy path: a Clerk JWT template explicitly named "supabase".
      token = await getToken({ template: 'supabase' })
    } catch {
      // Template missing (or any Clerk error) → use the plain session token.
      // Works with Clerk's native Supabase integration, where no template
      // is configured. Swallow the error so the UI flow continues.
      try {
        token = await getToken()
      } catch {
        token = null
      }
    }
    return makeSupabaseClient(token)
  }, [getToken])
}

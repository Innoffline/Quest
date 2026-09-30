import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Refuse to run with a secret key in the browser bundle. */
function looksLikeSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true
  try {
    const payload = JSON.parse(atob(key.split('.')[1] ?? '')) as { role?: string }
    return payload.role === 'service_role'
  } catch {
    return false
  }
}

if (anonKey && looksLikeSecretKey(anonKey)) {
  throw new Error('VITE_SUPABASE_ANON_KEY is a service-role/secret key. Use the public anon (publishable) key only.')
}

/** Supabase is optional: without env vars the app runs in Local Mode. */
export const supabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    })
  : null

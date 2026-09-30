import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { localDb } from '../offline/db'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabaseConfigured = Boolean(url && publishableKey)

// Supabase Auth requires durable storage for session recovery. Keep its session
// in IndexedDB instead of localStorage; never log tokens or expose service keys.
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url, publishableKey, {
      auth: {
        storage: {
          async getItem(key) { return (await localDb()).get('auth', key).then(value => value ?? null) },
          async setItem(key, value) { await (await localDb()).put('auth', value, key) },
          async removeItem(key) { await (await localDb()).delete('auth', key) },
        },
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null

export async function probeSupabase(): Promise<'unconfigured' | 'online' | 'offline'> {
  if (!url || !publishableKey) return 'unconfigured'
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/health`, { signal: AbortSignal.timeout(4000) })
    return response.ok ? 'online' : 'offline'
  } catch {
    return 'offline'
  }
}

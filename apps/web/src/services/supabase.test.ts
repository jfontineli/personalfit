import { expect, it } from 'vitest'
import { probeSupabase, supabase, supabaseConfigured } from './supabase'

it('só cria cliente com configuração pública e informa a disponibilidade', async () => {
  expect(Boolean(supabase)).toBe(supabaseConfigured)
  const result = await probeSupabase()
  expect(result).toMatch(/^(unconfigured|online|offline)$/)
  if (!supabaseConfigured) expect(result).toBe('unconfigured')
  expect(localStorage.length).toBe(0)
})

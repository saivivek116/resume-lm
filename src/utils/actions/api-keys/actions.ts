'use server'

import { createClient } from '@/utils/supabase/server'
import { encrypt, decrypt } from '@/utils/encryption'
import type { ServiceName } from '@/lib/types'

export async function upsertApiKey(provider: ServiceName, rawKey: string): Promise<{ error?: string }> {
  if (!rawKey.trim()) return { error: 'API key cannot be empty' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const encrypted_key = encrypt(rawKey.trim())
  const { error } = await supabase
    .from('user_api_keys')
    .upsert(
      { user_id: user.id, provider, encrypted_key, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,provider' }
    )

  if (error) return { error: error.message }
  return {}
}

export async function deleteApiKey(provider: ServiceName): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('user_api_keys')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', provider)

  if (error) return { error: error.message }
  return {}
}

export async function hasApiKey(provider: ServiceName): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('user_api_keys')
    .select('provider')
    .eq('user_id', user.id)
    .eq('provider', provider)
    .maybeSingle()

  return !!data
}

export async function getDecryptedApiKey(provider: ServiceName): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('user_api_keys')
    .select('encrypted_key')
    .eq('user_id', user.id)
    .eq('provider', provider)
    .maybeSingle()

  if (!data) return null
  try {
    return decrypt(data.encrypted_key)
  } catch {
    return null
  }
}

export async function getAvailableProviders(): Promise<ServiceName[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('user_api_keys')
    .select('provider')
    .eq('user_id', user.id)

  return (data ?? []).map(row => row.provider as ServiceName)
}

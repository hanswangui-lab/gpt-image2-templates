import { supabaseAdmin } from './supabase.js'
import { config } from '../config.js'

let cache: Record<string, string> = {}
let loaded = false

export async function loadSettings() {
  const { data } = await supabaseAdmin.from('settings').select('key, value')
  if (data) {
    for (const row of data) {
      cache[row.key] = row.value
    }
  }
  loaded = true
}

export async function refreshSettings() {
  loaded = false
  await loadSettings()
}

export function getSetting(key: string): string {
  // Return cached value if non-empty, otherwise fall back to env
  const val = cache[key]
  if (val && val.length > 0) return val

  // Fallback to env vars
  if (key === 'bestapi_url') return config.bestapiUrl
  if (key === 'bestapi_key') return config.bestapiKey

  return val || ''
}

export function getAllSettings(): Record<string, string> {
  return { ...cache }
}

export async function updateSettings(settings: Record<string, string>) {
  const entries = Object.entries(settings)
  for (const [key, value] of entries) {
    await supabaseAdmin
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })
    cache[key] = value
  }
}

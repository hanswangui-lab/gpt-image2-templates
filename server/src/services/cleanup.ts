import fs from 'fs'
import path from 'path'
import { supabaseAdmin } from './supabase.js'
import { config } from '../config.js'

export async function cleanupExpiredImages(): Promise<void> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const { data: expired } = await supabaseAdmin
    .from('generated_images')
    .select('id, storage_path')
    .lt('created_at', cutoff)

  if (!expired || expired.length === 0) return

  // Delete local files
  for (const r of expired) {
    if (r.storage_path) {
      const filePath = path.join(config.imagesDir, r.storage_path)
      try { fs.unlinkSync(filePath) } catch {}
    }
  }

  // Delete records
  const ids = expired.map((r) => r.id)
  await supabaseAdmin.from('generated_images').delete().in('id', ids)

  console.log(`[cleanup] Removed ${expired.length} expired images`)
}

export async function expireCredits(): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc('rpc_expire_credits')
  if (error) {
    console.error('[cleanup] Credit expiry error:', error)
    return
  }
  if (data && Array.isArray(data) && data.length > 0) {
    console.log(`[cleanup] Expired credits: ${data.length} batch(es)`)
  }
}

import { Router } from 'express'
import { supabaseAdmin } from '../services/supabase.js'

const router = Router()

// GET /api/announcements — public, returns active announcements
router.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('announcements')
      .select('id, content, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data || [])
  } catch (err: any) {
    console.error('[announcements]', err)
    res.status(500).json({ error: '获取公告失败' })
  }
})

export default router

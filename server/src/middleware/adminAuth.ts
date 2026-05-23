import type { Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../services/supabase.js'

// Must be used after authMiddleware
export async function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = req.userId!
  const { data } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()

  if (!data || data.role !== 'admin') {
    res.status(403).json({ error: 'Admin required' })
    return
  }

  next()
}

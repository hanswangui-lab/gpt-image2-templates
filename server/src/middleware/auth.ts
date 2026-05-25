import type { Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../services/supabase.js'

declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' })
    return
  }

  const token = header.slice(7)
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !user) {
    res.status(401).json({ error: 'Invalid token' })
    return
  }

  // Check if user is disabled
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('disabled')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profile?.disabled) {
    res.status(403).json({ error: '账号已被禁用，请联系管理员' })
    return
  }

  req.userId = user.id
  next()
}

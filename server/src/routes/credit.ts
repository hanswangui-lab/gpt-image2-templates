import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { supabaseAdmin } from '../services/supabase.js'

const router = Router()

// GET /api/credit/balance — current user balance
router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('user_credits')
      .select('balance')
      .eq('user_id', req.userId!)
      .single()

    res.json({ balance: data?.balance ?? 0 })
  } catch (err: any) {
    console.error('[credit/balance]', err)
    res.status(500).json({ error: '查询余额失败' })
  }
})

// GET /api/credit/transactions — user's credit transaction history
router.get('/transactions', authMiddleware, async (req, res) => {
  const { type, limit, offset } = req.query

  try {
    const params = {
      p_user_id: req.userId!,
      p_type: type as string || null,
      p_limit: parseInt(limit as string) || 50,
      p_offset: parseInt(offset as string) || 0,
    }

    const { data, error } = await supabaseAdmin.rpc('rpc_get_credit_transactions', params)

    if (error) {
      console.error('[credit/transactions]', error)
      res.status(500).json({ error: '查询交易记录失败' })
      return
    }
    res.json(data)
  } catch (err: any) {
    console.error('[credit/transactions]', err)
    res.status(500).json({ error: '查询交易记录失败' })
  }
})

export default router

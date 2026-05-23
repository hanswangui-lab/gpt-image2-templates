import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { supabaseAdmin } from '../services/supabase.js'
import { createPayment, processCallback, processZhifuxpayCallback } from '../services/payment.js'
import { config } from '../config.js'

const router = Router()

// Rate limit: 5 payment creations per user per minute
const paymentLimiter = rateLimit({ max: 5, windowMs: 60_000, keyFn: (req) => req.userId || 'anon' })

// POST /api/payment/create — create a payment order, return Epay URL
router.post('/create', authMiddleware, paymentLimiter, async (req, res) => {
  const { credits, amountCents } = req.body

  if (!credits || !amountCents || credits < 1 || amountCents < 1) {
    res.status(400).json({ error: '参数不合法' })
    return
  }

  // Validate against known credit packs to prevent price tampering
  const validPack = config.validCreditPacks.find(
    (p) => p.credits === credits && p.priceCents === amountCents
  )
  if (!validPack) {
    res.status(400).json({ error: '无效的充值套餐' })
    return
  }

  try {
    const result = await createPayment(req.userId!, validPack.credits, validPack.priceCents)
    res.json(result)
  } catch (err: any) {
    console.error('[payment/create]', err)
    res.status(500).json({ error: '创建支付订单失败' })
  }
})

// GET/POST /api/payment/notify — Epay callback (public, no auth)
router.all('/notify', async (req, res) => {
  // Merge query and body params (Epay sends callback via GET)
  const params: Record<string, string> = { ...req.query as any, ...req.body as any }

  try {
    const result = await processCallback(params)
    if (result.success) {
      res.send('success')
    } else {
      res.status(400).send(result.message)
    }
  } catch (err: any) {
    console.error('[payment] Callback error', err)
    res.status(500).send('error')
  }
})

// GET/POST /api/zhifuxpay/notify — FM/Zhifuxpay callback (public, no auth)
// Sign: MD5(state + merchantNum + orderNo + amount + key)
router.all('/zhifuxpay/notify', async (req, res) => {
  const params: Record<string, string> = { ...req.query as any, ...req.body as any }

  try {
    const result = await processZhifuxpayCallback(params)
    res.send(result.message)
  } catch (err: any) {
    console.error('[zhifuxpay] Callback error:', err)
    res.status(500).send('fail')
  }
})

// GET /api/payment/orders — user's payment orders
router.get('/orders', authMiddleware, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('payment_orders')
    .select('*')
    .eq('user_id', req.userId!)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[payment/orders]', error)
    res.status(500).json({ error: '获取订单失败' })
    return
  }
  res.json(data)
})

export default router

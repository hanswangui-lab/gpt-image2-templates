import crypto from 'crypto'
import { supabaseAdmin } from './supabase.js'
import { config } from '../config.js'

/**
 * Build query string, sorted by key alphabetically (Epay standard)
 */
function buildQuery(params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort()
  return sorted.map((k) => `${k}=${params[k]}`).join('&')
}

/**
 * Generate MD5 sign: sorted params + key
 */
export function makeSign(params: Record<string, string>): string {
  const qs = buildQuery(params)
  return crypto.createHash('md5').update(qs + config.payment.key).digest('hex')
}

/**
 * Verify callback sign
 */
export function verifySign(params: Record<string, string>, sign: string): boolean {
  return makeSign(params) === sign
}

/**
 * Create a payment order and return Epay redirect URL
 */
export async function createPayment(userId: string, credits: number, amountCents: number) {
  const tradeNo = `GPT${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`

  // Insert pending order
  const { error: insertErr } = await supabaseAdmin
    .from('payment_orders')
    .insert({
      user_id: userId,
      trade_no: tradeNo,
      credits,
      amount_cents: amountCents,
      status: 'pending',
    })

  if (insertErr) throw new Error('创建订单失败')

  const amountYuan = (amountCents / 100).toFixed(2)
  const name = `${credits}积分充值`

  // Build Epay submit params
  const params: Record<string, string> = {
    pid: config.payment.pid,
    type: 'alipay',
    out_trade_no: tradeNo,
    notify_url: config.payment.notifyUrl,
    return_url: config.payment.returnUrl,
    name,
    money: amountYuan,
  }

  const sign = makeSign(params)

  // Build payment URL (standard Epay format: gateway/submit.php?params&sign=...)
  const qs = buildQuery(params)
  const payUrl = `${config.payment.gateway}/submit.php?${qs}&sign=${sign}&sign_type=MD5`

  return { tradeNo, payUrl }
}

/**
 * Process payment callback: verify sign, update order, add credits
 */
export async function processCallback(params: Record<string, string>) {
  const { sign, sign_type, ...rest } = params

  // 1. Verify signature
  if (!verifySign(rest, sign || '')) {
    console.error('[payment] Invalid signature', params)
    return { success: false, message: '签名验证失败' }
  }

  const tradeNo = rest.out_trade_no

  // 2. Check order
  const { data: order } = await supabaseAdmin
    .from('payment_orders')
    .select('*')
    .eq('trade_no', tradeNo)
    .single()

  if (!order) {
    console.error('[payment] Order not found', tradeNo)
    return { success: false, message: '订单不存在' }
  }

  // 3. Check trade status
  if (rest.trade_status !== 'TRADE_SUCCESS') {
    console.log('[payment] Trade not successful', tradeNo, rest.trade_status)
    return { success: false, message: '交易未成功' }
  }

  // 3a. Verify callback amount matches order
  const callbackAmountYuan = parseFloat(rest.money || '0')
  const orderAmountYuan = order.amount_cents / 100
  if (Math.abs(callbackAmountYuan - orderAmountYuan) > 0.01) {
    console.error('[payment] Amount mismatch', { callback: callbackAmountYuan, order: orderAmountYuan, tradeNo })
    return { success: false, message: '金额不一致' }
  }

  // 4. Already processed
  if (order.status === 'paid') {
    return { success: true, message: '已处理' }
  }

  // 5. Mark paid + add credits
  const { error: updateErr } = await supabaseAdmin
    .from('payment_orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      raw_callback: params,
    })
    .eq('trade_no', tradeNo)

  if (updateErr) {
    console.error('[payment] Update error', updateErr)
    return { success: false, message: '更新订单失败' }
  }

  // 6. Add credits with 30-day expiry
  const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60
  const { error: creditErr } = await supabaseAdmin.rpc('rpc_add_credits', {
    credit_user_id: order.user_id,
    credit_amount: order.credits,
    credit_source_type: 'recharge',
    credit_source_id: tradeNo,
    credit_expires_in_seconds: THIRTY_DAYS_SECONDS,
  })

  if (creditErr) {
    console.error('[payment] Credit error', creditErr)
    return { success: false, message: '加积分失败' }
  }

  console.log('[payment] Success', tradeNo, order.user_id, order.credits)
  return { success: true, message: 'success' }
}

/**
 * FM/Zhifuxpay callback processor
 * Sign rule: MD5(state + merchantNum + orderNo + amount + key)
 * state=1 means payment success
 */
export async function processZhifuxpayCallback(params: Record<string, string>) {
  const { state, merchantNum, orderNo, amount, sign } = params

  // 1. Verify state = 1 (payment success)
  if (state !== '1') {
    console.log('[zhifuxpay] state is not 1:', state)
    return { success: false, message: 'fail' }
  }

  // 2. Verify merchantNum matches our PID
  if (merchantNum !== config.payment.pid) {
    console.error('[zhifuxpay] Invalid merchantNum:', merchantNum)
    return { success: false, message: 'fail' }
  }

  // 3. Verify signature: MD5(state + merchantNum + orderNo + amount + key)
  const signStr = `${state}${merchantNum}${orderNo}${amount}${config.payment.key}`
  const expectedSign = crypto.createHash('md5').update(signStr).digest('hex')

  if (expectedSign !== sign?.toLowerCase()) {
    console.error('[zhifuxpay] Sign mismatch. Expected:', expectedSign, 'Got:', sign)
    return { success: false, message: 'fail' }
  }

  // 4. Find order by orderNo (trade_no)
  const { data: order } = await supabaseAdmin
    .from('payment_orders')
    .select('*')
    .eq('trade_no', orderNo)
    .single()

  if (!order) {
    console.error('[zhifuxpay] Order not found:', orderNo)
    return { success: false, message: 'fail' }
  }

  // 4a. Verify callback amount matches order
  const callbackAmountYuan = parseFloat(amount || '0')
  const orderAmountYuan = order.amount_cents / 100
  if (Math.abs(callbackAmountYuan - orderAmountYuan) > 0.01) {
    console.error('[zhifuxpay] Amount mismatch', { callback: callbackAmountYuan, order: orderAmountYuan, orderNo })
    return { success: false, message: 'fail' }
  }

  // 5. Already processed
  if (order.status === 'paid') {
    return { success: true, message: 'success' }
  }

  // 6. Mark paid
  const { error: updateErr } = await supabaseAdmin
    .from('payment_orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      raw_callback: params,
    })
    .eq('trade_no', orderNo)

  if (updateErr) {
    console.error('[zhifuxpay] Update error:', updateErr)
    return { success: false, message: 'fail' }
  }

  // 7. Add credits with 30-day expiry
  const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60
  const { error: creditErr } = await supabaseAdmin.rpc('rpc_add_credits', {
    credit_user_id: order.user_id,
    credit_amount: order.credits,
    credit_source_type: 'recharge',
    credit_source_id: orderNo,
    credit_expires_in_seconds: THIRTY_DAYS_SECONDS,
  })

  if (creditErr) {
    console.error('[zhifuxpay] Credit error:', creditErr)
    return { success: false, message: 'fail' }
  }

  console.log('[zhifuxpay] Success', orderNo, order.user_id, order.credits)
  return { success: true, message: 'success' }
}

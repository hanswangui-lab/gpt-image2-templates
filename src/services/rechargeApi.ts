import { supabase } from '../lib/supabase'

export async function submitRecharge(params: {
  credits: number
  amountCents: number
  afdianOrderId: string
  proofScreenshotUrl?: string
}) {
  const { data, error } = await supabase.rpc('rpc_submit_recharge', {
    p_credits: params.credits,
    p_amount_cents: params.amountCents,
    p_afdian_order_id: params.afdianOrderId,
    p_proof_screenshot_url: params.proofScreenshotUrl || null,
  })

  if (error) throw new Error(error.message)
  return data as string
}

export async function getMyRechargeOrders() {
  const { data, error } = await supabase
    .from('recharge_orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

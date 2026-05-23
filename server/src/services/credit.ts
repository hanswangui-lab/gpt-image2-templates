import { supabaseAdmin } from './supabase.js'

const MODEL_COST: Record<string, number> = {
  'gpt-image-2': 3,
  'gpt-image-2-2K': 5,
  'gpt-image-2-4K': 10,
}

export function getCreditCost(model: string): number {
  return MODEL_COST[model] || 1
}

export async function consumeCredits(userId: string, amount: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('rpc_consume_credits', {
    credit_user_id: userId,
    credit_amount: amount,
  })
  if (error) throw error
  return data as boolean
}

export async function refundCredits(userId: string, amount: number, referenceId?: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc('rpc_refund_credits', {
    refund_user_id: userId,
    refund_amount: amount,
    refund_reference_id: referenceId || null,
  })
  if (error) throw error
}

export async function getBalance(userId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('user_credits')
    .select('balance')
    .eq('user_id', userId)
    .single()
  return data?.balance ?? 0
}

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
  // Direct balance update (avoids credit_batches constraint on rpc_add_credits)
  const { data: bal } = await supabaseAdmin
    .from('user_credits')
    .select('balance')
    .eq('user_id', userId)
    .single()
  const newBalance = (bal?.balance ?? 0) + amount
  const { error: updateErr } = await supabaseAdmin
    .from('user_credits')
    .upsert({ user_id: userId, balance: newBalance })
  if (updateErr) throw updateErr
  const { error: txErr } = await supabaseAdmin
    .from('credit_transactions')
    .insert({
      user_id: userId,
      amount,
      type: 'refund',
      reference_type: 'refund',
      reference_id: referenceId || null,
      balance_after: newBalance,
    })
  if (txErr) throw txErr
}

export async function getBalance(userId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('user_credits')
    .select('balance')
    .eq('user_id', userId)
    .single()
  return data?.balance ?? 0
}

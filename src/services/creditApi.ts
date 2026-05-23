import { supabase } from '../lib/supabase'
import { config } from '../lib/config'

async function getToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token
}

async function safeJson(res: Response) {
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('text/html')) {
    throw new Error('服务器返回了网页而非 API 数据。请检查 VPS 服务。')
  }
  try { return await res.json() } catch {
    const text = (await res.text().catch(() => '')).slice(0, 200)
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html') || text.startsWith('<!doctype')) {
      throw new Error('API 地址返回了网页。请检查 VITE_VPS_API_URL 配置。')
    }
    throw new Error(text || '无法解析服务器响应')
  }
}

export interface CreditTransaction {
  id: string
  user_id: string
  amount: number
  type: string
  reference_type: string | null
  reference_id: string | null
  balance_after: number
  created_at: string
}

export async function getBalance(): Promise<number> {
  const token = await getToken()
  const res = await fetch(`${config.vpsApiUrl}/api/credit/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => { throw new Error('无法连接到 VPS 服务器') })
  if (!res.ok) {
    const data = await safeJson(res).catch(() => ({}))
    throw new Error(data.error || '获取积分余额失败')
  }
  const data = await safeJson(res)
  return data.balance
}

export async function getCreditTransactions(params?: {
  type?: string
  limit?: number
  offset?: number
}): Promise<CreditTransaction[]> {
  const token = await getToken()
  const searchParams = new URLSearchParams()
  if (params?.type) searchParams.set('type', params.type)
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))

  const qs = searchParams.toString()
  const res = await fetch(`${config.vpsApiUrl}/api/credit/transactions${qs ? '?' + qs : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => { throw new Error('无法连接到 VPS 服务器') })
  if (!res.ok) throw new Error('获取积分明细失败')
  return safeJson(res)
}

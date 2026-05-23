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

export async function createPayment(credits: number, amountCents: number): Promise<{ tradeNo: string; payUrl: string }> {
  const token = await getToken()
  const res = await fetch(`${config.vpsApiUrl}/api/payment/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ credits, amountCents }),
  }).catch(() => { throw new Error('无法连接到 VPS 服务器') })
  if (!res.ok) {
    const err = await safeJson(res).catch(() => ({ error: '请求失败' }))
    throw new Error(err.error || '请求失败')
  }
  return safeJson(res)
}

export async function getPaymentOrders() {
  const token = await getToken()
  const res = await fetch(`${config.vpsApiUrl}/api/payment/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => { throw new Error('无法连接到 VPS 服务器') })
  if (!res.ok) throw new Error('获取订单失败')
  return safeJson(res)
}

import { config } from '../lib/config'

async function safeJson(res: Response) {
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('text/html')) {
    throw new Error('服务器返回了网页而非 API 数据')
  }
  try { return await res.json() } catch {
    const text = (await res.text().catch(() => '')).slice(0, 200)
    throw new Error(text || '无法解析服务器响应')
  }
}

export async function sendVerificationCode(email: string) {
  const res = await fetch(`${config.vpsApiUrl}/api/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).catch(() => { throw new Error('无法连接到服务器') })
  if (!res.ok) {
    const err = await safeJson(res).catch(() => ({ error: '请求失败' }))
    throw new Error(err.error || '请求失败')
  }
  return safeJson(res)
}

export async function registerWithCode(params: {
  username: string
  password: string
  email: string
  code: string
}) {
  const res = await fetch(`${config.vpsApiUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).catch(() => { throw new Error('无法连接到服务器') })
  if (!res.ok) {
    const err = await safeJson(res).catch(() => ({ error: '请求失败' }))
    throw new Error(err.error || '请求失败')
  }
  return safeJson(res)
}

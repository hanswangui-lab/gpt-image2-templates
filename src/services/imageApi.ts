import { supabase } from '../lib/supabase'
import { config } from '../lib/config'

export interface GenerateResult {
  taskId: string
}

export interface TaskStatus {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  imageUrl: string | null
  error: string | null
}

async function safeJson(res: Response) {
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('text/html')) {
    throw new Error(`服务器返回了网页而非 API 数据。请检查 VPS 服务是否正常运行。`)
  }
  try {
    return await res.json()
  } catch {
    const text = (await res.text().catch(() => '')).slice(0, 200)
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html') || text.startsWith('<!doctype')) {
      throw new Error('API 地址返回了网页而非 JSON。请检查 VITE_VPS_API_URL 配置。')
    }
    throw new Error(text || '无法解析服务器响应')
  }
}

export async function generateImage(params: {
  templateId?: string
  prompt: string
  model?: string
  aspectRatio?: string
  cost?: number
}): Promise<GenerateResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('请先登录')

  let res: Response
  try {
    res = await fetch(`${config.vpsApiUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        prompt: params.prompt,
        templateId: params.templateId,
        model: params.model || 'gpt-image-2',
        aspectRatio: params.aspectRatio || '1:1',
        cost: params.cost,
      }),
    })
  } catch (err: any) {
    throw new Error(`无法连接到 VPS 服务器: ${err.message}`)
  }

  if (!res.ok) {
    const data = await safeJson(res).catch(() => ({}))
    if (res.status === 402) throw new Error('积分不足，请先充值')
    throw new Error(data.error || `服务器错误 (${res.status})`)
  }

  return safeJson(res)
}

export async function pollTask(taskId: string): Promise<TaskStatus> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('请先登录')

  const res = await fetch(`${config.vpsApiUrl}/api/generate/task/${taskId}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  }).catch(() => { throw new Error('无法连接到 VPS 服务器') })

  if (!res.ok) {
    const data = await safeJson(res).catch(() => ({}))
    throw new Error(data.error || `查询任务状态失败 (${res.status})`)
  }

  return safeJson(res)
}

export interface PendingGeneration {
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed'
  imageId?: string
  imageUrl?: string | null
  error?: string | null
}

export async function getPendingGeneration(): Promise<PendingGeneration> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return { status: 'idle' }

  const res = await fetch(`${config.vpsApiUrl}/api/generate/pending`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  }).catch(() => null)
  if (!res) return { status: 'idle' }

  if (!res.ok) return { status: 'idle' }
  return safeJson(res).catch(() => ({ status: 'idle' as const }))
}

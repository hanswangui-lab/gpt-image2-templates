import { getSetting } from './settings.js'

interface GenerateResult {
  imageUrl?: string
  externalTaskId?: string
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getApiConfig() {
  return {
    url: getSetting('bestapi_url'),
    key: getSetting('bestapi_key'),
  }
}

function fmtUrl(u: string) { return u.length > 70 ? u.slice(0, 70) + '...' : u }

export async function callBestApi(prompt: string, model: string, aspectRatio: string): Promise<GenerateResult> {
  const { url, key } = getApiConfig()
  if (!url || !key) throw new Error('API 未配置，请在管理后台设置')

  const t0 = Date.now()
  console.log('[bestapi] Request start', { url: url.slice(0, 60), model, aspectRatio, promptLen: prompt.length })

  const body = {
    model,
    prompt,
    n: 1,
    size: aspectRatioToSize(aspectRatio, model),
  }

  const maxRetries = 2
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const wait = attempt * 5
      console.log('[bestapi] Retry attempt', attempt, 'after', wait, 's')
      await sleep(wait * 1000)
    }

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      })
    } catch (err: any) {
      lastError = err
      console.error('[bestapi] Fetch error (attempt', attempt, '):', err.cause?.code || err.code || err.message)
      continue
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[bestapi] HTTP', res.status, 'attempt', attempt, text.slice(0, 300))
      if (res.status === 401 || res.status === 403) throw new Error(`API Key 无效 (${res.status}) [${fmtUrl(url)}]`)
      if (res.status === 404) throw new Error(`API 地址不存在 (404) [${fmtUrl(url)}]`)
      if (res.status >= 500 && attempt < maxRetries) {
        lastError = new Error(`API 服务器错误 (${res.status}) [${fmtUrl(url)}]`)
        continue
      }
      if (res.status >= 500) throw new Error(`API 服务器错误 (${res.status}) [${fmtUrl(url)}]`)
      let detail = text
      try {
        const j = JSON.parse(text)
        detail = j.error?.message || j.error || j.message || text
      } catch {}
      throw new Error(detail?.slice(0, 200) || `API 请求失败 (${res.status}) [${fmtUrl(url)}]`)
    }

    const data = await res.json().catch((err: Error) => {
      throw new Error(`API 返回数据格式异常: ${err.message}`)
    })

    // OpenAI-compatible sync response: { created, data: [{ url }] }
    if (data.data && Array.isArray(data.data) && data.data[0]?.url) {
      const imageUrl = data.data[0].url
      console.log('[bestapi] Sync completed in', ((Date.now() - t0) / 1000).toFixed(1), 's')
      return { imageUrl }
    }

    // Async task: already completed
    const taskId = data.id
    const taskStatus = data.status

    if (taskStatus === 'completed') {
      const imageUrl = data.video_url
      if (imageUrl) {
        console.log('[bestapi] Sync completed in', ((Date.now() - t0) / 1000).toFixed(1), 's')
        return { imageUrl }
      }
    }

    if (taskStatus === 'failed') {
      throw new Error(data.error?.message || data.error_message || '生成失败')
    }

    // Async task: return externalTaskId, let frontend-driven polling resolve it
    if (taskId && ['queued', 'in_progress', 'processing'].includes(taskStatus)) {
      console.log('[bestapi] Async task created', taskId, 'status:', taskStatus)
      return { externalTaskId: taskId }
    }

    const keys = Object.keys(data).slice(0, 10).join(', ')
    console.error('[bestapi] Unrecognized response:', keys, JSON.stringify(data).slice(0, 300))
    throw new Error('API 返回格式不匹配')
  }

  throw lastError || new Error('API 请求失败')
}

export async function pollExternalTask(externalTaskId: string): Promise<{
  status: 'pending' | 'completed' | 'failed'
  imageUrl?: string
  error?: string
}> {
  const { url, key } = getApiConfig()
  if (!url || !key) return { status: 'pending' }

  const pollUrl = `${url.replace(/\/$/, '')}/${externalTaskId}`

  let res: Response
  try {
    res = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    return { status: 'pending' }
  }

  if (!res.ok) return { status: 'pending' }

  let data: any
  try {
    data = await res.json()
  } catch {
    return { status: 'pending' }
  }

  if (data.status === 'completed') {
    const imageUrl = data.video_url
    if (imageUrl) return { status: 'completed', imageUrl }
    return { status: 'failed', error: '任务已完成但未返回图片地址' }
  }

  if (data.status === 'failed') {
    return { status: 'failed', error: data.error?.message || '生成失败' }
  }

  return { status: 'pending' }
}

const SIZE_TABLE: Record<string, Record<string, string>> = {
  '1:1':  { 'gpt-image-2': '1024x1024', 'gpt-image-2-2K': '2048x2048', 'gpt-image-2-4K': '2880x2880' },
  '3:4':  { 'gpt-image-2': '768x1024',  'gpt-image-2-2K': '1536x2048', 'gpt-image-2-4K': '2400x3200' },
  '4:3':  { 'gpt-image-2': '1024x768',  'gpt-image-2-2K': '2048x1536', 'gpt-image-2-4K': '3200x2400' },
  '9:16': { 'gpt-image-2': '720x1280',  'gpt-image-2-2K': '1440x2560', 'gpt-image-2-4K': '2160x3840' },
  '16:9': { 'gpt-image-2': '1280x720',  'gpt-image-2-2K': '2560x1440', 'gpt-image-2-4K': '3840x2160' },
  '2:3':  { 'gpt-image-2': '1024x1536', 'gpt-image-2-2K': '1440x2160', 'gpt-image-2-4K': '2304x3456' },
  '3:2':  { 'gpt-image-2': '1536x1024', 'gpt-image-2-2K': '2160x1440', 'gpt-image-2-4K': '3456x2304' },
}

function aspectRatioToSize(ratio: string, model: string): string {
  return SIZE_TABLE[ratio]?.[model] || SIZE_TABLE['1:1']['gpt-image-2']
}

import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { authMiddleware } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { consumeCredits, refundCredits, getCreditCost } from '../services/credit.js'
import { callBestApi, pollExternalTask } from '../services/bestapi.js'
import { supabaseAdmin } from '../services/supabase.js'
import { config } from '../config.js'

const router = Router()

const generateLimiter = rateLimit({ max: 10, windowMs: 60_000, keyFn: (req) => req.userId || 'anon' })

async function downloadAndSaveImage(taskId: string, userId: string, imageUrl: string) {
  let storagePath = ''
  try {
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(60_000) })
    if (!imgRes.ok) throw new Error('Failed to download image')
    const buffer = Buffer.from(await imgRes.arrayBuffer())

    const userDir = path.join(config.imagesDir, userId)
    await fs.promises.mkdir(userDir, { recursive: true })

    storagePath = `${userId}/${taskId}.png`
    await fs.promises.writeFile(path.join(config.imagesDir, storagePath), buffer)

    const localUrl = `${config.imageBaseUrl}/images/${storagePath}`
    await supabaseAdmin
      .from('generated_images')
      .update({ status: 'completed', image_url: localUrl, storage_path: storagePath })
      .eq('id', taskId)
    console.log('[generate] Image saved locally for task', taskId)
  } catch (err: any) {
    console.error('[generate] Local storage error:', err.message)
    await supabaseAdmin
      .from('generated_images')
      .update({ status: 'failed', error_message: `图片保存失败: ${err.message}` })
      .eq('id', taskId)
    throw err
  }
}

async function processGeneration(taskId: string, userId: string, prompt: string, model: string, aspectRatio: string, creditCost: number) {
  await supabaseAdmin
    .from('generated_images')
    .update({ status: 'processing' })
    .eq('id', taskId)

  let result: { imageUrl?: string; externalTaskId?: string }
  try {
    const tApiStart = Date.now()
    result = await callBestApi(prompt, model, aspectRatio)
    console.log('[generate] API call returned in', ((Date.now() - tApiStart) / 1000).toFixed(1), 's')
  } catch (err: any) {
    console.error('[generate] BestAPI error:', err.message)
    await supabaseAdmin
      .from('generated_images')
      .update({ status: 'failed', error_message: err.message })
      .eq('id', taskId)
    await refundCredits(userId, creditCost)
    return
  }

  // Sync path: image URL available immediately
  if (result.imageUrl) {
    try {
      await downloadAndSaveImage(taskId, userId, result.imageUrl)
    } catch {
      await refundCredits(userId, creditCost)
    }
    return
  }

  // Async path: store externalTaskId, let frontend-driven polling resolve
  if (result.externalTaskId) {
    const { data: existing } = await supabaseAdmin
      .from('generated_images').select('params').eq('id', taskId).single()
    const updatedParams = { ...(existing?.params || {}), externalTaskId: result.externalTaskId }
    await supabaseAdmin
      .from('generated_images')
      .update({ params: updatedParams })
      .eq('id', taskId)
    console.log('[generate] Async task stored', result.externalTaskId, 'for', taskId)
    return
  }
}

router.post('/', authMiddleware, generateLimiter, async (req, res) => {
  const userId = req.userId!
  const { prompt, templateId, model, aspectRatio, cost } = req.body

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
    res.status(400).json({ error: '提示词不能为空或过短' })
    return
  }
  if (prompt.length > 3000) {
    res.status(400).json({ error: '提示词过长，最多 3000 字' })
    return
  }

  const modelStr = model || 'gpt-image-2'
  const ratioStr = aspectRatio || '1:1'
  const creditCost = typeof cost === 'number' && cost > 0 ? cost : getCreditCost(modelStr)

  // 1. Create record first
  const { data: record, error: insertErr } = await supabaseAdmin
    .from('generated_images')
    .insert({
      user_id: userId,
      template_id: templateId || null,
      prompt: prompt.trim(),
      params: { model: modelStr, aspectRatio: ratioStr, creditCost },
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertErr || !record) {
    res.status(500).json({ error: '创建生成记录失败' })
    return
  }

  // 2. Consume credits (atomic RPC)
  const hasCredits = await consumeCredits(userId, creditCost)
  if (!hasCredits) {
    await supabaseAdmin
      .from('generated_images')
      .update({ status: 'failed', error_message: '积分不足' })
      .eq('id', record.id)
    res.status(402).json({ error: '积分不足，请先充值' })
    return
  }

  // 3. Start async generation
  processGeneration(record.id, userId, prompt.trim(), modelStr, ratioStr, creditCost)

  // 4. Return task ID immediately
  res.json({ taskId: record.id })
})

// GET /api/generate/pending — check for in-progress generation
router.get('/pending', authMiddleware, async (req, res) => {
  const userId = req.userId!

  const staleCutoff = new Date(Date.now() - 6 * 60 * 1000).toISOString()

  // Find stale tasks BEFORE marking them, so we know the credit cost
  const { data: staleTasks } = await supabaseAdmin
    .from('generated_images')
    .select('id, params')
    .eq('user_id', userId)
    .in('status', ['pending', 'processing'])
    .lt('created_at', staleCutoff)

  if (staleTasks && staleTasks.length > 0) {
    await supabaseAdmin
      .from('generated_images')
      .update({ status: 'failed', error_message: '任务超时' })
      .eq('user_id', userId)
      .in('status', ['pending', 'processing'])
      .lt('created_at', staleCutoff)

    for (const task of staleTasks) {
      const cost = (task.params as any)?.creditCost || getCreditCost('gpt-image-2')
      await refundCredits(userId, cost).catch((err) => console.error('[generate] Refund error on stale:', err.message))
    }
    console.log('[generate] Refunded', staleTasks.length, 'stale tasks for user', userId)
  }

  const { data } = await supabaseAdmin
    .from('generated_images')
    .select('id, status, image_url, error_message')
    .eq('user_id', userId)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!data) {
    res.json({ status: 'idle' })
    return
  }

  res.json({
    status: data.status,
    imageId: data.id,
    imageUrl: data.image_url || null,
    error: data.error_message || null,
  })
})

// GET /api/task/:taskId — poll for generation status; drives async third-party resolution
router.get('/task/:taskId', authMiddleware, async (req, res) => {
  const userId = req.userId!
  const { taskId } = req.params

  const { data } = await supabaseAdmin
    .from('generated_images')
    .select('id, status, image_url, error_message, params')
    .eq('id', taskId)
    .eq('user_id', userId)
    .single()

  if (!data) {
    res.status(404).json({ error: '任务不存在' })
    return
  }

  // Drive async third-party task resolution
  if (data.status === 'processing') {
    const externalTaskId = (data.params as any)?.externalTaskId
    const creditCost = (data.params as any)?.creditCost || getCreditCost('gpt-image-2')

    if (externalTaskId) {
      const pollResult = await pollExternalTask(externalTaskId)

      if (pollResult.status === 'completed' && pollResult.imageUrl) {
        try {
          await downloadAndSaveImage(data.id, userId, pollResult.imageUrl)
          const { data: updated } = await supabaseAdmin
            .from('generated_images')
            .select('id, status, image_url, error_message')
            .eq('id', taskId).single()
          if (updated) {
            res.json({ taskId: updated.id, status: updated.status, imageUrl: updated.image_url, error: updated.error_message })
            return
          }
        } catch {
          await refundCredits(userId, creditCost)
          res.json({ taskId: data.id, status: 'failed', imageUrl: null, error: '图片保存失败' })
          return
        }
      } else if (pollResult.status === 'failed') {
        await supabaseAdmin
          .from('generated_images')
          .update({ status: 'failed', error_message: pollResult.error || '生成失败' })
          .eq('id', taskId)
        await refundCredits(userId, creditCost)
        res.json({ taskId: data.id, status: 'failed', imageUrl: null, error: pollResult.error || '生成失败' })
        return
      }
      // still pending — fall through to return current status
    }
  }

  res.json({
    taskId: data.id,
    status: data.status,
    imageUrl: data.image_url || null,
    error: data.error_message || null,
  })
})

export default router

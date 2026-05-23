import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { authMiddleware } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { consumeCredits, refundCredits, getCreditCost } from '../services/credit.js'
import { callBestApi } from '../services/bestapi.js'
import { supabaseAdmin } from '../services/supabase.js'
import { config } from '../config.js'

const router = Router()

// Rate limit: 10 generation requests per user per minute
const generateLimiter = rateLimit({ max: 10, windowMs: 60_000, keyFn: (req) => req.userId || 'anon' })

async function processGeneration(taskId: string, userId: string, prompt: string, model: string, aspectRatio: string, creditCost: number) {
  await supabaseAdmin
    .from('generated_images')
    .update({ status: 'processing' })
    .eq('id', taskId)

  let imageUrl: string
  try {
    const tApiStart = Date.now()
    const result = await callBestApi(prompt, model, aspectRatio)
    console.log('[generate] API call returned in', ((Date.now() - tApiStart) / 1000).toFixed(1), 's')
    imageUrl = result.imageUrl
  } catch (err: any) {
    console.error('[generate] BestAPI error:', err.message)
    await supabaseAdmin
      .from('generated_images')
      .update({ status: 'failed', error_message: err.message })
      .eq('id', taskId)
    await refundCredits(userId, creditCost)
    return
  }

  // Download and save to local VPS storage
  let storagePath = ''
  try {
    const tDlStart = Date.now()
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) throw new Error('Failed to download image')
    const buffer = Buffer.from(await imgRes.arrayBuffer())

    const userDir = path.join(config.imagesDir, userId)
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true })

    storagePath = `${userId}/${taskId}.png`
    fs.writeFileSync(path.join(config.imagesDir, storagePath), buffer)

    imageUrl = `${config.imageBaseUrl}/images/${storagePath}`
    console.log('[generate] Image saved locally in', ((Date.now() - tDlStart) / 1000).toFixed(1), 's')
  } catch (err: any) {
    console.error('[generate] Local storage error:', err.message)
    storagePath = ''
  }

  await supabaseAdmin
    .from('generated_images')
    .update({ status: 'completed', image_url: imageUrl, storage_path: storagePath })
    .eq('id', taskId)
  console.log('[generate] DB updated to completed for task', taskId)
}

router.post('/', authMiddleware, generateLimiter, async (req, res) => {
  const userId = req.userId!
  const { prompt, templateId, model, aspectRatio, cost } = req.body

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
    res.status(400).json({ error: '提示词不能为空或过短' })
    return
  }
  if (prompt.length > 2000) {
    res.status(400).json({ error: '提示词过长，最多 2000 字' })
    return
  }

  const modelStr = model || 'gpt-image-2'
  const ratioStr = aspectRatio || '1:1'
  const creditCost = typeof cost === 'number' && cost > 0 ? cost : getCreditCost(modelStr)

  // 1. Create record first (so crash between consume and insert won't lose credits)
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
    // Mark record as failed, no need to refund since credits weren't deducted
    await supabaseAdmin
      .from('generated_images')
      .update({ status: 'failed', error_message: '积分不足' })
      .eq('id', record.id)
    res.status(402).json({ error: '积分不足，请先充值' })
    return
  }

  // 3. Start async generation (don't await)
  processGeneration(record.id, userId, prompt.trim(), modelStr, ratioStr, creditCost)

  // 4. Return task ID immediately
  res.json({ taskId: record.id })
})

// GET /api/generate/pending — check for in-progress generation (for refresh persistence)
router.get('/pending', authMiddleware, async (req, res) => {
  const userId = req.userId!

  // Mark stale pending/processing tasks (older than 6 min) as failed
  const staleCutoff = new Date(Date.now() - 6 * 60 * 1000).toISOString()
  await supabaseAdmin
    .from('generated_images')
    .update({ status: 'failed', error_message: '任务超时' })
    .eq('user_id', userId)
    .in('status', ['pending', 'processing'])
    .lt('created_at', staleCutoff)

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

// GET /api/task/:taskId — poll for generation status
router.get('/task/:taskId', authMiddleware, async (req, res) => {
  const userId = req.userId!
  const { taskId } = req.params

  const { data } = await supabaseAdmin
    .from('generated_images')
    .select('id, status, image_url, error_message')
    .eq('id', taskId)
    .eq('user_id', userId)
    .single()

  if (!data) {
    res.status(404).json({ error: '任务不存在' })
    return
  }

  res.json({
    taskId: data.id,
    status: data.status,
    imageUrl: data.image_url || null,
    error: data.error_message || null,
  })
})

export default router

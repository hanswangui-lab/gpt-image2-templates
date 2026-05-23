import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { adminMiddleware } from '../middleware/adminAuth.js'
import { supabaseAdmin } from '../services/supabase.js'

const router = Router()

// All admin routes require auth + admin role
router.use(authMiddleware, adminMiddleware)

// GET /api/admin/users - list all users
router.get('/users', async (_req, res) => {
  try {
    const { data: users, error } = await supabaseAdmin.rpc('rpc_admin_list_users')
    if (error) throw error
    res.json(users)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/disable-user - disable or enable a user
router.post('/disable-user', async (req, res) => {
  const { userId, disabled } = req.body
  if (!userId || typeof disabled !== 'boolean') {
    res.status(400).json({ error: 'userId and disabled are required' })
    return
  }

  try {
    const { error } = await supabaseAdmin.rpc('rpc_admin_disable_user', {
      p_user_id: userId,
      p_disabled: disabled,
    })
    if (error) throw error
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/delete-user - delete a user and all their data
router.post('/delete-user', async (req, res) => {
  const { userId } = req.body
  if (!userId) {
    res.status(400).json({ error: 'userId is required' })
    return
  }

  try {
    // 1. Clean up storage files for this user's generated images
    const { data: images } = await supabaseAdmin
      .from('generated_images')
      .select('storage_path')
      .eq('user_id', userId)
      .not('storage_path', 'is', null)

    if (images && images.length > 0) {
      const paths = images
        .map((i) => i.storage_path)
        .filter(Boolean) as string[]
      if (paths.length > 0) {
        await supabaseAdmin.storage.from('generated-images').remove(paths)
      }
    }

    // 2. Delete from auth.users (cascades to all related tables via FK)
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteErr) throw deleteErr

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/admin/payment-orders — all payment orders with username, paginated
router.get('/payment-orders', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1
  const pageSize = parseInt(req.query.pageSize as string) || 10
  const offset = (page - 1) * pageSize

  try {
    const { count } = await supabaseAdmin
      .from('payment_orders')
      .select('*', { count: 'exact', head: true })

    const { data, error } = await supabaseAdmin
      .from('payment_orders')
      .select('id, trade_no, credits, amount_cents, status, created_at, paid_at, user_id')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    // Fetch usernames and emails
    const userIds = [...new Set(data.map((o: any) => o.user_id))]
    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, username')
      .in('user_id', userIds)

    const usernameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.username]))

    // Get emails from auth — fetch individually per user for reliability
    const emailMap = new Map<string, string>()
    await Promise.all(
      userIds.map(async (uid: string) => {
        try {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(uid)
          if (userData?.user?.email) emailMap.set(uid, userData.user.email)
        } catch {
          // skip
        }
      }),
    )

    const orders = data.map((o: any) => ({
      ...o,
      username: usernameMap.get(o.user_id) || emailMap.get(o.user_id) || o.user_id?.slice(0, 8) || '—',
      email: emailMap.get(o.user_id) || '',
    }))

    res.json({ orders, total: count || 0 })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/admin/announcements — list all announcements (active + inactive)
router.get('/announcements', async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('announcements')
      .select('id, content, is_active, created_by, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data || [])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/announcements — create announcement
router.post('/announcements', async (req, res) => {
  const { content } = req.body
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    res.status(400).json({ error: 'content is required' })
    return
  }
  if (content.trim().length > 100) {
    res.status(400).json({ error: '公告内容不能超过 100 字' })
    return
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('announcements')
      .insert({
        content: content.trim(),
        created_by: (req as any).userId,
      })
      .select('id, content, created_at')
      .single()

    if (error) throw error
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/admin/announcements/:id — delete announcement
router.delete('/announcements/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('announcements')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/announcements/:id/activate — activate announcement
router.post('/announcements/:id/activate', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('announcements')
      .update({ is_active: true })
      .eq('id', req.params.id)

    if (error) throw error
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/announcements/:id/deactivate — deactivate announcement
router.post('/announcements/:id/deactivate', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('announcements')
      .update({ is_active: false })
      .eq('id', req.params.id)

    if (error) throw error
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/admin/settings — get all settings
router.get('/settings', async (_req, res) => {
  try {
    const { getAllSettings } = await import('../services/settings.js')
    res.json(getAllSettings())
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/admin/settings — update settings
router.put('/settings', async (req, res) => {
  const { settings } = req.body
  if (!settings || typeof settings !== 'object') {
    res.status(400).json({ error: 'settings object is required' })
    return
  }

  try {
    const { updateSettings } = await import('../services/settings.js')
    await updateSettings(settings)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/test-api — test the API connection
router.post('/test-api', async (req, res) => {
  try {
    const { getSetting } = await import('../services/settings.js')
    const url = getSetting('bestapi_url')
    const key = getSetting('bestapi_key')

    if (!url || !key) {
      res.json({ ok: false, error: 'API 地址或 Key 未配置，请先在 .env 或管理后台设置' })
      return
    }

    const t0 = Date.now()
    let status: number, body: string, ct: string
    try {
      const apiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: 'gpt-image-2', prompt: 'test connection', metadata: { aspect_ratio: '1:1', urls: [] } }),
        signal: AbortSignal.timeout(15_000),
      })
      status = apiRes.status
      ct = (apiRes.headers.get('content-type') || '').toLowerCase()
      body = (await apiRes.text().catch(() => '')).slice(0, 500)
    } catch (err: any) {
      const msg = err.name === 'TimeoutError' ? '连接超时 (15s)，API 地址可能不可达' : `网络错误: ${err.message}`
      res.json({ ok: false, error: msg, latencyMs: Date.now() - t0 })
      return
    }

    const latencyMs = Date.now() - t0
    const isHtml = ct.includes('text/html') || body.startsWith('<!DOCTYPE') || body.startsWith('<html') || body.startsWith('<!doctype')

    if ((status === 200 || status === 201 || status === 202) && !isHtml) {
      res.json({ ok: true, status, latencyMs, detail: `HTTP ${status}`, testedUrl: url.slice(0, 80) })
    } else if (isHtml) {
      res.json({ ok: false, error: `API 地址返回了网页 (HTTP ${status})，请确认 URL 是正确的 API 端点而非网站首页`, status, latencyMs, testedUrl: url.slice(0, 80) })
    } else if (status === 401 || status === 403) {
      res.json({ ok: false, error: `鉴权失败 (HTTP ${status})，API Key 无效`, status, latencyMs, testedUrl: url.slice(0, 80) })
    } else if (status === 404) {
      res.json({ ok: false, error: `API 地址不存在 (HTTP 404)，请检查 URL`, status, latencyMs, testedUrl: url.slice(0, 80) })
    } else {
      res.json({ ok: false, error: `API 返回错误 (HTTP ${status})`, status, latencyMs, detail: body.slice(0, 200), testedUrl: url.slice(0, 80) })
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router

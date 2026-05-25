import { Router } from 'express'
import nodemailer from 'nodemailer'
import { supabaseAdmin } from '../services/supabase.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { config } from '../config.js'

const router = Router()

// SMTP transporter from env config
const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
})

// In-memory verification code store
interface CodeEntry { code: string; expiresAt: number; attempts?: number }
const codes = new Map<string, CodeEntry>()

// Clean expired codes every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [email, entry] of codes) {
    if (now > entry.expiresAt) codes.delete(email)
  }
}, 5 * 60 * 1000)

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// Rate limit: 3 codes per email per 60 seconds
const sendCodeLimiter = rateLimit({ max: 3, windowMs: 60_000, keyFn: (req) => req.body?.email || req.ip || 'anon' })

// Rate limit: 5 registrations per IP per hour
const registerLimiter = rateLimit({ max: 5, windowMs: 60 * 60_000, keyFn: (req) => req.ip || 'anon' })

router.post('/send-code', sendCodeLimiter, async (req, res) => {
  const { email } = req.body
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: '请输入有效的邮箱地址' })
    return
  }

  // Rate limit per email (60s cooldown)
  const existing = codes.get(email)
  if (existing && Date.now() - (existing.expiresAt - 10 * 60 * 1000) < 60_000) {
    res.status(429).json({ error: '发送过于频繁，请 60 秒后再试' })
    return
  }

  const code = generateCode()
  codes.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 })

  try {
    await transporter.sendMail({
      from: `"GPT Image 2" <${config.smtp.user}>`,
      to: email,
      subject: 'GPT Image 2 邮箱验证码',
      text: `您的验证码是：${code}\n\n有效期 10 分钟。如非本人操作，请忽略。`,
    })
    console.log('[auth] Code sent to', email)
    res.json({ success: true })
  } catch (err: any) {
    codes.delete(email)
    console.error('[auth] Failed to send:', err.message)
    res.status(500).json({ error: '发送验证码失败，请稍后重试' })
  }
})

router.post('/register', registerLimiter, async (req, res) => {
  const { username, password, email, code } = req.body

  if (!username || typeof username !== 'string' || username.trim().length < 2) {
    res.status(400).json({ error: '用户名至少 2 个字符' })
    return
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: '请输入有效的邮箱地址' })
    return
  }
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: '请输入密码' })
    return
  }
  if (password.length < 8) {
    res.status(400).json({ error: '密码至少 8 位' })
    return
  }
  if (!/[A-Z]/.test(password) && !/[a-z]/.test(password)) {
    res.status(400).json({ error: '密码需包含字母' })
    return
  }
  if (!/[0-9]/.test(password)) {
    res.status(400).json({ error: '密码需包含数字' })
    return
  }
  if (!code || typeof code !== 'string' || code.length !== 6) {
    res.status(400).json({ error: '请输入 6 位验证码' })
    return
  }

  // Verify code
  const entry = codes.get(email)
  if (!entry) {
    res.status(400).json({ error: '请先获取验证码' })
    return
  }
  if (Date.now() > entry.expiresAt) {
    codes.delete(email)
    res.status(400).json({ error: '验证码已过期，请重新获取' })
    return
  }
  if (entry.code !== code) {
    // Consume the code entry after 5 failed attempts to prevent brute force
    if (!entry.attempts) entry.attempts = 0
    entry.attempts++
    if (entry.attempts >= 5) {
      codes.delete(email)
      res.status(400).json({ error: '验证码错误次数过多，请重新获取' })
      return
    }
    res.status(400).json({ error: '验证码错误' })
    return
  }

  // Create user via Supabase Admin API
  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: username.trim() },
    })

    if (error) {
      // Generic error to prevent email enumeration
      console.error('[auth] Create error:', error)
      res.status(400).json({ error: '注册失败，请检查输入信息' })
      return
    }

    // Grant 3 signup bonus credits
    try {
      await supabaseAdmin.rpc('rpc_add_credits', {
        credit_user_id: data.user!.id,
        credit_amount: 3,
        credit_source_type: 'signup_bonus',
      })
      console.log('[auth] Granted 3 signup bonus credits to', data.user!.id)
    } catch (rpcErr: any) {
      console.error('[auth] Failed to grant signup credits:', rpcErr.message)
    }

    codes.delete(email)
    console.log('[auth] Registered:', data.user?.id)
    res.json({ success: true, message: '注册成功，请登录' })
  } catch (err: any) {
    console.error('[auth] Register error:', err)
    res.status(500).json({ error: '注册失败，请稍后重试' })
  }
})

export default router

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { sendVerificationCode, registerWithCode } from '../services/authApi'

type Mode = 'login' | 'register' | 'forgot'

type Props = { open: boolean; onClose: () => void; defaultMode?: 'login' | 'register' }

export default function AuthModal({ open, onClose, defaultMode = 'login' }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [code, setCode] = useState('')
  const [mode, setMode] = useState<Mode>(defaultMode === 'register' ? 'register' : 'login')
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)

  if (!open) return null

  const startCountdown = () => {
    setCountdown(60)
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) { setError('请先输入有效的邮箱'); return }
    setError('')
    setSendingCode(true)
    try {
      await sendVerificationCode(email)
      startCountdown()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSendingCode(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.message.includes('Invalid')) setError('邮箱或密码错误')
        else if (error.message.includes('Email not confirmed')) setError('邮箱未验证')
        else setError(error.message)
      }
    } else if (mode === 'register') {
      if (!username.trim()) { setError('请输入用户名'); return }
      if (username.trim().length < 2) { setError('用户名至少 2 个字符'); return }
      if (password.length < 8) { setError('密码至少 8 位'); return }
      if (!/[A-Za-z]/.test(password)) { setError('密码需包含字母'); return }
      if (!/[0-9]/.test(password)) { setError('密码需包含数字'); return }
      if (password !== confirmPassword) { setError('两次密码不一致'); return }
      if (!code || code.length !== 6) { setError('请输入 6 位验证码'); return }

      try {
        await registerWithCode({ username: username.trim(), password, email, code })
        setSent('registered')
      } catch (err: any) {
        setError(err.message)
      }
    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) setError(error.message)
      else setSent('reset')
    }
  }

  const switchTo = (m: Mode) => { setMode(m); setError(''); setCode(''); setCountdown(0) }

  const close = () => { onClose(); setTimeout(() => { setMode('login'); setSent(''); setError(''); setCode(''); setCountdown(0) }, 200) }

  return (
    <div className="auth-overlay" onClick={close}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={close}>✕</button>

        {sent === 'registered' ? (
          <div className="auth-body">
            <h2>注册成功</h2>
            <p>您的账号已创建，请登录。</p>
            <button className="button primary" onClick={() => { setSent(''); switchTo('login') }}>去登录</button>
          </div>
        ) : sent === 'reset' ? (
          <div className="auth-body">
            <h2>邮件已发送</h2>
            <p>密码重置链接已发送至 <strong>{email}</strong>，请查收邮件并点击链接重置密码。</p>
            <button className="button primary" onClick={close}>知道了</button>
          </div>
        ) : (
          <form className="auth-body" onSubmit={handleSubmit}>
            <h2>{mode === 'login' ? '登录' : mode === 'register' ? '注册' : '找回密码'}</h2>

            {mode === 'register' && (
              <>
                <label>
                  <span>用户名</span>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={2} placeholder="你的用户名" />
                </label>
                <label>
                  <span>密码</span>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="至少 8 位，含字母+数字" />
                </label>
                <label>
                  <span>确认密码</span>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} placeholder="再次输入密码" />
                </label>
              </>
            )}

            <label>
              <span>邮箱</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="your@email.com" />
            </label>

            {mode === 'register' && (
              <>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button type="button" className="button secondary compact"
                    onClick={handleSendCode}
                    disabled={sendingCode || countdown > 0}
                    style={{ flex: '0 0 auto' }}
                  >
                    {sendingCode ? '发送中...' : countdown > 0 ? `${countdown}s` : '发送验证码'}
                  </button>
                </div>
                <label>
                  <span>验证码</span>
                  <input type="text" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={6} placeholder="6 位验证码" style={{ letterSpacing: '0.3em', textAlign: 'center' }} />
                </label>
              </>
            )}

            {mode !== 'forgot' && mode !== 'register' && (
              <label>
                <span>密码</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="至少 8 位" />
              </label>
            )}

            {error && <div className="auth-error">{error}</div>}

            <button className="button primary" type="submit">
              {mode === 'login' ? '登录' : mode === 'register' ? '注册' : '发送重置邮件'}
            </button>

            <div className="auth-switch">
              {mode === 'login' ? (
                <>
                  <button type="button" onClick={() => switchTo('forgot')}>忘记密码？</button>
                  <span style={{ margin: '0 8px' }}>·</span>
                  没有账号？<button type="button" onClick={() => switchTo('register')}>去注册</button>
                </>
              ) : mode === 'register' ? (
                <>已有账号？<button type="button" onClick={() => switchTo('login')}>去登录</button></>
              ) : (
                <>想起密码了？<button type="button" onClick={() => switchTo('login')}>去登录</button></>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

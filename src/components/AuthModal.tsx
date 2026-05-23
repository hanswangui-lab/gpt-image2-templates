import { useState } from 'react'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'register' | 'forgot'

type Props = { open: boolean; onClose: () => void; defaultMode?: 'login' | 'register' }

export default function AuthModal({ open, onClose, defaultMode = 'login' }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [mode, setMode] = useState<Mode>(defaultMode === 'register' ? 'register' : 'login')
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')

  if (!open) return null

  const handleResend = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: username.trim() },
        emailRedirectTo: `${window.location.origin}/profile`,
      },
    })
    if (error) {
      setError(error.message.includes('already') ? '验证邮件已重新发送，请查收' : error.message)
    } else {
      setSent('verify')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.message.includes('Invalid')) setError('邮箱或密码错误')
        else if (error.message.includes('Email not confirmed')) setError('邮箱未验证，请查收验证邮件')
        else setError(error.message)
      }
    } else if (mode === 'register') {
      if (!username.trim()) { setError('请输入用户名'); return }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username: username.trim() },
          emailRedirectTo: `${window.location.origin}/profile`,
        },
      })
      if (error) {
        setError(error.message.includes('already') ? '该邮箱已注册' : error.message)
      } else {
        setSent('verify')
      }
    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) setError(error.message)
      else setSent('reset')
    }
  }

  const switchTo = (m: Mode) => { setMode(m); setError('') }

  const close = () => { onClose(); setTimeout(() => { setMode('login'); setSent(''); setError('') }, 200) }

  return (
    <div className="auth-overlay" onClick={close}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={close}>✕</button>

        {sent === 'verify' ? (
          <div className="auth-body">
            <h2>注册成功</h2>
            <p>验证邮件已发送至 <strong>{email}</strong>，请点击邮件中的链接完成验证后登录。</p>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>没收到？检查垃圾箱或 <button type="button" className="link-button" onClick={handleResend} style={{ color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>重新发送</button></p>
            <button className="button primary" onClick={close}>知道了</button>
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
              <label>
                <span>用户名</span>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={2} placeholder="你的用户名" />
              </label>
            )}

            <label>
              <span>邮箱</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="your@email.com" />
            </label>

            {mode !== 'forgot' && (
              <label>
                <span>密码</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="至少 6 位" />
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


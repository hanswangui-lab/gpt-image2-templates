import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const hash = window.location.hash
    if (!hash || !hash.includes('access_token')) {
      setChecking(false)
      setError('无效的重置链接')
      return
    }

    // Supabase processes the hash asynchronously. Wait for the session
    // via onAuthStateChange instead of getSession to avoid race conditions.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setChecking(false)
      } else if (event === 'SIGNED_OUT') {
        setChecking(false)
        setError('链接已过期，请重新申请密码重置')
      }
    })

    // Fallback: if session is already available, stop checking
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setChecking(false)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('密码至少 6 位'); return }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
    } else {
      setDone(true)
    }
  }

  return (
    <section className="section-panel" style={{ textAlign: 'center', padding: '60px 24px', maxWidth: 460, margin: '0 auto' }}>
      <div className="section-heading">
        <span className="eyebrow">Account</span>
        <h2>重置密码</h2>
      </div>

      {checking ? (
        <p style={{ marginTop: 24, color: 'var(--muted)' }}>验证链接...</p>
      ) : done ? (
        <div style={{ marginTop: 24 }}>
          <p style={{ color: '#22d3ee', marginBottom: 16 }}>密码已重置成功</p>
          <button className="button primary" onClick={() => navigate('/')}>返回首页</button>
        </div>
      ) : error && !password ? (
        <div style={{ marginTop: 24 }}>
          <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>
          <button className="button secondary" onClick={() => navigate('/')}>返回首页</button>
        </div>
      ) : (
        <form onSubmit={handleReset} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ textAlign: 'left' }}>
            <span>新密码</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="至少 6 位" />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="button primary" type="submit">确认重置</button>
        </form>
      )}
    </section>
  )
}

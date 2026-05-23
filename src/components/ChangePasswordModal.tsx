import { useState } from 'react'
import { supabase } from '../lib/supabase'

const EyeIcon = ({ open, onClick }: { open: boolean; onClick: () => void }) => (
  <button type="button" onClick={onClick} style={{
    position: 'absolute', right: 0, top: 0, bottom: 0, width: 36,
    background: 'none', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--muted)', padding: 0,
  }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <path d="m14.12 14.12a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      )}
    </svg>
  </button>
)

type Props = { open: boolean; onClose: () => void }

export default function ChangePasswordModal({ open, onClose }: Props) {
  const [current, setCurrent] = useState('')
  const [next1, setNext1] = useState('')
  const [next2, setNext2] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [showCurr, setShowCurr] = useState(false)
  const [showNext1, setShowNext1] = useState(false)
  const [showNext2, setShowNext2] = useState(false)

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')

    if (next1.length < 6) { setMsg('新密码至少 6 位'); return }
    if (next1 !== next2) { setMsg('两次输入的新密码不一致'); return }

    setBusy(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) { setMsg('无法获取用户信息'); setBusy(false); return }

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current })
    if (signInErr) { setMsg('当前密码错误'); setBusy(false); return }

    const { error } = await supabase.auth.updateUser({ password: next1 })
    if (error) { setMsg(error.message) }
    else { setMsg('密码修改成功'); setCurrent(''); setNext1(''); setNext2('') }
    setBusy(false)
  }

  const close = () => { onClose(); setTimeout(() => { setMsg(''); setCurrent(''); setNext1(''); setNext2('') }, 200) }

  return (
    <div className="auth-overlay" onClick={close}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <button className="auth-close" onClick={close}>✕</button>

        <form className="auth-body" onSubmit={handleSubmit}>
          <h2>修改密码</h2>

          <label>
            <span>当前密码</span>
            <div style={{ position: 'relative' }}>
              <input type={showCurr ? 'text' : 'password'} value={current} onChange={(e) => setCurrent(e.target.value)} required placeholder="输入当前密码" style={{ width: '100%', height: 44, paddingRight: 40, boxSizing: 'border-box' }} />
              <EyeIcon open={showCurr} onClick={() => setShowCurr(!showCurr)} />
            </div>
          </label>

          <label>
            <span>新密码</span>
            <div style={{ position: 'relative' }}>
              <input type={showNext1 ? 'text' : 'password'} value={next1} onChange={(e) => setNext1(e.target.value)} required minLength={6} placeholder="至少 6 位" style={{ width: '100%', height: 44, paddingRight: 40, boxSizing: 'border-box' }} />
              <EyeIcon open={showNext1} onClick={() => setShowNext1(!showNext1)} />
            </div>
          </label>

          <label>
            <span>确认新密码</span>
            <div style={{ position: 'relative' }}>
              <input type={showNext2 ? 'text' : 'password'} value={next2} onChange={(e) => setNext2(e.target.value)} required minLength={6} placeholder="再次输入新密码" style={{ width: '100%', height: 44, paddingRight: 40, boxSizing: 'border-box' }} />
              <EyeIcon open={showNext2} onClick={() => setShowNext2(!showNext2)} />
            </div>
          </label>

          {msg && <div style={{ fontSize: 13, color: msg.includes('成功') ? '#22d3ee' : '#f87171' }}>{msg}</div>}

          <button className="button primary" type="submit" disabled={busy}>
            {busy ? '修改中...' : '确认修改'}
          </button>
        </form>
      </div>
    </div>
  )
}

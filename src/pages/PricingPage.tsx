import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../hooks/AuthContext'
import { createPayment, getPaymentOrders } from '../services/paymentApi'
import { config } from '../lib/config'

const ACCENTS: Record<string, string> = { gold: '#f59e0b', platinum: '#a78bfa', diamond: '#22d3ee' }
const POLL_INTERVAL = 2000
const POLL_MAX = 15

const USERNAMES = ['rip890','gongxi234','woaini520','77uio','90ok','8ui','786uy','hanswwang','ivy1208','jerry','jack900','rose520','best560']
const DOMAINS = ['gmail.com','qq.com','126.com','hotmail.com','163.com','yahoo.com','icloud.com','foxmail.com','tencent.com']
const CARDS = ['黄金卡', '铂金卡', '钻石卡']

function maskUser(name: string): string {
  if (name.length <= 2) return name[0] + '***'
  return name[0] + '***' + name[name.length - 1]
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

function randInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min }

interface MarqueeMsg { text: string; minutesAgo: number }

function buildMarqueeMessages(count: number): MarqueeMsg[] {
  const msgs: MarqueeMsg[] = Array.from({ length: count }, () => ({
    text: `${maskUser(pick(USERNAMES))}@${pick(DOMAINS)}充值了${pick(CARDS)}`,
    minutesAgo: randInt(0, 59),
  }))
  msgs.sort((a, b) => a.minutesAgo - b.minutesAgo)
  return msgs
}

function fmtRelative(minutes: number): string {
  return minutes === 0 ? '刚刚' : `${minutes}分钟前`
}

const MARQUEE_MESSAGES = buildMarqueeMessages(24)

function fmtTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export default function PricingPage() {
  const { user, setShowAuth, setAuthMode, refreshCredits } = useAuthContext()
  const [orders, setOrders] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [paying, setPaying] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const pollRef = useRef(0)
  const cancelledRef = useRef(false)

  const loadOrders = useCallback(async () => {
    if (!user) return
    setOrdersLoading(true)
    try {
      const data = await getPaymentOrders()
      setOrders(data)
      return data
    } catch {
      // silent
    } finally {
      setOrdersLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) { setOrders([]); return }
    cancelledRef.current = false
    const init = async () => {
      const data = await loadOrders()
      await refreshCredits()
      if (cancelledRef.current) return

      const hasPending = data?.some((o: any) => o.status === 'pending')
      if (hasPending && pollRef.current < POLL_MAX) {
        const timer = setInterval(async () => {
          pollRef.current++
          const fresh = await getPaymentOrders().catch(() => [])
          if (cancelledRef.current) { clearInterval(timer); return }
          setOrders(fresh)
          await refreshCredits()
          const stillPending = fresh.some((o: any) => o.status === 'pending')
          if (!stillPending || pollRef.current >= POLL_MAX) {
            clearInterval(timer)
          }
        }, POLL_INTERVAL)
        return () => clearInterval(timer)
      }
    }
    init()
    return () => { cancelledRef.current = true }
  }, [loadOrders, refreshCredits])

  if (!user) {
    return (
      <section className="section-panel" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div className="section-heading">
          <span className="eyebrow">Pricing</span>
          <h2>获取积分，低至￥0.03/张</h2>
          <p>请先登录后再进行充值。</p>
        </div>
        <div style={{ marginTop: 32, display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="button primary" onClick={() => { setAuthMode('login'); setShowAuth(true) }}>登录</button>
          <button className="button secondary" onClick={() => { setAuthMode('register'); setShowAuth(true) }}>注册</button>
        </div>
      </section>
    )
  }

  const handlePay = async (pack: typeof config.creditPacks[number]) => {
    setError('')
    setPaying(pack.id)
    try {
      const totalCredits = pack.credits + ((pack as any).bonusCredits || 0)
      const { payUrl } = await createPayment(totalCredits, pack.priceCents)
      window.location.href = payUrl
    } catch (err: any) {
      setError(err.message)
      setPaying(null)
    }
  }

  const statusLabel = (o: { status: string; created_at: string }) => {
    if (o.status === 'paid') return '已支付'
    if (o.status === 'failed') return '已失败'
    if (o.status === 'pending') {
      const elapsed = Date.now() - new Date(o.created_at).getTime()
      if (elapsed > 5 * 60 * 1000) return '未支付完成'
      return '待支付'
    }
    return o.status
  }

  const months = [...new Set(orders.map((o: any) => o.created_at.slice(0, 7)))].sort().reverse() as string[]
  const filteredOrders = monthFilter === 'all' ? orders : orders.filter((o: any) => o.created_at.startsWith(monthFilter))

  return (
    <section className="section-panel" style={{ textAlign: 'center' }}>
      <div className="section-heading" style={{ marginBottom: 16 }}>
        <span className="eyebrow">Pricing</span>
        <h2>获取积分，低至￥0.03/张</h2>
      </div>

      <div className="marquee-track" style={{ marginBottom: 32 }}>
        <div className="marquee-inner">
          {[...MARQUEE_MESSAGES, ...MARQUEE_MESSAGES].map((msg, i) => (
            <span key={i} className="marquee-item">
              <span className="marquee-time">{fmtRelative(msg.minutesAgo)}</span>
              {msg.text}
            </span>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20,
        maxWidth: 960,
        margin: '0 auto',
      }}>
        {config.creditPacks.map((pack) => (
          <div
            key={pack.id}
            style={{
              background: (pack as any).popular
                ? 'linear-gradient(180deg, rgba(167,139,250,.1) 0%, rgba(15,23,42,.8) 60%)'
                : 'var(--panel)',
              border: (pack as any).popular ? '2px solid #a78bfa' : '1px solid var(--line)',
              borderRadius: 20,
              padding: '32px 24px 24px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              transition: 'transform .2s, box-shadow .2s',
            }}
          >
            {(pack as any).popular && (
              <span style={{
                position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                padding: '4px 16px', borderRadius: 999,
                background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
                color: '#fff', fontSize: 12, fontWeight: 800,
              }}>
                ⭐ 推荐
              </span>
            )}

            <h3 style={{ fontSize: 20, marginBottom: 16, color: ACCENTS[pack.id] || '#f59e0b', fontWeight: 700 }}>
              {pack.name}
            </h3>

            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 42, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>
                ¥{(pack.priceCents / 100).toFixed(2)}
              </span>
            </div>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(245,158,11,.1)', borderRadius: 999,
              padding: '6px 16px', margin: '0 auto 4px',
            }}>
              <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>{pack.credits} 积分</span>
            </div>

            {'bonusCredits' in pack && (
              <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 12 }}>
                赠送 {(pack as any).bonusCredits} 积分
              </div>
            )}

            <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
              低至 <span style={{ color: ACCENTS[pack.id] || '#f59e0b', fontWeight: 700 }}>¥{(pack as any).perImage}/张</span>
            </div>

            <div style={{ borderTop: '1px solid var(--line)', marginBottom: 16 }} />

            {error && <div className="auth-error" style={{ marginBottom: 10 }}>{error}</div>}

            <div style={{ marginTop: 'auto' }}>
              <button
                className={`button primary${(pack as any).popular ? ' shimmer' : ''}`}
                style={{ width: '100%' }}
                onClick={() => handlePay(pack)}
                disabled={paying === pack.id}
              >
                {paying === pack.id ? '跳转中...' : '立即支付'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 32 }}>
        开通即同意<Link to="/terms" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>服务条款</Link>
      </p>

      {/* Payment history */}
      {user && (
        <div style={{ marginTop: 48, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ margin: 0 }}>支付记录</h3>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              style={{
                background: 'var(--panel)',
                color: 'var(--text)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 13,
              }}
            >
              <option value="all">全部</option>
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          {ordersLoading ? (
            <div className="empty-state"><strong>加载中...</strong></div>
          ) : filteredOrders.length === 0 ? (
            <div className="empty-state"><strong>暂无支付记录</strong></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredOrders.map((o) => (
                <div key={o.id} className="stat-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px' }}>
                  <div>
                    <strong style={{ fontSize: 15 }}>{o.credits} 积分</strong>
                    <span style={{ color: 'var(--muted)', marginLeft: 12, fontSize: 13 }}>
                      ¥{(o.amount_cents / 100).toFixed(2)} · {fmtTime(o.created_at)}
                    </span>
                  </div>
                  <span style={{
                    color: o.status === 'paid' ? '#22d3ee' : o.status === 'failed' ? '#f87171' : '#f59e0b',
                    fontSize: 13, fontWeight: 600,
                  }}>
                    {statusLabel(o)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

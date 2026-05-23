import { useState, useEffect, useMemo } from 'react'
import { useAuthContext } from '../hooks/AuthContext'
import { getCreditTransactions, type CreditTransaction } from '../services/creditApi'

type Tab = 'recharge' | 'consumption'

const PAGE_SIZES = [10, 50, 100]

function formatTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function consumptionLabel(tx: CreditTransaction): string {
  if (tx.reference_type === 'refund') return '生成失败，返还积分'
  return '生成图片消耗'
}

export default function CreditHistoryPage() {
  const { user, setShowAuth, setAuthMode } = useAuthContext()
  const [tab, setTab] = useState<Tab>('recharge')
  const [allTxs, setAllTxs] = useState<CreditTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getCreditTransactions({ limit: 200 })
      .then(setAllTxs)
      .catch(() => setAllTxs([]))
      .finally(() => setLoading(false))
  }, [user])

  // Reset page when tab changes
  useEffect(() => { setPage(1) }, [tab])

  const filteredTxs = useMemo(() =>
    tab === 'recharge'
      ? allTxs.filter((t) => t.reference_type === 'recharge')
      : allTxs.filter((t) => t.type === 'usage' || t.reference_type === 'refund'),
    [allTxs, tab]
  )

  const totalPages = Math.max(1, Math.ceil(filteredTxs.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const txs = filteredTxs.slice((safePage - 1) * pageSize, safePage * pageSize)

  if (!user) {
    return (
      <section className="section-panel" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div className="section-heading">
          <span className="eyebrow">History</span>
          <h2>积分明细</h2>
          <p>请先登录后查看。</p>
        </div>
        <div style={{ marginTop: 32, display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="button primary" onClick={() => { setAuthMode('login'); setShowAuth(true) }}>登录</button>
          <button className="button secondary" onClick={() => { setAuthMode('register'); setShowAuth(true) }}>注册</button>
        </div>
      </section>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'recharge', label: '积分充值' },
    { key: 'consumption', label: '积分消耗' },
  ]

  return (
    <section className="section-panel">
      <div className="section-heading" style={{ marginBottom: 32 }}>
        <span className="eyebrow">History</span>
        <h2>积分明细</h2>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--line)' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: 'none',
              border: 'none',
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? 'var(--text)' : 'var(--muted)',
              borderBottom: tab === t.key ? '2px solid #f59e0b' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'color .15s, border-color .15s',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state"><strong>加载中...</strong></div>
      ) : filteredTxs.length === 0 ? (
        <div className="empty-state">
          <strong>{tab === 'recharge' ? '暂无充值记录' : '暂无消耗记录'}</strong>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {txs.map((tx) => {
              const isAdd = tx.amount > 0
              const label = tab === 'recharge' ? '积分充值' : consumptionLabel(tx)
              const amountColor = isAdd ? '#22d3ee' : '#f87171'

              return (
                <div
                  key={tx.id}
                  className="stat-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 24px',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: amountColor }}>
                        {isAdd ? '+' : ''}{tx.amount} 积分
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {label}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace' }}>
                      {formatTime(tx.created_at)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>余额</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                      {tx.balance_after}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
              <span>共 {filteredTxs.length} 条</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                style={{
                  background: 'var(--panel)',
                  color: 'var(--text)',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: 13,
                }}
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>每页 {s} 条</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                className="button secondary compact"
                disabled={safePage <= 1}
                onClick={() => setPage(1)}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                首页
              </button>
              <button
                className="button secondary compact"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                上一页
              </button>
              <span style={{ fontSize: 13, color: 'var(--muted)', margin: '0 8px', whiteSpace: 'nowrap' }}>
                {safePage} / {totalPages}
              </span>
              <button
                className="button secondary compact"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                下一页
              </button>
              <button
                className="button secondary compact"
                disabled={safePage >= totalPages}
                onClick={() => setPage(totalPages)}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                末页
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

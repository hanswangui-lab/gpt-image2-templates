import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../hooks/AuthContext'
import { getAdminPaymentOrders } from '../services/adminApi'
import { useAdmin } from '../hooks/useAdmin'

function fmtTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function statusLabel(o: { status: string; created_at: string }) {
  if (o.status === 'paid') return { text: '已支付', color: '#22d3ee' }
  if (o.status === 'failed') return { text: '已失败', color: '#f87171' }
  const elapsed = Date.now() - new Date(o.created_at).getTime()
  if (elapsed > 5 * 60 * 1000) return { text: '未支付完成', color: '#f59e0b' }
  return { text: '待支付', color: '#f59e0b' }
}

const PAGE_SIZES = [10, 50, 100]

export default function AdminPage() {
  const { user, isAdmin } = useAuthContext()
  const { loading: adminLoading } = useAdmin()
  const [orders, setOrders] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAdminPaymentOrders(page, pageSize)
      setOrders(data.orders)
      setTotal(data.total)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => { loadOrders() }, [loadOrders])

  if (!user) {
    return (
      <section className="section-panel" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div className="section-heading">
          <h2>管理后台</h2>
          <p>请先登录。</p>
        </div>
      </section>
    )
  }

  if (adminLoading) {
    return (
      <section className="section-panel">
        <div className="section-heading"><h2>管理后台</h2></div>
        <div className="empty-state"><strong>加载中...</strong></div>
      </section>
    )
  }

  if (!isAdmin) {
    return (
      <section className="section-panel" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div className="section-heading">
          <h2>管理后台</h2>
          <p>你没有管理员权限。</p>
        </div>
      </section>
    )
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <section className="section-panel">
      <div className="section-heading">
        <span className="eyebrow">Admin</span>
        <h2>管理后台</h2>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 24, marginBottom: 8 }}>
        <Link to="/admin" style={{
          padding: '8px 20px', borderRadius: 999, fontSize: 13, fontWeight: 600,
          background: 'var(--primary)', color: '#fff', textDecoration: 'none',
        }}>充值订单</Link>
        <Link to="/admin/users" style={{
          padding: '8px 20px', borderRadius: 999, fontSize: 13, fontWeight: 600,
          background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)',
          textDecoration: 'none',
        }}>用户管理</Link>
        <Link to="/admin/announcements" style={{
          padding: '8px 20px', borderRadius: 999, fontSize: 13, fontWeight: 600,
          background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)',
          textDecoration: 'none',
        }}>公告管理</Link>
        <Link to="/admin/settings" style={{
          padding: '8px 20px', borderRadius: 999, fontSize: 13, fontWeight: 600,
          background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)',
          textDecoration: 'none',
        }}>API 配置</Link>
      </div>

      {loading ? (
        <div className="empty-state"><strong>加载中...</strong></div>
      ) : orders.length === 0 ? (
        <div className="empty-state"><strong>暂无订单</strong></div>
      ) : (
        <>
          {/* Table */}
          <div style={{ overflowX: 'auto', marginTop: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600 }}>ID</th>
                  <th style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600 }}>用户</th>
                  <th style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600 }}>充值金额</th>
                  <th style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600 }}>充值积分</th>
                  <th style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600 }}>充值时间</th>
                  <th style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600 }}>状态</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o: any) => {
                  const st = statusLabel(o)
                  return (
                    <tr key={o.id} style={{ borderBottom: '1px solid var(--line)', background: st.text === '未支付完成' ? 'rgba(245,158,11,.05)' : undefined }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)' }}>
                        {o.trade_no?.length > 18 ? o.trade_no.slice(0, 18) + '...' : o.trade_no}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 500 }}>{o.email || o.username}</td>
                      <td style={{ padding: '10px 12px' }}>¥{(o.amount_cents / 100).toFixed(2)}</td>
                      <td style={{ padding: '10px 12px' }}>{o.credits}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtTime(o.created_at)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ color: st.color, fontWeight: 600, fontSize: 12 }}>{st.text}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>每页</span>
              {PAGE_SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => { setPage(1); setPageSize(s) }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: pageSize === s ? 700 : 400,
                    background: pageSize === s ? 'var(--primary)' : 'transparent',
                    color: pageSize === s ? '#fff' : 'var(--muted)',
                    border: pageSize === s ? 'none' : '1px solid var(--line)',
                    cursor: 'pointer',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 12,
                  background: 'transparent', border: '1px solid var(--line)',
                  color: page <= 1 ? 'var(--muted)' : 'var(--text)',
                  cursor: page <= 1 ? 'default' : 'pointer',
                  opacity: page <= 1 ? 0.4 : 1,
                }}
              >
                上一页
              </button>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {page} / {totalPages || 1}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 12,
                  background: 'transparent', border: '1px solid var(--line)',
                  color: page >= totalPages ? 'var(--muted)' : 'var(--text)',
                  cursor: page >= totalPages ? 'default' : 'pointer',
                  opacity: page >= totalPages ? 0.4 : 1,
                }}
              >
                下一页
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

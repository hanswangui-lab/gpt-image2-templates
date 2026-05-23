import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../hooks/AuthContext'
import { checkIsAdmin, getAdminUsers, disableUser, deleteUser } from '../services/adminApi'
import type { AdminUser } from '../types'

export default function AdminUsersPage() {
  const { user } = useAuthContext()
  const [isAdmin, setIsAdmin] = useState(false)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const admin = await checkIsAdmin()
      setIsAdmin(admin)
      if (admin) {
        const data = await getAdminUsers()
        setUsers(data)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (!user) {
    return (
      <section className="section-panel" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div className="section-heading"><h2>用户管理</h2><p>请先登录。</p></div>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="section-panel">
        <div className="section-heading"><h2>用户管理</h2></div>
        <div className="empty-state"><strong>加载中...</strong></div>
      </section>
    )
  }

  if (!isAdmin) {
    return (
      <section className="section-panel" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div className="section-heading"><h2>用户管理</h2><p>你没有管理员权限。</p></div>
      </section>
    )
  }

  const handleDisable = async (u: AdminUser) => {
    setActing(u.user_id)
    try {
      await disableUser(u.user_id, !u.disabled)
      setUsers((prev) => prev.map((x) => (x.user_id === u.user_id ? { ...x, disabled: !u.disabled } : x)))
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActing(null)
    }
  }

  const handleDelete = async (u: AdminUser) => {
    if (!confirm(`确定删除用户 ${u.username} (${u.email}) 的所有数据吗？此操作不可撤销。`)) return
    setActing(u.user_id)
    try {
      await deleteUser(u.user_id)
      setUsers((prev) => prev.filter((x) => x.user_id !== u.user_id))
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActing(null)
    }
  }

  const enabledCount = users.filter((u) => !u.disabled).length
  const disabledCount = users.filter((u) => u.disabled).length

  return (
    <section className="section-panel">
      <div className="section-heading">
        <span className="eyebrow">Admin</span>
        <h2>用户管理</h2>
        <p>
          共 {users.length} 个用户 · {enabledCount} 已启用 · {disabledCount} 已禁用
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 24, marginBottom: 8 }}>
        <Link to="/admin" style={{
          padding: '8px 20px', borderRadius: 999, fontSize: 13, fontWeight: 600,
          background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)',
          textDecoration: 'none',
        }}>充值审核</Link>
        <Link to="/admin/users" style={{
          padding: '8px 20px', borderRadius: 999, fontSize: 13, fontWeight: 600,
          background: 'var(--primary)', color: '#fff', textDecoration: 'none',
        }}>用户管理</Link>
        <Link to="/admin/settings" style={{
          padding: '8px 20px', borderRadius: 999, fontSize: 13, fontWeight: 600,
          background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)',
          textDecoration: 'none',
        }}>API 配置</Link>
      </div>

      <div style={{ marginTop: 24, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left' }}>
              <th style={th}>ID</th>
              <th style={th}>用户名</th>
              <th style={th}>邮箱</th>
              <th style={th}>状态</th>
              <th style={th}>充值金额</th>
              <th style={th}>剩余积分</th>
              <th style={th}>创建时间</th>
              <th style={th}>最后登录</th>
              <th style={th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={td}>{u.row_num}</td>
                <td style={td}>
                  <strong>{u.username}</strong>
                </td>
                <td style={{ ...td, color: 'var(--muted)', fontSize: 13 }}>{u.email}</td>
                <td style={td}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    background: u.disabled ? 'rgba(248,113,113,.15)' : 'rgba(34,211,238,.15)',
                    color: u.disabled ? '#f87171' : '#22d3ee',
                  }}>
                    {u.disabled ? '已禁用' : '已启用'}
                  </span>
                </td>
                <td style={{ ...td, color: '#f59e0b', fontWeight: 600 }}>
                  ¥{(u.total_recharge_cents / 100).toFixed(2)}
                </td>
                <td style={{ ...td, color: '#22d3ee', fontWeight: 600 }}>
                  {u.balance} 积分
                </td>
                <td style={{ ...td, color: 'var(--muted)', fontSize: 13 }}>
                  {new Date(u.created_at).toLocaleDateString('zh-CN')}
                </td>
                <td style={{ ...td, color: 'var(--muted)', fontSize: 13 }}>
                  {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('zh-CN') : '从未登录'}
                </td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="button compact"
                      onClick={() => handleDisable(u)}
                      disabled={acting === u.user_id}
                      style={{
                        padding: '4px 14px',
                        fontSize: 12,
                        border: u.disabled ? '1px solid #22d3ee' : '1px solid #f59e0b',
                        color: u.disabled ? '#22d3ee' : '#f59e0b',
                        background: 'transparent',
                        borderRadius: 999,
                        cursor: 'pointer',
                      }}
                    >
                      {acting === u.user_id ? '...' : u.disabled ? '启用' : '禁用'}
                    </button>
                    <button
                      className="button compact"
                      onClick={() => handleDelete(u)}
                      disabled={acting === u.user_id}
                      style={{
                        padding: '4px 14px',
                        fontSize: 12,
                        border: '1px solid #f87171',
                        color: '#f87171',
                        background: 'transparent',
                        borderRadius: 999,
                        cursor: 'pointer',
                      }}
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const th: React.CSSProperties = {
  padding: '12px 16px',
  color: 'var(--muted)',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '.05em',
}

const td: React.CSSProperties = {
  padding: '12px 16px',
  whiteSpace: 'nowrap',
}

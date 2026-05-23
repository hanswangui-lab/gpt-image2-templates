import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../hooks/AuthContext'
import { useAdmin } from '../hooks/useAdmin'
import { createAnnouncement, getAllAnnouncements, activateAnnouncement, deactivateAnnouncement, deleteAnnouncement } from '../services/adminApi'

export default function AdminAnnouncementsPage() {
  const { user, isAdmin } = useAuthContext()
  const { loading: adminLoading } = useAdmin()
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showPublish, setShowPublish] = useState(false)
  const [annContent, setAnnContent] = useState('')
  const [publishError, setPublishError] = useState('')
  const [actionMsg, setActionMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAllAnnouncements()
      setAnnouncements(data || [])
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
        <div className="section-heading"><h2>管理后台</h2><p>请先登录。</p></div>
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
        <div className="section-heading"><h2>管理后台</h2><p>你没有管理员权限。</p></div>
      </section>
    )
  }

  const handleToggle = async (a: any) => {
    setActionMsg('')
    try {
      if (a.is_active) {
        await deactivateAnnouncement(a.id)
      } else {
        await activateAnnouncement(a.id)
      }
      setActionMsg(a.is_active ? '已下线' : '已上线')
      setTimeout(() => setActionMsg(''), 2000)
      load()
    } catch {
      setActionMsg('操作失败')
    }
  }

  const handleDelete = async (a: any) => {
    if (!window.confirm(`确定删除公告「${a.content}」？`)) return
    setActionMsg('')
    try {
      await deleteAnnouncement(a.id)
      setActionMsg('已删除')
      setTimeout(() => setActionMsg(''), 2000)
      load()
    } catch {
      setActionMsg('删除失败')
    }
  }

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()
    setPublishError('')
    if (!annContent.trim()) return
    try {
      await createAnnouncement(annContent.trim())
      setAnnContent('')
      setShowPublish(false)
      load()
    } catch (err: any) {
      setPublishError(err.message || '发布失败')
    }
  }

  return (
    <section className="section-panel">
      <div className="section-heading">
        <span className="eyebrow">Admin</span>
        <h2>管理后台</h2>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 24, marginBottom: 8 }}>
        <Link to="/admin" style={{
          padding: '8px 20px', borderRadius: 999, fontSize: 13, fontWeight: 600,
          background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)',
          textDecoration: 'none',
        }}>充值订单</Link>
        <Link to="/admin/users" style={{
          padding: '8px 20px', borderRadius: 999, fontSize: 13, fontWeight: 600,
          background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)',
          textDecoration: 'none',
        }}>用户管理</Link>
        <Link to="/admin/announcements" style={{
          padding: '8px 20px', borderRadius: 999, fontSize: 13, fontWeight: 600,
          background: 'var(--primary)', color: '#fff', textDecoration: 'none',
        }}>公告管理</Link>
        <Link to="/admin/settings" style={{
          padding: '8px 20px', borderRadius: 999, fontSize: 13, fontWeight: 600,
          background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)',
          textDecoration: 'none',
        }}>API 配置</Link>
        <button
          onClick={() => setShowPublish(true)}
          style={{
            padding: '8px 20px', borderRadius: 999, fontSize: 13, fontWeight: 600,
            background: '#f59e0b', color: '#fff', border: 'none', cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          发布公告
        </button>
      </div>

      {/* Publish modal */}
      {showPublish && (
        <div className="auth-overlay" onClick={() => { setShowPublish(false); setAnnContent('') }}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <button className="auth-close" onClick={() => { setShowPublish(false); setAnnContent('') }}>✕</button>
            <form className="auth-body" onSubmit={handlePublish}>
              <h2>发布公告</h2>
              <label>
                <span>公告内容（{annContent.length}/100）</span>
                <textarea
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value.slice(0, 100))}
                  required maxLength={100} rows={10}
                  placeholder="输入公告内容，最多 100 字"
                  style={{ resize: 'vertical' }}
                />
              </label>
              {publishError && <div className="auth-error">{publishError}</div>}
              <button className="button primary" type="submit">确认发布</button>
            </form>
          </div>
        </div>
      )}

      {actionMsg && (
        <div style={{ padding: '8px 16px', borderRadius: 8, background: '#22d3ee15', color: '#22d3ee', fontSize: 13, marginBottom: 12 }}>
          {actionMsg}
        </div>
      )}

      {loading ? (
        <div className="empty-state"><strong>加载中...</strong></div>
      ) : announcements.length === 0 ? (
        <div className="empty-state"><strong>暂无公告</strong></div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600 }}>公告内容</th>
                <th style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600 }}>发布时间</th>
                <th style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600 }}>状态</th>
                <th style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {announcements.map((a: any) => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '10px 12px' }}>{a.content}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {new Date(a.created_at).toLocaleString('zh-CN')}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      color: a.is_active ? '#22d3ee' : 'var(--muted)',
                      fontWeight: 600, fontSize: 12,
                    }}>
                      {a.is_active ? '在线' : '已下线'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleToggle(a)}
                      style={{
                        padding: '4px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: a.is_active ? 'transparent' : '#22d3ee',
                        color: a.is_active ? '#f87171' : '#fff',
                        border: a.is_active ? '1px solid #f87171' : '1px solid #22d3ee',
                        cursor: 'pointer',
                      }}
                    >
                      {a.is_active ? '下线' : '上线'}
                    </button>
                    <button
                      onClick={() => handleDelete(a)}
                      style={{
                        padding: '4px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: 'transparent', color: '#f87171',
                        border: '1px solid #f87171', cursor: 'pointer',
                      }}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

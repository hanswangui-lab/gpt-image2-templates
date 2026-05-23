import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../hooks/AuthContext'
import { useAdmin } from '../hooks/useAdmin'
import { getSettings, updateSettings, testApiConnection } from '../services/adminApi'

export default function AdminSettingsPage() {
  const { user, isAdmin } = useAuthContext()
  const { loading: adminLoading } = useAdmin()
  const [apiUrl, setApiUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string; latencyMs?: number } | null>(null)

  useEffect(() => {
    getSettings().then((s) => {
      setApiUrl(s.bestapi_url || '')
      setApiKey(s.bestapi_key || '')
    }).catch(() => {})
  }, [])

  if (!user || adminLoading) {
    return (
      <section className="section-panel" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div className="section-heading"><h2>管理后台</h2><p>加载中...</p></div>
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')
    setSaving(true)
    try {
      await updateSettings({ bestapi_url: apiUrl.trim(), bestapi_key: apiKey.trim() })
      setMsg('保存成功，立即生效')
    } catch (err: any) {
      setMsg(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTestResult(null)
    setTesting(true)
    // Save first if there are unsaved changes
    try { await updateSettings({ bestapi_url: apiUrl.trim(), bestapi_key: apiKey.trim() }) } catch {}
    try {
      const result = await testApiConnection()
      setTestResult(result)
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message || '测试请求失败' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className="section-panel">
      <div className="section-heading">
        <span className="eyebrow">Admin</span>
        <h2>API 配置</h2>
        <p>修改后即时生效，无需重启服务器。留空则使用 .env 环境变量作为默认值。</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 24, marginBottom: 24 }}>
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
          background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)',
          textDecoration: 'none',
        }}>公告管理</Link>
        <Link to="/admin/settings" style={{
          padding: '8px 20px', borderRadius: 999, fontSize: 13, fontWeight: 600,
          background: 'var(--primary)', color: '#fff', textDecoration: 'none',
        }}>API 配置</Link>
      </div>

      <form onSubmit={handleSave} style={{ maxWidth: 560 }}>
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 14 }}>API 端点地址</span>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://api.example.com/v1/images/generations"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 20 }}>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 14 }}>API Key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }}
          />
        </label>

        {msg && (
          <div style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 13, marginBottom: 16,
            background: msg.includes('成功') ? '#22d3ee15' : '#f8717115',
            color: msg.includes('成功') ? '#22d3ee' : '#f87171',
          }}>
            {msg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="button primary" type="submit" disabled={saving} style={{ minWidth: 140 }}>
            {saving ? '保存中...' : '保存配置'}
          </button>
          <button type="button" className="button secondary" disabled={testing} onClick={handleTest} style={{ minWidth: 140 }}>
            {testing ? '测试中...' : '测试连接'}
          </button>
        </div>

        {testResult && (
          <div style={{
            marginTop: 16, padding: '12px 16px', borderRadius: 8, fontSize: 13,
            background: testResult.ok ? '#22d3ee15' : '#f8717115',
            border: `1px solid ${testResult.ok ? '#22d3ee30' : '#f8717130'}`,
            color: testResult.ok ? '#22d3ee' : '#f87171',
          }}>
            {testResult.ok
              ? `连接成功，延迟 ${testResult.latencyMs}ms`
              : `失败: ${testResult.error}`}
            {(testResult as any).testedUrl && (
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
                请求地址: {(testResult as any).testedUrl}
              </div>
            )}
          </div>
        )}
      </form>
    </section>
  )
}

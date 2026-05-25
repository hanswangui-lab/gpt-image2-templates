import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../hooks/AuthContext'

export default function Navbar() {
  const { user, credits, isAdmin, signOut, setShowAuth } = useAuthContext()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="navbar">
      <Link className="brand" to="/" onClick={closeMenu}>
        <img className="brand-mark" src="/logo.png" alt="Logo" />
        <span>
          <strong>GPT Image 2</strong>
          <small>AI 图片生成平台</small>
        </span>
      </Link>

      <button
        className="menu-button"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="site-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? '关闭' : '菜单'}
      </button>

      <nav id="site-navigation" className={menuOpen ? 'nav-links open' : 'nav-links'}>
        <Link to="/" onClick={closeMenu}>首页</Link>
        <Link to="/templates" onClick={closeMenu}>模板</Link>
        <Link to="/pricing" onClick={closeMenu}>价格</Link>
        {isAdmin && <Link to="/admin" onClick={closeMenu} style={{ color: '#ff00ff' }}>管理</Link>}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {user ? (
          <>
            <span style={{ color: '#00ff88', fontSize: 13, fontWeight: 700, fontFamily: "'Orbitron','Share Tech Mono',monospace" }}>{credits} 积分</span>
            <Link className="nav-cta" to="/profile" style={{ background: 'rgba(255,255,255,.1)', border: '1px solid var(--line)' }}>个人中心</Link>
            <button className="nav-cta" style={{ background: 'rgba(255,255,255,.1)', border: '1px solid var(--line)' }} onClick={signOut}>退出</button>
          </>
        ) : (
          <>
            <button className="nav-cta" onClick={() => setShowAuth(true)}>登录</button>
          </>
        )}
      </div>
    </header>
  )
}

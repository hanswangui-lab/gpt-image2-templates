import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import Navbar from './Navbar'
import AuthModal from './AuthModal'
import AnnouncementBanner from './AnnouncementBanner'
import { useAuthContext } from '../hooks/AuthContext'

export default function AppLayout() {
  const { showAuth, setShowAuth, authMode } = useAuthContext()
  const [toast, setToast] = useState('')

  return (
    <>
      <AnnouncementBanner />

      <div className="site-shell">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />

        <Navbar />

        <main>
          <Outlet context={{ toast, setToast }} />
        </main>

        <footer className="footer">
          <p>GPT Image 2 · AI 图片生成平台 · 🐧群：1053700744</p>
        </footer>

        {toast && <div className="toast" role="status">{toast}</div>}
        <AuthModal open={showAuth} onClose={() => setShowAuth(false)} defaultMode={authMode} />
      </div>
    </>
  )
}

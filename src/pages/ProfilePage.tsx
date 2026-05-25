import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../hooks/AuthContext'
import { getCreditHistory, getGeneratedImages } from '../services/profileApi'
import { loadCachedGallery, MAX_GALLERY_ITEMS } from '../services/galleryCache'
import ChangePasswordModal from '../components/ChangePasswordModal'
import ImageLightbox from '../components/ImageLightbox'
import type { CreditTransaction } from '../types'

type GalleryItem = { _url: string; _prompt: string; _key: string }

export default function ProfilePage() {
  const { user, profile, credits, setShowAuth, setAuthMode } = useAuthContext()
  const navigate = useNavigate()
  const setHistory = useState<CreditTransaction[]>([])[1]
  const [gallery, setGallery] = useState<GalleryItem[]>([])
  const [galleryCount, setGalleryCount] = useState(0)
  const [showPwdModal, setShowPwdModal] = useState(false)
  const [lightbox, setLightbox] = useState<{ url: string; prompt: string } | null>(null)

  useEffect(() => {
    if (!user) return
    getCreditHistory(user.id).then(setHistory)
    getGeneratedImages(user.id).then((apiImages) => {
      setGalleryCount(apiImages.length)
      const cached = loadCachedGallery()
      if (cached.length > 0) {
        setGallery(cached.map((img) => ({ _url: img.imageUrl, _prompt: img.prompt, _key: img.imageUrl })))
      } else {
        setGallery(apiImages.slice(0, MAX_GALLERY_ITEMS).map((img) => ({ _url: img.image_url!, _prompt: img.prompt, _key: img.id })))
      }
    })
  }, [user])

  if (!user) {
    return (
      <section className="section-panel" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div className="section-heading">
          <span className="eyebrow">Profile</span>
          <h2>个人中心</h2>
          <p>请先登录。</p>
        </div>
        <div style={{ marginTop: 32, display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="button primary" onClick={() => { setAuthMode('login'); setShowAuth(true) }}>登录</button>
          <button className="button secondary" onClick={() => { setAuthMode('register'); setShowAuth(true) }}>注册</button>
        </div>
      </section>
    )
  }

  return (
    <section className="section-panel">
      <div className="section-heading">
        <span className="eyebrow">Profile</span>
        <h2>个人中心</h2>
      </div>

      {/* User info card */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 20,
        padding: '32px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 24,
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 32,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Avatar */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #00ff88, #00d4ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 800, color: '#0a0a0f',
            flexShrink: 0,
          }}>
            {(profile?.username || user.email?.[0] || '?')[0].toUpperCase()}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <strong style={{ fontSize: 20 }}>
                {profile?.username || profile?.display_name || (user as any).user_metadata?.username || user.email?.split('@')[0] || '未设置'}
              </strong>
              <button onClick={() => setShowPwdModal(true)} style={{
                background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
                fontSize: 12, textDecoration: 'underline', padding: 0,
              }}>修改密码</button>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>{user.email}</p>

            <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{galleryCount}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>作品</div>
              </div>
<div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{credits}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>积分</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 2 }}>当前积分</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#00ff88', fontFamily: "'Orbitron','Share Tech Mono',monospace" }}>{credits}</div>
          </div>
          <button className="button primary" onClick={() => navigate('/recharge')}>
            立即充值
          </button>
          <button className="button secondary compact" onClick={() => navigate('/credit-history')} style={{ marginTop: 8 }}>
            积分明细
          </button>
        </div>
      </div>

      <ChangePasswordModal open={showPwdModal} onClose={() => setShowPwdModal(false)} />

      {/* Gallery section */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{ marginBottom: 4, fontSize: 18 }}>作品画廊（最近5张）</h3>
        <small style={{ display: 'block', marginBottom: 16, color: 'var(--muted)', fontSize: 12 }}>存储最近的5张图，生成结果仅在平台保留48小时。喜欢的作品请尽快下载到本地，过期后可能无法找回。</small>
        {gallery.length === 0 ? (
          <div className="empty-state">
            <strong>还没有作品</strong>
            <p>去首页开始创作吧！</p>
            <button className="button primary compact" style={{ marginTop: 12 }} onClick={() => navigate('/')}>
              去生图
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {gallery.map((img) => (
              <div key={img._key} style={{
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                cursor: 'pointer',
              }} onClick={() => setLightbox({ url: img._url, prompt: img._prompt })}>
                <img
                  src={img._url}
                  alt={img._prompt.slice(0, 40)}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                  loading="lazy"
                />
                <p style={{ margin: 0, padding: '8px 10px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={img._prompt}>
                  {img._prompt}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <ImageLightbox
        open={lightbox !== null}
        imageUrl={lightbox?.url || ''}
        prompt={lightbox?.prompt || ''}
        onClose={() => setLightbox(null)}
      />

    </section>
  )
}

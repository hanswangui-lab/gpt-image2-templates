import { useState, useEffect, useCallback } from 'react'
import { useAuthContext } from '../hooks/AuthContext'
import { getGeneratedImages, deleteGeneratedImage } from '../services/profileApi'
import { loadCachedGallery, saveCachedGallery, MAX_GALLERY_ITEMS, type CachedImage } from '../services/galleryCache'
import type { GeneratedImage } from '../types'

export default function GalleryPage() {
  const { user, setShowAuth, setAuthMode } = useAuthContext()
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [cachedImages, setCachedImages] = useState<CachedImage[]>(loadCachedGallery)
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<GeneratedImage | CachedImage | null>(null)

  const refreshImages = useCallback(() => {
    if (!user) { setLoading(false); return }
    setCachedImages(loadCachedGallery())
    getGeneratedImages(user.id).then((data) => {
      setImages(data.slice(0, MAX_GALLERY_ITEMS))
      setLoading(false)
    })
  }, [user])

  useEffect(() => { refreshImages() }, [refreshImages])

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除这张图片？')) return
    await deleteGeneratedImage(id).catch(() => {})
    const target = images.find((img) => img.id === id)
    if (target?.image_url) {
      setCachedImages((prev) => {
        const next = prev.filter((img) => img.imageUrl !== target.image_url)
        saveCachedGallery(next)
        return next
      })
    }
    setImages((prev) => prev.filter((img) => img.id !== id))
    if (preview && 'id' in preview && preview.id === id) setPreview(null)
  }

  // Use cached images if available, otherwise API images
  const displayItems = cachedImages.length > 0 ? cachedImages : images

  if (!user) {
    return (
      <section className="section-panel" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div className="section-heading">
          <span className="eyebrow">Gallery</span>
          <h2>作品画廊（最近5张）</h2>
          <p>查看你生成的图片。<br /><small style={{ color: 'var(--muted)', fontSize: 12 }}>存储最近的5张图，请即时保存图片</small></p>
        </div>
        <div style={{ marginTop: 32, display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="button primary" onClick={() => { setAuthMode('login'); setShowAuth(true) }}>登录</button>
          <button className="button secondary" onClick={() => { setAuthMode('register'); setShowAuth(true) }}>注册</button>
        </div>
      </section>
    )
  }

  function getImgUrl(item: GeneratedImage | CachedImage): string {
    return 'imageUrl' in item ? item.imageUrl : item.image_url!
  }

  function getPrompt(item: GeneratedImage | CachedImage): string {
    return 'prompt' in item ? item.prompt : (item as GeneratedImage).prompt
  }

  function getKey(item: GeneratedImage | CachedImage): string {
    return 'imageUrl' in item ? item.imageUrl : (item as GeneratedImage).id
  }

  return (
    <section className="section-panel">
      <div className="section-heading">
        <span className="eyebrow">Gallery</span>
        <h2>作品画廊（最近5张）</h2>
        <p>点击查看大图，支持下载和删除。<br /><small style={{ color: 'var(--muted)', fontSize: 12 }}>存储最近的5张图，请即时保存图片</small></p>
      </div>

      {loading ? (
        <div className="empty-state"><strong>加载中...</strong></div>
      ) : displayItems.length === 0 ? (
        <div className="empty-state">
          <strong>还没有生成的图片</strong>
          <p>去生图页开始创作吧！</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {displayItems.map((item) => {
            const url = getImgUrl(item)
            const promptText = getPrompt(item)
            return (
              <div
                key={getKey(item)}
                style={{ display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer' }}
                onClick={() => setPreview(item)}
              >
                <img
                  src={url}
                  alt={promptText.slice(0, 40)}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                  loading="lazy"
                />
                <p style={{ margin: 0, padding: '8px 10px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={promptText}>
                  {promptText}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="modal-card" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setPreview(null)}>✕</button>
            <div style={{ padding: 24 }}>
              <img src={getImgUrl(preview)} alt={getPrompt(preview)} style={{ width: '100%', borderRadius: 12 }} />
              <div className="modal-prompt" style={{ marginTop: 16 }}>
                <span className="modal-prompt-label">生成提示词</span>
                <pre>{getPrompt(preview)}</pre>
              </div>
              <div className="modal-actions" style={{ marginTop: 16 }}>
                <a className="button primary compact" href={getImgUrl(preview)} target="_blank" rel="noreferrer" download>下载</a>
                {'id' in preview && (
                  <button className="button ghost compact" onClick={() => handleDelete((preview as GeneratedImage).id)}>删除</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

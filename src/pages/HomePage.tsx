import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../hooks/AuthContext'
import { useGenerateContext } from '../hooks/GenerateContext'
import { getGeneratedImages } from '../services/profileApi'
import { config } from '../lib/config'
import { templates, sourceAttribution } from '../data/templates'
import { loadCachedGallery, addToGallery, MAX_GALLERY_ITEMS, type CachedImage } from '../services/galleryCache'
import type { GeneratedImage } from '../types'
import ImageLightbox from '../components/ImageLightbox'

const RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16', '2:3', '3:2'] as const

const faqs = [
  { question: '真实内容从哪里来？', answer: `数据来自参考站公开加载的 /cases.json 和 /style-library.json，源项目为 ${sourceAttribution.name}，许可为 ${sourceAttribution.license}。` },
  { question: '生成一张图需要多少积分？', answer: '每次生图根据图片质量、分辨率，有不同的积分消耗，低至0.03元/张。' },
  { question: '积分如何获取？', answer: '通过支付宝充值后，积分自动到账。如有疑问，可以加🐧群：1053700744' },
  { question: '可以退款吗？', answer: '积分属于数字服务，已使用部分不支持退款；重复扣款、积分未到账等系统问题会处理退款或补发。' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const { user, credits } = useAuthContext()
  const {
    prompt, setPrompt, ratio, setRatio, resIndex, setResIndex,
    generating, result, error, handleGenerate, clearResult,
  } = useGenerateContext()
  const [gallery, setGallery] = useState<GeneratedImage[]>([])
  const [cachedImages, setCachedImages] = useState<CachedImage[]>(loadCachedGallery)
  const [lightbox, setLightbox] = useState<{ url: string; prompt: string } | null>(null)

  // Save generated result to local gallery cache
  useEffect(() => {
    if (!result) return
    setCachedImages(addToGallery(result.imageUrl, prompt))
  }, [result]) // eslint-disable-line react-hooks/exhaustive-deps

  // Merge API gallery with local cache
  useEffect(() => {
    if (!user) { setGallery([]); return }
    getGeneratedImages(user.id).then((apiImages) => {
      if (cachedImages.length > 0) {
        setGallery(apiImages)
      } else {
        setGallery(apiImages.slice(0, MAX_GALLERY_ITEMS))
      }
    })
  }, [user, result])

  const resolution = config.resolutions[resIndex]

  const scrollToGenerate = () => {
    document.getElementById('generate-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <section className="hero section-panel">
        <div className="hero-copy">
          <span className="eyebrow">GPT image 2</span>
          <h1>妙笔生花，即刻呈现</h1>
          <p>
            价格低至￥0.03/张
          </p>
          <div className="hero-actions">
            <button className="button primary" onClick={scrollToGenerate}>开始生图</button>
            <button className="button secondary" onClick={() => navigate('/templates')}>探索模板</button>
          </div>
        </div>

        <div className="hero-preview" aria-label="模板预览墙">
          {templates.slice(0, 4).map((template) => (
            <article className="preview-card" key={template.id}
              style={template.image ? {} : { background: template.gradient }}>
              {template.image ? (
                <img className="preview-card-img" src={template.image} alt={template.title} loading="lazy" />
              ) : null}
              <div className="preview-card-text">
                <span>{template.categoryLabel}</span>
                <strong>{template.previewTitle}</strong>
                <small>{template.tags.slice(0, 2).join(' · ')}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Generate section */}
      <section className="section-panel" id="generate-section">
        <div className="section-heading" style={{ padding: '32px 32px 0' }}>
          <span className="eyebrow">Generate</span>
          <h2>AI 生图</h2>
          <p>输入你的创意描述，选择比例和清晰度，GPT Image-2 为你生成图片。</p>
        </div>

        <div className="generator-layout" style={{ padding: '24px 32px 32px' }}>
          {/* Left: Controls */}
          <div className="generator-left" style={{ padding: 0 }}>
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>提示词</h3>
            <label className="search-field" style={{ marginBottom: 20 }}>
              <span>关键词描述</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="描述你想生成的画面，例如：一只可爱的橘猫坐在窗台上，阳光洒落，温暖色调，摄影风格..."
                rows={5}
                className="generate-textarea"
              />
            </label>

            <div style={{ marginBottom: 20 }}>
              <span style={{ display: 'block', marginBottom: 8, color: 'var(--muted)', fontSize: 13 }}>宽高比</span>
              <div className="filter-group">
                {RATIOS.map((r) => (
                  <button key={r} className={ratio === r ? 'filter-button active' : 'filter-button'} onClick={() => setRatio(r)}>{r}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <span style={{ display: 'block', marginBottom: 8, color: 'var(--muted)', fontSize: 13 }}>清晰度</span>
              <div className="filter-group">
                {config.resolutions.map((r, i) => (
                  <button key={r.label} className={resIndex === i ? 'filter-button active' : 'filter-button'} onClick={() => setResIndex(i)}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
              <span style={{ color: 'var(--muted)', fontSize: 14 }}>
                {user ? `当前积分：${credits} · 本次消耗：${resolution.cost}` : '登录后生图'}
              </span>
              <button className="button primary" onClick={handleGenerate} disabled={generating} style={{ minWidth: 160, opacity: generating ? 0.6 : 1 }}>
                {generating ? '生成中...' : '生成图片'}
              </button>
            </div>

            {error && (
              <div className="auth-error" style={{ marginTop: 16 }}>
                {error}
                {error.includes('积分不足') && (
                  <button className="button primary compact" style={{ marginLeft: 12 }} onClick={() => navigate('/pricing')}>去充值</button>
                )}
              </div>
            )}
          </div>

          {/* Right: Preview */}
          <div className="generator-right" style={{ flexDirection: 'column', gap: 0 }}>
            <h3 style={{ marginBottom: 12, fontSize: 16, fontWeight: 700, alignSelf: 'flex-start' }}>预览</h3>
            <div style={{ width: 480, height: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: 'var(--panel)', border: '1px solid var(--line)', overflow: 'hidden', flexShrink: 0 }}>
            {generating ? (
              <div className="preview-generating">
                <div className="generating-shimmer" />
                <div className="generating-core">
                  <div className="generating-orb" />
                  <div className="generating-ring" />
                  <div className="generating-sparks">
                    <div className="generating-spark" />
                    <div className="generating-spark" />
                    <div className="generating-spark" />
                    <div className="generating-spark" />
                    <div className="generating-spark" />
                    <div className="generating-spark" />
                  </div>
                </div>
                <span>AI 正在生成图片...</span>
                <small>预计需要 30-60 秒</small>
              </div>
            ) : result ? (
              <img
                src={result.imageUrl}
                alt="Generated"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <div className="preview-empty">
                <div className="preview-empty-icon">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.3)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <span>根据图片质量及大小，需要30~60秒左右生成</span>
              </div>
            )}
            </div>
            {result && (
              <div className="modal-actions" style={{ borderTop: 'none', padding: '12px 0 0' }}>
                <a className="button primary compact" href={result.imageUrl} target="_blank" rel="noreferrer" download>下载图片</a>
                <button className="button ghost compact" onClick={clearResult}>重新生成</button>
              </div>
            )}
          </div>
        </div>
      </section>

      {user && (cachedImages.length > 0 || gallery.length > 0) && (
        <section className="section-panel" style={{ padding: 32 }}>
          <h3 style={{ marginBottom: 4, fontSize: 18 }}>作品画廊（最近5张）</h3>
          <small style={{ display: 'block', marginBottom: 16, color: 'var(--muted)', fontSize: 12 }}>存储最近的5张图，生成结果仅在平台保留48小时。喜欢的作品请尽快下载到本地，过期后可能无法找回。</small>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {(cachedImages.length > 0 ? cachedImages : gallery.slice(0, MAX_GALLERY_ITEMS)).map((img) => {
              const url = 'imageUrl' in img ? img.imageUrl : (img as GeneratedImage).image_url!
              const promptText = 'prompt' in img ? img.prompt : (img as GeneratedImage).prompt
              return (
                <div
                  key={url}
                  style={{ display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer' }}
                  onClick={() => setLightbox({ url, prompt: promptText })}
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
        </section>
      )}

      <section className="faq-section section-panel">
        <div className="section-heading">
          <span className="eyebrow">FAQ</span>
          <h2>常见问题</h2>
        </div>
        <div className="faq-list">
          {faqs.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <ImageLightbox
        open={lightbox !== null}
        imageUrl={lightbox?.url || ''}
        prompt={lightbox?.prompt || ''}
        onClose={() => setLightbox(null)}
      />

    </>
  )
}

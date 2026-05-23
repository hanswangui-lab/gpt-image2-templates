import { Link } from 'react-router-dom'
import { useAuthContext } from '../hooks/AuthContext'
import { useGenerateContext } from '../hooks/GenerateContext'
import { config } from '../lib/config'

const RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16', '2:3', '3:2'] as const

function GenerationPlaceholder() {
  return (
    <div className="preview-empty">
      <span>输入提示词后生成图片，需要30秒左右生成</span>
    </div>
  )
}

function GenerationSpinner() {
  return (
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
  )
}

export default function GeneratePage() {
  const { user, credits } = useAuthContext()
  const {
    prompt, setPrompt, ratio, setRatio, resIndex, setResIndex,
    generating, result, error, handleGenerate, clearResult,
  } = useGenerateContext()

  const resolution = config.resolutions[resIndex]

  return (
    <section className="section-panel">
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
                <button
                  key={r}
                  className={ratio === r ? 'filter-button active' : 'filter-button'}
                  onClick={() => setRatio(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <span style={{ display: 'block', marginBottom: 8, color: 'var(--muted)', fontSize: 13 }}>清晰度</span>
            <div className="filter-group">
              {config.resolutions.map((r, i) => (
                <button
                  key={r.label}
                  className={resIndex === i ? 'filter-button active' : 'filter-button'}
                  onClick={() => setResIndex(i)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ color: 'var(--muted)', fontSize: 14 }}>
              {user ? `当前积分：${credits} · 本次消耗：${resolution.cost}` : '登录后生图'}
            </span>
            <button
              className="button primary"
              onClick={handleGenerate}
              disabled={generating}
              style={{ minWidth: 160, opacity: generating ? 0.6 : 1 }}
            >
              {generating ? '生成中...' : '生成图片'}
            </button>
          </div>

          {error && (
            <div className="auth-error" style={{ marginTop: 16 }}>
              {error}
              {error.includes('积分不足') && (
                <Link className="button primary compact" style={{ marginLeft: 12 }} to="/pricing">去充值</Link>
              )}
            </div>
          )}
        </div>

        {/* Right: Preview */}
        <div className="generator-right" style={{ flexDirection: 'column', gap: 0 }}>
          <h3 style={{ marginBottom: 12, fontSize: 16, fontWeight: 700, alignSelf: 'flex-start' }}>预览</h3>
          <div style={{ width: 480, height: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: 'var(--panel)', border: '1px solid var(--line)', overflow: 'hidden', flexShrink: 0 }}>
          {generating ? (
            <GenerationSpinner />
          ) : result ? (
            <img
              src={result.imageUrl}
              alt="Generated"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <GenerationPlaceholder />
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
  )
}

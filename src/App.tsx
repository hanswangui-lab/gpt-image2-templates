import { useEffect, useMemo, useRef, useState } from 'react'
import { categories, sourceAttribution, templates } from './data/templates'
import type { TemplateItem } from './types'

const faqs = [
  {
    question: '真实内容从哪里来？',
    answer: `数据来自参考站公开加载的 /cases.json 和 /style-library.json，源项目为 ${sourceAttribution.name}，许可为 ${sourceAttribution.license}。`,
  },
  {
    question: '是否可以商用？',
    answer: '可以自行研究使用，注意 AI 生成素材使用规范。',
  },
  {
    question: '如何更新到最新数据？',
    answer: '在项目目录运行 node scripts/sync-reference-data.mjs，然后重新构建即可同步参考站公开 JSON 的最新内容。',
  },
]

function App() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null)

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return templates.filter((template) => {
      const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
      const searchable = [
        template.title,
        template.categoryLabel,
        template.description,
        template.prompt,
        template.sourceLabel,
        template.sourceUrl,
        template.githubUrl,
        ...template.tags,
      ]
        .join(' ')
        .toLowerCase()

      return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery))
    })
  }, [query, selectedCategory])

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2200)
  }

  const copyPrompt = async (template: TemplateItem, e?: React.MouseEvent) => {
    if (e) { e.stopPropagation(); e.preventDefault() }
    const text = template.prompt
    if (!text || text.length < 5) {
      showToast('提示词内容为空')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      showToast(`已复制：${template.title}`)
      return
    } catch { /* clipboard API failed */ }

    try {
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.left = '-9999px'
      el.style.top = '0'
      document.body.appendChild(el)
      el.focus()
      el.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(el)
      if (ok) { showToast(`已复制：${template.title}`); return }
    } catch { /* fallback failed */ }

    // Final fallback: show prompt in an alert
    showToast(`提示词已显示，请手动复制`)
    window.setTimeout(() => { alert(text) }, 100)
  }

  const heroPreviewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = heroPreviewRef.current
    if (!container) return

    const cards = container.querySelectorAll<HTMLElement>('.preview-card')
    const handlers: Array<{ move(e: MouseEvent): void; leave(): void }> = []

    cards.forEach((card) => {
      const move = (e: MouseEvent) => {
        const rect = card.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const centerX = rect.width / 2
        const centerY = rect.height / 2
        const rotateX = ((y - centerY) / centerY) * -8
        const rotateY = ((x - centerX) / centerX) * 8
        card.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`
      }
      const leave = () => {
        card.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
      }
      card.addEventListener('mousemove', move)
      card.addEventListener('mouseleave', leave)
      handlers.push({ move, leave })
    })

    return () => {
      cards.forEach((card, i) => {
        card.removeEventListener('mousemove', handlers[i].move)
        card.removeEventListener('mouseleave', handlers[i].leave)
      })
    }
  }, [])

  useEffect(() => {
    if (!selectedTemplate) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedTemplate(null)
    }
    window.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [selectedTemplate])

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="site-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="navbar">
        <a className="brand" href="#home" onClick={closeMenu}>
          <img className="brand-mark" src="/logo.png" alt="Logo" />
          <span>
            <strong>GPT Image 2</strong>
            <small>提示词模板库</small>
          </span>
        </a>

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
          <a href="#home" onClick={closeMenu}>首页</a>
          <a href="#templates" onClick={closeMenu}>模板</a>
          <a href="#faq" onClick={closeMenu}>FAQ</a>
        </nav>

        <a className="nav-cta" href="https://bestapi.vip/" target="_blank">生成图片</a>
      </header>

      <main>
        <section id="home" className="hero section-panel">
          <div className="hero-copy">
            <span className="eyebrow">GPT image 2</span>
            <h1>妙笔生花，即刻呈现</h1>
            <p>
              已从公开数据源导入 {templates.length} 条 GPT-Image2 模板与案例 Prompt，保留来源链接，支持分类筛选与全文搜
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#templates">探索模板</a>
              <a className="button secondary" href="https://bestapi.vip/" target="_blank">生成图片</a>
            </div>
          </div>

          <div className="hero-preview" ref={heroPreviewRef} aria-label="模板预览墙">
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

        <section id="templates" className="templates-section section-panel">
          <div className="section-heading">
            <span className="eyebrow">Templates</span>
            <h2>真实 GPT-Image2 内容库</h2>
            <p>同步自公开数据源，按真实分类筛选或搜索关键词，找到后直接复制 Prompt。</p>
          </div>

          <div className="template-toolbar">
            <label className="search-field">
              <span>搜索模板</span>
              <input
                type="search"
                placeholder="搜索：UI、海报、电商、摄影、Prompt..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            <div className="filter-group" aria-label="模板分类">
              {categories.map((category) => (
                <button
                  className={selectedCategory === category.value ? 'filter-button active' : 'filter-button'}
                  key={category.value}
                  type="button"
                  onClick={() => setSelectedCategory(category.value)}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          <div className="result-line">
            已显示 <strong>{filteredTemplates.length}</strong> / {templates.length} 条真实内容
          </div>

          {filteredTemplates.length > 0 ? (
            <div className="templates-grid">
              {filteredTemplates.map((template) => (
                <article className="template-card" key={template.id}
                  onClick={() => setSelectedTemplate(template)}>
                  <div className="template-preview" style={template.image ? {} : { background: template.gradient }}>
                    {template.image ? (
                      <img className="template-preview-img" src={template.image} alt={template.title} loading="lazy" />
                    ) : (
                      <span className="preview-fallback">{template.previewTitle}</span>
                    )}
                  </div>

                  <div className="template-content">
                    <h3 className="template-title">{template.title}</h3>
                    <p className="template-desc">{template.description}</p>
                    <span className="template-cat">{template.categoryLabel}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>没有找到匹配模板</strong>
              <p>试试减少关键词，或切换到“全部”分类。</p>
            </div>
          )}
        </section>

        <section id="faq" className="faq-section section-panel">
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

        <section className="final-cta section-panel">
          <span className="eyebrow">Start creating</span>
          <h2>准备好复用真实 Prompt 了吗？</h2>
          <p>选择一条真实模板或案例，复制 Prompt，再根据你的品牌、产品和画幅继续改写。</p>
          <a className="button primary" href="#templates">马上浏览模板</a>
        </section>
      </main>

      <footer className="footer">
        <p>GPT Image 2 模板库 · 静态 Prompt Gallery</p>
        <p>
          GPT Image 2 模板库 · 静态 Prompt Gallery 数据来源：互联网，许可：MIT
        </p>
      </footer>

      {toast && <div className="toast" role="status">{toast}</div>}

      {selectedTemplate && (
        <div className="modal-overlay" onClick={() => setSelectedTemplate(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setSelectedTemplate(null)}>✕</button>

            <div className="modal-layout">
              <div className="modal-image" style={selectedTemplate.image ? {} : { background: selectedTemplate.gradient }}>
                {selectedTemplate.image ? (
                  <img src={selectedTemplate.image} alt={selectedTemplate.title} />
                ) : (
                  <strong>{selectedTemplate.previewTitle}</strong>
                )}
              </div>

              <div className="modal-right">
              <div className="modal-body">
              <div className="modal-meta">
                <span>{selectedTemplate.categoryLabel}</span>
                <span>{selectedTemplate.tags.length} tags</span>
              </div>
              <h2>{selectedTemplate.title}</h2>
              <p>{selectedTemplate.description}</p>
              <div className="tag-list">
                {selectedTemplate.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="modal-prompt">
                <span className="modal-prompt-label">完整 Prompt</span>
                <pre>{selectedTemplate.prompt}</pre>
              </div>
            </div>
              <div className="modal-actions">
                <button className="button primary compact" type="button" onClick={(e) => copyPrompt(selectedTemplate, e)}>
                  复制提示词
                </button>
                {selectedTemplate.githubUrl && (
                  <a className="button ghost compact" href={selectedTemplate.githubUrl} target="_blank" rel="noreferrer">
                    GitHub
                  </a>
                )}
                {selectedTemplate.sourceUrl && (
                  <a className="button ghost compact" href={selectedTemplate.sourceUrl} target="_blank" rel="noreferrer">
                    来源：{selectedTemplate.sourceLabel || 'Source'}
                  </a>
                )}
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

import { useMemo, useState, useEffect, useCallback } from 'react'
import { categories, templates } from '../data/templates'
import type { TemplateItem } from '../types'
import { useAuthContext } from '../hooks/AuthContext'
import TemplateModal from '../components/TemplateModal'
import { fetchAiwindTemplates } from '../services/aiwindApi'

const PAGE_SIZE = 100

export default function TemplatesPage() {
  const { user, consumeCredits, setShowAuth } = useAuthContext()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null)

  // AiWind state
  const [aiwindItems, setAiwindItems] = useState<TemplateItem[]>([])
  const [aiwindTotal, setAiwindTotal] = useState(0)
  const [aiwindLoading, setAiwindLoading] = useState(false)
  const [aiwindPage, setAiwindPage] = useState(0)
  const [aiwindHasMore, setAiwindHasMore] = useState(true)
  const loadAiwindPage = useCallback(async (page: number, search: string, category: string) => {
    setAiwindLoading(true)
    try {
      const data = await fetchAiwindTemplates({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        category: category !== 'all' ? category : undefined,
      })
      setAiwindItems((prev) => {
        const existingIds = new Set(prev.map((t) => t.id))
        const newItems = data.items.filter((t) => !existingIds.has(t.id))
        return [...prev, ...newItems]
      })
      setAiwindTotal(data.total)
      setAiwindPage(page)
      setAiwindHasMore(page * PAGE_SIZE < data.total)
    } catch {
      // silent
    } finally {
      setAiwindLoading(false)
    }
  }, [])

  // Load first page of aiwind on mount and when filters change
  useEffect(() => {
    setAiwindItems([])
    setAiwindPage(0)
    setAiwindHasMore(true)
    loadAiwindPage(1, query, selectedCategory)
  }, [query, selectedCategory, loadAiwindPage])

  const loadMore = () => {
    if (aiwindLoading || !aiwindHasMore) return
    loadAiwindPage(aiwindPage + 1, query, selectedCategory)
  }

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    // Filter curated templates
    const filteredCurated = templates.filter((template) => {
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
      ].join(' ').toLowerCase()
      return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery))
    })

    // Curated templates first, then aiwind items (already filtered server-side)
    // Deduplicate: skip aiwind items that share the same title as a curated template
    const curatedTitles = new Set(filteredCurated.map((t) => t.title.toLowerCase()))
    const filteredAiwind = aiwindItems.filter((t) => !curatedTitles.has(t.title.toLowerCase()))

    return [...filteredCurated, ...filteredAiwind]
  }, [query, selectedCategory, aiwindItems])

  const totalCount = templates.length + aiwindTotal

  return (
    <>
      <section className="templates-section section-panel">
        <div className="section-heading">
          <span className="eyebrow">Templates</span>
          <h2>真实 GPT-Image2 内容库</h2>
          <p>精选优质模板 + AiWind 社区内容，按分类筛选或搜索关键词，找到后直接复制 Prompt。</p>
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
          已显示 <strong>{filteredTemplates.length}</strong> / {totalCount} 条内容
        </div>

        {filteredTemplates.length > 0 ? (
          <>
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
                    {template.sourceLabel && (
                      <span className="template-source" style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>
                        {template.sourceLabel}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {aiwindHasMore && (
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <button
                  className="button secondary"
                  onClick={loadMore}
                  disabled={aiwindLoading}
                >
                  {aiwindLoading ? '加载中...' : '加载更多 (每次100条)'}
                </button>
              </div>
            )}
          </>
        ) : aiwindLoading && filteredTemplates.length === 0 ? (
          <div className="empty-state"><strong>加载中...</strong></div>
        ) : (
          <div className="empty-state">
            <strong>没有找到匹配模板</strong>
            <p>试试减少关键词，或切换到"全部"分类。</p>
          </div>
        )}
      </section>

      {selectedTemplate && (
        <TemplateModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          user={user}
          consumeCredits={consumeCredits}
          setShowAuth={setShowAuth}
          creditCost={1}
        />
      )}
    </>
  )
}

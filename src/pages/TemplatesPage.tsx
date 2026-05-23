import { useMemo, useState } from 'react'
import { categories, templates } from '../data/templates'
import type { TemplateItem } from '../types'
import { useAuthContext } from '../hooks/AuthContext'
import TemplateModal from '../components/TemplateModal'

export default function TemplatesPage() {
  const { user, consumeCredits, setShowAuth } = useAuthContext()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [query, setQuery] = useState('')
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
      ].join(' ').toLowerCase()
      return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery))
    })
  }, [query, selectedCategory])

  return (
    <>
      <section className="templates-section section-panel">
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

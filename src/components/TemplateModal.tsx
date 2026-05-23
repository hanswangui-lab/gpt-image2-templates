import type { TemplateItem } from '../types'
import type { AuthUser } from '../hooks/useAuth'

type Props = {
  template: TemplateItem
  onClose: () => void
  user: AuthUser
  consumeCredits: (amount: number) => Promise<boolean>
  setShowAuth: (v: boolean) => void
  creditCost: number
}

export default function TemplateModal({ template, onClose, user, consumeCredits, setShowAuth, creditCost }: Props) {
  const copyPrompt = async (e?: React.MouseEvent) => {
    if (e) { e.stopPropagation(); e.preventDefault() }
    if (user) {
      const ok = await consumeCredits(creditCost)
      if (!ok) { setShowAuth(true); return }
    }
    const text = template.prompt
    if (!text || text.length < 5) return
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch { /* fall through */ }
    try {
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.left = '-9999px'
      el.style.top = '0'
      document.body.appendChild(el)
      el.focus()
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    } catch { /* fallback failed */ }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose}>✕</button>

        <div className="modal-layout">
          <div className="modal-image" style={template.image ? {} : { background: template.gradient }}>
            {template.image ? (
              <img src={template.image} alt={template.title} />
            ) : (
              <strong>{template.previewTitle}</strong>
            )}
          </div>

          <div className="modal-right">
            <div className="modal-body">
              <div className="modal-meta">
                <span>{template.categoryLabel}</span>
                <span>{template.tags.length} tags</span>
              </div>
              <h2>{template.title}</h2>
              <p>{template.description}</p>
              <div className="tag-list">
                {template.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="modal-prompt">
                <span className="modal-prompt-label">完整 Prompt</span>
                <pre>{template.prompt}</pre>
              </div>
            </div>
            <div className="modal-actions">
              <button className="button primary compact" type="button" onClick={copyPrompt}>
                复制提示词 {user ? `(${creditCost} 积分)` : '(免费)'}
              </button>
              {template.githubUrl && (
                <a className="button ghost compact" href={template.githubUrl} target="_blank" rel="noreferrer">GitHub</a>
              )}
              {template.sourceUrl && (
                <a className="button ghost compact" href={template.sourceUrl} target="_blank" rel="noreferrer">
                  来源：{template.sourceLabel || 'Source'}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

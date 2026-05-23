type Props = {
  open: boolean
  imageUrl: string
  prompt: string
  onClose: () => void
}

export default function ImageLightbox({ open, imageUrl, prompt, onClose }: Props) {
  if (!open) return null

  return (
    <div
      className="auth-overlay"
      onClick={onClose}
      style={{ zIndex: 9999, alignItems: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 16,
          overflow: 'hidden',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--line)',
        }}>
          <span style={{ fontSize: 13, color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 12 }}>
            {prompt}
          </span>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <a
              href={imageUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="button primary compact"
              style={{ fontSize: 12, textDecoration: 'none' }}
            >
              下载
            </a>
            <button
              onClick={onClose}
              className="button ghost compact"
              style={{ fontSize: 16, lineHeight: 1, padding: '4px 8px' }}
            >
              ✕
            </button>
          </div>
        </div>

        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000',
          minHeight: 300,
        }}>
          <img
            src={imageUrl}
            alt={prompt}
            style={{
              maxWidth: '100%',
              maxHeight: '80vh',
              objectFit: 'contain',
            }}
          />
        </div>
      </div>
    </div>
  )
}

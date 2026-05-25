import { useState, useEffect, useRef } from 'react'
import { config } from '../lib/config'

type Announcement = { id: string; content: string; created_at: string }

const STORAGE_KEY = 'dismissed_announcements'

function getDismissed(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function addDismissed(id: string) {
  const list = getDismissed().filter((x) => x !== id)
  list.push(id)
  // keep only last 50
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-50)))
}

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    fetch(`${config.vpsApiUrl}/api/announcements`)
      .then((r) => r.json())
      .then((data: Announcement[]) => {
        const dismissed = getDismissed()
        setAnnouncements((data || []).filter((a) => !dismissed.includes(a.id)))
      })
      .catch(() => {})
  }, [])

  // rotate every 5 seconds
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  useEffect(() => {
    if (announcements.length <= 1) return
    timerRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % announcements.length)
    }, 5000)
    return () => clearInterval(timerRef.current)
  }, [announcements.length])

  if (announcements.length === 0) return null

  const current = announcements[index]

  const handleDismiss = (id: string) => {
    addDismissed(id)
    const next = announcements.filter((a) => a.id !== id)
    setAnnouncements(next)
    if (index >= next.length) setIndex(0)
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #00ff88, #00d4ff)',
      color: '#0a0a0f',
      padding: '10px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      fontSize: 14,
      fontWeight: 600,
      flexWrap: 'wrap',
    }}>
      <span>📢📢📢平台公告：{current.content}</span>

      {announcements.length > 1 && (
        <span style={{
          background: 'rgba(0,0,0,0.2)',
          clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)',
          padding: '2px 10px',
          fontSize: 11,
        }}>
          {index + 1}/{announcements.length}
        </span>
      )}

      <button
        onClick={() => handleDismiss(current.id)}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#0a0a0f',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
          padding: '2px 4px',
          opacity: 0.7,
        }}
        title="关闭"
      >
        ✕
      </button>
    </div>
  )
}

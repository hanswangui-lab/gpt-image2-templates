import { Router } from 'express'
import fs from 'fs'
import path from 'path'

const router = Router()

const DATA_PATH = path.resolve(process.cwd(), 'aiwind_templates.json')

let cache: any[] | null = null
let cacheTime = 0
const CACHE_TTL = 10 * 60 * 1000 // 10 min

function loadData(): any[] {
  const now = Date.now()
  if (cache && now - cacheTime < CACHE_TTL) return cache
  try {
    cache = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))
    cacheTime = now
    return cache!
  } catch {
    return []
  }
}

// GET /api/aiwind-templates — paginated list
router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const pageSize = Math.min(500, Math.max(1, parseInt(req.query.pageSize as string) || 100))
  const search = (req.query.search as string || '').trim().toLowerCase()
  const category = (req.query.category as string || 'all').trim()

  const all = loadData()

  let filtered = all
  if (category !== 'all') {
    filtered = filtered.filter((t) => t.category === category)
  }
  if (search) {
    filtered = filtered.filter((t) => {
      const haystack = [t.title, t.categoryLabel, t.description, t.prompt, ...(t.tags || [])].join(' ').toLowerCase()
      return haystack.includes(search)
    })
  }

  const total = filtered.length
  const offset = (page - 1) * pageSize
  const items = filtered.slice(offset, offset + pageSize)

  res.json({ items, total, page, pageSize })
})

export default router

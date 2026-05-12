import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { get } from 'node:https'

const GRADIENTS = [
  ['linear-gradient(135deg, #2563eb, #8b5cf6 52%, #ec4899)', '#93c5fd'],
  ['linear-gradient(135deg, #0f172a, #1d4ed8 54%, #22d3ee)', '#67e8f9'],
  ['linear-gradient(135deg, #581c87, #7c3aed 48%, #f472b6)', '#f0abfc'],
  ['linear-gradient(135deg, #064e3b, #10b981 50%, #a7f3d0)', '#6ee7b7'],
  ['linear-gradient(135deg, #7c2d12, #ea580c 52%, #fde68a)', '#fed7aa'],
  ['linear-gradient(135deg, #312e81, #4f46e5 48%, #c4b5fd)', '#c4b5fd'],
  ['linear-gradient(135deg, #111827, #334155 48%, #f8fafc)', '#cbd5e1'],
  ['linear-gradient(135deg, #831843, #e11d48 52%, #f9a8d4)', '#f9a8d4'],
]

const IMGS_DIR = new URL('../public/images/', import.meta.url)
const DATA_PATH = new URL('../src/data/templates.ts', import.meta.url)
const SCRAPED_PATH = new URL('scraped_all_data.json', import.meta.url)

await mkdir(IMGS_DIR, { recursive: true })
const scraped = JSON.parse(await readFile(SCRAPED_PATH, 'utf-8'))

// Download helpers
const downloadFile = (url, dest) => new Promise((resolve) => {
  if (!url || url === 'null') { resolve(false); return }
  get(url, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      downloadFile(res.headers.location, dest).then(resolve)
      return
    }
    if (res.statusCode !== 200) { resolve(false); return }
    const file = createWriteStream(dest)
    res.pipe(file)
    file.on('finish', () => { file.close(); resolve(true) })
    file.on('error', () => resolve(false))
  }).on('error', () => resolve(false))
})

const nameToId = (title) => {
  const safe = title.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '-').replace(/^-|-$/g, '')
  return 'img2-' + safe.slice(0, 50)
}

const toPreview = (title) => {
  if (!title) return 'AI'
  const clean = title.replace(/[一-鿿]/g, '').trim()
  return clean.slice(0, 18) || title.slice(0, 18)
}

// Read existing titles for dedup
const existingText = await readFile(DATA_PATH, 'utf-8')
const existingTitles = new Set([...existingText.matchAll(/"title":\s*"([^"]+)"/g)].map(m => m[1]))
const existingUrls = new Set([...existingText.matchAll(/"sourceUrl":\s*"([^"]+)"/g)].map(m => m[1]))
const existingPrompts = new Set([...existingText.matchAll(/"prompt":\s*"([^"]{50,})"/g)].map(m => m[1]))

// Filter truly new items
const trulyNew = scraped.filter(item => {
  const t = (item.title || '').trim()
  const p = (item.prompt || '').trim()
  if (!p || p.length < 50) return false
  if (existingTitles.has(t)) return false
  if (existingPrompts.has(p.slice(0, 100))) return false
  return true
})

console.log(`Scraped: ${scraped.length}, new (deduped): ${trulyNew.length}`)

// Build entries
const entries = []
for (let i = 0; i < trulyNew.length; i++) {
  const item = trulyNew[i]
  const slug = item.slug
  const title = (item.title || 'AI Prompt').trim()
  const prompt = (item.prompt || '').trim()
  const [gradient, accent] = GRADIENTS[i % GRADIENTS.length]
  const id = nameToId(title)
  const desc = prompt.slice(0, 120) + (prompt.length > 120 ? '...' : '')

  // Download image
  let localImage = null
  if (item.image && item.image !== 'null' && item.image.startsWith('http')) {
    const ext = item.image.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || 'jpg'
    const fname = `${id}.${ext}`
    const dest = new URL(fname, IMGS_DIR)
    try {
      await access(dest)
      localImage = `/images/${fname}`
    } catch {
      console.log(`  dl: ${fname}`)
      const ok = await downloadFile(item.image, dest.pathname)
      if (ok) localImage = `/images/${fname}`
    }
  }

  entries.push({
    id, title, category: 'other-use-cases', categoryLabel: '其他应用场景',
    description: desc, tags: [], prompt, gradient, accent,
    previewTitle: toPreview(title),
    image: localImage,
    sourceLabel: 'image2.fun',
    sourceUrl: `https://image2.fun${slug}`,
    githubUrl: undefined,
  })
}

if (entries.length === 0) { console.log('Nothing to add.'); process.exit(0) }

// Append to templates.ts
const insertPoint = existingText.lastIndexOf(']')
const jsonStr = entries.map(e => JSON.stringify(e, null, 2)).join(',\n')
const merged = existingText.slice(0, insertPoint) + ',\n' + jsonStr + '\n' + existingText.slice(insertPoint)
await writeFile(DATA_PATH, merged)

console.log(`Merged ${entries.length} new records.`)

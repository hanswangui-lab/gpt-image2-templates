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
const SCRAPED_PATH = new URL('scraped_remaining.json', import.meta.url)

await mkdir(IMGS_DIR, { recursive: true })
const scraped = JSON.parse(await readFile(SCRAPED_PATH, 'utf-8'))

const downloadFile = (url, dest) => new Promise((resolve) => {
  if (!url || url === 'null') { resolve(false); return }
  get(url, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      downloadFile(res.headers.location, dest).then(resolve); return
    }
    if (res.statusCode !== 200) { resolve(false); return }
    const file = createWriteStream(dest)
    res.pipe(file)
    file.on('finish', () => { file.close(); resolve(true) })
    file.on('error', () => resolve(false))
  }).on('error', () => resolve(false))
})

const safeId = (title) => {
  const s = title.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '-').replace(/^-|-$/g, '')
  return 'img2-' + s.slice(0, 50)
}
const toPreview = (t) => { const c = (t || '').replace(/[一-鿿]/g, '').trim(); return c.slice(0, 18) || (t || '').slice(0, 18) }

// Read existing titles for dedup
const existingText = await readFile(DATA_PATH, 'utf-8')
const existingTitles = new Set([...existingText.matchAll(/"title":\s*"([^"]+)"/g)].map(m => m[1]))
const existingPrompts = new Set([...existingText.matchAll(/"prompt":\s*"([^"]{80,})"/g)].map(m => m[1].slice(0, 100))]

const newEntries = []
for (let i = 0; i < scraped.length; i++) {
  const item = scraped[i]
  const title = (item.title || '').trim()
  const prompt = (item.prompt || '').trim()
  if (!prompt || prompt.length < 50) continue
  if (existingTitles.has(title)) continue

  const existing = [...existingPrompts].filter(p => prompt.startsWith(p) || prompt.includes(p.slice(0, 60)))
  if (existing.length > 0) continue

  const [gradient, accent] = GRADIENTS[i % GRADIENTS.length]
  const id = safeId(title)
  const desc = prompt.slice(0, 120) + (prompt.length > 120 ? '...' : '')

  // Download image
  let localImage = null
  if (item.image && item.image.startsWith('http')) {
    const ext = item.image.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || 'jpg'
    const fname = `${id}.${ext}`
    const dest = new URL(fname, IMGS_DIR)
    try { await access(dest); localImage = `/images/${fname}` }
    catch {
      process.stdout.write(`  img: ${fname} `)
      const ok = await downloadFile(item.image, dest.pathname)
      console.log(ok ? 'OK' : 'FAIL')
      if (ok) localImage = `/images/${fname}`
    }
  }

  newEntries.push({
    id, title, category: 'other-use-cases', categoryLabel: '其他应用场景',
    description: desc, tags: [], prompt, gradient, accent,
    previewTitle: toPreview(title), image: localImage,
    sourceLabel: 'image2.fun', sourceUrl: `https://image2.fun${item.slug}`,
  })
}

console.log(`\nNew entries to add: ${newEntries.length}`)
if (newEntries.length === 0) { process.exit(0) }

// Append to templates.ts
const insertPoint = existingText.lastIndexOf(']')
const jsonStr = newEntries.map(e => JSON.stringify(e, null, 2)).join(',\n')
await writeFile(DATA_PATH, existingText.slice(0, insertPoint) + ',\n' + jsonStr + '\n' + existingText.slice(insertPoint))
console.log('Merged into templates.ts')

// Also save reference JSON
await writeFile(new URL('merged_remaining.json', import.meta.url), JSON.stringify(newEntries, null, 2))
console.log('Done.')

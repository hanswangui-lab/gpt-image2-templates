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
const SCRAPED_PATH = new URL('scraped_poster_data.json', import.meta.url)

await mkdir(IMGS_DIR, { recursive: true })

const scraped = JSON.parse(await readFile(SCRAPED_PATH, 'utf-8'))

const downloadFile = (url, dest) => new Promise((resolve, reject) => {
  get(url, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      downloadFile(res.headers.location, dest).then(resolve).catch(reject)
      return
    }
    if (res.statusCode !== 200) { resolve(false); return }
    const file = createWriteStream(dest)
    res.pipe(file)
    file.on('finish', () => { file.close(); resolve(true) })
    file.on('error', reject)
  }).on('error', reject)
})

const sanitizeId = (value) =>
  value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const toPreview = (title) => {
  if (!title) return 'Poster'
  return title.replace(/[一-鿿]/g, '').trim() || title.slice(0, 18)
}

const newItems = []
for (let i = 0; i < scraped.length; i++) {
  const item = scraped[i]
  const [gradient, accent] = GRADIENTS[i % GRADIENTS.length]
  const id = `img2fun-${sanitizeId(item.title).slice(0, 40)}`

  // Download image
  let localImage = null
  if (item.image) {
    const ext = item.image.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || 'jpg'
    const filename = `${id}.${ext}`
    const destPath = new URL(filename, IMGS_DIR)
    try {
      await access(destPath)
      localImage = `/images/${filename}`
    } catch {
      console.log(`  downloading ${filename}...`)
      const ok = await downloadFile(item.image, destPath.pathname)
      if (ok) localImage = `/images/${filename}`
      else console.warn(`  FAILED: ${item.image}`)
    }
  }

  const prompt = (item.prompt || '').trim()
  newItems.push({
    id,
    title: item.title,
    category: 'posters-and-typography',
    categoryLabel: '海报与排版',
    description: prompt.slice(0, 120) + (prompt.length > 120 ? '...' : ''),
    tags: ['海报', '排版'],
    prompt,
    gradient,
    accent,
    previewTitle: toPreview(item.title),
    image: localImage,
    sourceLabel: 'image2.fun',
    sourceUrl: `https://image2.fun${item.slug}`,
    githubUrl: null,
  })
}

// Read existing data
const existingText = await readFile(DATA_PATH, 'utf-8')

// Extract existing titles for dedup
const titleRe = /"title":\s*"([^"]+)"/g
const existingTitles = new Set()
let m
while ((m = titleRe.exec(existingText)) !== null) existingTitles.add(m[1])

// Filter new items that aren't in existing data
const trulyNew = newItems.filter(item => !existingTitles.has(item.title))
console.log(`\nScraped: ${scraped.length}, new (by title): ${trulyNew.length}`)

if (trulyNew.length === 0) {
  console.log('No new items to add.')
  process.exit(0)
}

// Append new items to existing data
// Find the end of the templates array
const insertPoint = existingText.lastIndexOf(']\n')
const before = existingText.slice(0, insertPoint)
const after = existingText.slice(insertPoint)

// Build the new templates entries
const newData = trulyNew.map(item => JSON.stringify(item, null, 2)).join(',\n')

const merged = before + ',\n' + newData + '\n' + after

// Update the count in the sourceAttribution section
const updated = merged.replace(
  /(url: '[^']+',?\n\s+license: 'MIT',?\n\s+dataUrl: '[^']+',?\n)/,
  (match) => match
)

await writeFile(DATA_PATH, updated)
console.log(`Merged ${trulyNew.length} new records. Total templates array updated.`)

// Also save to a JSON for reference
await writeFile(
  new URL('scraped_new_items.json', import.meta.url),
  JSON.stringify(trulyNew, null, 2)
)
console.log('Saved scraped_new_items.json')

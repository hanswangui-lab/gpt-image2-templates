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

const CANGHE_BASE = 'https://gpt-image2.canghe.ai'
const IMGS_DIR = new URL('../public/images/', import.meta.url)
const DATA_PATH = new URL('../src/data/templates.ts', import.meta.url)
await mkdir(IMGS_DIR, { recursive: true })

// Fetch source data
const [markdownResp, casesResp] = await Promise.all([
  fetch('https://raw.githubusercontent.com/freestylefly/awesome-gpt-image-2/main/docs/gallery-part-2.md'),
  fetch(`${CANGHE_BASE}/cases.json`)
])
const md = await markdownResp.text()
let casesData = await casesResp.json()
if (!Array.isArray(casesData)) casesData = casesData.cases || []

// Build source case map
const sourceMap = {}
for (const c of casesData) { sourceMap[c.id] = c }

const zhCategoryLabels = {
  'Architecture & Spaces': '建筑与空间', 'Brand & Logos': '品牌与标志', 'Characters & People': '人物与角色',
  'Charts & Infographics': '图表与信息可视化', 'Documents & Publishing': '文档与出版物', 'History & Classical Themes': '历史与古风题材',
  'Illustration & Art': '插画与艺术', 'Other Use Cases': '其他应用场景', 'Photography & Realism': '摄影与写实',
  'Posters & Typography': '海报与排版', 'Products & E-commerce': '商品与电商', 'Scenes & Storytelling': '场景与叙事',
  'UI & Interfaces': 'UI 与界面',
}

const sanitizeId = (v) => v.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Read existing data
const existingText = await readFile(DATA_PATH, 'utf-8')
const existingIds = new Set()
for (const m of existingText.matchAll(/"id":\s*"case-(\d+)"/g)) existingIds.add(parseInt(m[1]))
const existingTitles = new Set([...existingText.matchAll(/"title":\s*"([^"]+)"/g)].map(m => m[1]))

// Parse markdown and build entries
const caseBlocks = md.split(/(?=### 例 \d+：)/)
const newEntries = []
let skipped = 0

for (const block of caseBlocks) {
  const idMatch = block.match(/case-(\d+)/)
  if (!idMatch) continue
  const id = parseInt(idMatch[1])
  const titleMatch = block.match(/### 例 \d+：(.+)/)
  const promptMatch = block.match(/```text\n([\s\S]*?)```/)
  const sourceMatch = block.match(/@([\w]+)/)
  const sourceUrlMatch = block.match(/https:\/\/x\.com\/\w+\/status\/\d+/)
  const imageMatch = block.match(/!\[.*?\]\((.+?)\)/)

  if (existingIds.has(id) || existingTitles.has(titleMatch?.[1]?.trim())) {
    skipped++
    continue
  }

  const sourceCase = sourceMap[id]
  const title = (titleMatch?.[1] || '').trim()
  const prompt = (promptMatch?.[1] || '').trim()
  const rawPrompt = sourceCase?.prompt || prompt
  const category = sourceCase?.category || 'Other Use Cases'
  const styles = sourceCase?.styles || []
  const scenes = sourceCase?.scenes || []
  const tags = [...new Set([...styles, ...scenes])]
  const sourceLabel = sourceCase?.sourceLabel || (sourceMatch ? `@${sourceMatch[1]}` : '')
  const sourceUrl = sourceCase?.sourceUrl || (sourceUrlMatch ? sourceUrlMatch[0] : '')
  const githubUrl = sourceCase?.githubUrl || `https://github.com/freestylefly/awesome-gpt-image-2/blob/main/docs/gallery-part-2.md#case-${id}`
  const imagePath = sourceCase?.image || (imageMatch?.[1]?.replace('../data/images/', '/images/') || '')

  const idx = newEntries.length % GRADIENTS.length
  const [gradient, accent] = GRADIENTS[idx]
  const catKey = sanitizeId(category)
  const catLabel = zhCategoryLabels[category] || category

  const desc = (sourceCase?.promptPreview || rawPrompt).slice(0, 120) + '...'

  // Download image
  let localImage = null
  if (imagePath) {
    const remoteUrl = imagePath.startsWith('http') ? imagePath : `${CANGHE_BASE}${imagePath}`
    const ext = remoteUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || 'jpg'
    const fname = `case-${id}.${ext}`
    const dest = new URL(fname, IMGS_DIR)
    try {
      await access(dest); localImage = `/images/${fname}`
    } catch {
      try {
        const resp = await fetch(remoteUrl)
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer())
          await writeFile(dest, buf)
          localImage = `/images/${fname}`
        }
      } catch {}
    }
  }

  const previewTitle = title.replace(/[一-鿿]/g, '').trim().slice(0, 18) || title.slice(0, 18)

  newEntries.push({
    id: `case-${id}`, title, category: catKey, categoryLabel: catLabel,
    description: desc, tags, prompt: rawPrompt,
    gradient, accent, previewTitle, image: localImage,
    sourceLabel, sourceUrl, githubUrl,
  })
}

console.log(`Added: ${newEntries.length}, Skipped: ${skipped}`)
if (newEntries.length === 0) process.exit(0)

// Append to data
const jsonStr = newEntries.map(e => JSON.stringify(e, null, 2)).join(',\n')
const insert = existingText.lastIndexOf(']')
await writeFile(DATA_PATH, existingText.slice(0, insert) + ',\n' + jsonStr + '\n' + existingText.slice(insert))
console.log('Done!')

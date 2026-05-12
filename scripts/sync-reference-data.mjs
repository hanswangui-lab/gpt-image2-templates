const SOURCE_BASE = 'https://gpt-image2.canghe.ai'
const OUTPUT_PATH = new URL('../src/data/templates.ts', import.meta.url)
const IMAGES_DIR = new URL('../public/images/', import.meta.url)
const { mkdir, writeFile } = await import('node:fs/promises')
const { access: fsAccess } = await import('node:fs/promises')
await mkdir(IMAGES_DIR, { recursive: true })

const gradients = [
  ['linear-gradient(135deg, #2563eb, #8b5cf6 52%, #ec4899)', '#93c5fd'],
  ['linear-gradient(135deg, #0f172a, #1d4ed8 54%, #22d3ee)', '#67e8f9'],
  ['linear-gradient(135deg, #581c87, #7c3aed 48%, #f472b6)', '#f0abfc'],
  ['linear-gradient(135deg, #064e3b, #10b981 50%, #a7f3d0)', '#6ee7b7'],
  ['linear-gradient(135deg, #7c2d12, #ea580c 52%, #fde68a)', '#fed7aa'],
  ['linear-gradient(135deg, #312e81, #4f46e5 48%, #c4b5fd)', '#c4b5fd'],
  ['linear-gradient(135deg, #111827, #334155 48%, #f8fafc)', '#cbd5e1'],
  ['linear-gradient(135deg, #831843, #e11d48 52%, #f9a8d4)', '#f9a8d4'],
]

const zhCategoryLabels = new Map([
  ['UI & Interfaces', 'UI 与界面'],
  ['Charts & Infographics', '图表与信息可视化'],
  ['Posters & Typography', '海报与排版'],
  ['Products & E-commerce', '商品与电商'],
  ['Brand & Logos', '品牌与标志'],
  ['Architecture & Spaces', '建筑与空间'],
  ['Photography & Realism', '摄影与写实'],
  ['Illustration & Art', '插画与艺术'],
  ['Characters & People', '人物与角色'],
  ['Scenes & Storytelling', '场景与叙事'],
  ['History & Classical Themes', '历史与古风题材'],
  ['Documents & Publishing', '文档与出版物'],
  ['Other Use Cases', '其他应用场景'],
])

const sanitizeId = (value) =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const pickLocalized = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.zh || value.en || ''
}

const toPreview = (title) => {
  if (!title) return 'GPT-Image2 Case'
  return String(title).replace(/[一-鿿]/g, '').trim() || String(title).slice(0, 18)
}

const firstParagraph = (text) => String(text || '').replace(/\s+/g, ' ').trim()

const getJson = async (path) => {
  const response = await fetch(`${SOURCE_BASE}${path}`)
  if (!response.ok) throw new Error(`Failed to fetch ${path}: ${response.status}`)
  return response.json()
}

const downloadImage = async (remotePath, id) => {
  if (!remotePath) return undefined
  const filename = `${id}${remotePath.match(/\.\w+$/)?.[0] || '.jpg'}`
  const localPath = new URL(filename, IMAGES_DIR)
  // Skip if already downloaded
  try {
    await import('node:fs/promises').then(fs => fs.access(localPath))
    return `/images/${filename}` // file exists
  } catch {}
  try {
    const response = await fetch(`${SOURCE_BASE}${remotePath}`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    await writeFile(localPath, buffer)
    return `/images/${filename}`
  } catch (err) {
    console.warn(`  skip image ${remotePath}: ${err.message}`)
    return undefined
  }
}

const styleLibrary = await getJson('/style-library.json')
const casesData = await getJson('/cases.json')

// Import REAL cases with actual prompts (sorted newest first)
const realCases = await Promise.all(
  casesData.cases
    .slice() // copy
    .sort((a, b) => (b.id || 0) - (a.id || 0)) // newest first
    .slice(0, 120) // take 120 cases
    .map(async (item, index) => {
      const [gradient, accent] = gradients[index % gradients.length]
      const id = `case-${item.id}`
      const image = await downloadImage(item.image, id, fsAccess)
      return {
        id,
        title: item.title,
        category: sanitizeId(item.category),
        categoryLabel: zhCategoryLabels.get(item.category) || item.category,
        description: firstParagraph(item.promptPreview || item.prompt).slice(0, 150),
        tags: [...new Set([...(item.styles || []), ...(item.scenes || [])])].slice(0, 5),
        prompt: item.prompt,
        gradient,
        accent,
        previewTitle: toPreview(item.title),
        image,
        sourceLabel: item.sourceLabel,
        sourceUrl: item.sourceUrl,
        githubUrl: item.githubUrl,
      }
    })
)

const templates = realCases
const uniqueCategories = [...new Map(
  templates.map((item) => [item.category, { value: item.category, label: item.categoryLabel }]),
).values()]

const file = `import type { TemplateItem } from '../types'\n\nexport const sourceAttribution = {\n  name: 'awesome-gpt-image-2',\n  url: '${styleLibrary.repository}',\n  license: 'MIT',\n  dataUrl: '${SOURCE_BASE}',\n}\n\nexport const categories = ${JSON.stringify([{ value: 'all', label: '全部' }, ...uniqueCategories], null, 2)} as const\n\nexport const templates: TemplateItem[] = ${JSON.stringify(templates, null, 2)}\n`

await import('node:fs/promises').then(({ writeFile }) => writeFile(OUTPUT_PATH, file))
console.log(`Wrote ${templates.length} records to ${OUTPUT_PATH.pathname}`)

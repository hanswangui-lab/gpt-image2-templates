import { writeFile } from 'node:fs/promises'

const BASE = 'https://image2.fun'

// ---- Step 1: fetch main page and extract card slugs + images ----
const html = await fetch(BASE).then(r => r.text())

const slugPattern = /href="(\/p\/[^"]+)"/g
const slugs = [...new Set([...html.matchAll(slugPattern)].map(m => m[1]))]
console.log(`Found ${slugs.length} card slugs`)

// Extract card data blocks
const cards = []
const seen = new Set()
const linkRe = /<a[^>]*href="(\/p\/[^"]+)"[^>]*>/g
let match
while ((match = linkRe.exec(html)) !== null) {
  const slug = match[1]
  if (seen.has(slug)) continue
  seen.add(slug)

  const block = html.slice(match.index, Math.min(html.length, match.index + 3000))

  // image src
  const imgRe = /<img[^>]*src="([^"]+)"/.exec(block)
  let img = imgRe ? imgRe[1] : null
  // unwrap _next/image query param
  if (img && img.includes('_next/image')) {
    try {
      const qs = new URL(img, BASE).searchParams
      img = decodeURIComponent(qs.get('url') || '')
    } catch {}
  }

  // title from alt or h3
  const titleRe = /alt="([^"]{5,})"/.exec(block)
  const h3Re = /<h3[^>]*>([^<]+)</.exec(block)
  const title = titleRe?.[1] || h3Re?.[1] || null

  cards.push({ slug, image: img, title })
}

console.log(`Extracted ${cards.length} cards`)
const first20 = cards.slice(0, 20)
for (const c of first20) {
  console.log(`\n  ${c.slug}`)
  console.log(`  title: ${c.title}`)
  console.log(`  image: ${(c.image || 'N/A').slice(0, 150)}`)
}

await writeFile(
  new URL('extracted_cards.json', import.meta.url),
  JSON.stringify(cards, null, 2)
)
console.log('\nSaved extracted_cards.json')

// ---- Step 2: fetch detail pages for prompts ----
const BATCH_SIZE = 30
const results = []

for (let i = 0; i < Math.min(BATCH_SIZE, cards.length); i++) {
  const card = cards[i]
  const slugPath = card.slug
  console.log(`\n[${i + 1}/${BATCH_SIZE}] fetching ${slugPath}...`)

  try {
    const detailHtml = await fetch(BASE + slugPath).then(r => r.text())

    // Extract prompt from __next_f.push data
    const promptRe = /__next_f\.push\(\[1,"[^"]*\\(?:n|")?([^"]*(?:生成|创建|设计|绘制|写实|风格|插画|色调|构图|光影)[^"]{30,3000})/g
    let promptMatch
    let prompt = null
    while ((promptMatch = promptRe.exec(detailHtml)) !== null) {
      const candidate = promptMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/&quot;/g, '"')
      if (candidate.length > 100 && !prompt) {
        prompt = candidate
      }
    }

    // If no prompt found via the above pattern, try a broader search
    if (!prompt) {
      const broadRe = /__next_f\.push\(\[1,"[^"]*\\n([^"]{200,3000})[^"]*"\]\)/
      const broadMatch = broadRe.exec(detailHtml)
      if (broadMatch) {
        prompt = broadMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/&quot;/g, '"')
      }
    }

    results.push({
      ...card,
      prompt: prompt || null
    })

    if (prompt) {
      console.log(`  prompt: ${prompt.slice(0, 150)}...`)
    } else {
      console.log(`  WARNING: no prompt found`)
    }

  } catch (err) {
    console.error(`  ERROR: ${err.message}`)
    results.push({ ...card, prompt: null })
  }

  // Small delay to be polite
  if (i < Math.min(BATCH_SIZE, cards.length) - 1) {
    await new Promise(r => setTimeout(r, 500))
  }
}

await writeFile(
  new URL('extracted_with_prompts.json', import.meta.url),
  JSON.stringify(results, null, 2)
)

const withPrompt = results.filter(r => r.prompt)
console.log(`\nDone. ${withPrompt.length}/${results.length} have prompts`)
console.log('Saved extracted_with_prompts.json')

import { chromium } from 'playwright'
import { writeFile } from 'node:fs/promises'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('https://evolink.ai/zh/gpt-image-2-prompts', { waitUntil: 'domcontentloaded', timeout: 30000 })
await new Promise(r => setTimeout(r, 4000))

// Scroll to load all cards
for (let i = 0; i < 5; i++) {
  await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
  await new Promise(r => setTimeout(r, 1500))
}

// Click all "展开提示词" buttons to reveal full prompts
const expandBtns = await page.locator('button, span', { hasText: '展开提示词' }).all()
console.log(`Expand buttons: ${expandBtns.length}`)
for (const btn of expandBtns) {
  try {
    await btn.click()
    await new Promise(r => setTimeout(r, 300))
  } catch {}
}

await new Promise(r => setTimeout(r, 2000))

// Extract full card data
const cards = await page.evaluate(() => {
  // Find all card containers
  const allCards = []
  const seenTitles = new Set()
  const elements = document.querySelectorAll('[class*="card"], [class*="Card"], [class*="item"], [class*="Item"]')

  for (const el of elements) {
    const text = el.textContent.trim()
    if (!text || text.length < 50) continue

    const titleEl = el.querySelector('h3, h4, [class*="title"], [class*="Title"], strong')
    const title = titleEl ? titleEl.textContent.trim() : ''
    if (!title || seenTitles.has(title) || title.length < 3) continue
    seenTitles.add(title)

    // Get all text blocks
    const blocks = Array.from(el.querySelectorAll('p, div, span, pre'))
      .map(b => b.textContent.trim())
      .filter(b => b.length > 10 && b !== title)

    const img = el.querySelector('img')
    const imgSrc = img ? (img.getAttribute('src') || '') : ''

    // Extract prompt - the largest text block
    let prompt = ''
    let tags = []
    for (const block of blocks) {
      const tagMatch = block.match(/^[a-z][\w\s-]{2,50}$/)
      if (tagMatch && block.length < 60) {
        tags.push(block.trim())
      } else if (block.length > 60 && block.length > prompt.length) {
        prompt = block
      }
    }

    // Find category
    const categories = ['Character Design', 'UI Mockups', 'Posters', 'Portraits', 'Marketing Visuals', 'Product Photography', 'Community Showcase']
    let category = ''
    for (const cat of categories) {
      if (text.includes(cat)) { category = cat; break }
    }

    allCards.push({
      title: title.slice(0, 100),
      category,
      prompt: prompt.slice(0, 3000),
      tags: tags.slice(0, 5),
      image: imgSrc,
    })
  }
  return allCards
})

console.log(`\nExtracted ${cards.length} cards`)
for (const c of cards.slice(0, 5)) {
  console.log(`\n  [${c.category}] ${c.title.slice(0, 50)}`)
  console.log(`  prompt: ${c.prompt.slice(0, 100)}...`)
  console.log(`  tags: ${c.tags.join(', ')}`)
  console.log(`  image: ${c.image.slice(0, 100)}`)
}

await writeFile('/Users/wanghans/gpt-image2-templates/scripts/evolink_cards.json', JSON.stringify(cards, null, 2))
console.log(`\nSaved ${cards.length} cards to evolink_cards.json`)
await browser.close()

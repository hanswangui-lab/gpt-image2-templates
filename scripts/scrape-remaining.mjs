import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { get } from 'node:https'
import { chromium } from 'playwright'

const BASE = 'https://image2.fun'
const SLUGS_PATH = new URL('remaining_slugs.json', import.meta.url)
const OUTPUT_PATH = new URL('scraped_remaining.json', import.meta.url)

// Get remaining slugs
const html = await fetch(BASE).then(r => r.text())
const catUrls = ['', '?cat=portrait', '?cat=poster', '?cat=character', '?cat=ui-mockup',
  '?cat=infographic', '?cat=other', '?tag=ecommerce', '?tag=logo-branding', '?tag=food', '?tag=chinese']

const allSlugs = new Set()
for (const cat of catUrls) {
  const h = await fetch(BASE + '/' + cat).then(r => r.text())
  for (const m of h.matchAll(/href="(\/p\/[^"]+)"/g)) allSlugs.add(m[1])
}

// Read existing data for dedup
const existingText = await readFile(new URL('../src/data/templates.ts', import.meta.url), 'utf-8')
const existingUrls = new Set()
for (const m of existingText.matchAll(/"sourceUrl":\s*"([^"]+)"/g)) {
  const url = m[1]
  if (url.includes('/p/')) existingUrls.add('/p/' + url.split('/p/')[1])
}
const existingTitles = new Set([...existingText.matchAll(/"title":\s*"([^"]+)"/g)].map(m => m[1]))

const remaining = [...allSlugs].filter(s => !existingUrls.has(s))
console.log(`Remaining: ${remaining.length} cards`)

if (remaining.length === 0) { console.log('Nothing to scrape.'); process.exit(0) }

await writeFile(SLUGS_PATH, JSON.stringify(remaining))

// Scrape with Playwright
const results = []
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })

for (let i = 0; i < remaining.length; i++) {
  const slug = remaining[i]
  process.stdout.write(`[${i+1}/${remaining.length}] ${slug} `)
  const page = await context.newPage()
  try {
    await page.goto(BASE + slug, { waitUntil: 'networkidle', timeout: 30000 })
    await new Promise(r => setTimeout(r, 800))

    const prompt = await page.evaluate(`() => {
      const el = document.querySelector('pre');
      if (el && el.textContent.length > 50) return el.textContent.trim();
      let best = '';
      for (const e of document.querySelectorAll('p, div')) {
        const t = (e.textContent || '').trim();
        if (t.length > best.length && t.length > 80) best = t;
      }
      return best || null;
    }`)
    const metaTitle = await page.evaluate('document.title')
    const ogImage = await page.evaluate(`() => {
      const m = document.querySelector('meta[property="og:image"]');
      return m ? m.content : null;
    }`)
    const title = ((metaTitle || '').split('·')[0] || slug.split('/').pop()).trim()

    results.push({ slug, title, image: ogImage, prompt })

    if (prompt && prompt.length > 50) console.log(`OK (${prompt.length}c)`)
    else console.log('NO PROMPT')
  } catch (e) {
    console.log(`ERROR: ${e.message.slice(0, 60)}`)
    results.push({ slug, title: '', image: null, prompt: null })
  }
  await page.close()
  await new Promise(r => setTimeout(r, 300))
}

await browser.close()
await writeFile(OUTPUT_PATH, JSON.stringify(results, null, 2))
console.log(`\nDone. ${results.filter(r => r.prompt && r.prompt.length > 50).length}/${results.length} with prompts`)

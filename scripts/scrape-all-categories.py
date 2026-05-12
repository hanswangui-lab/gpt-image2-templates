import json, time, re, os, subprocess
from playwright.sync_api import sync_playwright

BASE = 'https://image2.fun'
BATCH_LIMIT = 80
OUTPUT = '/Users/wanghans/gpt-image2-templates/scripts/scraped_all_data.json'
IMG_DIR = '/Users/wanghans/gpt-image2-templates/public/images/'
os.makedirs(IMG_DIR, exist_ok=True)

# Load new slugs
with open('/Users/wanghans/gpt-image2-templates/scripts/new_slugs.json') as f:
    all_slugs = json.load(f)

slugs = all_slugs[:BATCH_LIMIT]
print(f'Scraping {len(slugs)} / {len(all_slugs)} new cards')

JS_PROMPT = """() => {
  const sel = document.querySelector('pre');
  if (sel && sel.textContent && sel.textContent.length > 50) return sel.textContent.trim();
  const all = document.querySelectorAll('p, div');
  let best = '';
  for (const el of all) {
    const t = (el.textContent || '').trim();
    if (t.length > best.length && t.length > 80) best = t;
  }
  return best || null;
}"""
JS_TITLE = """() => document.title"""
JS_OG_IMAGE = """() => { const m = document.querySelector('meta[property="og:image"]'); return m ? m.content : null; }"""

results = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 900})

    for i, slug in enumerate(slugs):
        print(f'[{i+1}/{len(slugs)}] {slug}', end='')
        page = None
        try:
            page = context.new_page()
            page.goto(f'{BASE}{slug}', wait_until='networkidle', timeout=30000)
            time.sleep(0.8)

            prompt = page.evaluate(JS_PROMPT)
            meta_title = page.evaluate(JS_TITLE)
            og_image = page.evaluate(JS_OG_IMAGE)

            # Extract title from alt text or meta
            title = meta_title.split('·')[0].strip() if meta_title else slug.split('/')[-1]

            results.append({
                'slug': slug,
                'title': title,
                'image': og_image,
                'prompt': prompt
            })

            if prompt and len(prompt) > 50:
                print(f'  OK ({len(prompt)} chars)')
            else:
                print(f'  NO PROMPT')

        except Exception as e:
            print(f'  ERROR: {e}')
            results.append({'slug': slug, 'title': '', 'image': None, 'prompt': None})
        finally:
            if page:
                page.close()

        if i < len(slugs) - 1:
            time.sleep(0.3)

    browser.close()

# Save results
with open(OUTPUT, 'w') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

with_prompt = sum(1 for r in results if r.get('prompt') and len(r['prompt']) > 50)
print(f'\nDone. {with_prompt}/{len(results)} with prompts')

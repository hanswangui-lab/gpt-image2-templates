import json, time, os, re
from playwright.sync_api import sync_playwright

BASE = 'https://image2.fun'
OUTPUT = '/Users/wanghans/gpt-image2-templates/scripts/scraped_remaining.json'
IMG_DIR = '/Users/wanghans/gpt-image2-templates/public/images/'
os.makedirs(IMG_DIR, exist_ok=True)

# Get all slugs
cat_urls = ['', '?cat=portrait', '?cat=poster', '?cat=character', '?cat=ui-mockup',
            '?cat=infographic', '?cat=other', '?tag=ecommerce', '?tag=logo-branding', '?tag=food', '?tag=chinese']

import subprocess
all_slugs = set()
for cat in cat_urls:
    html = subprocess.check_output(['curl', '-sSL', f'{BASE}/{cat}'], text=True, timeout=15)
    slugs = set(re.findall(r'href="(/p/[^"]+)"', html))
    all_slugs.update(slugs)

# Read existing data for dedup
with open('/Users/wanghans/gpt-image2-templates/src/data/templates.ts') as f:
    text = f.read()
existing_urls = set()
for m in re.finditer(r'"sourceUrl":\s*"([^"]+)"', text):
    url = m.group(1)
    if '/p/' in url:
        existing_urls.add('/p/' + url.split('/p/')[1])
existing_titles = set(re.findall(r'"title":\s*"([^"]+)"', text))

remaining = sorted(set(all_slugs) - existing_urls)
print(f'Remaining: {len(remaining)} cards')

if not remaining:
    print('Nothing to scrape')
    exit()

# Save slugs reference
with open('/Users/wanghans/gpt-image2-templates/scripts/remaining_slugs.json', 'w') as f:
    json.dump(remaining, f)

# Scrape with Playwright
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 900})

    for i, slug in enumerate(remaining):
        print(f'[{i+1}/{len(remaining)}] {slug}', end=' ')
        page = None
        try:
            page = context.new_page()
            page.goto(f'{BASE}{slug}', wait_until='networkidle', timeout=30000)
            time.sleep(0.8)

            prompt = page.evaluate("""() => {
                const el = document.querySelector('pre');
                if (el && el.textContent.length > 50) return el.textContent.trim();
                let best = '';
                for (const e of document.querySelectorAll('p, div')) {
                    const t = (e.textContent || '').trim();
                    if (t.length > best.length && t.length > 80) best = t;
                }
                return best || null;
            }""")
            meta_title = page.evaluate('document.title')
            og_image = page.evaluate("""() => {
                const m = document.querySelector('meta[property="og:image"]');
                return m ? m.content : null;
            }""")
            t = (meta_title or '').split('·')[0].strip() or slug.split('/')[-1]

            results.append({'slug': slug, 'title': t, 'image': og_image, 'prompt': prompt})
            if prompt and len(prompt) > 50:
                print(f'OK ({len(prompt)}c)')
            else:
                print('NO PROMPT')
        except Exception as e:
            print(f'ERROR: {str(e)[:60]}')
            results.append({'slug': slug, 'title': '', 'image': None, 'prompt': None})
        finally:
            if page:
                page.close()
            time.sleep(0.3)

    browser.close()

with open(OUTPUT, 'w') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

with_prompt = sum(1 for r in results if r.get('prompt') and len(r['prompt']) > 50)
print(f'\nDone. {with_prompt}/{len(results)} with prompts')

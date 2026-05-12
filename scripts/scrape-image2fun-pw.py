import json, time
from playwright.sync_api import sync_playwright

CAT_PAGE = 'https://image2.fun/?cat=poster'
OUTPUT = '/Users/wanghans/gpt-image2-templates/scripts/scraped_poster_data.json'

JS_EXTRACT_CARDS = """
() => {
  const links = document.querySelectorAll('a[href^="/p/"]');
  const results = [];
  const seen = new Set();
  for (const link of links) {
    const href = link.getAttribute('href');
    if (seen.has(href) || !href.startsWith('/p/')) continue;
    seen.add(href);
    const img = link.querySelector('img');
    const title = (img && img.getAttribute('alt')) || (link.querySelector('h3') && link.querySelector('h3').textContent) || '';
    let src = (img && img.getAttribute('src')) || '';
    if (src.includes('_next/image')) {
      try {
        const u = new URL(src, window.location.origin);
        src = decodeURIComponent(u.searchParams.get('url') || src);
      } catch(e) {}
    }
    results.push({ slug: href, title: title.trim(), image: src });
  }
  return results;
}
"""

JS_EXTRACT_PROMPT = """
() => {
  const sel = document.querySelector('pre');
  if (sel && sel.textContent && sel.textContent.length > 50) return sel.textContent.trim();
  const all = document.querySelectorAll('p, div');
  let best = '';
  for (const el of all) {
    const t = (el.textContent || '').trim();
    if (t.length > best.length && t.length > 80) best = t;
  }
  return best || null;
}
"""

JS_TITLE = """() => { return document.title; }"""

JS_OG_IMAGE = """() => { const m = document.querySelector('meta[property="og:image"]'); return m ? m.content : null; }"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_viewport_size({"width": 1440, "height": 900})
    page.goto(CAT_PAGE, wait_until="networkidle")
    time.sleep(2)

    cards = page.evaluate(JS_EXTRACT_CARDS)
    print(f'Found {len(cards)} cards on poster page')
    for c in cards[:5]:
        print(f'  {c["slug"]}: {c["title"][:50]}')

    results = []
    for i, card in enumerate(cards):
        slug = card['slug']
        print(f'[{i+1}/{len(cards)}] {slug}', end='')
        try:
            detail_page = browser.new_page()
            detail_page.set_viewport_size({"width": 1440, "height": 900})
            detail_page.goto(f'https://image2.fun{slug}', wait_until="networkidle")
            time.sleep(1)

            prompt = detail_page.evaluate(JS_EXTRACT_PROMPT)
            meta_title = detail_page.evaluate(JS_TITLE)
            og_image = detail_page.evaluate(JS_OG_IMAGE)

            results.append({
                'slug': slug,
                'title': card['title'] or meta_title,
                'image': og_image or card['image'],
                'prompt': prompt
            })

            if prompt:
                print(f'  OK ({len(prompt)} chars)')
            else:
                print(f'  NO PROMPT')

            detail_page.close()

        except Exception as e:
            print(f'  ERROR: {e}')
            results.append({**card, 'prompt': None})

        if i < len(cards) - 1:
            time.sleep(0.5)

    browser.close()

with open(OUTPUT, 'w') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

with_prompt = sum(1 for r in results if r.get('prompt'))
print(f'\nDone. {with_prompt}/{len(results)} with prompts')
print(f'Saved to {OUTPUT}')

import json, time, re
from playwright.sync_api import sync_playwright

OUTPUT = '/Users/wanghans/gpt-image2-templates/scripts/evolink_cards.json'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto('https://evolink.ai/zh/gpt-image-2-prompts', wait_until='domcontentloaded', timeout=30000)
    time.sleep(4)

    for _ in range(5):
        page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
        time.sleep(1.5)

    # Get all images
    images = page.evaluate("Array.from(document.querySelectorAll('img')).map(i => ({src:i.src,alt:i.alt}))")
    img_map = {i['alt']: i['src'] for i in images if i['alt'] and len(i['alt']) > 5 and '.logo' not in i['src']}

    # Get page text
    body_text = page.evaluate('document.body.innerText')
    lines = [l.strip() for l in body_text.split('\n') if l.strip()]

    browser.close()

# Parse cards from structured text
cards = []
i = 0
current = None
categories = ['CHARACTER DESIGN', 'UI MOCKUPS', 'POSTERS', 'PORTRAITS',
              'MARKETING VISUALS', 'PRODUCT PHOTOGRAPHY', 'COMMUNITY SHOWCASE']
levels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']

while i < len(lines):
    line = lines[i]

    # Detect card start marker
    if line == 'IMAGE' and i + 2 < len(lines):
        if current and current.get('title'):
            cards.append(current)

        current = {'category': '', 'title': '', 'prompt': '', 'tags': [], 'level': '', 'source': '', 'image': ''}

        # Look ahead for category, level, title
        j = i + 1
        while j < min(i + 8, len(lines)):
            l = lines[j]
            if l in categories:
                current['category'] = l.title()
            elif l in levels:
                current['level'] = l
            elif l.startswith('@') and 'on X' in l:
                current['source'] = l
            elif l == '展开提示词':
                # The prompt text is ABOVE this line
                k = j - 1
                prompt_parts = []
                while k > i and lines[k] not in categories and lines[k] not in levels and not lines[k].startswith('@') and lines[k] != '复制' and lines[k] != '使用':
                    if len(lines[k]) > 5:
                        prompt_parts.insert(0, lines[k])
                    k -= 1
                if prompt_parts:
                    current['prompt'] = ' '.join(prompt_parts)
            elif l == '复制':
                # Read tags before this
                k = j - 1
                while k > i and lines[k] not in categories and lines[k] not in levels and not lines[k].startswith('@'):
                    if len(lines[k]) < 60 and lines[k] not in ['展开提示词', '复制', '使用', '']:
                        current.setdefault('tags', []).append(lines[k])
                    k -= 1
                break
            j += 1

        # Determine title (first meaningful line after level/category)
        for j in range(i + 1, min(i + 6, len(lines))):
            l = lines[j]
            if l not in categories and l not in levels and not l.startswith('@') and len(l) > 3 and l not in ['展开提示词', 'IMAGE', 'STATIC']:
                current['title'] = l
                break

        i += 1
    else:
        i += 1

if current and current.get('title'):
    cards.append(current)

print(f'Cards extracted: {len(cards)}')

# Filter valid cards
valid = [c for c in cards if c.get('title') and len(c['title']) > 3]
print(f'Valid cards: {len(valid)}')

for c in valid[:5]:
    print(f'\n  [{c.get("category")}] {c["title"][:50]}')
    print(f'  prompt: {c.get("prompt","")[:100]}')
    print(f'  tags: {", ".join(c.get("tags",[]))}')

with open(OUTPUT, 'w') as f:
    json.dump(valid, f, ensure_ascii=False, indent=2)
print(f'\nSaved {len(valid)} cards')

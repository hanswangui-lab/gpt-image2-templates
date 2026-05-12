import subprocess, re, json, urllib.parse
from html import unescape
from urllib.parse import urlparse, parse_qs

BASE = 'https://image2.fun'
html = subprocess.check_output(['curl', '-sSL', BASE + '/'], text=True)

# Extract card slugs and images from main page
cards = []
seen = set()
for m in re.finditer(r'<a[^>]*href="(/p/[^"]+)"[^>]*>', html):
    slug = m.group(1)
    if slug in seen:
        continue
    seen.add(slug)
    block = html[m.start():min(len(html), m.start() + 3000)]

    # Image URL
    img_match = re.search(r'<img[^>]*src="([^"]+)"', block)
    img = img_match.group(1) if img_match else None
    if img and '_next/image' in img:
        try:
            parsed = urlparse(unescape(img))
            params = parse_qs(parsed.query)
            img = params.get('url', [img])[0]
            img = urllib.parse.unquote(img)
        except:
            pass

    # Title from alt or h3
    title_match = re.search(r'alt="([^"]{5,})"', block)
    title = title_match.group(1) if title_match else None
    if not title:
        title_match = re.search(r'<h3[^>]*>([^<]+)<', block)
        title = title_match.group(1) if title_match else None

    # Category badge
    cat_match = re.search(r'class="[^"]*inline-flex[^"]*rounded-md[^"]*text-secondary-foreground[^"]*"[^>]*>([^<]+)', block)
    category = cat_match.group(1).strip() if cat_match else None

    cards.append({'slug': slug, 'image': img, 'title': title, 'category': category})

print(f'Found {len(cards)} cards on main page')

# Fetch detail pages in batches to extract prompts
BATCH_SIZE = 40
results = []

for i, card in enumerate(cards[:BATCH_SIZE]):
    slug = card['slug']
    print(f'[{i+1}/{min(BATCH_SIZE,len(cards))}] {slug}')

    try:
        detail = subprocess.check_output(['curl', '-sSL', BASE + slug], text=True, timeout=30)

        # Look for prompt text in __next_f.push blocks
        # The RSC format uses \uXXXX encoding for Chinese chars
        prompt = None
        for push_m in re.finditer(r'__next_f\.push\(\[1,"(.*?)"\]\)', detail, re.DOTALL):
            raw = push_m.group(1)
            try:
                decoded = raw.encode().decode('unicode_escape')
            except:
                continue

            # Check if this block contains the prompt (long Chinese text)
            if re.search(r'[一-鿿]{30,}', decoded) and len(decoded) > 200:
                # Extract just the prompt text - it's the longest continuous Chinese block
                chinese_segments = re.findall(r'[一-鿿][^"]{50,1500}', decoded)
                for seg in chinese_segments:
                    # Clean up HTML entities and escaping
                    seg = seg.replace('\\n', '\n').replace('\\"', '"').replace('&quot;', '"')
                    seg = seg.replace('\\(', '(').replace('\\)', ')')
                    if len(seg) > 100 and not seg.startswith('children'):
                        prompt = seg
                        break
                if prompt:
                    break

        results.append({**card, 'prompt': prompt})
        if prompt:
            print(f'  prompt: {prompt[:120]}...')
        else:
            print(f'  WARNING: no prompt found')

    except Exception as e:
        print(f'  ERROR: {e}')
        results.append({**card, 'prompt': None})

    if i < min(BATCH_SIZE, len(cards)) - 1:
        import time
        time.sleep(0.5)

with open('/Users/wanghans/gpt-image2-templates/scripts/extracted_image2fun_prompts.json', 'w') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

with_prompt = sum(1 for r in results if r['prompt'])
print(f'\nDone. {with_prompt}/{len(results)} with prompts')
print('Saved extracted_image2fun_prompts.json')

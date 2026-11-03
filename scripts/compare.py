"""Dev tool: side-by-side mockup (left) vs build (right) for each page, into screenshots/compare/."""
import os, sys
from PIL import Image
os.makedirs('screenshots/compare', exist_ok=True)
pairs = []
for name in ['Main', 'Faiths', 'Faith', 'Encounter', 'Agent', 'Write']:
    for w in (1440, 1024, 390):
        mock = f'design/mockups/png/{name}-{w}.png'
        if w == 390 and name in ('Main', 'Faith', 'Encounter'):
            mock = f'design/mockups/png/Phone{"Nave" if name == "Main" else name}-390.png'
        pairs.append((mock, f'screenshots/{name}-{w}.png', f'screenshots/compare/{name}-{w}.png'))
pairs.append(('design/mockups/png/Card-1200x630.png', 'screenshots/Card-1200x630.png', 'screenshots/compare/Card.png'))
maxh = int(sys.argv[1]) if len(sys.argv) > 1 else 1600
for mock, ours, dst in pairs:
    if not os.path.exists(ours):
        continue
    a, b = Image.open(mock).convert('RGB'), Image.open(ours).convert('RGB')
    w = max(a.width, b.width)
    h = min(maxh, max(a.height, b.height))
    canvas = Image.new('RGB', (w * 2 + 20, h), (255, 255, 255))
    canvas.paste(a.crop((0, 0, a.width, min(a.height, h))), (0, 0))
    canvas.paste(b.crop((0, 0, b.width, min(b.height, h))), (w + 20, 0))
    canvas.save(dst)
print('ok')

# Erzeugt die App-Icons (eigene Zeichnung: Käsekuchen-Stück mit Ziegenhörnern) für Manifest und iOS.
#   python3 tools/icons.py
from PIL import Image, ImageDraw
import os
out = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
os.makedirs(out, exist_ok=True)
BG = (26, 16, 40); BG2 = (58, 35, 94)
def draw(size, pad):
    S = 1024; im = Image.new('RGB', (S, S), BG); d = ImageDraw.Draw(im)
    for i in range(S // 2, 0, -4):  # weicher Lichtkreis
        t = i / (S / 2); c = tuple(int(BG[k] + (BG2[k] - BG[k]) * (1 - t)) for k in range(3)); d.ellipse([S/2-i, S/2-i, S/2+i, S/2+i], fill=c)
    s = (1 - 2 * pad); o = S * pad
    P = lambda x, y: (o + x * S * s, o + y * S * s)
    # Hörner
    d.polygon([P(.30,.36), P(.20,.08), P(.40,.30)], fill=(214, 196, 160)); d.polygon([P(.70,.36), P(.80,.08), P(.60,.30)], fill=(214, 196, 160))
    # Kuchenstück: Boden, Füllung, Beerenschicht
    d.polygon([P(.14,.78), P(.86,.78), P(.86,.52), P(.50,.34), P(.14,.52)], fill=(243, 201, 105))
    d.polygon([P(.14,.78), P(.86,.78), P(.86,.86), P(.14,.86)], fill=(160, 104, 52))
    d.polygon([P(.14,.52), P(.50,.34), P(.86,.52), P(.86,.58), P(.50,.42), P(.14,.58)], fill=(214, 51, 108))
    # grüne Zombie-Augen
    for x in (.36, .64): d.ellipse([*P(x-.06,.56), *P(x+.06,.68)], fill=(26,16,40)); d.ellipse([*P(x-.03,.59), *P(x+.03,.65)], fill=(140, 255, 120))
    return im.resize((size, size), Image.LANCZOS)
draw(512, .10).save(os.path.join(out, 'icon-512.png'))
draw(192, .10).save(os.path.join(out, 'icon-192.png'))
draw(512, .20).save(os.path.join(out, 'icon-maskable-512.png'))   # Inhalt innerhalb der sicheren 80-%-Zone
draw(180, .10).save(os.path.join(out, 'apple-touch-icon.png'))     # iOS: ohne Transparenz
draw(64, .06).save(os.path.join(out, 'favicon-64.png'))
print('Icons erzeugt in public/icons')

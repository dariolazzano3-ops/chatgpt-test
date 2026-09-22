#!/usr/bin/env python3
import json, hashlib, sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
contract=json.loads((ROOT/'reference/jarvis-anatomy-final/VISUAL_CONTRACT_V1.json').read_text())
errors=[]
for name,spec in contract['static_art'].items():
    p=ROOT/spec['path']
    raw=p.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=spec['sha256']:
        errors.append(f'{name}: sha256 mismatch'); continue
    im=Image.open(p).convert('RGBA')
    alpha=im.getchannel('A'); hist=alpha.histogram(); total=im.width*im.height
    transparent=sum(hist[:8])/total
    opaque=sum(hist[248:])/total
    corners=[alpha.getpixel((0,0)),alpha.getpixel((im.width-1,0)),alpha.getpixel((0,im.height-1)),alpha.getpixel((im.width-1,im.height-1))]
    if transparent < spec['min_transparent_ratio']:
        errors.append(f'{name}: transparent ratio {transparent:.3f} below {spec["min_transparent_ratio"]:.3f}')
    if sum(1 for c in corners if c <= 8) < 3:
        errors.append(f'{name}: corners are not sufficiently transparent: {corners}')
    print(f'{name}: {im.width}x{im.height} transparent={transparent:.3f} opaque={opaque:.3f} corners={corners}')
if errors:
    print('JARVIS REFERENCE ASSET AUDIT V1: FAIL')
    print('\n'.join(' - '+e for e in errors)); sys.exit(1)
print('JARVIS REFERENCE ASSET AUDIT V1: PASS')

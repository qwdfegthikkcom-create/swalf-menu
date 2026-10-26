"""Build docs/royal-palace/index.html (menu + cashier) from src/template.html + src/images.json.
Run:  python3 royal-palace/src/build.py
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'docs', 'royal-palace')  # GitHub Pages serves /docs
t = open(os.path.join(HERE, 'template.html'), encoding='utf-8').read()
img = json.load(open(os.path.join(HERE, 'images.json'), encoding='utf-8'))
t = t.replace('%%IMG:logo%%', img['logo']).replace('%%IMG:hero%%', img['hero'])
t = t.replace('%%IMGMAP%%', json.dumps({k: v for k, v in img.items() if k not in ('logo', 'hero')}))
assert '%%' not in t, 'unreplaced placeholder left in template'
os.makedirs(ROOT, exist_ok=True)
open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(t)
print('built index.html', len(t) // 1024, 'KB')

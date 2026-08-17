import re
idx = open('app/index.html', encoding='utf-8').read()
sw = open('app/sw.js', encoding='utf-8').read()

tags = set()
for t in re.findall(r'<script src="([^"]+)"', idx):
    tags.add(t.split('?')[0].lstrip('./'))

assets = set()
for a in re.findall(r'''['"]([^'"]+\.js)['"]''', sw):
    assets.add(a.split('?')[0].lstrip('./'))

fehlt = sorted(t for t in tags if t not in assets)
print('Script-Tags in index.html:', len(tags))
print('davon im SW-Cache gelistet:', len(tags) - len(fehlt))
print('NICHT im SW-Cache:', fehlt if fehlt else 'keine')
ver = re.search(r"const C = 'orvia-(v8-\d+)'", sw)
print('SW-Cache-Version:', ver.group(1) if ver else 'unbekannt')

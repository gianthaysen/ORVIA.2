#!/usr/bin/env python3
"""ORVIA · SW-Asset-Check

Vergleicht die 141 handgepflegten Script-Tags in index.html mit der ebenso
handgepflegten Asset-Liste in sw.js. Ein fehlender Eintrag bricht den
Offline-Betrieb still — das ist die haeufigste Ursache fuer "weisse Seite nach
Update". Nur Lesezugriffe.

Aufruf von ueberall:  python3 app/tools/sw_asset_check.py
Die Pfade werden aus dem Ort DIESER Datei abgeleitet (app/tools/ -> app/),
damit das Werkzeug nicht davon abhaengt, aus welchem Verzeichnis es startet.
"""
import re
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent      # app/tools/ -> app/
IDX = APP / 'index.html'
SW = APP / 'sw.js'

for p in (IDX, SW):
    if not p.exists():
        sys.exit('Nicht gefunden: ' + str(p) + '  (liegt dieses Skript noch in app/tools/?)')

idx = IDX.read_text(encoding='utf-8')
sw = SW.read_text(encoding='utf-8')

tags = {t.split('?')[0].lstrip('./') for t in re.findall(r'<script src="([^"]+)"', idx)}
assets = {a.split('?')[0].lstrip('./') for a in re.findall(r"""['"]([^'"]+\.js)['"]""", sw)}

extern = sorted(t for t in tags if t.startswith('http'))
fehlt = sorted(t for t in tags if t not in assets and not t.startswith('http'))

ver = re.search(r"const C = 'orvia-(v8-\d+)'", sw)
print('SW-Cache-Version:            ' + (ver.group(1) if ver else 'unbekannt'))
print('Script-Tags in index.html:   %d  (davon %d extern)' % (len(tags), len(extern)))
print('lokale Skripte im SW-Cache:  %d von %d' % (len(tags) - len(extern) - len(fehlt), len(tags) - len(extern)))
for e in extern:
    print('  extern (bewusst nicht gecacht, Phase-C-Buendelpflicht): ' + e)
if fehlt:
    print('\nFEHLT IM SW-CACHE — Offline-Betrieb bricht still:')
    for f in fehlt:
        print('  ' + f)
    sys.exit(1)
print('\nOK — jedes lokale Skript ist im Cache gelistet.')

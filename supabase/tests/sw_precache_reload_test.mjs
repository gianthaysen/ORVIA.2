/* ============================================================
   ORVIA · sw_precache_reload — v8-399
   ------------------------------------------------------------
   Nutzerbefund 25.09.: js neu (v8-397-Texte sichtbar), styles.css alt
   (Goldbuttons wieder schwarz auf schwarz) — auf demselben Geraet.
   cache.add(url) im install-Handler holt ueber den HTTP-Cache des Browsers;
   eine dort liegende aeltere styles.css wird unter dem NEUEN Cache-Namen
   einbetoniert. Die Versionsnummer allein bricht das nicht auf.

     A. install vorbefuellt mit Request(..., {cache:'reload'}) — HTTP-Cache umgangen
     B. Rueckfall auf cache.add(url), falls ein Browser den Modus ablehnt
     C. Handler-Semantik im Simulator: jede Asset-Anfrage traegt cache:'reload'
     D. Start-CTA: Icon und Label in EINER Zeile (.cta-row); gesperrter CTA neutral

   node supabase/tests/sw_precache_reload_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _ex } from 'node:fs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const sw = rd('sw.js');
sec('A/B · Quelltext');
{
  const inst = (sw.match(/self\.addEventListener\('install'[\s\S]*?\n\}\);/) || [''])[0];
  ok('A1 install-Handler vorhanden', inst.length > 0);
  ok("A2 Vorbefuellung mit new Request(a, { cache: 'reload' })", /new Request\(a,\s*\{\s*cache:\s*'reload'\s*\}\)/.test(inst));
  ok('B1 Rueckfall auf cache.add(a) bleibt (Browser ohne Modus-Unterstuetzung)', /\.catch\(\(\) => c\.add\(a\)/.test(inst));
  ok('A3 skipWaiting bleibt nach der Vorbefuellung', /then\(\(\) => self\.skipWaiting\(\)\)/.test(inst));
}

sec('C · Handler-Simulation');
{
  /* Minimaler SW-Simulator: nur das, was der install-Handler anfasst. */
  const seen = [];
  const cacheObj = { add: async (r) => { seen.push(r); }, put: async () => {}, match: async () => null };
  const g = {
    self: { addEventListener: (t, fn) => { g.handlers[t] = fn; }, skipWaiting: async () => { g.skipped = true; }, clients: { claim: async () => {} }, location: { origin: 'https://x' } },
    handlers: {}, skipped: false,
    caches: { open: async () => cacheObj, keys: async () => [], delete: async () => true },
    Request: class { constructor(url, init) { this.url = url; this.cache = (init && init.cache) || 'default'; } },
    Response: { error: () => null }
  };
  const fn = new Function('self', 'caches', 'Request', 'Response', sw);
  fn(g.self, g.caches, g.Request, g.Response);
  ok('C1 install-Handler registriert', typeof g.handlers.install === 'function');
  let done;
  g.handlers.install({ waitUntil: p => { done = p; } });
  await done;
  ok('C2 alle Assets angefordert (Anzahl = ASSETS-Liste)', seen.length > 100, String(seen.length));
  ok("C3 JEDE Anfrage traegt cache:'reload' (kein HTTP-Cache-Treffer moeglich)", seen.every(r => r && r.cache === 'reload'));
  ok('C4 styles.css und index.html sind dabei', seen.some(r => r.url === './styles.css') && seen.some(r => r.url === './index.html'));
  ok('C5 skipWaiting nach der Vorbefuellung', g.skipped === true);
}

sec('D · Start-CTA');
{
  const ui = rd('js/ui.js');
  ok('D1 aktiver Start-CTA: Icon + Label in <span class="cta-row">', /class="cta prim"[^>]*onclick="gmStartFromPreStart\(\)"><span class="cta-row">'\+icon\('play','sm'\)\+gmEsc\(sport\)\+' starten<\/span>/.test(ui));
  const css = rd('styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const dis = (css.match(/\.cta\.prim\[disabled\]\{[^}]*\}/) || [''])[0];
  ok('D2 gesperrter Gold-CTA: neutrale Flaeche, volle Deckung, lesbare Schrift', /opacity:1/.test(dis) && /background:var\(--surface\)/.test(dis) && /color:var\(--muted\)/.test(dis), dis);
  ok('D3 .cta-row ist inline-flex mit Abstand', /\.cta \.cta-row\{display:inline-flex;align-items:center;gap:8px\}/.test(css));
}

console.log('\n' + (fail ? '❌' : '✅') + ' ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

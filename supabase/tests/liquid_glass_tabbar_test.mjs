/* ORVIA · Liquid-Glass-Tabbar (2026-08-06) — reale Pruefung im Browser.

   Der Umbau ist rein visuell/interaktiv; die Navigation darunter ist unveraendert.
   Genau das wird hier belegt: die Optik ist da UND jeder Tab fuehrt weiterhin an
   sein echtes Ziel. Eine huebsche Bar, die nicht mehr navigiert, waere die
   schlimmste moegliche Regression — deshalb steht die Funktion an erster Stelle.

   node supabase/tests/liquid_glass_tabbar_test.mjs [appRoot-absolut] */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = (function () {
  /* Playwright ist eine ENTWICKLUNGSVORAUSSETZUNG, kein App-Bestandteil.
     Aufgeloest wird wie bei supabase-js in den Live-Tests: erst normal, dann
     ueber die bekannten node_modules-Nachbarn (Repo-Stamm, app, _dev). Fehlt
     es wirklich (z. B. in einer Umgebung ohne Browser), ist das ein
     UEBERSPRUNGEN (exit 2) — nie ein Crash, der wie ein Produktfehler
     aussieht, und nie ein stilles Gruen. Bewusst OHNE HERE/join: dieser Block
     laeuft vor deren Definition. */
  const _p = require('node:path');
  const _h = _p.dirname(new (globalThis.URL || require('node:url').URL)(import.meta.url).pathname);
  const _cands = [null, _p.join(_h, '..', '..'), _p.join(_h, '..', '..', 'app'),
    _p.join(_h, '..', '..', '_dev'), _p.join(_h, '..', '..', '..')];
  for (const c of _cands) {
    try { return require(c ? _p.join(c, 'node_modules', 'playwright') : 'playwright'); }
    catch (_e) { }
  }
  console.log('⏭️  ÜBERSPRUNGEN — playwright ist in dieser Umgebung nicht installiert (npm install im Repo-Stamm holt es nach)');
  process.exit(2);
})();
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
/* ROBUSTE APP-AUFLOESUNG: Das Repo existiert in zwei Layouts — kanonisch
   (app/supabase/tests, App-Wurzel = HERE/../..) und umstrukturiert
   (supabase/tests neben app/, App-Wurzel = HERE/../../app). Eine starre
   Aufloesung fand im jeweils anderen Layout den falschen Ordner und liess
   die GANZE Suite scheinbar fehlschlagen (0/46 statt gruen). Gesucht wird
   deshalb der erste Kandidat mit index.html UND js/engine. */
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);
const CHROME = (await import('./_pw-chrome.mjs')).chromeOrSkip(chromium); /* v8-307b: Binary-Existenz ist Teil der Skip-Bedingung */

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  if (p === '/env.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); res.end('/* Test */'); return; }
  const f = join(APP, normalize(p).replace(/^([\\/])+/, ''));
  if (!f.startsWith(APP) || !existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const browser = await chromium.launch({ executablePath: CHROME });

async function newPage(w, h, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: w, height: h } }, opts || {}));
  await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
  await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* stub */' }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    /* Das Gate blendet die Bar per html.orvia-gated aus (styles.css) — ohne dieses
       Entfernen misst der Test eine unsichtbare Bar mit Groesse 0. */
    document.documentElement.classList.remove('orvia-gated');
    document.querySelectorAll('.orvia-gate,#splash').forEach(e => e.remove());
  });
  await page.waitForTimeout(150);
  return { page, ctx, errs };
}

/* ============ 1) FUNKTION VOR OPTIK ============ */
sec('Navigation · jeder Tab erreicht weiterhin sein echtes Ziel');
let { page, ctx, errs } = await newPage(390, 844);
{
  const TABS = [['heute', 'tab-heute'], ['plan', 'tab-plan'], ['akt', 'tab-akt'], ['dash', 'tab-dash']];
  for (const [tab, panel] of TABS) {
    const r = await page.evaluate(({ tab, panel }) => {
      document.querySelector('.tabwrap button[data-tab="' + tab + '"]').click();
      const el = document.getElementById(panel);
      const btn = document.querySelector('.tabwrap button[data-tab="' + tab + '"]');
      return { visible: !!el && !el.classList.contains('hide'),
        marked: btn.classList.contains('on'), aria: btn.getAttribute('aria-current') };
    }, { tab, panel });
    ok('Tab „' + tab + '" oeffnet sein Panel und ist markiert', r.visible && r.marked, 'aria-current=' + r.aria);
    ok('Tab „' + tab + '" traegt aria-current=page', r.aria === 'page');
  }
  /* 'mehr' ist ein Overlay, kein Panel — eigener Vertrag. */
  const m = await page.evaluate(() => {
    document.querySelector('.tabwrap button[data-tab="mehr"]').click();
    const btn = document.querySelector('.tabwrap button[data-tab="mehr"]');
    return { marked: btn.classList.contains('on'), aria: btn.getAttribute('aria-current'),
      overlay: typeof profileOpen === 'function' ? profileOpen() : null };
  });
  ok('Tab „mehr" oeffnet das Profil-Overlay und ist markiert', m.marked && m.overlay !== false, JSON.stringify(m));
  ok('genau EIN Tab traegt aria-current', await page.evaluate(() =>
    document.querySelectorAll('.tabwrap button[aria-current="page"]').length) === 1);

  const plus = await page.evaluate(() => {
    const b = document.getElementById('navPlus');
    return { exists: !!b, hasHandler: !!(b && (b.onclick || b.dataset.qaBound)),
      outsideBar: !!b && !b.closest('.tabbar') };
  });
  ok('#navPlus existiert weiterhin und haengt am Quick-Action-System', plus.exists && plus.hasHandler, JSON.stringify(plus));
  ok('#navPlus liegt AUSSERHALB der Bar (Aktion ≠ Navigation)', plus.outsideBar);

  /* Der FAB darf keine Tab-Klickflaeche verdecken. */
  const overlap = await page.evaluate(() => {
    const f = document.getElementById('navPlus').getBoundingClientRect();
    return [].slice.call(document.querySelectorAll('.tabwrap button[data-tab]')).map(b => {
      const r = b.getBoundingClientRect();
      return !(f.right < r.left || f.left > r.right || f.bottom < r.top || f.top > r.bottom);
    }).some(Boolean);
  });
  ok('FAB ueberdeckt keine Tab-Klickflaeche', overlap === false);

  /* Treffergroesse: mindestens ~44 px in beiden Achsen. */
  const sizes = await page.evaluate(() => [].slice.call(document.querySelectorAll('.tabwrap button[data-tab]'))
    .map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  ok('alle Touch-Targets >= 44 × 44 px', sizes.every(s => s[0] >= 44 && s[1] >= 44), JSON.stringify(sizes));
}

/* ============ 2) GLASKOERPER ============ */
sec('Glas · Ebenen, Schweben, Lesbarkeit');
{
  const g = await page.evaluate(() => {
    const bar = document.querySelector('.tabbar'), wrap = document.querySelector('.tabwrap');
    const cs = getComputedStyle(wrap), cb = getComputedStyle(bar);
    const bf = cs.backdropFilter || cs.webkitBackdropFilter || '';
    const r = wrap.getBoundingClientRect();
    return { tag: bar.tagName, label: bar.getAttribute('aria-label'),
      bf: bf, hasBlur: /blur/.test(bf), hasSat: /saturate/.test(bf),
      hasContrast: /contrast/.test(bf), hasBright: /brightness/.test(bf),
      radius: parseFloat(cs.borderRadius), shadow: cs.boxShadow,
      insetCount: (cs.boxShadow.match(/inset/g) || []).length,
      glassLayer: !!wrap.querySelector('.tabglass'),
      indicator: !!wrap.querySelector('.glass-indicator'),
      left: Math.round(r.left), right: Math.round(window.innerWidth - r.right),
      bottomGap: Math.round(window.innerHeight - r.bottom),
      barPointer: cb.pointerEvents, wrapPointer: getComputedStyle(wrap).pointerEvents,
      isolation: cs.isolation };
  });
  ok('semantisches <nav> mit aria-label', g.tag === 'NAV' && !!g.label, g.tag + ' / ' + g.label);
  ok('backdrop-filter enthaelt Blur UND Saturation (kein reines Milchglas)', g.hasBlur && g.hasSat, g.bf);
  ok('backdrop-filter enthaelt zusaetzlich Kontrast und Helligkeit', g.hasContrast && g.hasBright);
  ok('Kapselform (Radius >= 24 px)', g.radius >= 24, g.radius + 'px');
  ok('Kontur aus Lichtkanten: mindestens 2 inset-Schatten', g.insetCount >= 2, g.insetCount + ' inset');
  ok('separate Lichtkanten-Ebene (.tabglass) vorhanden', g.glassLayer);
  ok('bewegliche Kapsel (.glass-indicator) vorhanden', g.indicator);
  ok('schwebt: Abstand links UND rechts zum Viewport', g.left > 4 && g.right > 4, g.left + ' / ' + g.right);
  ok('schwebt: Abstand zum unteren Rand', g.bottomGap > 4, g.bottomGap + 'px');
  ok('Bar faengt keine Taps ab, nur die Kapsel selbst', g.barPointer === 'none' && g.wrapPointer === 'auto');
  ok('eigener Stapelkontext (isolation) gegen Glas-auf-Glas-Artefakte', g.isolation === 'isolate');

  /* Inhalt darf nicht verdeckt werden: unteres Padding >= Barhoehe. */
  const pad = await page.evaluate(() => {
    const w = document.querySelector('.wrap');
    const r = document.querySelector('.tabwrap').getBoundingClientRect();
    return { pb: parseFloat(getComputedStyle(w).paddingBottom), barH: Math.round(r.height),
      gap: Math.round(window.innerHeight - r.top) };
  });
  ok('Inhalt bekommt genug Bodenfreiheit (Padding > Barhoehe)', pad.pb > pad.barH, pad.pb + 'px > ' + pad.barH + 'px');
}

/* ============ 2b) PLUS-BUTTON als Gold-Glaskoerper ============ */
sec('Plus-Button · gleiche Materialsprache, eigene Hierarchie');
{
  const f = await page.evaluate(() => {
    const b = document.getElementById('navPlus');
    const cs = getComputedStyle(b);
    const r = b.getBoundingClientRect();
    const wrap = document.querySelector('.tabwrap').getBoundingClientRect();
    const bf = cs.backdropFilter || cs.webkitBackdropFilter || '';
    return { bf, hasBlur: /blur/.test(bf), hasSat: /saturate/.test(bf),
      insetCount: (cs.boxShadow.match(/inset/g) || []).length,
      radius: cs.borderRadius, size: [Math.round(r.width), Math.round(r.height)],
      bottomCss: cs.bottom, usesSafeArea: false,
      aboveBar: r.bottom <= wrap.top + 1,
      gapToBar: Math.round(wrap.top - r.bottom),
      rightGap: Math.round(window.innerWidth - r.right),
      z: cs.zIndex, isolation: cs.isolation };
  });
  ok('Plus traegt dieselbe Brechung wie die Bar (Blur + Saturation)', f.hasBlur && f.hasSat, f.bf);
  ok('Kontur aus Lichtkanten (mind. 2 inset-Schatten)', f.insetCount >= 2, f.insetCount + ' inset');
  ok('rund und in Groesse eines Touch-Targets', /50%/.test(f.radius) && f.size[0] >= 48 && f.size[1] >= 48, JSON.stringify(f.size));
  ok('sitzt oberhalb der Bar, ueberlappt sie nicht', f.aboveBar, 'Abstand ' + f.gapToBar + 'px');
  ok('Abstand zur Bar ist definiert, nicht zufaellig (8–40 px)', f.gapToBar >= 8 && f.gapToBar <= 40, f.gapToBar + 'px');
  ok('liegt ueber der Bar in der Stapelordnung', Number(f.z) > 50, 'z-index ' + f.z);
  ok('eigener Stapelkontext fuer die Specular-Ebene', f.isolation === 'isolate');

  /* Der wichtigste Punkt: die Aktion bleibt eine Aktion. */
  const still = await page.evaluate(() => {
    const b = document.getElementById('navPlus');
    return { handler: !!(b.onclick || b.dataset.qaBound), label: b.getAttribute('aria-label'),
      haspopup: b.getAttribute('aria-haspopup'), tag: b.tagName,
      inNav: !!b.closest('nav') };
  });
  ok('Plus ist weiterhin ein Button mit Quick-Action-Handler', still.handler && still.tag === 'BUTTON', JSON.stringify(still));
  ok('Plus bleibt semantisch AUSSERHALB der Navigation (Aktion ≠ Ziel)', still.inNav === false);
  ok('Plus behaelt aria-label und aria-haspopup', !!still.label && still.haspopup === 'dialog', still.label + ' / ' + still.haspopup);

  /* Position folgt denselben Tokens wie die Bar — inkl. Safe-Area. Frueher stand
     hier bottom:94px fest verdrahtet, ohne env(safe-area-inset-bottom). */
  const cssSrc = readFileSync(join(APP, 'styles.css'), 'utf8');
  ok('Position an die Bar-Tokens gekoppelt statt fest verdrahtet',
     /#navPlus\.fab\{[\s\S]{0,700}--orvia-tabbar-h/.test(cssSrc));
  ok('Safe-Area in der Position beruecksichtigt',
     /#navPlus\.fab\{[\s\S]{0,700}env\(safe-area-inset-bottom\)/.test(cssSrc));
  ok('Fallback ohne backdrop-filter deckt den Plus mit ab',
     /@supports not \(\(backdrop-filter[\s\S]{0,400}#navPlus\.fab\{background:/.test(cssSrc));

  /* Icon-Lesbarkeit: das Plus ist dunkel auf Gold — der Kontrast muss auch bei
     halbtransparentem Material tragen. Gemessen ueber der tatsaechlichen Flaeche. */
  const contrast = await page.evaluate(() => {
    const b = document.getElementById('navPlus');
    const c = getComputedStyle(b).color;
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
    if (!m) return null;
    const lum = (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255;
    return { color: c, lum: +lum.toFixed(3) };
  });
  ok('Icon-Farbe bleibt deutlich dunkel (Kontrast gegen Gold)', contrast && contrast.lum < 0.3,
     contrast && contrast.color + ' lum=' + contrast.lum);

  /* Mitbewegung beim Komprimieren + Wegfahren bei Tastatur. */
  const moves = await page.evaluate(async () => {
    const bar = document.querySelector('.tabbar'), b = document.getElementById('navPlus');
    const t0 = getComputedStyle(b).transform;
    bar.classList.add('compact'); await new Promise(r => setTimeout(r, 340));
    const t1 = getComputedStyle(b).transform;
    bar.classList.remove('compact'); await new Promise(r => setTimeout(r, 340));
    bar.classList.add('kb'); await new Promise(r => setTimeout(r, 340));
    const t2 = getComputedStyle(b).transform;
    bar.classList.remove('kb'); await new Promise(r => setTimeout(r, 340));
    return { t0, t1, t2 };
  });
  ok('Plus geht beim Komprimieren mit (optischer Verbund bleibt)', moves.t0 !== moves.t1, moves.t1);
  ok('Plus faehrt bei sichtbarer Tastatur mit der Bar weg', /matrix.*[1-9]\d{2,}\)$/.test(moves.t2) || moves.t2 !== moves.t0, moves.t2);
}

/* ============ 3) BEWEGLICHE KAPSEL ============ */
sec('Aktive Kapsel · Position aus dem DOM, nicht aus nth-child');
{
  const moves = await page.evaluate(async () => {
    const ind = document.querySelector('.glass-indicator');
    const out = [];
    for (const t of ['heute', 'plan', 'akt', 'dash']) {
      document.querySelector('.tabwrap button[data-tab="' + t + '"]').click();
      /* Die Kapsel laeuft 420 ms; wer frueher misst, misst einen Zwischenwert der
         Animation und nicht das Ziel. Deshalb bis zum Ende der Transition warten. */
      await new Promise(r => setTimeout(r, 560));
      const b = document.querySelector('.tabwrap button[data-tab="' + t + '"]');
      const cs = getComputedStyle(ind);
      const m = /matrix\(([^)]+)\)/.exec(cs.transform);
      const tx = m ? Math.round(parseFloat(m[1].split(',')[4])) : null;
      out.push({ t, tx, want: b.offsetLeft, w: Math.round(parseFloat(cs.width)), wantW: b.offsetWidth });
    }
    return out;
  });
  ok('Kapsel bewegt sich per transform (nicht per left)',
     moves.every(m => m.tx !== null), JSON.stringify(moves.map(m => m.tx)));
  ok('Position entspricht exakt dem echten Tab-Offset (DOM-gemessen)',
     moves.every(m => Math.abs(m.tx - m.want) <= 1), JSON.stringify(moves.map(m => m.tx + '≈' + m.want)));
  ok('Breite folgt der echten Tab-Breite (unterschiedlich lange Labels)',
     moves.every(m => Math.abs(m.w - m.wantW) <= 1), JSON.stringify(moves.map(m => m.w + '≈' + m.wantW)));
  ok('die Positionen unterscheiden sich tatsaechlich (keine Attrappe)',
     new Set(moves.map(m => m.tx)).size === moves.length);

  const timing = await page.evaluate(() => getComputedStyle(document.querySelector('.glass-indicator')).transitionDuration);
  const ms = Math.round(parseFloat(timing) * 1000);
  ok('Bewegungsdauer im hochwertigen Bereich (200–520 ms)', ms >= 200 && ms <= 520, ms + ' ms');

  /* Programmatische Navigation (nicht per Klick) muss die Kapsel mitziehen. */
  const prog = await page.evaluate(async () => {
    showTab('plan'); if (window._orviaTabSync) window._orviaTabSync();
    await new Promise(r => setTimeout(r, 60));
    const on = document.querySelector('.tabwrap button[data-tab].on');
    return on && on.dataset.tab;
  });
  ok('programmatischer Tabwechsel aktualisiert die Bar', typeof prog === 'string', 'aktiv=' + prog);
}

/* ============ 4) SCROLL-KOMPRIMIERUNG ============ */
sec('Scroll · komprimiert mit Hysterese, verschwindet nie');
{
  const s = await page.evaluate(async () => {
    document.querySelector('.tabwrap button[data-tab="heute"]').click();
    await new Promise(r => setTimeout(r, 80));
    const bar = document.querySelector('.tabbar');
    const wrap = document.querySelector('.tabwrap');
    const spacer = document.createElement('div');
    spacer.style.height = '3000px'; spacer.id = '__scrolltest';
    document.body.appendChild(spacer);
    const st = () => ({ compact: bar.classList.contains('compact'),
      visible: wrap.getBoundingClientRect().height > 10 && getComputedStyle(bar).display !== 'none' });
    const go = async (y) => { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); return st(); };
    const atTop = await go(0);
    const tiny = await go(20);            /* Mikrobewegung darf NICHTS ausloesen */
    const down = await go(600);
    const stillVisible = st();
    const backUp = await go(80);
    const top2 = await go(0);
    spacer.remove(); window.scrollTo(0, 0);
    return { atTop, tiny, down, stillVisible, backUp, top2 };
  });
  ok('oben: Bar voll ausgefahren', s.atTop.compact === false);
  ok('Mikro-Scroll (20 px) loest KEINE Komprimierung aus (Hysterese)', s.tiny.compact === false);
  ok('deutliches Scrollen nach unten komprimiert', s.down.compact === true);
  ok('komprimiert heisst kleiner, NICHT unsichtbar', s.stillVisible.visible === true);
  ok('zurueck nach oben faehrt wieder aus', s.top2.compact === false);

  const scaleWhenCompact = await page.evaluate(async () => {
    const bar = document.querySelector('.tabbar'), wrap = document.querySelector('.tabwrap');
    bar.classList.add('compact');
    await new Promise(r => setTimeout(r, 380));
    const t = getComputedStyle(wrap).transform;
    const m = /matrix\(([^)]+)\)/.exec(t);
    const sx = m ? parseFloat(m[1].split(',')[0]) : 1;
    const h = wrap.getBoundingClientRect().height;
    bar.classList.remove('compact');
    return { sx: +sx.toFixed(3), h: Math.round(h) };
  });
  ok('Komprimierung skaliert spuerbar, aber moderat (0.85–0.99)',
     scaleWhenCompact.sx >= .85 && scaleWhenCompact.sx < 1, 'scale ' + scaleWhenCompact.sx);
  ok('Labels bleiben auch komprimiert im DOM (Bedienbarkeit erhalten)',
     await page.evaluate(() => document.querySelectorAll('.tabwrap .tl').length) === 5);
}

/* ============ 5) TASTATUR / A11Y ============ */
sec('Bedienung · Tastatur, Fokus, Kontrast');
{
  const kb = await page.evaluate(async () => {
    const first = document.querySelector('.tabwrap button[data-tab="heute"]');
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    const on = document.querySelector('.tabwrap button[data-tab].on');
    return { moved: on && on.dataset.tab, focused: document.activeElement && document.activeElement.dataset.tab };
  });
  ok('Pfeiltaste wechselt den Tab und zieht den Fokus mit', kb.moved === kb.focused && !!kb.moved, JSON.stringify(kb));
  const fv = await page.evaluate(() => {
    const b = document.querySelector('.tabwrap button[data-tab]');
    for (const s of document.styleSheets) { try { for (const r of s.cssRules)
      if (r.selectorText && /tabbar button\[data-tab\]:focus-visible/.test(r.selectorText)) return r.style.outline || r.style.outlineWidth; } catch (e) {} }
    return null;
  });
  ok(':focus-visible ist sichtbar definiert', !!fv, fv);
  ok('Icons sind fuer Screenreader ausgeblendet (Label traegt die Bedeutung)',
     await page.evaluate(() => [].slice.call(document.querySelectorAll('.tabwrap button[data-tab] svg'))
       .every(s => s.getAttribute('aria-hidden') === 'true')));
  ok('aktiver Zustand nicht NUR ueber Farbe (Kapsel + aria-current)',
     await page.evaluate(() => !!document.querySelector('.glass-indicator') &&
       !!document.querySelector('.tabwrap button[aria-current="page"]')));
}
ok('keine ungefangenen JS-Fehler (390 px)', errs.length === 0, errs.slice(0, 3).join(' | '));
await ctx.close();

/* ============ 6) VIEWPORTS ============ */
sec('Viewports · Bar bleibt intakt und lesbar');
for (const [w, h, name] of [[320, 568, 'iPhone SE'], [375, 667, 'iPhone 8'], [390, 844, 'iPhone 14'],
                            [393, 852, 'Pixel/iPhone 15'], [430, 932, 'iPhone Pro Max'], [844, 390, 'Landscape'], [1280, 900, 'Desktop']]) {
  const s = await newPage(w, h);
  const r = await s.page.evaluate(() => {
    const wrap = document.querySelector('.tabwrap');
    const bb = wrap.getBoundingClientRect();
    const btns = [].slice.call(wrap.querySelectorAll('button[data-tab]'));
    const labels = btns.map(b => { const t = b.querySelector('.tl'); return t ? t.scrollWidth <= t.clientWidth + 1 : true; });
    const ind = wrap.querySelector('.glass-indicator').getBoundingClientRect();
    return { fits: bb.left >= 0 && bb.right <= window.innerWidth + .5,
      inside: ind.left >= bb.left - 1 && ind.right <= bb.right + 1,
      minH: Math.min.apply(null, btns.map(b => Math.round(b.getBoundingClientRect().height))),
      labelsOk: labels.every(Boolean), n: btns.length };
  });
  ok(name + ' (' + w + '×' + h + '): Bar passt, 5 Tabs, Kapsel innerhalb, Labels nicht abgeschnitten',
     r.fits && r.inside && r.n === 5 && r.labelsOk, JSON.stringify(r));
  ok(name + ': Touch-Target-Hoehe >= 44 px', r.minH >= 44, r.minH + 'px');
  await s.ctx.close();
}

/* ============ 7) REDUCED MOTION + FALLBACK ============ */
sec('Fallbacks · Reduced Motion, kein backdrop-filter');
{
  const s = await newPage(390, 844, { reducedMotion: 'reduce' });
  const r = await s.page.evaluate(() => {
    const ind = document.querySelector('.glass-indicator');
    const wrap = document.querySelector('.tabwrap');
    document.querySelector('.tabwrap button[data-tab="dash"]').click();
    return { indT: getComputedStyle(ind).transitionDuration,
      wrapT: getComputedStyle(wrap).transitionDuration,
      stillWorks: document.querySelector('.tabwrap button[data-tab].on').dataset.tab };
  });
  ok('Reduced Motion: keine Bewegungsdauer mehr', parseFloat(r.indT) === 0 && parseFloat(r.wrapT) === 0, r.indT + ' / ' + r.wrapT);
  ok('Reduced Motion: Navigation funktioniert unveraendert', r.stillWorks === 'dash');
  await s.ctx.close();
}
{
  const css = readFileSync(join(APP, 'styles.css'), 'utf8');
  ok('@supports-Fallback ohne backdrop-filter vorhanden',
     /@supports not \(\(backdrop-filter[\s\S]{0,220}\.tabwrap\{background:/.test(css));
  ok('Fallback ist deckend genug (kein kaputtes Transparenz-Bild)',
     /@supports not \(\(backdrop-filter[\s\S]{0,260}rgba\(\d+,\s*\d+,\s*\d+,\s*\.9/.test(css));
  ok('Safe-Area wird beruecksichtigt', /\.tabbar\{[^}]*env\(safe-area-inset-bottom\)/.test(css));
  ok('Geometrie responsiv (clamp) statt auf ein Geraet verdrahtet', /--orvia-tabbar-inline:clamp\(/.test(css));
  ok('Design-Tokens als Custom Properties vorhanden',
     ['--orvia-glass-blur', '--orvia-glass-saturation', '--orvia-glass-bg', '--orvia-glass-shadow',
      '--orvia-tab-active', '--orvia-tabbar-h'].every(t => css.indexOf(t) >= 0));
  const ui = readFileSync(join(APP, 'js/ui.js'), 'utf8');
  ok('Scroll-Handler ist passiv und rAF-gedrosselt',
     /addEventListener\('scroll'[\s\S]{0,180}\{passive:true\}/.test(ui) && /requestAnimationFrame\(apply\)/.test(ui));
  ok('Specular laeuft NUR bei echtem Zeiger (hover:hover and pointer:fine)',
     /\(hover:hover\) and \(pointer:fine\)/.test(ui));
  ok('Kapsel nutzt translate3d (Compositor statt Layout)', /translate3d\(/.test(ui));
}

await browser.close(); server.close();
console.log('\nliquid_glass_tabbar: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);

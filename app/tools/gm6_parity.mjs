/* VERALTET (KF-013, 2026-08-02) — NICHT MEHR LAUFFAEHIG.

   Dieses Werkzeug vergleicht gegen Golden-Master-Fixtures in /tmp
   (z. B. /tmp/orvia_dashboard_5.html, /tmp/gm4h.html, /tmp/gm6h.html).
   Diese Dateien liegen NICHT im Repo und sind fluechtig. Nach ihrem Verlust
   war die verbindliche Regel „Struktur schrumpft NIE"
   (docs/GOLDEN-MASTER-MAPPING.md:47) nur noch dokumentiert, aber nicht
   geschuetzt — genau das ist KF-013.

   ABGELOEST DURCH:
     supabase/tests/gm_structure_contract_test.mjs   (semantischer Vertrag)
     tools/build_structure_contract.mjs              (Generator)
     docs/gm-ref/structure-contract.json             (eingecheckter Vertrag)

   Aufbewahrt als Referenz fuer die pixelnahe Pruefung. Wieder aktivierbar,
   sobald die Fixtures eingecheckt sind — dann diesen Hinweis entfernen.
*/
/* ORVIA · GM6-Paritätsprüfung — globale Zustände und systemweites Verhalten.
   Referenz: /tmp/orvia_dashboard_5.html (unverändert, md5 1b93e15e23054318c8848d5cb10e6bcb).
   Prüfling: /tmp/gm6h.html (Harness aus produktivem js/ui.js + styles.css + Fixtures).

   Aufbau
   ------
   A  Dashboard-Zustandsparität gegen die SECHS echten Golden-Master-Szenarien
      (good/attention/crit/loading/empty/error) auf 430×900 und 390 px.
   B  Komponentenparität der drei systemweiten Bausteine (.sk-Karte, .sk-Kachel,
      .card>.empty, .errbar, Retry-Button) — UNMASKIERT, gegen die echten
      Golden-Master-Elemente, jeweils im Golden-Master-eigenen Container.
   C  Struktur-Diff je Zustand (DOM-Reihenfolge, Klassen, Karten-/Slotzahlen) —
      in A integriert und dort einzeln ausgewiesen.
   D  Nicht-Dashboard-Tabs: der Golden Master besitzt dort nachweislich KEINE
      Zustandsvarianten. Genau das wird gemessen (Szenario-Invarianz, 0 % Diff)
      und als echte Referenzaufnahme abgelegt — es wird kein GM-Zustand erfunden.
   E  Retry, Fokus, Escape, Reduced Motion, Overflow, Legacy, Konsole.

   Aufruf: node tools/gm6_parity.mjs        (erwartet /tmp/gm6h.html aus /tmp/gm6_build.mjs)
   Ergebnisse: docs/gm-ref/gm6/ (Referenz- + Prüfaufnahmen, results.json)          */

import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'fs';
import crypto from 'crypto';

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const head = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 66 - t.length)));

const GMFILE = '/tmp/orvia_dashboard_5.html';
const OUT = new URL('../docs/gm-ref/gm6/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const results = {};

/* --- 0. Referenz-Integrität ------------------------------------------------ */
head('0 · Referenz-Integrität');
const gmMd5 = crypto.createHash('md5').update(fs.readFileSync(GMFILE)).digest('hex');
ok('Golden Master unverändert (md5 1b93e15e23054318c8848d5cb10e6bcb)',
   gmMd5 === '1b93e15e23054318c8848d5cb10e6bcb', gmMd5);

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

/* Der Golden Master wird NICHT geometrisch normalisiert: ausgeblendet werden nur
   Demo-Bedienelemente (Statusleiste, Dev-Panel, Legende, Toast) und der Geräte-
   rahmen der .phone-Hülle. Die Inhaltsbreite bleibt exakt die Referenzbreite. */
const GMCSS = '.statusbar{display:none!important}.phone{border:none!important;border-radius:0!important;box-shadow:none!important}.demobar,.legend,.save-toast{display:none!important}';

const gm = await b.newPage({ viewportSize: { width: 470, height: 1000 }, deviceScaleFactor: 1 });
await gm.goto('file://' + GMFILE);
await gm.addStyleTag({ content: GMCSS });

const prod = await b.newPage({ viewportSize: { width: 430, height: 900 }, deviceScaleFactor: 1 });
const perrs = []; prod.on('pageerror', e => perrs.push(String(e)));
prod.on('console', m => { if (m.type() === 'error') perrs.push('console: ' + m.text()); });
await prod.goto('file:///tmp/gm6h.html');

const probe = await b.newPage({ viewportSize: { width: 430, height: 900 }, deviceScaleFactor: 1 });
const pberrs = []; probe.on('pageerror', e => pberrs.push(String(e)));
await probe.goto('file:///tmp/gm6h.html');

/* --- Werkzeuge ------------------------------------------------------------- */
async function setWidth(px) {
  await gm.evaluate(w => {
    document.querySelector('.phone').style.setProperty('width', w + 'px', 'important');
  }, px);
  await gm.waitForTimeout(120);
}
async function gmSet(level, scen, ci) {
  await gm.evaluate(([l, s, c]) => {
    document.querySelectorAll('#lvl button').forEach(x => { if (x.dataset.l === l) x.click(); });
    document.querySelectorAll('#scen button').forEach(x => { if (x.dataset.s === s) x.click(); });
    const t = document.getElementById('ciToggle');
    if (t) { const on = t.classList.contains('on'); if (c !== on) t.click(); }
  }, [level, scen, ci]);
  await gm.waitForTimeout(150);
}
/* Sektionsfolge: #tab-heute/#command/#modules sind produktive Host-Wrapper ohne
   Golden-Master-Pendant und werden deshalb — wie schon in GM1..GM5 — aufgelöst. */
const seqOf = pg => pg.evaluate(sel => {
  const scr = document.querySelector(sel); const kids = [];
  const push = el => {
    if (el.id === 'tab-heute' || el.id === 'command' || el.id === 'modules') { [...el.children].forEach(push); return; }
    const r = el.getBoundingClientRect();
    if (r.height <= 1 || getComputedStyle(el).display === 'none') return;
    kids.push(el);
  };
  [...scr.children].forEach(push);
  return kids.map(el => {
    const r = el.getBoundingClientRect();
    const self = (el.classList.contains('card') || el.classList.contains('kcard')) ? 1 : 0;
    return {
      cls: [...el.classList].filter(c => !['v3date', 'ci-compact', 'ci-full', 'ci-collapsed', 'tight', 'tap'].includes(c)).join(' '),
      y: Math.round(r.y), h: Math.round(r.height), w: Math.round(r.width),
      cards: self + el.querySelectorAll('.card,.kcard').length,
      sk: el.querySelectorAll('.sk').length + (el.classList.contains('sk') ? 1 : 0),
      empty: el.querySelectorAll('.empty').length,
      errbar: el.querySelectorAll('.errbar').length + (el.classList.contains('errbar') ? 1 : 0)
    };
  });
}, pg === gm ? '#screen' : '#prodScreen');

const MASKPARENTS = '.card,.kcard,.hero,.hdr,.sync,.sectlabel,.addmod,.gapnote,.errbar,.eduhint,.batt,.reco,.checkin';
async function shot(pg, sel, path, mask) {
  await pg.evaluate(() => { document.querySelectorAll('.tabbar,.fab').forEach(e => e.style.visibility = 'hidden'); });
  if (mask) await pg.evaluate(mp => {
    document.querySelectorAll('.gm-mask').forEach(m => m.remove());
    /* Textzeilen-Maske: volle Blockbreite des Elternkastens, seitenverankert.
       Maskiert werden ausschliesslich Textzeilen — Karten, Skeletons, Fehler-
       symbole, Rahmen, Abstaende und Buttons bleiben unmaskiert (§6). */
    const walk = el => {
      for (const n of el.childNodes) {
        if (n.nodeType === 3 && n.textContent.trim()) {
          const r = el.getBoundingClientRect();
          const p = (el.closest(mp) || el.parentElement || el).getBoundingClientRect();
          if (r.height > 0 && r.height < 120) {
            const d = document.createElement('div'); d.className = 'gm-mask';
            d.style.cssText = `position:absolute;left:${p.x + scrollX + 8}px;top:${r.y + scrollY - 3}px;width:${Math.max(p.width - 16, 10)}px;height:${r.height + 6}px;background:#ff00ff;z-index:99999;pointer-events:none`;
            document.body.appendChild(d);
          }
          return;
        }
      }
      for (const c of el.children) if (!/^(svg|path|circle|rect|line|g|text)$/i.test(c.tagName)) walk(c);
    };
    walk(document.querySelector('.screen') || document.body);
  }, MASKPARENTS);
  const el = await pg.$(sel);
  await el.screenshot({ path, animations: 'disabled' });
  if (mask) await pg.evaluate(() => document.querySelectorAll('.gm-mask').forEach(m => m.remove()));
  await pg.evaluate(() => { document.querySelectorAll('.tabbar,.fab').forEach(e => e.style.visibility = ''); });
}
function diffPNG(a, bp, out) {
  const A = PNG.sync.read(fs.readFileSync(a)), B = PNG.sync.read(fs.readFileSync(bp));
  const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height);
  const crop = P => { const c = new PNG({ width: w, height: h }); PNG.bitblt(P, c, 0, 0, w, h, 0, 0); return c; };
  const D = new PNG({ width: w, height: h });
  const n = pixelmatch(crop(A).data, crop(B).data, D.data, w, h, { threshold: 0.14 });
  fs.writeFileSync(out, PNG.sync.write(D));
  return { pct: Math.round(n / (w * h) * 10000) / 100, px: n, gm: [A.width, A.height], prod: [B.width, B.height] };
}
/* GM6.1 §2: Vergleich „PROD-Gutzustand vs. PROD-Offline+Cache", exakt um die
   Hoehe der zusaetzlichen Hinweisleiste verschoben. Kein Zuschnitt, keine Maske
   ueber das ohnehin gemeinsame Textraster hinaus, keine Veraenderung der
   Referenz — verglichen werden zwei Aufnahmen derselben Anwendung. */
function diffShift(aPath, bPath, cut, shift, out) {
  const A = PNG.sync.read(fs.readFileSync(aPath));   /* Datenzustand   */
  const B = PNG.sync.read(fs.readFileSync(bPath));   /* offline+Cache  */
  const w = Math.min(A.width, B.width);
  const hTop = Math.max(0, cut);
  const hBot = Math.max(0, Math.min(A.height - cut, B.height - cut - shift));
  const H = hTop + hBot;
  const CA = new PNG({ width: w, height: H }), CB = new PNG({ width: w, height: H });
  if (hTop > 0) { PNG.bitblt(A, CA, 0, 0, w, hTop, 0, 0); PNG.bitblt(B, CB, 0, 0, w, hTop, 0, 0); }
  if (hBot > 0) { PNG.bitblt(A, CA, 0, cut, w, hBot, 0, hTop); PNG.bitblt(B, CB, 0, cut + shift, w, hBot, 0, hTop); }
  const D = new PNG({ width: w, height: H });
  const n = pixelmatch(CA.data, CB.data, D.data, w, H, { threshold: 0.14 });
  fs.writeFileSync(out, PNG.sync.write(D));
  return { pct: Math.round(n / (w * H) * 10000) / 100, px: n, shift, cut };
}
const LEGACY = '#prodScreen .occ, #prodScreen .cic-b, #prodScreen .cic-h, #prodScreen .headrow, ' +
  '#prodScreen .btn.sec, #prodScreen .mv-note, #prodScreen p.muted, #prodScreen .placeholder';

/* ============================================================================
   A/C · Dashboard-Zustandsparität + Struktur-Diff
   Prod-Zustand → GM-Szenario. Die GM-Spalte nennt das ECHTE Referenzszenario;
   Zustände ohne eigenes GM-Bauteil (partial, offline-ohne-Daten, sync-Fehler,
   local/pending) werden gegen dasjenige GM-Szenario geprüft, dessen Struktur
   sie laut §3 beibehalten müssen — nicht gegen einen erfundenen GM-Zustand.
   ========================================================================== */
const STATES = [
  /* name,                 GM(level,scen,ci),        prod(state,mode),                    Gruppe */
  ['f_good', ['f', 'good', true], ['good', 'fortgeschritten'], 'vollständig'],
  ['a_good', ['a', 'good', true], ['good', 'anfaenger'], 'vollständig'],
  ['p_good', ['p', 'good', true], ['good', 'profi'], 'vollständig'],
  ['f_ciopen', ['f', 'good', false], ['ciopen', 'fortgeschritten'], 'vollständig'],
  ['f_attention', ['f', 'attention', true], ['attention', 'fortgeschritten'], 'vollständig'],
  ['p_crit', ['p', 'crit', true], ['crit', 'profi'], 'vollständig'],
  ['a_loading', ['a', 'loading', true], ['loading', 'anfaenger'], 'Laden'],
  ['f_loading', ['f', 'loading', true], ['loading', 'fortgeschritten'], 'Laden'],
  ['p_loading', ['p', 'loading', true], ['loading', 'profi'], 'Laden'],
  ['a_empty', ['a', 'empty', true], ['empty', 'anfaenger'], 'leer'],
  ['f_empty', ['f', 'empty', true], ['empty', 'fortgeschritten'], 'leer'],
  ['p_empty', ['p', 'empty', true], ['empty', 'profi'], 'leer'],
  /* GM6.1 §2: Fuer „offline mit vorhandenem Cache" (und den behebbaren
     Ladefehler MIT Daten) existiert im Golden Master KEIN Referenzzustand. Sein
     errorView ist der reduzierte Hard-Error; §2 schreibt hier ausdruecklich das
     Gegenteil vor — Module und Werte bleiben stehen, es kommt NUR der Hinweis
     dazu. Referenz ist deshalb der GM-GUTZUSTAND; geprueft wird der additive
     Vertrag (siehe NOGMREF). */
  ['a_offline_cache', ['a', 'good', true], ['offline_cache', 'anfaenger'], 'offline mit Cache'],
  ['f_offline_cache', ['f', 'good', true], ['offline_cache', 'fortgeschritten'], 'offline mit Cache'],
  ['p_offline_cache', ['p', 'good', true], ['offline_cache', 'profi'], 'offline mit Cache'],
  ['f_offline_nav', ['f', 'good', true], ['offline_cache_nav', 'fortgeschritten'], 'offline (navigator)'],
  ['f_offline_sync', ['f', 'good', true], ['offline_cache_sync', 'fortgeschritten'], 'offline (syncState)'],
  ['f_offline_nodata', ['f', 'error', true], ['offline_nodata', 'fortgeschritten'], 'offline ohne Daten'],
  ['f_error', ['f', 'good', true], ['error', 'fortgeschritten'], 'behebbarer Ladefehler'],
  ['f_error_nodata', ['f', 'error', true], ['error_nodata', 'fortgeschritten'], 'Ladefehler ohne Daten'],
  ['f_partial', ['f', 'good', true], ['partial', 'fortgeschritten'], 'teilweise vorhanden'],
  ['f_local_only', ['f', 'good', true], ['local_only', 'fortgeschritten'], 'nur lokal (Negativkontrolle)'],
  ['f_pending', ['f', 'good', true], ['pending', 'fortgeschritten'], 'Sync ausstehend (Negativkontrolle)']
];
/* Zustände, deren Werteinhalt sich vom GM-Szenario unterscheiden DARF (Partial /
   offline-ohne-Daten / Negativkontrollen): dort zählt die Struktur, der Pixel-
   vergleich läuft über die Textmaske. Alles andere wird identisch erwartet. */
const STRUCTONLY = new Set(['f_partial', 'f_offline_nodata', 'f_error_nodata', 'f_local_only', 'f_pending']);

/* GM6.1 §2 — Zustaende OHNE Golden-Master-Referenz.
   Der Golden Master kennt „offline mit vorhandenem Cache" nicht. Ein Pixelgate
   gegen seinen errorView waere ein Vergleich mit der FALSCHEN Referenz und
   wuerde genau das erzwingen, was §2 verbietet (Module wegwerfen). Das
   ≤2-%-Gate gegen den GM entfaellt hier deshalb ersatzlos NICHT, sondern wird
   durch zwei striktere, maskenfreie Vertraege ersetzt:
     1. Struktur  = GM-Gutzustand + genau EINE zusaetzliche .errbar nach .sync
     2. Pixel     = PROD-Datenzustand, exakt um die Hoehe der Hinweisleiste
                    verschoben, sonst deckungsgleich (prod-vs-prod, ≤2 %)
   Die Hinweisleiste selbst bleibt gegen den Golden Master gemessen
   (Komponente „errbar", 1,79 % ohne Maske). Die Referenzdatei bleibt unberuehrt,
   es wird nichts normalisiert und nichts maskiert.
   name → [PROD-Vergleichsaufnahme, PROD-Zustand, PROD-Modus] */
const NOGMREF = new Map([
  ['a_offline_cache', ['a_good', 'good', 'anfaenger']],
  ['f_offline_cache', ['f_good', 'good', 'fortgeschritten']],
  ['p_offline_cache', ['p_good', 'good', 'profi']],
  ['f_offline_nav', ['f_good', 'good', 'fortgeschritten']],
  ['f_offline_sync', ['f_good', 'good', 'fortgeschritten']],
  ['f_error', ['f_good', 'good', 'fortgeschritten']]
]);
const heroTop = async () => prod.evaluate(() => {
  const s = document.getElementById('prodScreen').getBoundingClientRect();
  const h = document.querySelector('#prodScreen .hero');
  return h ? Math.round(h.getBoundingClientRect().top - s.top) : -1;
});

async function runState(name, gset, pset, group, tag) {
  const [gl, gs, gc] = gset, [ps, pm] = pset;
  await gmSet(gl, gs, gc);
  await prod.evaluate(([s, m]) => setState(s, m), [ps, pm]);
  await prod.waitForTimeout(90);
  const key = name + tag;

  const gseq = await seqOf(gm), pseq = await seqOf(prod);
  const drop = x => /statusbar|lvlbadge|demobar/.test(x.cls);
  const G = gseq.filter(x => !drop(x)), P = pseq.filter(x => !drop(x));
  const norm = a => a.map(x => x.cls.split(' ')[0] || 'div');

  const noRef = NOGMREF.get(name);
  /* Erwartete Sequenz fuer §2-Zustaende: GM-Gutzustand + eine .errbar nach .sync */
  const expSeq = (() => {
    const a = norm(G).slice(); const i = a.indexOf('sync');
    a.splice(i < 0 ? 0 : i + 1, 0, 'errbar'); return a.join('|');
  })();
  /* Fuer die element-weise Geometrie wird die zusaetzliche Leiste ausgeblendet —
     sie ist der EINZIGE erlaubte Unterschied und wird separat gemessen. */
  const Pg = noRef ? P.filter((x, i) => norm(P)[i] !== 'errbar') : P;

  /* C1 — DOM-Reihenfolge und Klassen */
  if (noRef)
    ok(key + ': Struktur = GM-Gutzustand + genau EINE zusaetzliche Hinweisleiste (§2)',
       expSeq === norm(P).join('|'), expSeq + '  VS  ' + norm(P).join('|'));
  else
    ok(key + ': Struktur-Diff 0 (Sektionsfolge + Klassen)',
       norm(G).join('|') === norm(P).join('|'), norm(G).join('|') + '  VS  ' + norm(P).join('|'));
  /* C2 — Slotzahlen: Karten, Skeletons, Empty-Blöcke, Fehlerleisten */
  const sum = (a, k) => a.reduce((s, x) => s + x[k], 0);
  ok(key + ': Slotzahlen identisch (Karten/Skeletons/Empty/Errbar)',
     sum(G, 'cards') === sum(P, 'cards') && sum(G, 'sk') === sum(P, 'sk') &&
     sum(G, 'empty') === sum(P, 'empty') &&
     (noRef ? (sum(G, 'errbar') === 0 && sum(P, 'errbar') === 1) : sum(G, 'errbar') === sum(P, 'errbar')),
     `GM ${sum(G, 'cards')}/${sum(G, 'sk')}/${sum(G, 'empty')}/${sum(G, 'errbar')} vs ` +
     `PROD ${sum(P, 'cards')}/${sum(P, 'sk')}/${sum(P, 'empty')}/${sum(P, 'errbar')}`);
  /* C3 — Geometrie: Breite exakt, Höhe mit Texttoleranz */
  let boxOK = G.length === Pg.length, boxInfo = '';
  if (boxOK) for (let i = 0; i < G.length; i++) {
    const wBad = (G[i].w >= 300 || Pg[i].w >= 300) ? Math.abs(G[i].w - Pg[i].w) > 2 : false;
    if (wBad || Math.abs(G[i].h - Pg[i].h) > 56) { boxOK = false; boxInfo = norm(G)[i] + ' w' + G[i].w + '/' + Pg[i].w + ' h' + G[i].h + '/' + Pg[i].h; break; }
  }
  ok(key + ': Bounding-Boxen (Breite exakt, Höhe ±Texttoleranz)', boxOK, boxInfo);

  /* A — Pixelvergleich, dynamische Texte eng maskiert */
  await shot(gm, '#screen', `${OUT}gm_${key}.png`, true);
  await shot(prod, '#prodScreen', `${OUT}prod_${key}.png`, true);
  const d = diffPNG(`${OUT}gm_${key}.png`, `${OUT}prod_${key}.png`, `${OUT}diff_${key}.png`);
  if (noRef) {
    /* Der GM-Wert wird ehrlich ausgewiesen, aber NICHT gegated: er misst gegen
       einen Zustand, den der Golden Master fuer diesen Fall gar nicht kennt. */
    const [refKey, rs, rm] = noRef;
    const T1 = await heroTop();
    await prod.evaluate(([s, m]) => setState(s, m), [rs, rm]);
    await prod.waitForTimeout(90);
    const T0 = await heroTop();
    await prod.evaluate(([s, m]) => setState(s, m), [ps, pm]);
    await prod.waitForTimeout(90);
    const ds = diffShift(`${OUT}prod_${refKey}${tag}.png`, `${OUT}prod_${key}.png`,
                         T0, T1 - T0, `${OUT}diffshift_${key}.png`);
    results[key] = { ...ds, group, gmScen: gs, prodState: ps, gated: 'prod-vs-prod (§2)',
                     gmInfo: d.pct, note: 'kein GM-Referenzzustand (§2) — GM-Wert nur informativ' };
    ok(key + ': §2-Pixelvertrag — identisch zum Datenzustand, nur um die Hinweisleiste verschoben',
       ds.pct <= 2 && ds.shift > 0, ds.pct + '% (' + ds.px + 'px) · Versatz ' + ds.shift + 'px' +
       ' · GM-errorView informativ ' + d.pct + '%');
  } else {
    results[key] = { ...d, group, gmScen: gs, prodState: ps };
    ok(key + ': Pixel-Diff ≤ 2 % (' + group + ')', d.pct <= 2, d.pct + '% (' + d.px + 'px)');
  }

  /* E — Overflow, Legacy, Shell */
  const over = await prod.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(key + ': kein horizontaler Overflow', over <= 0, 'over=' + over);
  ok(key + ': keine sichtbare Legacy-Komponente', !(await prod.evaluate(s => !!document.querySelector(s), LEGACY)));
  const shell = await prod.evaluate(() => ({
    tabs: [...document.querySelectorAll('.tabwrap button .tl')].map(x => x.textContent).join(','),
    fab: getComputedStyle(document.getElementById('navPlus')).display
  }));
  ok(key + ': Tabbar und Shell bleiben erhalten',
     shell.tabs === 'Dashboard,Plan,Aktivität,Analyse,Profil' && shell.fab !== 'none', JSON.stringify(shell));
  /* §3 — Missingness nie als 0 */
  const zero = await prod.evaluate(() => {
    const bad = [];
    document.querySelectorAll('#prodScreen .kv,#prodScreen .big,#prodScreen .mv,#prodScreen b,#prodScreen .n')
      .forEach(e => { if (/^\s*0\s*$/.test(e.textContent)) bad.push([...e.classList].join('.') || e.tagName); });
    return bad;
  });
  if (STRUCTONLY.has(name) || group === 'leer' || /offline|Ladefehler/.test(group))
    ok(key + ': keine Missingness als 0 dargestellt', zero.length === 0, zero.join(','));
  return d;
}

head('A/C · Dashboard-Zustandsparität 430×900 (Struktur + Pixel)');
for (const [name, g, p, grp] of STATES) await runState(name, g, p, grp, '_430');

head('A/C · Dashboard-Zustandsparität 390 px');
await prod.setViewportSize({ width: 390, height: 844 });
await setWidth(390);
const S390 = STATES.filter(s => ['f_good', 'f_loading', 'f_empty', 'f_offline_cache', 'f_partial', 'f_error'].includes(s[0]));
for (const [name, g, p, grp] of S390) await runState(name, g, p, grp, '_390');
await prod.setViewportSize({ width: 430, height: 900 });
await setWidth(430);

/* ============================================================================
   B · Komponentenparität — unmaskiert, GM-eigene Texte im Harness-Probe.
   Die drei systemweiten Bausteine werden im Golden-Master-eigenen Container
   gerendert (Karte / Kachelraster / Seitenebene / Hero) und Element gegen
   Element mit der Referenz verglichen. Keine Maske, kein Toleranzfenster
   ausser dem regulären 2-%-Gate.
   ========================================================================== */
head('B · Komponentenparität der systemweiten Zustandsbausteine');
const PROBES = [
  ['sk_card', 'loading',
    () => document.querySelector('#screen .card'),
    `<div id="pb">${'GMSTATELOADING'}</div>`, '#pb > .card'],
  ['sk_kcard', 'loading',
    () => document.querySelector('#screen .kgrid .kcard'),
    `<div class="kgrid" id="pb">${'GMSTATELOADINGK'}</div>`, '#pb > .kcard'],
  ['empty_card', 'empty',
    () => [...document.querySelectorAll('#screen .card')].find(c => c.querySelector('.empty')),
    `<div id="pb">${'GMSTATEEMPTY'}</div>`, '#pb > .card'],
  ['errbar', 'error',
    () => document.querySelector('#screen .errbar'),
    `<div id="pb">${'GMSTATEERROR'}</div>`, '#pb > .errbar'],
  ['retry_btn', 'error',
    () => document.querySelector('#screen .hero button.cta.wide-ghost'),
    `<div class="hero" id="pb">${'GMSTATEERROR'}</div>`, '#pb button.cta.wide-ghost']
];
const PROBEHTML = {
  GMSTATELOADING: `gmStateLoading({})`,
  GMSTATELOADINGK: `gmStateLoading({kind:'kcard'})`,
  /* Golden-Master-Texte, wörtlich aus emptyView/errorView — sie existieren
     ausschliesslich in diesem Harness-Probe (§2), nie im Produktivcode. */
  GMSTATEEMPTY: `gmStateEmpty({icon:'moon',title:'Schlaf & Erholung',desc:'Verbinde ein Wearable oder erfasse manuell.',action:'expandCheckinCard()',actionIcon:'activity',label:'Manuell erfassen'})`,
  GMSTATEERROR: `gmStateError({icon:'wifi',title:'Offline — letzte Daten von 07:14.',desc:'Bereitschaft wird aktualisiert, sobald die Verbindung zurück ist.',retry:'renderDay()',label:'Erneut versuchen'})`
};
/* DOM-Signatur: Klassenfolge OHNE SVG-Innenleben. Icon-Pfade werden nicht als
   Struktur, sondern pixelweise (unmaskiert) verglichen; e.className ist bei SVG
   ein SVGAnimatedString, deshalb getAttribute('class'). */
const SIGFN = `el=>{const s=[];const w=n=>{for(const c of n.children){const k=c.getAttribute('class');s.push(c.tagName.toLowerCase()+(k?'.'+k.trim().split(/\\s+/).join('.'):''));if(c.tagName.toLowerCase()!=='svg')w(c);}};w(el);return s.join('>');}`;

/* Messrahmen der Komponentenprobe (§6, unmaskiert):
   .errbar, .card und .hero sind teil-transparent (z. B. --crit-t = rgba(...,.15)).
   Ihr Farbwert haengt damit vom Radial-Verlauf des Containers ab, und dieser
   haengt an Containerhoehe und Position im Container. Der Pruefling wird deshalb
   im MESSRAHMEN auf exakt dieselbe Containerhoehe und denselben Abstand zum
   Containeroberrand gesetzt wie die Referenz — gleiche Komponente, gleicher
   Hintergrund. Das ist keine Normalisierung der Referenz (die bleibt unangetastet)
   und keine Maske, sondern die Herstellung identischer Messbedingungen. Als
   Nebeneffekt stimmt der Subpixel-Versatz beider Boxen ueberein, sodass beide
   Elementaufnahmen exakt dieselbe Pixelgroesse haben. */
/* Shell-Overlays (Tabbar/FAB) liegen im Golden Master ueber tief liegenden
   Karten. Sie gehoeren nicht zur geprueften Komponente und werden waehrend der
   Komponentenaufnahme auf BEIDEN Seiten gleich ausgeblendet; ihre Parität wird
   in Teil A an der vollstaendigen Ansicht geprueft. */
const HIDESHELL = '/*gm6shell*/.tabbar,.fab{visibility:hidden!important}';
await gm.addStyleTag({ content: HIDESHELL });
await probe.addStyleTag({ content: HIDESHELL });
const dropShell = pg => pg.evaluate(() => document.querySelectorAll('style').forEach(s => { if (s.textContent.includes('gm6shell')) s.remove(); }));
for (const [pname, scen, gsel, tpl, psel] of PROBES) {
  await gmSet('f', scen, true);
  const gEl = await gm.evaluateHandle(gsel);
  const gh = gEl.asElement();
  if (!gh) { ok('Komponente ' + pname + ': Referenzelement im Golden Master gefunden', false); continue; }
  await gh.scrollIntoViewIfNeeded();
  await gm.waitForTimeout(80);
  const gRef = await gh.evaluate(el => {
    const scr = document.getElementById('screen');
    const r = el.getBoundingClientRect(), s = scr.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, sw: s.width, sh: s.height, off: r.y - s.y };
  });
  const gSig = await gh.evaluate(new Function('return (' + SIGFN + ')')());
  await gh.screenshot({ path: `${OUT}gmc_${pname}.png`, animations: 'disabled' });

  /* laengster passender Schluessel — sonst schluckt GMSTATELOADING das K-Suffix */
  const key = Object.keys(PROBEHTML).filter(k => tpl.includes(k)).sort((a, z) => z.length - a.length)[0];
  const align = await probe.evaluate(([t, expr, sh, want, sel]) => {
    const scr = document.getElementById('prodScreen');
    scr.style.setProperty('height', sh + 'px', 'important');
    scr.style.setProperty('min-height', sh + 'px', 'important');
    scr.style.setProperty('max-height', sh + 'px', 'important');
    scr.style.setProperty('overflow', 'hidden', 'important');
    scr.innerHTML = '<div id="pbspacer" style="height:0px"></div>' + t.replace(/GMSTATE\w+/, '');
    document.getElementById('pb').innerHTML = eval(expr);
    window.scrollTo(0, 0);
    const sp = document.getElementById('pbspacer');
    let cur = 0;
    for (let i = 0; i < 5; i++) {
      const el = document.querySelector(sel); if (!el) return null;
      const d = want - (el.getBoundingClientRect().y - scr.getBoundingClientRect().y);
      if (Math.abs(d) < 0.005) break;
      cur = Math.max(0, cur + d); sp.style.height = cur + 'px';
    }
    const el = document.querySelector(sel); if (!el) return null;
    const r = el.getBoundingClientRect(), s = scr.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, off: r.y - s.y, sh: s.height };
  }, [tpl, PROBEHTML[key], gRef.sh, gRef.off, psel]);
  await probe.waitForTimeout(60);
  const pEl = await probe.$(psel);
  ok('Komponente ' + pname + ': im DOM vorhanden', !!pEl && !!align);
  if (!pEl || !align) continue;
  ok('Komponente ' + pname + ': identische Messbedingungen (Containerhöhe + Abstand)',
     Math.abs(align.sh - gRef.sh) < 0.01 && Math.abs(align.off - gRef.off) < 0.01,
     `GM h=${gRef.sh} off=${Math.round(gRef.off * 100) / 100} vs PROD h=${align.sh} off=${Math.round(align.off * 100) / 100}`);
  const pSig = await pEl.evaluate(new Function('return (' + SIGFN + ')')());
  ok('Komponente ' + pname + ': DOM-Signatur identisch zur Referenz (Struktur-Diff 0)',
     pSig === gSig, pSig === gSig ? pSig : 'GM ' + gSig + '  VS  PROD ' + pSig);
  ok('Komponente ' + pname + ': Geometrie identisch (Breite exakt, Höhe exakt)',
     Math.round(gRef.w) === Math.round(align.w) && Math.abs(gRef.h - align.h) < 0.01,
     `GM ${gRef.w}×${gRef.h} vs PROD ${align.w}×${align.h}`);
  await pEl.screenshot({ path: `${OUT}prodc_${pname}.png`, animations: 'disabled' });
  const d = diffPNG(`${OUT}gmc_${pname}.png`, `${OUT}prodc_${pname}.png`, `${OUT}diffc_${pname}.png`);
  results['komponente_' + pname] = { ...d, group: 'Komponente (unmaskiert)' };
  ok('Komponente ' + pname + ': Aufnahmen exakt gleich groß (kein Zuschnitt)',
     d.gm[0] === d.prod[0] && d.gm[1] === d.prod[1], d.gm.join('×') + ' vs ' + d.prod.join('×'));
  ok('Komponente ' + pname + ': Pixel-Diff ≤ 2 % OHNE Maske', d.pct <= 2, d.pct + '% (' + d.px + 'px)');
}
/* Messrahmen zurücksetzen — die folgenden Kontraktprüfungen laufen am realen Host,
   die Referenzaufnahmen in Teil D wieder mit vollstaendiger Shell. */
await probe.evaluate(() => {
  const scr = document.getElementById('prodScreen');
  ['height', 'min-height', 'max-height', 'overflow'].forEach(p => scr.style.removeProperty(p));
});
await dropShell(gm); await dropShell(probe);
/* Kontraktprüfung der ECHTEN Produktivhosts (Karten-Kontext, nicht Probe):
   dieselben Klassen, dieselbe Kindfolge — Struktur-Diff 0 zur Referenz. */
const CONTRACT = await probe.evaluate(SF => {
  const sig = new Function('return (' + SF + ')')();
  const d = document.createElement('div');
  const r = {};
  d.innerHTML = gmStateLoading({ bare: true }); r.loading = sig(d);
  d.innerHTML = gmStateEmpty({ icon: 'moon', title: 'T', desc: 'D', action: 'expandCheckinCard()', actionIcon: 'activity', label: 'L' }); r.empty = sig(d);
  d.innerHTML = gmStateError({ title: 'T', desc: 'D', retry: 'renderDay()', label: 'L' }); r.error = sig(d);
  return r;
}, SIGFN);
/* Referenz-Kindfolgen direkt aus dem Golden Master, nicht aus einer Annahme. */
await gmSet('f', 'empty', true);
const GMEMPTYSIG = await gm.evaluate(SF => {
  const sig = new Function('return (' + SF + ')')();
  const c = [...document.querySelectorAll('#screen .card')].find(x => x.querySelector('.empty'));
  const d = document.createElement('div'); d.appendChild(c.cloneNode(true)); return sig(d);
}, SIGFN);
await gmSet('f', 'error', true);
const GMERRSIG = await gm.evaluate(SF => {
  const sig = new Function('return (' + SF + ')')();
  const d = document.createElement('div');
  d.appendChild(document.querySelector('#screen .errbar').cloneNode(true));
  d.appendChild(document.querySelector('#screen .hero button.cta.wide-ghost').cloneNode(true));
  return sig(d);
}, SIGFN);
const GMLOADSIG = await (async () => {
  await gmSet('f', 'loading', true);
  return gm.evaluate(SF => {
    const sig = new Function('return (' + SF + ')')();
    const d = document.createElement('div');
    [...document.querySelector('#screen .card').children].forEach(c => d.appendChild(c.cloneNode(true)));
    return sig(d);
  }, SIGFN);
})();
ok('Kontrakt Loading: Kindfolge identisch zum Golden-Master-Kartenskelett',
   CONTRACT.loading === GMLOADSIG, CONTRACT.loading === GMLOADSIG ? CONTRACT.loading : 'GM ' + GMLOADSIG + '  VS  PROD ' + CONTRACT.loading);
ok('Kontrakt Empty: Kindfolge identisch zur Golden-Master-Empty-Karte',
   CONTRACT.empty === GMEMPTYSIG, CONTRACT.empty === GMEMPTYSIG ? CONTRACT.empty : 'GM ' + GMEMPTYSIG + '  VS  PROD ' + CONTRACT.empty);
ok('Kontrakt Error: Kindfolge identisch zu Golden-Master-errbar + Retry-Button',
   CONTRACT.error === GMERRSIG, CONTRACT.error === GMERRSIG ? CONTRACT.error : 'GM ' + GMERRSIG + '  VS  PROD ' + CONTRACT.error);

/* ============================================================================
   D · Nicht-Dashboard-Tabs + Profilunterseite
   Der Golden Master besitzt dort KEINE Zustandsvarianten (loadingView/emptyView/
   errorView sind ausschliesslich über originalDashboardRender erreichbar).
   Statt einen GM-Zustand zu erfinden, wird genau dieser Sachverhalt gemessen:
   die vier Tabs und die Profilunterseite müssen über ALLE sechs Szenarien
   strukturell und pixelweise invariant sein. Die Aufnahmen sind die echten
   Referenzbilder für diese Tabs.
   ========================================================================== */
head('D · Golden-Master-Zustandsinvarianz der vier Nicht-Dashboard-Tabs');
const TABS = [['tage', 'Plan'], ['act', 'Aktivität'], ['ana', 'Analyse'], ['prof', 'Profil']];
const SCENS = ['good', 'attention', 'crit', 'empty', 'loading', 'error'];
for (const [tab, label] of TABS) {
  const sigs = [], files = [];
  for (const s of SCENS) {
    await gmSet('f', s, true);
    await gm.evaluate(t => go(t), tab);
    await gm.waitForTimeout(150);
    sigs.push(await gm.evaluate(() => {
      const scr = document.getElementById('screen');
      return [...scr.querySelectorAll('*')].map(e => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : '')).join('>');
    }));
    const f = `${OUT}gm_tab_${tab}_${s}_430.png`;
    await shot(gm, '#screen', f, false); files.push(f);
  }
  const same = sigs.every(x => x === sigs[0]);
  ok(`GM-Tab „${label}": strukturell invariant über alle 6 Szenarien (kein GM-Zustand vorhanden)`, same);
  const dd = diffPNG(files[0], files[SCENS.indexOf('loading')], `${OUT}diff_tab_${tab}_loading.png`);
  const de = diffPNG(files[0], files[SCENS.indexOf('error')], `${OUT}diff_tab_${tab}_error.png`);
  results['gmtab_' + tab] = { loadingVsGood: dd, errorVsGood: de };
  ok(`GM-Tab „${label}": pixelidentisch in loading/error (0 %)`, dd.pct === 0 && de.pct === 0, `loading ${dd.pct}% · error ${de.pct}%`);
  /* Aufnahmen bei 390 px als zweite Referenzbreite */
  await setWidth(390);
  await gmSet('f', 'good', true); await gm.evaluate(t => go(t), tab); await gm.waitForTimeout(120);
  await shot(gm, '#screen', `${OUT}gm_tab_${tab}_good_390.png`, false);
  await setWidth(430);
}
/* Profilunterseite: die Referenz öffnet Unterseiten über openPage(). */
head('D · Profilunterseite (Golden Master)');
const SUB = 'settings';
{
  const sigs = [], files = [];
  for (const s of SCENS) {
    await gmSet('f', s, true);
    await gm.evaluate(p => { go('prof'); openPage(p); }, SUB);
    await gm.waitForTimeout(160);
    sigs.push(await gm.evaluate(() => document.getElementById('screen').innerHTML.length));
    const f = `${OUT}gm_sub_${SUB}_${s}_430.png`;
    await shot(gm, '#screen', f, false); files.push(f);
  }
  ok(`GM-Profilunterseite „${SUB}": invariant über alle 6 Szenarien`, sigs.every(x => x === sigs[0]), sigs.join(','));
  const d = diffPNG(files[0], files[SCENS.indexOf('error')], `${OUT}diff_sub_${SUB}_error.png`);
  results['gmsub_' + SUB] = d;
  ok(`GM-Profilunterseite „${SUB}": pixelidentisch im Fehlerszenario (0 %)`, d.pct === 0, d.pct + '%');
  await setWidth(390);
  await gmSet('f', 'good', true); await gm.evaluate(p => { go('prof'); openPage(p); }, SUB);
  await gm.waitForTimeout(160);
  await shot(gm, '#screen', `${OUT}gm_sub_${SUB}_good_390.png`, false);
  await setWidth(430);
  await gm.evaluate(() => go('dash'));
}

/* ============================================================================
   E · Retry, Fokus, Escape, Reduced Motion, Übergänge
   ========================================================================== */
head('E · Retry, Fokus, Übergänge, Reduced Motion');
/* GM6.1 §2: der Retry-Knopf gehoert AUSSCHLIESSLICH in den Hard-Error ohne
   verwendbare Daten. „Offline mit vorhandenem Cache" behaelt Hero und Module und
   bekommt nur den zusaetzlichen Hinweis; ein Retry waere dort irrefuehrend.
   Die Pruefung ist deshalb VERSCHOBEN, nicht entfallen: sie laeuft jetzt auf
   error_nodata, und offline_cache wird zusaetzlich ausdruecklich auf „kein
   Retry-Knopf, aber Hinweisleiste" geprueft. */
await prod.evaluate(() => setState('error_nodata', 'fortgeschritten'));
await prod.waitForTimeout(80);
ok('Retry-Zustand (Hard-Error ohne Daten): genau ein Retry-Button, mit GM-Klassen',
   await prod.evaluate(() => {
     const b = document.querySelectorAll('#prodScreen button.cta.wide-ghost');
     return b.length === 1 && b[0].id === 'gmRetryBtn';
   }));
ok('GM6.1 §2: Offline mit Cache traegt KEINEN Retry-Knopf (getrennte Zustaende)',
   await prod.evaluate(() => {
     setState('offline_cache', 'fortgeschritten');
     const n = document.querySelectorAll('#prodScreen button.cta.wide-ghost').length;
     const hasBar = !!document.querySelector('#prodScreen .errbar');
     setState('error_nodata', 'fortgeschritten');
     return n === 0 && hasBar;
   }));
await prod.evaluate(() => { window.__gm6.resetCalls(); document.getElementById('gmRetryBtn').focus(); });
await shot(prod, '#prodScreen', `${OUT}prod_retry_focus_430.png`, true);
ok('Retry-Zustand: Button ist fokussierbar (sichtbarer Fokus)',
   await prod.evaluate(() => document.activeElement && document.activeElement.id === 'gmRetryBtn'));
await prod.click('#gmRetryBtn');
await prod.waitForTimeout(120);
const calls = await prod.evaluate(() => JSON.parse(JSON.stringify(window.__gm6.calls)));
ok('Retry löst exakt EINEN bestehenden Aufruf aus (renderDay), sonst nichts',
   calls.renderDay === 1 && calls.engine === 0 && calls.persist === 0 && calls.showGate === 0 &&
   calls.syncStart === 0 && calls.flushSync === 0 && calls.schedulePush === 0, JSON.stringify(calls));
ok('Fokus kehrt nach erfolgreicher Aktion in den Zustand zurück',
   await prod.evaluate(() => {
     const a = document.activeElement;
     return !!a && (a.id === 'gmRetryBtn' || a.closest && !!a.closest('#prodScreen'));
   }));

/* Übergänge */
const seqSig = async () => (await seqOf(prod)).map(x => x.cls.split(' ')[0]).join('|');
async function trans(name, from, to, check) {
  await prod.evaluate(([s, m]) => setState(s, m), from);
  await prod.waitForTimeout(70);
  const a = { sig: await seqSig(), sk: await prod.evaluate(() => document.querySelectorAll('#prodScreen .sk').length) };
  if (Array.isArray(to)) await prod.evaluate(([s, m]) => setState(s, m), to);
  else await prod.evaluate(t => setSignals(t.sync, t.online), to);
  await prod.waitForTimeout(70);
  const bB = { sig: await seqSig(), sk: await prod.evaluate(() => document.querySelectorAll('#prodScreen .sk').length) };
  ok('Übergang ' + name, check(a, bB), JSON.stringify([a, bB]));
}
await trans('Loading → Daten', ['loading', 'fortgeschritten'], ['good', 'fortgeschritten'],
  (a, z) => a.sk > 0 && z.sk === 0 && /hero/.test(z.sig));
await trans('Loading → Empty', ['loading', 'fortgeschritten'], ['empty', 'fortgeschritten'],
  (a, z) => a.sk > 0 && z.sk === 0 && /gapnote/.test(z.sig));
await trans('Daten → offline mit Cache', ['good', 'fortgeschritten'], ['offline_cache', 'fortgeschritten'],
  (a, z) => !/errbar/.test(a.sig) && /errbar/.test(z.sig) && /hero/.test(z.sig));
/* Rückkehr in den Normalzustand ausschliesslich über die produktiven Signale
   (orviaSyncState + navigator.onLine) — kein Fixture-Zustandswechsel. */
await trans('offline → wieder online', ['offline_cache', 'fortgeschritten'], { sync: 'synced', online: true },
  (a, z) => /errbar/.test(a.sig) && !/errbar/.test(z.sig));
await trans('Error → erfolgreicher Retry', ['error', 'fortgeschritten'], { sync: 'synced', online: true },
  (a, z) => /errbar/.test(a.sig) && !/errbar/.test(z.sig));

/* Offline-Cache bleibt sichtbar */
await prod.evaluate(() => setState('offline_cache', 'fortgeschritten'));
await prod.waitForTimeout(80);
ok('Offline mit Cache: vorhandene Daten bleiben sichtbar (Hero mit Wert)',
   await prod.evaluate(() => {
     const h = document.querySelector('#prodScreen .hero'); if (!h) return false;
     return /\d/.test(h.textContent) && !!document.querySelector('#prodScreen .errbar');
   }));
await prod.evaluate(() => setState('offline_nodata', 'fortgeschritten'));
await prod.waitForTimeout(80);
ok('Offline ohne Daten: kein erfundener Wert (kein numerischer Score)',
   await prod.evaluate(() => {
     const big = document.querySelector('#prodScreen .hero .big');
     return !big || !/^\s*\d+\s*$/.test(big.textContent);
   }), await prod.evaluate(() => { const e = document.querySelector('#prodScreen .hero .big'); return e ? e.textContent : '(kein .big)'; }));

/* Re-Render-Stabilität: sechs Durchläufe ohne DOM-/Listener-Duplikate */
await prod.evaluate(() => setState('good', 'fortgeschritten'));
const rr = await prod.evaluate(() => {
  const sig = () => document.getElementById('prodScreen').innerHTML.length;
  const l0 = window.__gm6.listeners, s0 = sig();
  for (let i = 0; i < 6; i++) window.__gm6.paint();
  return { l: window.__gm6.listeners - l0, same: sig() === s0, n: document.querySelectorAll('#prodScreen .hero').length };
});
ok('sechs Re-Renders ohne DOM- oder Listener-Duplikate',
   rr.l === 0 && rr.same && rr.n === 1, JSON.stringify(rr));

/* Escape-Verhalten vorhandener Sheets */
await prod.click('#command .ring-wrap');
ok('Sheet öffnet (GM-Sheet + Scrim)',
   await prod.evaluate(() => document.getElementById('detailSheet').classList.contains('on')));
await prod.keyboard.press('Escape');
ok('Escape schließt Sheet und gibt Fokus zurück',
   await prod.evaluate(() => !document.getElementById('detailSheet').classList.contains('on') &&
     document.activeElement && document.activeElement.classList.contains('ring-wrap')));

/* Reduced Motion */
await prod.evaluate(() => setState('loading', 'fortgeschritten'));
const animNormal = await prod.evaluate(() => getComputedStyle(document.querySelector('#prodScreen .sk')).animationName);
await prod.emulateMedia({ reducedMotion: 'reduce' });
const animReduce = await prod.evaluate(() => getComputedStyle(document.querySelector('#prodScreen .sk')).animationName);
await prod.emulateMedia({ reducedMotion: null });
ok('ohne Präferenz behält .sk den Golden-Master-Shimmer', animNormal !== 'none' && !!animNormal, String(animNormal));
ok('bei prefers-reduced-motion:reduce ist der .sk-Shimmer abgeschaltet (§5)', animReduce === 'none', String(animReduce));

ok('keine Konsolen-/Seitenfehler im produktiven Harness', perrs.length === 0, perrs.slice(0, 3).join(' | '));
ok('keine Konsolen-/Seitenfehler im Komponenten-Probe', pberrs.length === 0, pberrs.slice(0, 3).join(' | '));

/* --- Abschluss ------------------------------------------------------------- */
fs.writeFileSync(OUT + 'results.json', JSON.stringify(results, null, 1));
await b.close();
head('Pixel-Diff je Ansicht');
for (const [k, v] of Object.entries(results)) {
  if (v.pct !== undefined) console.log(String(k).padEnd(34) + String(v.pct).padStart(6) + ' %   ' + String(v.px).padStart(8) + ' px' +
    (v.gated ? '   [' + v.gated + ', Versatz ' + v.shift + 'px · GM-errorView informativ ' + v.gmInfo + ' %]' : ''));
}
console.log('\n' + (fail ? fail + ' FAILED' : 'gm6_parity: ALL PASSED') + ' (' + pass + ' ok)');
process.exit(fail ? 1 : 0);

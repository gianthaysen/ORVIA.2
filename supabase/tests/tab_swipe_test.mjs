/* ============================================================
   ORVIA · tab_swipe — Tabwechsel per Wischen + Tastatur-Heuristik der Leiste (v8-424)
   node supabase/tests/tab_swipe_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _exApp } from 'node:fs';
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i != null ? '  — ' + i : '')); c ? pass++ : fail++; };
globalThis.window = globalThis;
await import(new URL(_APPREL + 'js/tab-swipe.js', import.meta.url));
const T = globalThis.ORVIA.tabSwipe;
const W = 390, g = o => Object.assign({ dx: 0, dy: 0, dt: 220, startX: 200, width: W }, o);

ok('A1 deutlicher Wisch nach links ⇒ next, nach rechts ⇒ prev', T.decide(g({ dx: -140 })) === 'next' && T.decide(g({ dx: 150 })) === 'prev');
ok('A2 zu kurz (< 30 % der Breite bzw. < 96 px) ⇒ nichts', T.decide(g({ dx: -100 })) === null && T.decide(g({ dx: -116 })) === null && T.decide(g({ dx: -118 })) === 'next');
ok('A3 schraeg (|dx| < 2,5 × |dy|) ⇒ nichts — Scrollen loest nie aus', T.decide(g({ dx: -160, dy: 70 })) === null && T.decide(g({ dx: -160, dy: 60 })) === 'next' && T.decide(g({ dx: -40, dy: 300 })) === null);
ok('A4 zu langsam (> 700 ms oder < 0,35 px/ms) ⇒ nichts', T.decide(g({ dx: -200, dt: 800 })) === null && T.decide(g({ dx: -130, dt: 600 })) === null && T.decide(g({ dx: -250, dt: 600 })) === 'next');
ok('A5 Start am Bildschirmrand (System-Gesten) ⇒ nichts', T.decide(g({ dx: 160, startX: 8 })) === null && T.decide(g({ dx: -160, startX: W - 5 })) === null && T.decide(g({ dx: 160, startX: 24 })) === 'prev');
ok('A6 schmale Breite: Mindestweg 96 px gilt weiter', T.decide(g({ dx: -90, width: 280 })) === null && T.decide(g({ dx: -100, width: 280 })) === 'next');
ok('A7 leere/kaputte Eingabe ⇒ null, kein Throw', T.decide(null) === null && T.decide({}) === null && T.decide(g({ dx: -200, dt: 0 })) === null);
ok('B1 Reihenfolge Dashboard · Plan · Aktivitaet · Analyse · Profil', T.ORDER.join(',') === 'heute,plan,akt,dash,mehr');
ok('B2 Ziel: vor/zurueck, kein Umlauf an den Enden', T.target('heute', 'next') === 'plan' && T.target('plan', 'prev') === 'heute' && T.target('dash', 'next') === 'mehr' && T.target('mehr', 'prev') === 'dash' && T.target('heute', 'prev') === null && T.target('mehr', 'next') === null && T.target('x', 'next') === null);
{
  const doc = { body: { classList: { contains: c => c === 'profile-open' } }, querySelector: () => null };
  ok('B3 offenes Profil gilt als aktuelles Ziel „mehr"', T._currentTab(doc) === 'mehr');
  const doc2 = { body: { classList: { contains: () => false } }, querySelector: s => /sheet\.on/.test(s) ? {} : null };
  ok('B4 offenes Sheet/Unterseite/Story/Modal sperrt den Wisch', T._overlayOpen(doc2) === true && T._overlayOpen({ body: { classList: { contains: c => c === 'story-open' } }, querySelector: () => null }) === true && T._overlayOpen({ body: { classList: { contains: () => false } }, querySelector: () => null }) === false);
  const el = { closest: s => /canvas/.test(s) ? {} : null };
  ok('B5 Start in Eingabe/Diagramm/Karte/Leiste gesperrt', T._blockedStart(el, { body: {} }) === true);
  globalThis.getComputedStyle = () => ({ overflowX: 'auto' });
  const body = {}; const scroller = { nodeType: 1, scrollWidth: 800, clientWidth: 300, parentNode: body }; const chip = { nodeType: 1, scrollWidth: 60, clientWidth: 60, parentNode: scroller, closest: () => null };
  ok('B6 Start in waagerecht scrollbarem Bereich (Filterzeile) gesperrt', T._blockedStart(chip, { body }) === true);
}
{
  const ui = rd('js/ui.js'), sw = rd('sw.js'), idx = rd('index.html'), src = rd('js/tab-swipe.js'), css = rd('styles.css');
  ok('C1 Wisch nutzt denselben Wechselpfad wie die Leiste (window._orviaGoTab=goTab), Listener passiv', /window\._orviaGoTab=goTab;/.test(ui) && /root\._orviaGoTab\(to\)/.test(src) && (src.match(/passive: true/g) || []).length >= 4 && !/preventDefault/.test(src));
  ok('C2 geladen + im Precache', /js\/tab-swipe\.js/.test(idx) && /'\.\/js\/tab-swipe\.js'/.test(sw));
  ok('C3 Einschub-Animation respektiert reduzierte Bewegung', /html\[data-swipe-dir="next"\]/.test(css) && /prefers-reduced-motion:reduce\)\{html\[data-swipe-dir\]/.test(css));
  ok('D1 Leiste: Tastatur nur bei fokussiertem Eingabefeld und ohne Zoom', /function gmKbEval\(\)/.test(ui) && /var kb=editing&&!zoomed&&\(window\.innerHeight-vv\.height>120\);/.test(ui));
  ok('D2 Neubewertung bei resize, scroll, Fokuswechsel, Rueckkehr und Tabwechsel (kein Haengenbleiben)', /visualViewport\.addEventListener\('scroll',gmKbEval\)/.test(ui) && /addEventListener\('focusout'/.test(ui) && /addEventListener\('pageshow',gmKbEval\)/.test(ui) && /addEventListener\('orvia:tab-changed',gmKbEval\)/.test(ui));
  ok('D3 Planseite zeichnet nach einer Zuordnung neu', /d\.autoLinked\|\|d\.planLinkCorrected/.test(ui));
}
{
  /* v8-425: die Seite geht mit dem Finger mit */
  ok('E1 Achse: erst ab 10 px, klar waagerecht ⇒ h; senkrecht ⇒ v (dann nie mitziehen)', T.axis(6, 2) === null && T.axis(14, 4) === 'h' && T.axis(14, 12) === 'v' && T.axis(3, 20) === 'v' && T.axis(-30, 10) === 'h');
  const f1 = T.follow(-100, 390, true), f2 = T.follow(-100, 390, false), f3 = T.follow(-800, 390, true);
  ok('E2 Mitziehen gedaempft (42 %), am Rand nur Widerstand (14 %), Deckkraft nie unter 55 %', f1.x === -42 && f2.x === -14 && f1.opacity < 1 && f1.opacity > 0.8 && f3.opacity === 0.55);
  const src = rd('js/tab-swipe.js'), css = rd('styles.css');
  ok('E3 Loslassen: erkannt ⇒ hinausgleiten + Wechsel, sonst zurueckfedern; Styles werden immer aufgeraeumt', /root\.setTimeout\(go, 150\)/.test(src) && /var back = function \(\)/.test(src) && /function clearPane\(el\)/.test(src) && /touchcancel', function \(\) \{ if \(st\) clearPane\(st\.el\)/.test(src));
  ok('E4 nur transform/opacity (Compositor), Listener weiterhin passiv, kein preventDefault', /translate3d\(/.test(src) && !/preventDefault/.test(src) && !/\.style\.left/.test(src));
  ok('E5 „Bewegung reduzieren" ⇒ Wechsel ohne Mitziehen/Animation', /st\.lock !== 'h' \|\| st\.calm/.test(src) && /if \(s\.calm \|\| !s\.el\) \{ go\(\); return; \}/.test(src));
  ok('E6 Einschub der neuen Seite: 64 px, .34 s, weiche Kurve', /tabInNext\{from\{opacity:0;transform:translate3d\(64px,0,0\)\}/.test(css) && /animation:tabInNext \.34s cubic-bezier\(\.16,\.84,\.24,1\) both/.test(css));
}
console.log('\n' + (fail ? '❌' : '✅') + ' tab_swipe: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

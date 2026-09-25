/* ============================================================
   ORVIA · tour_v14 — Rundgang an der App (js/tour.js, S4c)
   ------------------------------------------------------------
     A. Schritte: echte Selektoren, Texte aus dem Katalog, nie automatisch
     B. Ablauf: fehlende Elemente werden uebersprungen, Ende raeumt auf
     C. Verdrahtung: index.html, sw.js, Einstieg im Profil (Hilfe & über ORVIA)
   node supabase/tests/tour_v14_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _ex } from 'node:fs';
import { tStub } from './_i18n-src.mjs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const src = rd('js/tour.js'); const de = rd('locales/de.js'); const ui = rd('js/ui.js');
const g = globalThis; g.window = g; g.ORVIA = { i18n: tStub() };
/* Mini-DOM */
const els = {}; const present = new Set(['#command .hero', '#navPlus', '#gmProf']);
const mk = () => ({ style: {}, innerHTML: '', setAttribute() {}, remove() { this.removed = true; }, getBoundingClientRect: () => ({ top: 100, left: 10, width: 300, height: 120, bottom: 220 }), scrollIntoView() {} });
g.document = {
  body: { appendChild: e => { els[e.id] = e; } },
  createElement: () => mk(),
  getElementById: id => els[id] && !els[id].removed ? els[id] : null,
  querySelector: sel => present.has(sel) ? mk() : null
};
g.innerHeight = 800;
const tabs = []; g.showTab = n => tabs.push(n);
const toasts = []; g.toast = m => toasts.push(m);
g.setTimeout = fn => { fn(); return 1; }; g.clearTimeout = () => {};
(0, eval)(src);
const TR = g.ORVIA.tour;

sec('A · Schritte');
{
  ok('A1 Modul + VERSION', TR && TR.VERSION === 'tour@1' && typeof TR.start === 'function');
  ok('A2 11 Schritte, Intro + Fertig ohne Selektor, Rest mit echtem Selektor', TR.steps.length === 11 && !TR.steps[0].sel && !TR.steps[10].sel && TR.steps.slice(1, 10).every(s => /^#/.test(s.sel)));
  ok('A3 Selektoren zeigen auf existierende App-Elemente', ['#command', '#gmAdp', '#modules', '#navPlus', '.pvar-row', '.session-card', '.hub-actions', '.activity-card', '#gmProf'].every(x => TR.steps.some(s => (s.sel || '').indexOf(x) >= 0)) && /id="navPlus"/.test(rd('index.html')) && /id="gmAdp"/.test(ui) && /class="pvar-row"/.test(ui) && /class="hub-actions"/.test(ui));
  ok('A4 jeder Schritt hat Titel + Text im Katalog', TR.steps.every(s => de.indexOf("'tour." + s.id + "_t'") >= 0 && de.indexOf("'tour." + s.id + "_d'") >= 0 && de.indexOf("'" + s.k + "'") >= 0));
  ok('A5 kein Autostart: start() nur ueber ORVIA.tour.start (Profil-Zeile)', !/DOMContentLoaded|addEventListener\('load'/.test(src) && /gmStartTour\(\)/.test(ui) && !/gmStartTour\(\)/.test(ui.slice(ui.indexOf('function renderDay('), ui.indexOf('function renderDay(') + 5000)));
  ok('A6 Texte versprechen nichts Fremdes (kein Tauschen, keine Community, keine Beispieldaten)', !/Tauschen|Community|Beispieldaten|Beitrag/.test(de.slice(de.indexOf("'tour.k_rundgang'"), de.indexOf("'ui.rundgang_starten'"))));
}

sec('B · Ablauf');
{
  ok('B1 inaktiv vor Start', TR.active() === false);
  const r = TR.start();
  ok('B2 start() legt Hole + Tip an, Intro-Schritt (zentriert, ohne Aussparung), Tab heute', r === true && TR.active() && els.spotHole && els.spotTip && els.spotHole.style.display === 'none' && /Das ist ORVIA/.test(els.spotTip.innerHTML) && tabs[0] === 'heute');
  ok('B3 doppelter Start ignoriert', TR.start() === false);
  TR.next();
  ok('B4 Schritt 2 (Hero) mit Aussparung + Fortschritt 2 von 11 + Zurueck/Weiter', els.spotHole.style.display === 'block' && els.spotHole.style.width === '314px' && /2 von 11/.test(els.spotTip.innerHTML) && /ORVIA\.tour\.prev\(\)/.test(els.spotTip.innerHTML) && /Weiter/.test(els.spotTip.innerHTML));
  TR.next();
  ok('B5 fehlende Elemente (Tagesentscheidung, Module) uebersprungen ⇒ Plus-Knopf', /Das goldene Plus/.test(els.spotTip.innerHTML) && /5 von 11/.test(els.spotTip.innerHTML));
  TR.prev();
  ok('B6 zurueck ueberspringt ebenfalls ⇒ Hero', /Ein Score/.test(els.spotTip.innerHTML));
  TR.next(); TR.next();
  ok('B7 Plan/Aktivitaet ohne Elemente uebersprungen ⇒ Profil (Tab mehr)', /Dein Profil/.test(els.spotTip.innerHTML) && tabs.indexOf('mehr') >= 0);
  TR.next();
  ok('B8 letzter Schritt: „Fertig"-Knopf, Balken 100 %', /Das war ORVIA/.test(els.spotTip.innerHTML) && /width:100%/.test(els.spotTip.innerHTML) && />Fertig</.test(els.spotTip.innerHTML));
  TR.next();
  ok('B9 Ende: Elemente entfernt, Tab heute, Toast, inaktiv', els.spotHole.removed && els.spotTip.removed && tabs[tabs.length - 1] === 'heute' && toasts.length === 1 && !TR.active());
  TR.end();
  ok('B10 end() ohne laufende Tour: kein zweiter Toast', toasts.length === 1);
}

sec('C · Verdrahtung');
{
  const idx = rd('index.html'), sw = rd('sw.js'), css = rd('styles.css');
  ok('C1 index.html laedt js/tour.js nach coachmarks.js', idx.indexOf('js/tour.js') > idx.indexOf('js/coachmarks.js') && idx.indexOf('js/tour.js') > 0);
  ok('C2 sw.js precached ./js/tour.js', /'\.\/js\/tour\.js'/.test(sw));
  ok('C3 CSS: .spot-hole/.spot-tip ueber allen Sheets (9600/9601), unter dem Toast (10000)', /\.spot-hole\{position:fixed;z-index:9600/.test(css) && /\.spot-tip\{position:fixed;z-index:9601/.test(css));
  const about = ui.slice(ui.indexOf('function gmProfAbout(){'), ui.indexOf('function gmStartTour(){'));
  ok('C4 Profil → Hilfe & über ORVIA: Rundgang-Zeile (mit Modul), sonst inaktive Zeile', /ui\.rundgang_starten/.test(about) && /ORVIA\.tour&&ORVIA\.tour\.start/.test(about) && /ui\.dokumentation_folgt/.test(about));
  ok('C5 gmStartTour schliesst Profil + Unterseite vor dem Start', /closeProfile\(\)/.test(ui.slice(ui.indexOf('function gmStartTour(){'), ui.indexOf('function gmStartTour(){') + 400)) && /gmCloseProfPage\(\)/.test(ui.slice(ui.indexOf('function gmStartTour(){'), ui.indexOf('function gmStartTour(){') + 400)));
}

console.log('\n' + (fail ? '❌' : '✅') + ' tour_v14: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

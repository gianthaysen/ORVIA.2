/* ============================================================
   ORVIA · F02 (Metaanalyse 05.10.2026) — der ORVIA-Score heißt nicht „Readiness".

   Live: ORVIA-Score 80 (Erholung 81 × 60 % + Belastungskontrolle 100 × 25 % +
   Umsetzung 40 × 15 %), daneben Erholung/Readiness 81. Die Analyse zeigte
   „Readiness 80" — der Gesamtscore unter dem Namen der Erholung. Dieselbe
   Verwechslung stand im Start-Sheet („Vor-Start-Werte").

   N1  Analyse-KPI: der Gesamtscore steht unter „ORVIA-Score".
   N2  Profi-Hero der Analyse nennt „ORVIA-Score 80", nicht „Readiness 80".
   N3  Start-Sheet: gleicher Name; der Statustext kommt aus status.l (das Feld
       `statusText` gibt es an orviaScore() nicht).
   N4  Vertrag: orviaScore() trägt score, recovery und status.l getrennt.
   node supabase/tests/score_naming_f02_test.mjs
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
const _APPREL = existsSync(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const app = new URL(_APPREL, import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const ui = readFileSync(new URL('js/ui.js', app), 'utf8');
const sliceFn = name => { const i = ui.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0, st = false; for (let j = i; j < ui.length; j++) { const ch = ui[j]; if (ch === '{') { d++; st = true; } else if (ch === '}') { d--; if (st && d === 0) return ui.slice(i, j + 1); } } return ''; };

function sandbox(level) {
  const sb = { console, Math, JSON, Object, Array, String, Number, isNaN, isFinite, Date };
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  sb.localStorage = { getItem: () => null, setItem() {} }; sb.navigator = { language: 'de-DE' };
  sb.addEventListener = () => {}; sb.dispatchEvent = () => true; sb.CustomEvent = function () {};
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('locales/de.js', app), 'utf8'), sb);
  vm.runInContext(readFileSync(new URL('js/i18n.js', app), 'utf8'), sb);
  sb._uiT = (k, p) => sb.ORVIA.i18n.t(k, p);
  sb.icon = () => ''; sb.gmEsc = s => String(s == null ? '' : s); sb.GM_NA = 'Nicht verfügbar';
  sb.gmLevel = () => level;
  sb.gmDashVM = () => ({ reco: { t: 'Reduzieren empfohlen' }, pro: 'Intervalle reduzieren', simpleReco: { t: 'Heute lockerer' }, warnings: [] });
  sb.gmAnaChartEmpty = t => '<div>' + t + '</div>';
  sb.gmFeatureFlag = () => false;
  /* Die Form, die orviaScore() wirklich liefert (siehe N4). */
  sb.orviaScore = () => ({ score: 80, recovery: 81, status: { l: 'Reduzieren empfohlen', c: 'y' }, dayState: 'YELLOW' });
  vm.runInContext([sliceFn('fmtDe'), sliceFn('gmAnaOverview')].join('\n'), sb, { filename: 'ui.js#gmAnaOverview' });
  return sb;
}
const kpis = h => [...h.matchAll(/<div class="kpi"><b>([^<]*)<\/b><span>([^<]*)<\/span><small>([^<]*)<\/small><\/div>/g)].map(m => ({ v: m[1], l: m[2], s: m[3] }));

/* ---------- N1 · KPI ---------- */
{
  const H = sandbox('f').gmAnaOverview({ ok: false });
  const k = kpis(H), cell = k.find(x => x.v === '80');
  ok('N1a der Gesamtscore 80 steht in einer KPI-Zelle', !!cell, k.map(x => x.v + ':' + x.l).join(' | '));
  ok('N1b sie heißt „ORVIA-Score"', cell && cell.l === 'ORVIA-Score', cell && cell.l);
  ok('N1c keine KPI-Zelle zeigt den Gesamtscore als „Readiness"', !k.some(x => /Readiness/.test(x.l)));
  ok('N1d Statuszeile der Zelle = Status der Tagesentscheidung', cell && cell.s === 'Reduzieren empfohlen', cell && cell.s);
}

/* ---------- N2 · Profi-Hero ---------- */
{
  const H = sandbox('p').gmAnaOverview({ ok: false });
  const hero = (/<div class="decision-hero">[\s\S]*?<\/p>/.exec(H) || [''])[0];
  ok('N2a Profi-Hero nennt „ORVIA-Score 80"', /ORVIA-Score 80/.test(hero), hero.replace(/<[^>]+>/g, ' ').slice(0, 140));
  ok('N2b nirgends „Readiness 80"', !/Readiness\s*80/.test(H.replace(/<[^>]+>/g, ' ')));
}

/* ---------- N3 · Start-Sheet ---------- */
{
  const i = ui.indexOf('var _bb=null,_st5=null,_os5=null'), block = ui.slice(i, i + 2600);
  ok('N3a Start-Sheet gefunden', i > 0);
  ok('N3b der Score heißt dort „ORVIA-Score"', /_uiT\('ui\.orvia_score'\)[^\n]*_os5\.score/.test(block) && !/\['Readiness',\(_os5/.test(block));
  ok('N3c Statustext aus status.l, nicht aus dem nicht existierenden statusText', /_os5\.status&&_os5\.status\.l/.test(block) && !/_os5\.statusText/.test(block));
}

/* ---------- N4 · Vertrag orviaScore ---------- */
{
  const src = sliceFn('orviaScore');
  ok('N4 orviaScore liefert score, recovery und status.l getrennt', /score:d\.score/.test(src) && /recovery:d\.subscores\.recovery\.value/.test(src) && /status:\{l:d\.statusText/.test(src) && !/statusText:/.test(src));
  const de = readFileSync(new URL('locales/de.js', app), 'utf8');
  ok('N4b Katalog: ui.orvia_score = „ORVIA-Score"', /'ui\.orvia_score': 'ORVIA-Score'/.test(de));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

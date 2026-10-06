/* ============================================================
   ORVIA · start_hydration_v428 — ruhiger Start + schneller Dashboard-Aufbau (v8-428)
   Gians Befund 2.10.: „das dashboard laedt deutlich laenger und zeigt erstmal den score
   1 sek ohne berechnung, dann nochmal anders und dann erst final".
   Zwei Ursachen, beide hier abgesichert:
   (1) Die Anmeldekette zeichnete nach JEDEM Schritt neu (Zwischenstaende).
   (2) Der Beobachter-Snapshot kopierte/hashte bei jedem Dashboard-Render alle
       Messreihen aller Aktivitaeten (gemessen: 5,9 s → 0,56 s bei 3,9 MB Speicher).
   node supabase/tests/start_hydration_v428_test.mjs
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
const _APPREL = existsSync(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i != null ? '  — ' + i : '')); c ? pass++ : fail++; };
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const ui = rd('js/ui.js'), auth = rd('js/auth.js'), refresh = rd('js/ui-refresh.js'), sync = rd('js/sync.js'), pal = rd('js/plan-auto-link.js'), css = rd('styles.css');
const wait = ms => new Promise(r => setTimeout(r, ms));

function sandbox() {
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  Object.assign(sb, { Date, Math, JSON, Array, Object, String, Number, parseInt, parseFloat, isNaN, isFinite, Set, Promise, setTimeout, clearTimeout });
  sb.navigator = { onLine: true };
  const wl = {};
  sb.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
  sb.addEventListener = (t, f) => { (wl[t] = wl[t] || []).push(f); };
  sb.removeEventListener = () => {};
  sb.dispatchEvent = e => { (wl[e.type] || []).slice().forEach(f => f(e)); return true; };
  sb.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  sb.document = { querySelector: sel => (sel === '.tabbar button.on[data-tab]' ? { dataset: { tab: 'heute' } } : null), querySelectorAll: () => [], getElementById: () => null, activeElement: null };
  sb.ORVIA = {};
  vm.createContext(sb);
  return sb;
}

/* ---------- A) ui-refresh: kein Zwischenstand waehrend der Start-Hydration ---------- */
{
  const sb = sandbox(); let day = 0;
  sb.renderDay = () => { day++; }; sb.renderTopAvatar = () => {}; sb.renderProfileScreen = () => {};
  vm.runInContext(refresh, sb, { filename: 'ui-refresh.js' });
  sb.ORVIA.hydrating = true;
  for (let i = 0; i < 4; i++) { sb.dispatchEvent(new sb.CustomEvent('orvia:profile-updated', { detail: { changedSections: ['goals'] } })); await wait(60); }
  sb.ORVIA.uiRefresh.schedule([], {});
  await wait(250);
  ok('A1 vier Profil-Signale + ein direkter schedule() in der Hydration ⇒ KEIN Dashboard-Render', day === 0, 'renderDay=' + day);
  sb.ORVIA.hydrating = false;
  sb.dispatchEvent(new sb.CustomEvent('orvia:auth-ready'));
  await wait(250);
  ok('A2 Ende der Kette (auth-ready) ⇒ genau EIN Render mit dem fertigen Stand', day === 1, 'renderDay=' + day);
  sb.dispatchEvent(new sb.CustomEvent('orvia:profile-updated', { detail: { changedSections: ['personal'] } }));
  await wait(250);
  ok('A3 danach wieder normal: ein Signal ⇒ ein Render', day === 2, 'renderDay=' + day);
}
{
  /* Wachhund: die Kette haengt — die zurueckgestellten Anlaesse gehen nicht verloren */
  const sb = sandbox(); let day = 0;
  sb.renderDay = () => { day++; }; sb.renderTopAvatar = () => {}; sb.renderProfileScreen = () => {};
  vm.runInContext(refresh, sb, { filename: 'ui-refresh.js' });
  sb.ORVIA.hydrating = true;
  sb.dispatchEvent(new sb.CustomEvent('orvia:profile-updated', { detail: { changedSections: [] } }));
  await wait(200);
  sb.ORVIA.hydrating = false;
  sb.dispatchEvent(new sb.CustomEvent('orvia:hydration-end', { detail: { reason: 'watchdog' } }));
  await wait(250);
  ok('A4 Wachhund (hydration-end) zeichnet einmal nach, wenn etwas zurueckgestellt war', day === 1, 'renderDay=' + day);
  sb.dispatchEvent(new sb.CustomEvent('orvia:hydration-end'));
  await wait(250);
  ok('A5 hydration-end ohne zurueckgestellten Anlass ⇒ kein zusaetzlicher Render', day === 1, 'renderDay=' + day);
}

/* ---------- B) auth.js: Phase klar begrenzt, endet immer ---------- */
{
  const a = strip(auth);
  const iOn = a.indexOf('O.hydrating = true;'), iGate = a.indexOf('hideGate();', iOn), iOff = a.indexOf('O.hydrating = false;', iGate), iReady = a.indexOf("new CustomEvent('orvia:auth-ready')");
  ok('B1 Phase beginnt VOR dem Oeffnen der App (hideGate) — kein Render mit Zwischenstand davor', iOn > 0 && iGate > iOn);
  ok('B2 Phase endet VOR dem Ready-Signal — der eine Abschluss-Refresh darf zeichnen', iOff > iGate && iReady > iOff);
  ok('B3 Wachhund: spaetestens nach 20 s beendet, meldet orvia:hydration-end', /setTimeout\(function \(\) \{\s*if \(!O\.hydrating\) return;\s*O\.hydrating = false;[\s\S]{0,260}orvia:hydration-end[\s\S]{0,80}\}, 20000\);/.test(a) && /clearTimeout\(_hydWatch\)/.test(a));
  ok('B4 Start der Phase wird gemeldet (Dashboard setzt die Lade-Ansicht)', /new CustomEvent\('orvia:hydration-start'\)/.test(a));
}

/* ---------- C) Dashboard: „wird geladen" statt „Check-in ausstehend", kein Score-Springen ---------- */
{
  const u = strip(ui);
  ok('C1 gmDashState: ohne lokalen Score in der Hydration ⇒ loading (vor empty/normal)', /if\(!d\.hasScore&&typeof window!=='undefined'&&window\.ORVIA&&ORVIA\.hydrating\)return 'loading';\s*if\(noData\)return 'empty';/.test(u));
  /* Listener funktional: nur wenn KEINE Ziffer im Ring steht, wird die Lade-Ansicht gesetzt */
  const i = ui.indexOf("window.addEventListener('orvia:hydration-start',function(){"), j = ui.indexOf('function gmErrorHero(){');
  const run = bigText => {
    const set = { hero: null, mods: null }; let fn = null;
    const el = { querySelector: s => (s === '.ring-c .big' ? (bigText == null ? null : { textContent: bigText }) : null) };
    const host = { set innerHTML(v) { set.mods = v; } };
    const c = { window: { addEventListener: (t, f) => { fn = f; } }, document: { getElementById: id => (id === 'command' ? el : id === 'modules' ? host : null) },
      gmSetHTML: (e, h) => { set.hero = h; }, gmLoadingHero: () => 'HERO', gmLoadingMods: () => 'MODS' };
    vm.createContext(c); vm.runInContext(ui.slice(i, j), c); fn(); return set;
  };
  const a = run('—'), b = run('72'), n = run(null);
  ok('C2 kein Score sichtbar („—") ⇒ Lade-Ansicht in Hero und Modulen', a.hero === 'HERO' && a.mods === 'MODS');
  ok('C3 lokaler Score sichtbar („72") ⇒ bleibt stehen (kein Flackern auf Laden)', b.hero === null && b.mods === null);
  ok('C4 Ring noch gar nicht gezeichnet ⇒ Lade-Ansicht', n.hero === 'HERO');
  ok('C5 sync.js: Pull zeichnet das Dashboard in der Hydration nicht mit Zwischenstand', /var _hyd = !!\(window\.ORVIA && window\.ORVIA\.hydrating\);\s*try \{ if \(!_hyd && typeof renderDay === 'function'\) renderDay\(\); \}/.test(strip(sync)));
}

/* ---------- D) Beobachter-Snapshot ohne Rohdaten (der gemessene Zeitfresser) ---------- */
{
  const i = ui.indexOf('var GM_OBS_HEAVY='), j = ui.indexOf('function gmObserveWeekPlan(');
  const c = {}; vm.createContext(c); vm.runInContext(ui.slice(i, j) + '\nthis.S=gmObsSlim;this.L=gmObsActivities;', c);
  const big = []; for (let k = 0; k < 3000; k++) big.push(120 + (k % 40));
  const act = { id: 'a1', sport: 'cycling', date: '2026-10-02', durationSec: 3060, metrics: { distance_m: 19960, plannedSessionId: 'po:2026-10-02:x', durationCorrection: { sec: 3000 }, streams: { heart_rate: big, power: big }, stream_units: { power: 'W' }, route: big, splits: [{ n: 1 }] }, recording: { metrics: { streams: { speed: big } }, startedAt: 1 } };
  const before = JSON.stringify(act);
  const s = c.S(act);
  ok('D1 Messreihen, Einheiten, Route und Runden sind raus', !('streams' in s.metrics) && !('stream_units' in s.metrics) && !('route' in s.metrics) && !('splits' in s.metrics) && !('streams' in s.recording.metrics));
  ok('D2 alles Fachliche bleibt: Dauer, Distanz, Sportart, Datum, Zuordnung, Korrektur', s.id === 'a1' && s.sport === 'cycling' && s.date === '2026-10-02' && s.durationSec === 3060 && s.metrics.distance_m === 19960 && s.metrics.plannedSessionId === 'po:2026-10-02:x' && s.metrics.durationCorrection.sec === 3000 && s.recording.startedAt === 1);
  ok('D3 das Original wird nicht veraendert (Kopie, kein Loeschen an Ort und Stelle)', JSON.stringify(act) === before && s !== act && s.metrics !== act.metrics);
  const light = { id: 'g1', sport: 'strength', metrics: { plannedSessionId: null } };
  ok('D4 Einheit ohne Rohdaten geht unveraendert durch (keine Kopie noetig)', c.S(light) === light && c.S(null) === null && c.L(undefined) === undefined);
  const list = c.L([act, light]);
  const ratio = JSON.stringify(list).length / JSON.stringify([act, light]).length;
  ok('D5 Liste: Groesse des Snapshots faellt auf einen Bruchteil', list.length === 2 && ratio < 0.05, (ratio * 100).toFixed(1) + ' %');
  ok('D6 der Beobachter bekommt die schlanke Liste', /st\.listActivities\)\?gmObsActivities\(st\.listActivities\(\)\|\|\[\]\):undefined/.test(ui));
  const eng = ['js/engine/observer-input.js', 'js/engine/prediction-observer.js', 'js/engine/shadow-adaptive.js'].map(rd).map(strip).join('\n');
  ok('D7 Vertrag: kein Beobachter-Modul liest Messreihen, Route oder Runden', !/\.streams\b|\.stream_units\b|\.splits\b|metrics\.route\b/.test(eng));
}

/* ---------- E) Auto-Zuordnung startet NACH dem Start, nicht mittendrin ---------- */
{
  const p = strip(pal);
  ok('E1 erster Lauf nach orvia:auth-ready (Rueckfall 12 s), nicht mehr 2,5 s nach load', /root\.addEventListener\('orvia:auth-ready', _first\);/.test(p) && /setTimeout\(_first, 12000\)/.test(p) && !/setTimeout\(function \(\) \{ run\(\); \}, 2500\)/.test(p));
  ok('E2 waehrend der Hydration plant schedule() nichts ein', /function schedule\(\) \{ if \(O\.hydrating\) return;/.test(p));
  ok('E3 ein Lese-/Schreibvorgang: ensureLocalMany + linkManyToPlan', /store\.ensureLocalMany\(_srv\)/.test(p) && /store\.linkManyToPlan\(decisions, \{ method: 'auto' \}\)/.test(p));
}

/* ---------- F) Breite: Debrief-Karte wie jede andere Karte ---------- */
{
  ok('F1 Aktivitaetsseite: Debrief-Karte ohne zusaetzlichen Rand-Wrapper (war doppelt eingerueckt)', /h\+=gmDebriefCardHTML\(_dbM,\{planCta:true,freeText:rate\?rate\.txt:null\}\);/.test(ui) && !/<div style="margin:0 18px 14px">'\+gmDebriefCardHTML/.test(ui));
  ok('F2 Karten tragen ihren Seitenrand selbst (18 px) — die Debrief-Karte ist eine .card', /\.card\{[^}]*margin:0 18px 14px/.test(css) && /var h='<div class="card db-card">/.test(ui));
  ok('F3 im Sheet schliessen Karten buendig mit Tabs und Knoepfen ab', /\.sheet \.sh-block>\.card\{margin-left:0;margin-right:0\}/.test(css));
  ok('F4 „Story ansehen" ueber die volle Breite, Symbol neben dem Text (war schmal mit Symbol darueber)', /<button class="cta wide-ghost(?: gm-story-cta)?" style="width:100%;flex-direction:row;gap:8px" onclick="gmOpenStory\(/.test(ui));
}
console.log('\n' + (fail ? '❌' : '✅') + ' start_hydration_v428: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

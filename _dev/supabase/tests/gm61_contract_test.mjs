/* ORVIA · GM6.1 — Funktionsabschluss, Vertragstest.
   Referenz: orvia_dashboard_5_1.html (md5 1b93e15e23054318c8848d5cb10e6bcb).

   Deckt exakt die im GM6.1-Auftrag benannten Prüfpunkte ab:
     §1  Reduced Motion  — deaktiviert ausschliesslich Bewegung, Geometrie und
                           Farben bleiben identisch.
     §3  produktiver Loading-Zustand — Loading ist aus echtem Produktionscode
                           erreichbar (nicht nur ueber Fixture-Flags),
                           Loading→Daten / →Empty / →Error, verspaetete aeltere
                           Antwort ueberschreibt keinen neueren Zustand,
                           sechs Wiederholungen ohne Skelett-/Listener-Duplikate.
     §4  Stimmungsauswahl — Auswahl, Wechsel, Re-Render, Tastatur, Fokus,
                           fehlender Wert.
     §5  Supplement-Stack-Leerzustand — leer / teilweise / befuellt, Re-Render
                           ohne Duplikate, Bereich verschwindet nicht.
     §6  gelöschte Legacy-Bloecke — Nachweis, dass keine produktive Route mehr
                           darauf zeigt.

   Methodik: Teile B/D/E werten AUSSCHLIESSLICH unveraenderte Produktionsslices
   aus js/ui.js aus (Extraktion ueber Klammerbilanz, kein Kopieren von Code in
   den Test). Teil F fuehrt den bestehenden Harness /tmp/gm6h.html im Browser.
   Es existiert KEIN Produktiv-Fixture und KEIN neuer Testhaken in ORVIA.

   Aufruf:  node /tmp/gm6_build.mjs && node supabase/tests/gm61_contract_test.mjs */
import fs from 'fs';

let pass = 0, fail = 0;
const ok  = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 66 - t.length)));
const R   = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

const uiSrc = R('../../../app/js/ui.js');
const html  = R('../../../app/index.html');
const css   = R('../../../app/styles.css');
const uiL   = uiSrc.split('\n');

/* ---- Produktionsslice-Extraktion (liest, veraendert nichts) -------------- */
const fnSrc = name => {
  const i = uiL.findIndex(l => l.startsWith('function ' + name + '('));
  if (i < 0) throw new Error('GM6.1-Test: Funktion nicht gefunden — ' + name);
  let d = 0, started = false, out = [];
  for (let j = i; j < uiL.length; j++) {
    out.push(uiL[j]);
    for (const ch of uiL[j]) { if (ch === '{') { d++; started = true; } else if (ch === '}') d--; }
    if (started && d <= 0) return out.join('\n');
  }
  throw new Error('GM6.1-Test: unbalancierte Funktion — ' + name);
};
const lineSlice = (fromMarker, toMarker) => {
  const a = uiL.findIndex(l => l.startsWith(fromMarker));
  const b = uiL.findIndex((l, i) => i > a && l.startsWith(toMarker));
  if (a < 0 || b < 0) throw new Error('GM6.1-Test: Slice-Grenzen fehlen — ' + fromMarker + ' / ' + toMarker);
  return uiL.slice(a, b).join('\n');
};
const blockOf = (a, b) => { const i = uiSrc.indexOf(a), j = uiSrc.indexOf(b); if (i < 0 || j <= i) throw new Error('GM6.1-Test: Block fehlt — ' + a); return uiSrc.slice(i, j); };

const GM1 = blockOf('/* ====== GM1:', '/* ====== GM1-ENDE');
const GM4 = blockOf('/* ====== GM4:', '/* ====== GM4-ENDE');

const tick = async (n = 4) => { for (let i = 0; i < n; i++) await Promise.resolve(); };
const defer = () => { let r, j; const p = new Promise((a, b) => { r = a; j = b; }); return { p, resolve: r, reject: j }; };

/* ══════════════════════════════════════════════════════════════════════════
   TEIL A · §3 — Beleg, dass der initiale Boot vollstaendig synchron ist
   ══════════════════════════════════════════════════════════════════════════ */
sec('A · §3 Boot-Aufrufkette (Beleg fuer „kein kuenstlicher Boot-Spinner")');

/* Der Auftrag verlangt: „Wenn der initiale Boot vollstaendig synchron ist und
   tatsaechlich keine asynchrone Grenze besitzt, belege das mit der vollstaendigen
   Aufrufkette. Dann darf kein kuenstlicher Boot-Spinner entstehen." */
const bootStmt = uiL.filter(l => /^renderDay\(\);\s*$/.test(l));
ok('Boot-Einstieg: renderDay(); ist eine Top-Level-Anweisung in js/ui.js (Zeile ' +
   (uiL.findIndex(l => /^renderDay\(\);\s*$/.test(l)) + 1) + ')',
   bootStmt.length === 1, bootStmt.length + ' Treffer');

const iUi = html.indexOf('js/ui.js'), iAuth = html.indexOf('js/auth.js');
ok('index.html laedt js/ui.js VOR js/auth.js ⇒ renderDay() laeuft vor jedem Auth-Await',
   iUi > 0 && iAuth > iUi, 'ui@' + iUi + ' auth@' + iAuth);

const renderDayFn = fnSrc('renderDay');
ok('renderDay() selbst enthaelt kein await/then/setTimeout ⇒ synchrone Grenze',
   !/\bawait\b|\.then\s*\(|setTimeout\s*\(/.test(renderDayFn),
   renderDayFn.length + ' Zeichen');

ok('kein kuenstlicher Boot-Spinner: kein gmStateLoading()/.sk im Boot-Pfad renderDay()',
   !/gmStateLoading|class="sk/.test(renderDayFn));

/* Kein Ladezustand darf durch eine kuenstliche Wartezeit entstehen. */
const GM61_LOADERS = [fnSrc('gmAnaResolved'), fnSrc('gmAnaBodyModel'), fnSrc('gmAnaRetry')].join('\n');
ok('§3 Leitplanke: keine kuenstliche Wartezeit (kein setTimeout/setInterval in den Ladepfaden)',
   !/setTimeout\s*\(|setInterval\s*\(/.test(GM61_LOADERS));
ok('§3 Leitplanke: kein neuer Netzwerkaufruf (kein fetch/XHR/supabase in den Ladepfaden)',
   !/\bfetch\s*\(|XMLHttpRequest|supabase\./.test(GM61_LOADERS));
ok('§3 Leitplanke: keine Persistenz-/Engine-Aktion in den Ladepfaden',
   !/\bsaveDB\s*\(|\bsave\s*\(\)|runEngine\s*\(|orviaSchedulePush\s*\(/.test(GM61_LOADERS));

/* ══════════════════════════════════════════════════════════════════════════
   TEIL B · §3 — produktive Ladezustaende der Analyse (echter GM4-Block)
   ══════════════════════════════════════════════════════════════════════════ */
sec('B · §3 Loading aus echtem Produktionscode (GM4-Block, unveraendert)');

const mkEl = id => ({
  id, innerHTML: '', textContent: '', value: '', style: {}, dataset: {},
  classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } },
  setAttribute() {}, getAttribute() { return null; }, focus() { focused.push(id); }, scrollTop: 0, scrollIntoView() {}
});
const focused = [];
const els = {};
const el = id => els[id] || (els[id] = mkEl(id));
let listenerCount = 0;

globalThis.window = globalThis;
globalThis.document = {
  getElementById: id => el(id), createElement: () => mkEl('x'),
  addEventListener() { listenerCount++; }, querySelectorAll: () => [], querySelector: () => null,
  activeElement: null, body: { appendChild() {}, addEventListener() { listenerCount++; } }
};
globalThis.addEventListener = function () { listenerCount++; };

globalThis.escH = x => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
globalThis.gmEsc = globalThis.escH; globalThis.esc = globalThis.escH;
globalThis.jsArg = x => String(x == null ? '' : x).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
globalThis.icon = () => '<svg class="ic"></svg>';
globalThis.ic = () => '<svg class="ic"></svg>';
globalThis.fmtDe = n => { if (n == null || isNaN(n)) return '–'; const r = Math.round(n * 10) / 10; return r === Math.round(r) ? String(Math.round(r)) : String(r).replace('.', ','); };
globalThis.GM_NA = 'Noch nicht verfügbar';
globalThis.todayStr = () => '2026-07-27';
let MODE = 'fortgeschritten';
globalThis.uiDetailMode = () => MODE;
globalThis.gmLevel = () => MODE === 'anfaenger' ? 'a' : MODE === 'profi' ? 'p' : 'f';

/* Die drei GM6-Zustandskomponenten werden als echter Produktionsslice geladen. */
(0, eval)([fnSrc('gmStateLoading'), fnSrc('gmStateEmpty'), fnSrc('gmStateError')].join('\n'));

/* Kanonische Stubs (identisch zum bestehenden GM4-Paritaetstest) */
globalThis.gmDashVM = () => ({ hasScore: true, score: 82, statusColor: 'ready', reco: { t: 'Aufbauen — innerhalb des Plans', cls: 'ok', ic: 'check' }, pro: 'Erholung stabil.', warnings: [] });
globalThis.orviaScore = () => ({ score: 82, status: { l: 'Gut', c: 'g' }, subs: [] });
globalThis.allLoads = () => ({ loads: [5, 6, 7, 4, 6, 5, 7, 6, 5, 8, 6, 7, 5, 6, 7, 6], labels: [], confidence: {} });
const SERIES = { ctl: Array(16).fill(41), atl: Array(16).fill(34), tsb: Array(16).fill(7) };
globalThis.Calc = {
  loadSeries: () => SERIES, loadModel: () => ({ acwr: 1.12, acwrReliable: true }),
  loadConfidenceContract: () => ({ tier: 'hoch', suppressNumbers: false, ctlAtlNote: null, acwrTsbNote: null }),
  fmtPace: s => { const m = Math.floor(s / 60), x = Math.round(s % 60); return m + ':' + String(x).padStart(2, '0'); },
  hrvScoreOf: () => 60
};
globalThis.weekRunKm = () => 19.4;
globalThis.weekInsights = () => [];
globalThis.DB = {};
globalThis.gmActWeekTotals = () => ({ totals: { knownDurationMin: 100, completeness: { duration: true } }, bySport: {} });
globalThis.gmActFmtMin = m => (m == null ? '—' : m + ' min');
globalThis.gmOpenActTeaserSheet = () => {}; globalThis.gmOpenSheet = () => {}; globalThis.gmCloseSheets = () => {};
globalThis.openRecoveryMetricSheet = () => {};
globalThis._rcvVal = r => (r && r.value != null ? String(r.value) : '–');
globalThis.mvStatusModel = m => { const k = m && m.status && m.status.key; return k ? { key: k, label: k, sym: '✓' } : { key: 'no_data', label: 'Keine Daten', sym: '–' }; };
globalThis.mvLabelDe = id => id; globalThis.mvExperience = () => 'intermediate'; globalThis.mvNextStep = () => 'Kurs halten.';
globalThis.renderDash = function () {};
globalThis.weeklyActivityTotalsFix = null;

/* --- die beiden echten asynchronen Produktionsgrenzen, steuerbar ---------- */
let collectCalls = 0, mvCalls = 0;
let dCollect = defer(), dMv = defer();
globalThis._metricsResolved = null;          /* kein Tagescache ⇒ echter Ladevorgang */
globalThis._gmMvModel = null;
globalThis.ORVIA = {
  charts: { richChart: (e, c) => { if (e) e.innerHTML = '<svg class="rc"></svg>'; } },
  profileMetricResolver: { collect: () => { collectCalls++; return dCollect.p; } },
  gymVolume: {
    getProductiveVolumeModel: () => { mvCalls++; return dMv.p; },
    explainMuscleVolume: () => ({ contributions: [], exclusions: [] }),
    snapshotsFromStore: () => []
  }
};

/* GM7.5f-Kalibrierung: Helfer ausserhalb des GM4-Markerblocks (gleiches Muster wie gm4-Test):
   gmMetric, gmMetricToday, gmMetricSeries (Resolver-Tagescache, ui.js:3742ff.), sparkline und
   die anatomischen Polygone BODY_ANT/BODY_POST (ui.js:1385-1413, realer Quelltext-Slice). */
globalThis.gmMetric = id => { const c = globalThis._metricsResolved; const r = c && c.resolved && c.resolved[id]; return (r && (r.value != null || r.valueText != null)) ? r : null; };
globalThis.gmMetricToday = id => { const r = globalThis.gmMetric(id); return (r && r.metricDate === todayStr()) ? r : null; };
globalThis.gmMetricSeries = () => null;
globalThis.gmMetricTrendStats = () => null;
globalThis.sparkline = () => '<svg class="sp"></svg>';
try { const bA = uiSrc.indexOf('var BODY_ANT={'), bE = uiSrc.indexOf('// Muskel-Slug'); if (bA >= 0 && bE > bA) (0, eval)(uiSrc.slice(bA, bE)); } catch (e) {}
let gm4ok = true, gm4err = '';
try { (0, eval)(GM4); } catch (e) { gm4ok = false; gm4err = String(e); }
ok('GM4-Produktionsblock evaluiert (echter Code, keine Testkopie)', gm4ok, gm4err);

const H = () => els['gmAna'] ? els['gmAna'].innerHTML : '';
const nSk = () => (H().match(/class="sk"/g) || []).length;
const nErrbar = () => (H().match(/class="errbar"/g) || []).length;

if (gm4ok) {
  /* ---------- B1 · Erholung: Loading ist ohne jeden Fixture-Flag erreichbar -- */
  els['gmAna'] = mkEl('gmAna');
  gmSetAnaSeg('recovery');                                   /* produktiver Segmentwechsel */
  ok('§3/B1: kein Testhaken aktiv — window._gmStateOverride ist nicht gesetzt',
     window._gmStateOverride == null, String(window._gmStateOverride));
  ok('§3/B1: Loading wird allein durch den echten, noch offenen Produktions-Ladevorgang erreicht',
     _gmAnaState === 'loading' && collectCalls === 1, _gmAnaState + ' / collect=' + collectCalls);
  const skLoading = nSk();
  ok('§3/B1: es erscheinen die Golden-Master-Skelette (.sk) an der Kachelstelle',
     skLoading > 0 && /class="kgrid"/.test(H()) && /wird geladen/.test(H()), skLoading + ' .sk');
  ok('§3/B1: Ladezustand zeigt weder einen erfundenen Wert noch eine 0',
     !/>0</.test(H().slice(H().indexOf('kgrid'))), 'kgrid-Abschnitt');

  /* ---------- B2 · sechs Wiederholungen ohne Duplikate ---------------------- */
  const l0 = listenerCount, skSeq = [];
  for (let i = 0; i < 6; i++) { renderGMAnalysis(); skSeq.push(nSk()); }
  ok('§3/B2: sechs Wiederholungen erzeugen keine Skelett-Duplikate',
     skSeq.every(v => v === skLoading), skSeq.join(','));
  ok('§3/B2: sechs Wiederholungen erzeugen keine Listener-Duplikate',
     listenerCount === l0, (listenerCount - l0) + ' zusaetzliche');
  ok('§3/B2: sechs Wiederholungen loesen KEINEN zusaetzlichen Ladevorgang aus (vorhandener Guard)',
     collectCalls === 1, 'collect=' + collectCalls);

  /* ---------- B3 · verspaetete aeltere Antwort ------------------------------ */
  const old = dCollect;
  dCollect = defer();
  gmAnaRetry();                                              /* produktive Retry-Aktion */
  const reqAfterRetry = _gmAnaReq;
  ok('§3/B3: Retry startet einen neuen Ladevorgang und setzt Loading erneut',
     _gmAnaState === 'loading' && collectCalls === 2, _gmAnaState + ' / collect=' + collectCalls);
  old.resolve({ success: true, data: { resolved: { hrv_ms: { metricType: 'hrv_ms', value: 999 } } } });
  await tick(8);
  ok('§3/B3: verspaetete AELTERE Antwort ueberschreibt den neueren Zustand nicht',
     _gmAnaState === 'loading' && _gmAnaReq === reqAfterRetry && window._metricsResolved == null,
     _gmAnaState + ' / req=' + _gmAnaReq + ' / cache=' + JSON.stringify(window._metricsResolved));
  ok('§3/B3: die verworfene Antwort hinterlaesst keinen Wert im DOM (kein 999)',
     !/999/.test(H()));

  /* ---------- B4 · Loading → Daten ----------------------------------------- */
  dCollect.resolve({
    success: true,
    data: { resolved: { hrv_ms: { metricType: 'hrv_ms', value: 62 }, resting_hr: { metricType: 'resting_hr', value: 48 } } }
  });
  await tick(8);
  ok('§3/B4: Loading → Daten (Skelette verschwinden, kanonische Werte erscheinen)',
     _gmAnaState === null && nSk() === 0 && /62/.test(H()) && /48/.test(H()),
     _gmAnaState + ' / sk=' + nSk());
  ok('§3/B4: Datenzustand enthaelt keinen Fehlerhinweis',
     nErrbar() === 0);

  /* ---------- B5 · Loading → Empty ----------------------------------------- */
  window._metricsResolved = null; _gmAnaCollecting = false; _gmAnaState = null;
  dCollect = defer();
  renderGMAnalysis();
  ok('§3/B5: erneuter echter Ladevorgang ⇒ Loading',
     _gmAnaState === 'loading' && nSk() > 0, _gmAnaState + ' / sk=' + nSk());
  dCollect.resolve({ success: true, data: { resolved: {} } });
  await tick(8);
  ok('§3/B5: Loading → Empty (kein Skelett, kein Fehler, ehrliches „—" statt 0)',
     _gmAnaState === null && nSk() === 0 && nErrbar() === 0 && /—/.test(H()) &&
     !/>0</.test(H().slice(H().indexOf('kgrid'))),
     _gmAnaState + ' / sk=' + nSk() + ' / errbar=' + nErrbar());

  /* ---------- B6 · Loading → Error ----------------------------------------- */
  window._metricsResolved = null; _gmAnaCollecting = false; _gmAnaState = null;
  dCollect = defer();
  renderGMAnalysis();
  const skBeforeErr = nSk();
  dCollect.reject(new Error('netz'));
  await tick(8);
  ok('§3/B6: Loading → Error (GM-.errbar statt Skelett)',
     _gmAnaState === 'error' && nSk() === 0 && nErrbar() === 1 && skBeforeErr > 0,
     _gmAnaState + ' / sk=' + nSk() + ' / errbar=' + nErrbar());
  ok('§3/B6: Fehlerzustand erfindet keinen Wert und keine 0',
     /unbekannt/.test(H()) && !/>0</.test(H()));
  ok('§3/B6: Retry-Aktion ist die vorhandene, sichere Re-Render-Funktion gmAnaRetry()',
     /onclick="gmAnaRetry\(\)"/.test(H()) && /class="cta wide-ghost"/.test(H()));

  /* Retry aus dem Fehlerzustand fuehrt zurueck nach Loading. */
  dCollect = defer();
  gmAnaRetry();
  ok('§3/B6: Retry fuehrt vom Fehler zurueck in den Ladezustand',
     _gmAnaState === 'loading' && nSk() > 0, _gmAnaState + ' / sk=' + nSk());
  dCollect.resolve({ success: true, data: { resolved: { hrv_ms: { metricType: 'hrv_ms', value: 62 } } } });
  await tick(8);

  /* ---------- B7 · Koerper/Muskelvolumen: zweite echte asynchrone Grenze ---- */
  gmSetAnaSeg('body');
  ok('§3/B7: Koerper-Segment erreicht den Ladezustand ueber den echten Volumen-Ladevorgang',
     _gmMvState === 'loading' && mvCalls === 1 && nSk() > 0,
     _gmMvState + ' / mv=' + mvCalls + ' / sk=' + nSk());
  ok('§3/B7: Zeitraumwahl und Seitenumschalter bleiben im Ladezustand bedienbar',
     /class="range-row"/.test(H()) && /class="body-toggle"/.test(H()));
  const mvSk = nSk(), mvL0 = listenerCount, mvSeq = [];
  for (let i = 0; i < 6; i++) { renderGMAnalysis(); mvSeq.push(nSk()); }
  ok('§3/B7: sechs Wiederholungen ohne Skelett-/Listener-/Ladevorgangs-Duplikate',
     mvSeq.every(v => v === mvSk) && listenerCount === mvL0 && mvCalls === 1,
     mvSeq.join(',') + ' / mv=' + mvCalls);

  const oldMv = dMv; dMv = defer();
  gmAnaRetry();
  const mvReqAfter = _gmMvReq2;
  oldMv.resolve({ days: 28, muscles: [{ muscleId: 'chest', status: { key: 'in' }, weeklyEquivalent: 777 }] });
  await tick(8);
  ok('§3/B7: verspaetete AELTERE Volumen-Antwort ueberschreibt den neueren Zustand nicht',
     _gmMvState === 'loading' && _gmMvReq2 === mvReqAfter && !/777/.test(H()),
     _gmMvState + ' / req=' + _gmMvReq2);

  dMv.reject(new Error('netz'));
  await tick(8);
  ok('§3/B7: Volumen Loading → Error (GM-.errbar + gmAnaRetry, keine 0 Saetze)',
     _gmMvState === 'error' && nErrbar() === 1 && /onclick="gmAnaRetry\(\)"/.test(H()) &&
     /nicht null Sätze/.test(H()), _gmMvState + ' / errbar=' + nErrbar());

  dMv = defer(); gmAnaRetry();
  dMv.resolve({ days: 28, muscles: [{ muscleId: 'chest', status: { key: 'in' }, weeklyEquivalent: 10.5 }] });
  await tick(8);
  ok('§3/B7: Volumen Loading → Daten (Skelette verschwinden, Modell erscheint)',
     _gmMvState === null && nSk() === 0 && /class="mtiles"/.test(H()),
     _gmMvState + ' / sk=' + nSk());
}

/* ══════════════════════════════════════════════════════════════════════════
   TEIL C · §5 — Supplement-Stack-Leerzustand (echter Produktionsslice)
   ══════════════════════════════════════════════════════════════════════════ */
sec('C · §5 Supplement-Stack und Routinenbereich (Produktionsslice 1827–1936)');

const SUPP = lineSlice('function openRoutineTasks(){try{', 'function bindReps(){');

/* Stubs fuer die vorhandenen Abhaengigkeiten. Keine davon wird veraendert. */
let cur = '2026-07-27';
globalThis.cur = cur;
const ENTRY = { routines: {}, subs: [] };
globalThis.entry = () => ENTRY;
globalThis.SLOTS = ['Morgens', 'Pre-Workout', 'Post-Workout', 'Mit Mahlzeit', 'Abends'];
globalThis.SUB_CATS = { Basis: ['Vitamin D3', 'Omega-3 (EPA/DHA)'], Leistung: ['Kreatin', 'Koffein'] };
globalThis.activeWeekPlan = () => [[], [], [], [], [], [], []];
globalThis.recoveryCtx = () => ({});
globalThis.activeRoutines = () => [['mob', 'Mobility'], ['ss', 'Stretching']];
globalThis.canEditCur = () => true;
globalThis.save = () => { saves++; };
let saves = 0;
globalThis.v = id => (els[id] ? els[id].value : '');
globalThis.numIn = () => null;
globalThis.LIM = { reps: [0, 999] };
globalThis.SUPP_INFO = {}; globalThis.vmeta = () => ({ c: 'x', t: 'y' });
globalThis.DB = {};

let suppOk = true, suppErr = '';
try {
  (0, eval)(SUPP + '\n;globalThis.__stackEdit=function(){return stackEdit;};globalThis.__setStackEdit=function(v){stackEdit=v;};');
} catch (e) { suppOk = false; suppErr = String(e); }
ok('§5: Produktionsslice renderRoutines/renderSupps evaluiert (echter Code)', suppOk, suppErr);

if (suppOk) {
  const STACK = () => els['stackBox'].innerHTML;
  const REC = () => els['recBox'].innerHTML;
  const cnt = (s, re) => (s.match(re) || []).length;

  /* ---------- C1 · leer ---------------------------------------------------- */
  DB._stack = []; ENTRY.subs = [];
  renderSupps();
  ok('§5/C1 leer: exakte Golden-Master-Empty-Komponente (.card > .empty), kein Legacy-Absatz',
     /<div class="card"><div class="empty">/.test(STACK()) && !/<p class="muted"/.test(STACK()),
     STACK().slice(0, 0) || '');
  ok('§5/C1 leer: ehrlicher Hinweis („ORVIA schlägt hier nichts automatisch vor")',
     /Noch kein Stack angelegt/.test(STACK()) && /nichts automatisch vor/.test(STACK()));
  ok('§5/C1 leer: KEINE Demo-Supplements und keine automatisch erzeugten Stack-Eintraege',
     cnt(STACK(), /class="stackitem/g) === 0 && DB._stack.length === 0,
     cnt(STACK(), /class="stackitem/g) + ' stackitem / _stack=' + DB._stack.length);
  ok('§5/C1 leer: feste Position — Empty steht nach der Ueberschrift und vor der Aktionszeile',
     STACK().indexOf('supphd') < STACK().indexOf('class="empty"') &&
     STACK().indexOf('class="empty"') < STACK().indexOf('Stack bearbeiten</button>'));
  ok('§5/C1 leer: Erfassungsaktion zeigt auf den vorhandenen, funktionsfaehigen Weg',
     /onclick="openStackEditor\(\)"/.test(STACK()) && typeof openStackEditor === 'function' && typeof addStack === 'function');
  ok('§5/C1 leer: der Bereich verschwindet nicht (Ueberschrift + Aktionszeile bleiben)',
     /class="supphd"/.test(STACK()) && /Einmalig genommen/.test(STACK()));
  ok('§5/C1 leer: kein Schreibzugriff durch das Rendern (keine Persistenz ausgeloest)',
     saves === 0, saves + ' save()');

  /* ---------- C2 · Erfassungsaktion oeffnet den echten Editor ---------------- */
  openStackEditor();
  ok('§5/C2: openStackEditor() oeffnet den vorhandenen Editor (addrow mit addStack())',
     __stackEdit() === true && /class="addrow"/.test(STACK()) && /onclick="addStack\(\)"/.test(STACK()));
  ok('§5/C2: im geoeffneten Editor entfaellt die doppelte Aktion in der Empty-Komponente',
     !/class="eb" onclick="openStackEditor\(\)"/.test(STACK()));
  ok('§5/C2: das Oeffnen mutiert keine Daten',
     DB._stack.length === 0 && ENTRY.subs.length === 0 && saves === 0);
  __setStackEdit(false); renderSupps();

  /* ---------- C3 · teilweise ------------------------------------------------ */
  DB._stack = [{ name: 'Kreatin', dose: '5 g', timing: 'Morgens' }];
  const stackBefore = JSON.stringify(DB._stack);
  renderSupps();
  ok('§5/C3 teilweise: vorhandener echter Eintrag wird unveraendert gerendert',
     cnt(STACK(), /class="stackitem/g) === 1 && /Kreatin/.test(STACK()) && /5 g/.test(STACK()));
  ok('§5/C3 teilweise: kein Empty-Zustand mehr, aber auch kein erfundener zweiter Slot',
     !/class="empty"/.test(STACK()) && cnt(STACK(), /class="slot"/g) === 1,
     cnt(STACK(), /class="slot"/g) + ' slot');
  ok('§5/C3 teilweise: vorhandene echte Eintraege bleiben unveraendert',
     JSON.stringify(DB._stack) === stackBefore);

  /* ---------- C4 · befuellt ------------------------------------------------- */
  DB._stack = [
    { name: 'Kreatin', dose: '5 g', timing: 'Morgens' },
    { name: 'Vitamin D3', dose: '2000 IE', timing: 'Mit Mahlzeit' },
    { name: 'Magnesium-Glycinat', dose: '350 mg', timing: 'Abends' }
  ];
  renderSupps();
  ok('§5/C4 befuellt: alle drei Eintraege in drei Slots, kein Empty-Zustand',
     cnt(STACK(), /class="stackitem/g) === 3 && cnt(STACK(), /class="slot"/g) === 3 && !/class="empty"/.test(STACK()),
     cnt(STACK(), /class="stackitem/g) + ' items / ' + cnt(STACK(), /class="slot"/g) + ' slots');

  /* ---------- C5 · Re-Render ohne Duplikate --------------------------------- */
  const sig = [];
  for (let i = 0; i < 6; i++) { renderSupps(); sig.push([cnt(STACK(), /class="stackitem/g), cnt(STACK(), /class="supphd"/g), cnt(STACK(), /class="slot"/g), cnt(REC(), /class="stackitem rec/g)].join('/')); }
  ok('§5/C5: sechs Wiederholungen erzeugen keine Duplikate (befuellt)',
     new Set(sig).size === 1, sig.join(' | '));
  DB._stack = [];
  const sigE = [];
  for (let i = 0; i < 6; i++) { renderSupps(); sigE.push([cnt(STACK(), /class="empty"/g), cnt(STACK(), /class="supphd"/g), cnt(STACK(), /class="eb"/g)].join('/')); }
  ok('§5/C5: sechs Wiederholungen erzeugen keine Duplikate (leer)',
     new Set(sigE).size === 1 && sigE[0] === '1/1/1', sigE.join(' | '));

  /* ---------- C6 · Routinenbereich verschwindet nicht ----------------------- */
  /* Ausgangslage fuer das bestehende Sichtbarkeits-Gate: HEUTE ist nichts offen
     (keine aktive Routine offen, jede Empfehlung bereits erfasst). Nur dann ist
     das produktive Gate ueberhaupt auf „verbergen" — sonst misst der Test das
     Gate gar nicht. Der Stub wird ausschliesslich hier veraendert. */
  const realActiveRoutines = globalThis.activeRoutines;
  globalThis.activeRoutines = () => [];
  ENTRY.routines = {}; ENTRY.subs = suppRecs().map(x => x.n);
  const card = el('routinesCard');
  card.classList._s.clear();
  renderRoutines();
  const hiddenWithoutOpen = card.style.display;
  const openNow = openRoutineTasks();
  globalThis.activeRoutines = realActiveRoutines;
  ENTRY.routines = {}; ENTRY.subs = [];
  card.classList.add('gm-co-open');
  renderRoutines();
  ok('§5/C6: ausdruecklich geoeffneter Bereich (.gm-co-open) wird NICHT inline versteckt',
     card.style.display === '', 'display="' + card.style.display + '"');
  ok('§5/C6: ohne .gm-co-open bleibt das bestehende Sichtbarkeits-Gate unveraendert',
     hiddenWithoutOpen === 'none' && openNow === 0,
     'display="' + hiddenWithoutOpen + '" / offen=' + openNow);
  ok('§5/C6: der Supplementbereich wird in beiden Faellen mitgerendert (renderSupps im Pfad)',
     /class="supphd"/.test(STACK()));
  ok('§5/C6: keine automatisch erzeugten Routinen-/Supplement-Eintraege',
     Object.keys(ENTRY.routines).length === 0 && ENTRY.subs.length === 0 && DB._stack.length === 0);
  ok('§5/C6: das gesamte Kapitel hat keine Persistenz ausgeloest',
     saves === 0, saves + ' save()');
}

/* ══════════════════════════════════════════════════════════════════════════
   TEIL D · §4 — Stimmungsauswahl (echter Produktionsslice, Projektion)
   ══════════════════════════════════════════════════════════════════════════ */
sec('D · §4 Stimmungsauswahl — Projektion, kein zweiter Zustandsspeicher');

const moodSrc = [fnSrc('gmMoodKey'), fnSrc('gmSetMood')].join('\n');
(0, eval)(moodSrc);

ok('§4/D1: gmMoodKey projiziert die produktive 1–10-Skala „feel" auf die drei GM-Schluessel',
   gmMoodKey(10) === 'top' && gmMoodKey(7) === 'top' && gmMoodKey(6) === 'ok' &&
   gmMoodKey(5) === 'ok' && gmMoodKey(4) === 'tired' && gmMoodKey(1) === 'tired',
   [10, 7, 6, 5, 4, 1].map(gmMoodKey).join(','));
ok('§4/D1: fehlender Wert ⇒ null (unbekannt ist NICHT „Geht so")',
   gmMoodKey(null) === null && gmMoodKey(undefined) === null && gmMoodKey('') === null && gmMoodKey('x') === null);
ok('§4/D1: gmMoodKey ist eine reine Funktion — kein Schreiben, keine Persistenz',
   !/=[^=]|save|DB\[|localStorage|fetch/.test(fnSrc('gmMoodKey').replace(/var f=|return |==|>=|<=|===/g, '')) ||
   !/saveDB|localStorage|fetch\(|DB\[/.test(fnSrc('gmMoodKey')));

ok('§4/D2: das View-Model fuehrt mood ausschliesslich als Projektion von morning.feel',
   /mood:gmMoodKey\(m\?m\.feel:null\)/.test(GM1), 'gmDashVM');
ok('§4/D2: es existiert kein zweiter Zustandsspeicher fuer die Stimmung',
   !/_gmMood|window\.mood|DB\._mood|\.mood\s*=/.test(GM1.replace(/d\.mood===m\[2\]/g, '')));
ok('§4/D2: gmSetMood schreibt weder feel noch irgendeinen Store',
   !/\.feel\s*=|saveDB|save\(\)|localStorage|supabase|fetch\(/.test(fnSrc('gmSetMood')));

/* Minimales DOM fuer das GM-Verhalten (Geschwister entmarkieren, Ziel markieren). */
const mkMood = key => {
  const o = {
    _cls: new Set(['mood']), _attr: {}, dataset: { mood: key },
    classList: { add(c) { o._cls.add(c); }, remove(c) { o._cls.delete(c); }, contains(c) { return o._cls.has(c); } },
    setAttribute(k, v) { o._attr[k] = v; }, getAttribute(k) { return o._attr[k]; }
  };
  return o;
};
const moods = ['top', 'ok', 'tired'].map(mkMood);
const parent = { querySelectorAll: () => moods };
moods.forEach(m => { m.parentNode = parent; });

gmSetMood(moods[1]);
ok('§4/D3 Auswahl: genau ein Feld traegt .on, aria-pressed folgt sichtbar',
   moods.filter(m => m._cls.has('on')).length === 1 && moods[1]._cls.has('on') &&
   moods[1]._attr['aria-pressed'] === 'true' && moods[0]._attr['aria-pressed'] === 'false');
gmSetMood(moods[2]);
ok('§4/D3 Wechsel: die vorherige Auswahl wird entmarkiert (GM-Verhalten setMood)',
   moods.filter(m => m._cls.has('on')).length === 1 && moods[2]._cls.has('on') && !moods[1]._cls.has('on'));
gmSetMood(null);
ok('§4/D3 defensiv: ohne Element passiert nichts (kein Absturz, keine Aenderung)',
   moods.filter(m => m._cls.has('on')).length === 1 && moods[2]._cls.has('on'));

/* Markup-Vertrag der Auswahl aus dem echten renderCheckinCompact. */
const ciFn = fnSrc('renderCheckinCompact');
ok('§4/D4 Re-Render: .on ist eine Projektion von d.mood — nie ein gespeicherter UI-Zustand',
   /var on=\(d\.mood===m\[2\]\)/.test(ciFn) && /class="mood'\+\(on\?' on':''\)/.test(ciFn));
ok('§4/D4 Tastatur: Enter UND Space loesen dieselbe Aktion aus, Standardscroll unterdrueckt',
   /onkeydown="if\(event\.key===\\'Enter\\'\|\|event\.key===\\' \\'\)\{event\.preventDefault\(\);/.test(ciFn));
ok('§4/D4 Fokus: die Felder sind fokussierbar und assistiv als Schalter erkennbar',
   /tabindex="0"/.test(ciFn) && /role="button"/.test(ciFn) && /aria-pressed="/.test(ciFn));
ok('§4/D4 Tap: der Tap markiert nur optisch und fuehrt in das echte Formular',
   /gmSetMood\(this\);gotoCheckinForm\(\)/.test(ciFn) && /event\.stopPropagation\(\)/.test(ciFn));
ok('§4/D4: A/F/P veraendern den gespeicherten Wert nicht — die Auswahl ist nur in Stufe a sichtbar',
   /if\(lvl==='a'&&!d\.ciDone\)/.test(ciFn) && !/\.feel\s*=/.test(ciFn));
ok('§4/D4: der Renderer schreibt keinen Check-in- und keinen Decision-Zustand',
   !/saveDB|runEngine|persistCheckin|localStorage|supabase|fetch\(/.test(ciFn));
ok('§4/D4 fehlender Wert: ohne feel ist d.mood null ⇒ KEIN Feld erhaelt .on',
   gmMoodKey(null) === null && /var on=\(d\.mood===m\[2\]\)/.test(ciFn));

/* ══════════════════════════════════════════════════════════════════════════
   TEIL E · §1 und §6 — Reduced Motion (Quelle) und geloeschte Legacy-Bloecke
   ══════════════════════════════════════════════════════════════════════════ */
sec('E · §1 Reduced-Motion-Regel und §6 geloeschte Legacy-Bloecke');

const rmBlocks = [];
for (let i = 0; (i = css.indexOf('@media (prefers-reduced-motion', i)) >= 0;) {
  const o = css.indexOf('{', i); let d = 0, j = o;
  for (; j < css.length; j++) { if (css[j] === '{') d++; else if (css[j] === '}') { d--; if (!d) break; } }
  rmBlocks.push(css.slice(i, j + 1)); i = j + 1;
}
const skRm = rmBlocks.filter(b => /(^|[,{\s])\.sk\b/.test(b));
ok('§1: die freigegebene Reduced-Motion-Regel fuer .sk ist vorhanden',
   skRm.length === 1, skRm.length + ' Bloecke');
ok('§1: sie deaktiviert ausschliesslich die Bewegung (animation:none) — keine weitere Eigenschaft',
   skRm.length === 1 && /\.sk\s*\{\s*animation\s*:\s*none\s*;?\s*\}/.test(skRm[0].replace(/\s+/g, ' ').replace(/ \{/g, '{')),
   (skRm[0] || '').replace(/\s+/g, ' '));
ok('§1: sie aendert weder Geometrie noch Farbe (kein width/height/margin/padding/background/color)',
   skRm.length === 1 && !/(width|height|margin|padding|background|border|color|transform|display)\s*:/.test(skRm[0]));
ok('§1: sie wirkt nur unter der Praeferenz — ausserhalb bleibt die .sk-Animation unveraendert',
   /\.sk\{[^}]*animation\s*:/.test(css.replace(/\s+/g, '')) ||
   /\.sk\s*\{[^}]*animation/.test(css));

/* §6 — die beiden bereits geloeschten Legacy-Bloecke. */
const defsOf = re => (uiSrc.match(re) || []).length;
ok('§6: renderCommand ist heute genau einmal definiert (Legacy-Variante entfernt)',
   defsOf(/^function renderCommand\(/gm) === 1, defsOf(/^function renderCommand\(/gm) + ' Definitionen');
ok('§6: renderCheckinCompact ist heute genau einmal definiert (Legacy-Variante entfernt)',
   defsOf(/^function renderCheckinCompact\(/gm) === 1, defsOf(/^function renderCheckinCompact\(/gm) + ' Definitionen');
ok('§6: das Legacy-Markup .occ des alten renderCommand existiert nicht mehr',
   !/class="occ(\s|")/.test(uiSrc));
ok('§6: das Legacy-Markup .cic- des alten renderCheckinCompact existiert nicht mehr',
   !/class="cic-|"cic-b"|cic-pill/.test(uiSrc));
/* Gemessen wird ausschliesslich CODE. Der Name darf in der GM6.1-Dokumentation
   des geloeschten Blocks weiterhin vorkommen — genau das verlangt §6 („frühere
   Funktionsnamen … dokumentieren"). Blockkommentare werden daher entfernt. */
const uiCode = uiSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok('§6: der Legacy-Helfer proTechLine existiert im Code nicht mehr (nur noch in der GM6.1-Doku)',
   (uiCode.match(/proTechLine/g) || []).length === 0 && (uiSrc.match(/proTechLine/g) || []).length === 1,
   'Code ' + (uiCode.match(/proTechLine/g) || []).length + ' / Doku ' + (uiSrc.match(/proTechLine/g) || []).length);
/* Jeder verbliebene Aufrufer zeigt auf die heute einzige (GM-)Definition. */
const callers = uiL.map((l, i) => ({ l, i: i + 1 }))
  .filter(x => /(^|[^.\w])renderCommand\(\)|(^|[^.\w])renderCheckinCompact\(\)/.test(x.l) &&
               !/^function (renderCommand|renderCheckinCompact)\(/.test(x.l));
ok('§6: alle verbliebenen Aufrufstellen zeigen auf die einzige verbliebene Definition',
   callers.length > 0, callers.map(c => c.i).join(', '));
ok('§6: keine Eingabe-, Safety- oder Persistenzfunktion ging verloren',
   /function gotoCheckinForm\(/.test(uiSrc) && /function expandCheckinCard\(/.test(uiSrc) &&
   /function toggleCheckinCard\(/.test(uiSrc));
/* GM7 (Restbereinigung) hat die in GM6.1 bewusst stehengelassenen verwaisten .cic-*-Regeln
   entfernt. Die GM6.1-Invariante („der kompakte Check-in bleibt funktional unangetastet")
   bleibt inhaltlich in Kraft und wird auf den Zielzustand gedreht — statt EINER Bedingung
   werden jetzt DREI geprueft: die Legacy-Regeln sind fort, und die beiden aktiven Regeln
   des kompakten Check-ins (.ci-compact / .ci-collapsed) sind unveraendert vorhanden. */
const _cicFort = !/\.cic-/.test(css);
const _ciAktiv = /\.ci-compact\{/.test(css) && /\.ci-collapsed\{display:none/.test(css);
ok('§6/GM7: verwaiste .cic-*-Regeln entfernt, aktiver kompakter Check-in unveraendert',
   _cicFort && _ciAktiv, 'cic-fort=' + _cicFort + ' ci-aktiv=' + _ciAktiv);

/* ══════════════════════════════════════════════════════════════════════════
   TEIL F · §1 und §4 im Browser (Harness /tmp/gm6h.html)
   ══════════════════════════════════════════════════════════════════════════ */
sec('F · §1 Reduced Motion und §4 Bedienung im Browser');

const _pw = await (async () => {
  try { return await import('playwright'); }
  catch (_) { return await import('/tmp/node_modules/playwright/index.js'); }
})();
const chromium = _pw.chromium || (_pw.default && _pw.default.chromium);
const HARNESS = 'file:///tmp/gm6h.html';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
try {
  const geom = async reduced => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    await page.goto(HARNESS);
    await page.evaluate(`setState('loading','fortgeschritten')`);
    const out = await page.evaluate(`(() => {
      const sk = [...document.querySelectorAll('#tab-heute .sk')];
      const all = [...document.querySelectorAll('#tab-heute *')];
      return {
        n: sk.length,
        anim: sk.map(e => getComputedStyle(e).animationName),
        skStyle: sk.map(e => { const c = getComputedStyle(e); return [c.backgroundColor, c.backgroundImage, c.borderRadius, c.opacity].join('|'); }),
        boxes: all.map(e => { const r = e.getBoundingClientRect(); return [e.tagName, e.className, Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join('|'); })
      };
    })()`);
    await ctx.close();
    return out;
  };
  const normal = await geom(false), reduce = await geom(true);
  ok('§1/F: der Harness zeigt Skelette in beiden Kontexten',
     normal.n > 0 && normal.n === reduce.n, normal.n + ' / ' + reduce.n);
  ok('§1/F: ohne Praeferenz laeuft die GM-Animation unveraendert',
     normal.anim.length > 0 && normal.anim.every(a => a && a !== 'none'), [...new Set(normal.anim)].join(','));
  ok('§1/F: mit Reduced Motion ist ausschliesslich die Bewegung deaktiviert',
     reduce.anim.every(a => a === 'none'), [...new Set(reduce.anim)].join(','));
  ok('§1/F: Geometrie bleibt byte-identisch (alle Elemente in #tab-heute)',
     JSON.stringify(normal.boxes) === JSON.stringify(reduce.boxes),
     normal.boxes.length + ' Elemente');
  ok('§1/F: Farben, Radius und Deckkraft der Skelette bleiben identisch',
     JSON.stringify(normal.skStyle) === JSON.stringify(reduce.skStyle),
     [...new Set(reduce.skStyle)].join(' ~ '));

  /* ---------- §4 Bedienung ------------------------------------------------- */
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(HARNESS);
  const ev = fn => page.evaluate(typeof fn === 'string' ? fn : `(${fn})()`);

  /* Stufe a mit offenem Check-in ⇒ GM-Stimmungsauswahl. */
  await ev(`setState('empty','anfaenger')`);
  const base = await ev(`(() => ({ n: document.querySelectorAll('#checkinCompact .mood').length,
                                   on: document.querySelectorAll('#checkinCompact .mood.on').length }))()`);
  ok('§4/F1 fehlender Wert: drei Felder, KEINES markiert (unbekannt ≠ „Geht so")',
     base.n === 3 && base.on === 0, JSON.stringify(base));

  /* Gespeicherter Wert ⇒ genau die kanonische Auswahl, auch nach Re-Render. */
  await ev(`CURFIX = Object.assign({}, FIXEMPTY, { mood: 'ok' }); __gm6.paint();`);
  const stored = await ev(`(() => { const on = [...document.querySelectorAll('#checkinCompact .mood.on')];
     return { c: on.length, k: on.map(e => e.dataset.mood).join(','),
              ap: [...document.querySelectorAll('#checkinCompact .mood')].map(e => e.getAttribute('aria-pressed')).join(',') }; })()`);
  ok('§4/F2 Auswahl: der kanonische Wert erhaelt .on und aria-pressed=true',
     stored.c === 1 && stored.k === 'ok' && stored.ap === 'false,true,false', JSON.stringify(stored));

  await ev(`__gm6.resetCalls(); __gm6.paint(); __gm6.paint(); __gm6.paint();`);
  const rerender = await ev(`(() => { const on = [...document.querySelectorAll('#checkinCompact .mood.on')];
     return { c: on.length, k: on.map(e => e.dataset.mood).join(','), n: document.querySelectorAll('#checkinCompact .mood').length,
              calls: window.__gm6.calls }; })()`);
  ok('§4/F3 Re-Render: erneutes Rendern zeigt weiterhin exakt die kanonische Auswahl, ohne Duplikate',
     rerender.c === 1 && rerender.k === 'ok' && rerender.n === 3, JSON.stringify(rerender));
  ok('§4/F3 Re-Render loest keine Engine-, Store- oder Persistenzaktion aus',
     rerender.calls.engine === 0 && rerender.calls.persist === 0 && rerender.calls.score === 0,
     JSON.stringify(rerender.calls));

  /* Tap auf ein anderes Feld: Wechsel, ohne den gespeicherten Wert zu aendern. */
  await ev(`window.gotoCheckinForm = function(){ window.__gotoCalls = (window.__gotoCalls||0)+1; };`);
  await page.click('#checkinCompact .mood[data-mood="tired"]');
  const tapped = await ev(`(() => { const on = [...document.querySelectorAll('#checkinCompact .mood.on')];
     return { c: on.length, k: on.map(e => e.dataset.mood).join(','), goto: window.__gotoCalls || 0,
              feel: (window.CURFIX && CURFIX.mood) || null, calls: window.__gm6.calls }; })()`);
  ok('§4/F4 Wechsel per Tap: genau ein Feld markiert, das vorherige entmarkiert',
     tapped.c === 1 && tapped.k === 'tired', JSON.stringify(tapped));
  ok('§4/F4 Tap fuehrt in das echte Check-in-Formular (vorhandene Aktion)',
     tapped.goto === 1, String(tapped.goto));
  ok('§4/F4 Tap veraendert den gespeicherten Wert NICHT (kein zweiter Zustandsspeicher)',
     tapped.feel === 'ok' && tapped.calls.persist === 0 && tapped.calls.engine === 0, JSON.stringify(tapped));

  const afterRepaint = await ev(`(() => { __gm6.paint(); const on = [...document.querySelectorAll('#checkinCompact .mood.on')];
     return on.map(e => e.dataset.mood).join(','); })()`);
  ok('§4/F4 nach erneutem Rendern gewinnt wieder der kanonische Wert (Projektion, kein UI-Speicher)',
     afterRepaint === 'ok', afterRepaint);

  /* Tastatur: Enter und Space. */
  await ev(`window.__gotoCalls = 0;`);
  await page.focus('#checkinCompact .mood[data-mood="top"]');
  const focusOk = await ev(`(() => document.activeElement && document.activeElement.dataset && document.activeElement.dataset.mood)()`);
  ok('§4/F5 Fokus: die Felder sind per Tastatur fokussierbar (tabindex=0)',
     focusOk === 'top', String(focusOk));
  await page.keyboard.press('Enter');
  const kEnter = await ev(`(() => { const on = [...document.querySelectorAll('#checkinCompact .mood.on')];
     return { k: on.map(e => e.dataset.mood).join(','), goto: window.__gotoCalls || 0 }; })()`);
  ok('§4/F5 Tastatur Enter: markiert und loest dieselbe Aktion aus wie der Tap',
     kEnter.k === 'top' && kEnter.goto === 1, JSON.stringify(kEnter));

  const scrollBefore = await ev(`(() => window.scrollY)()`);
  await page.focus('#checkinCompact .mood[data-mood="tired"]');
  await page.keyboard.press('Space');
  const kSpace = await ev(`(() => { const on = [...document.querySelectorAll('#checkinCompact .mood.on')];
     return { k: on.map(e => e.dataset.mood).join(','), goto: window.__gotoCalls || 0, y: window.scrollY }; })()`);
  ok('§4/F5 Tastatur Space: markiert, loest die Aktion aus und unterdrueckt den Standardscroll',
     kSpace.k === 'tired' && kSpace.goto === 2 && kSpace.y === scrollBefore, JSON.stringify(kSpace));

  const focusKept = await ev(`(() => document.activeElement && document.activeElement.dataset && document.activeElement.dataset.mood)()`);
  ok('§4/F5 Fokus bleibt nach der Tastaturbedienung auf dem bedienten Feld',
     focusKept === 'tired', String(focusKept));

  await ctx.close();
} finally {
  await browser.close();
}

console.log('\n' + (fail ? '❌' : '✅') + ' gm61_contract: ' + (fail ? fail + ' FEHLER, ' : 'ALL PASSED (') + pass + ' ok' + (fail ? '' : ')'));
process.exit(fail ? 1 : 0);

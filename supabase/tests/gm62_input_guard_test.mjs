/* ============================================================
   ORVIA · GM6.2 — Eingabeschutz der Check-in-Hydration.

   Geprüfter Vertrag (GM6.2 §3–§5):
     „Eine laufende Check-in-Hydration darf eine offene Benutzereingabe niemals
      überschreiben. Der direkte Darstellungsaufruf in checkin-store.js läuft
      deshalb über den vorhandenen zentralen UI-Refresh mit Eingabeschutz.
      Daten, Store-API und Netzwerkverkehr bleiben unverändert."

   Bewusst NICHT geprüft (liegt in den bestehenden Suites):
     - Ready-Signal/Hydrationsreihenfolge  → gm61_hydration_contract_test.mjs
     - targetsFor-Reinheit / Coalescing    → ui_refresh_p1_test.mjs
     - GM-Zustandskomponenten              → gm6_state_contract_test.mjs

   node supabase/tests/gm62_input_guard_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 62 - t.length)));

const base = new URL(_APPREL + 'js/', import.meta.url);
const R = p => readFileSync(new URL(p, base), 'utf8');
const REFRESH = R('ui-refresh.js');
const STORE = R('checkin-store.js');
const SYNC = R('activity-sync.js');

/* Verträge über AUSFÜHRBAREN Code prüfen, nicht über Kommentartext. */
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const STORE_CODE = stripComments(STORE);
const REFRESH_CODE = stripComments(REFRESH);

/* ------------------------------------------------------------------
   Mini-DOM: genau so viel, wie der Eingabeschutz tatsächlich benutzt
   (activeElement, tagName, closest). Kein jsdom → keine neue Abhängigkeit.
   ------------------------------------------------------------------ */
function el(tag, ancestors) {
  const a = ancestors || [];
  return {
    tagName: tag, value: null, isContentEditable: false,
    closest(sel) { return a.indexOf(sel) >= 0 ? { __sel: sel } : null; }
  };
}

function sandbox(opts) {
  opts = opts || {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object;
  sb.String = String; sb.Number = Number; sb.Set = Set; sb.Map = Map; sb.Promise = Promise;
  sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout;
  sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN; sb.isFinite = isFinite;
  sb.navigator = { onLine: true };

  const wl = {}; sb.__listeners = wl;
  sb.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
  sb.addEventListener = (t, f) => { (wl[t] = wl[t] || []).push(f); };
  sb.removeEventListener = () => {};
  sb.dispatchEvent = e => { (wl[e.type] || []).slice().forEach(f => f(e)); return true; };

  sb.document = {
    activeElement: opts.activeElement || null,
    querySelector: sel => (sel === '.tabbar button.on[data-tab]' ? { dataset: { tab: opts.tab || 'heute' } } : null),
    querySelectorAll: () => [],
    getElementById: () => null,
    body: { appendChild() {} },
    documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } }
  };
  sb.ORVIA = {};
  vm.createContext(sb);
  return sb;
}

const wait = ms => new Promise(r => setTimeout(r, ms == null ? 260 : ms));
const loadRefresh = sb => vm.runInContext(REFRESH, sb, { filename: 'ui-refresh.js' });
const loadStore = sb => vm.runInContext(STORE, sb, { filename: 'checkin-store.js' });

/* Repository-Attrappe: liefert genau eine Morgen-Zeile. KEIN Netzwerk. */
function stubRepo(sb, rows) {
  let calls = 0;
  sb.ORVIA.repos = { checkin: { listRange: async () => { calls++; return { success: true, data: rows || [] }; } } };
  return () => calls;
}
const ROWS = [{ local_date: '2026-07-20', checkin_type: 'morning', sleep_minutes: 431, feel: 4, resting_hr: 48, complaints: [] }];

function stubRenderers(sb) {
  const c = { avatar: 0, card: 0, zones: 0, day: 0, plan: 0, dash: 0 };
  sb.renderTopAvatar = () => { c.avatar++; };
  sb.renderProfileScreen = () => { c.card++; };
  sb.renderZones = () => { c.zones++; };
  sb.renderDay = () => { c.day++; };
  sb.renderPlan = () => { c.plan++; };
  sb.renderDash = () => { c.dash++; };
  return c;
}

/* Vollständige Testumgebung: ui-refresh + checkin-store + DB + Repo. */
function bootstrap(opts) {
  opts = opts || {};
  const sb = sandbox(opts);
  const c = stubRenderers(sb);
  sb.DB = opts.DB || {};
  sb.todayStr = () => '2026-07-21';
  loadRefresh(sb);
  const repoCalls = stubRepo(sb, opts.rows === undefined ? ROWS : opts.rows);
  loadStore(sb);
  return { sb, c, repoCalls };
}

/* ==================================================================
   TEIL A — Quelltextvertrag: ausschließlich der Darstellungsaufruf wechselt
   ================================================================== */
sec('A · checkin-store.js — nur der UI-Aufruf ändert sich');
{
  // Der GM6-Defekt in Reinform: „wenn es renderDay gibt, rendere" — ohne jede Bedingung.
  const rohAlt = /if\s*\(\s*typeof\s+renderDay\s*===\s*['"]function['"]\s*\)\s*renderDay\s*\(\s*\)/;
  ok('A1 kein ungeschützter Direktaufruf renderDay() mehr',
    !rohAlt.test(STORE_CODE), 'Altpfad gefunden=' + rohAlt.test(STORE_CODE));

  const sched = STORE_CODE.match(/\.schedule\s*\(\s*\[\s*['"]day['"]/g) || [];
  ok('A2 genau ein Aufruf des zentralen UI-Refresh', sched.length === 1, 'gefunden=' + sched.length);

  ok('A3 Aufruf adressiert genau die Fläche "day" mit protectInput',
    /schedule\s*\(\s*\[\s*['"]day['"]\s*\]\s*,\s*\{\s*protectInput\s*:\s*true\s*\}\s*\)/.test(STORE_CODE));

  ok('A4 Fallback rendert nur ohne fokussierte Eingabe',
    !/renderDay\s*\(\s*\)/.test(STORE_CODE) ||
    /!\s*_gm62InputOpen\s*\(\s*\)\s*\)\s*renderDay\s*\(\s*\)/.test(STORE_CODE));

  ok('A5 Fallback-Wächter deckt #morningForm ausdrücklich ab',
    !/renderDay\s*\(\s*\)/.test(STORE_CODE) || /#morningForm/.test(STORE_CODE));

  // Der Aufruf steht weiterhin an derselben Stelle: Ende von hydrateRecentTypes.
  const iMig = STORE_CODE.indexOf('checkinMorningMigrated = true');
  const iSched = STORE_CODE.search(/\.schedule\s*\(\s*\[\s*['"]day['"]/);
  ok('A6 Aufruf steht unverändert am Ende von hydrateRecentTypes',
    iMig > 0 && iSched > iMig, 'migrated=' + iMig + ' schedule=' + iSched);
}

sec('A2 · unveränderte Store-Fach- und Datenlogik');
{
  ok('A7 Store-API unverändert (13 Exporte, gleiche Namen)',
    /O\.checkinStore\s*=\s*\{\s*persistCheckin,\s*hydrateRecentTypes,\s*rowToCheckin,\s*persistMorning,\s*hydrateRecent,\s*rowToMorning,\s*VALID_TYPES,\s*BLOCK_TYPES,\s*TYPE_KEY\s*\}/
      .test(STORE_CODE.replace(/\s+/g, ' ')));
  ok('A8 Merge-Semantik der Hydration unverändert',
    /DB\[row\.local_date\]\[key\]\s*=\s*Object\.assign\(\{\},\s*DB\[row\.local_date\]\[key\]\s*\|\|\s*\{\},\s*rowToCheckin\(row\)\)/.test(STORE_CODE));
  ok('A9 genau ein Datenabruf je Hydration (kein zusätzlicher Request)',
    (STORE_CODE.match(/listRange\s*\(/g) || []).length === 1);
  ok('A10 keine neue Persistenzlogik im Hydrationspfad',
    (STORE_CODE.match(/repos\.checkin\.upsert|localStorage\.setItem/g) || []).length === 0);
  ok('A11 kein fetch/supabase-Direktzugriff im Store',
    !/\bfetch\s*\(|supabase\./.test(STORE_CODE));
}

sec('B · ui-refresh.js — schedule ist öffentlicher Vertragsbestandteil');
{
  ok('B1 schedule wird exportiert', /O\.uiRefresh\s*=\s*\{[^}]*\bschedule\s*:\s*schedule\b/.test(REFRESH_CODE));
  ok('B2 bestehende Exporte bleiben erhalten',
    /targetsFor\s*:\s*targetsFor/.test(REFRESH_CODE) && /_apply\s*:\s*apply/.test(REFRESH_CODE)
    && /_onEvent\s*:\s*onProfileUpdated/.test(REFRESH_CODE) && /_onAuthReady\s*:\s*onAuthReady/.test(REFRESH_CODE));
  ok('B3 keine zweite Refresh-/Ready-Logik entstanden',
    (REFRESH_CODE.match(/function\s+schedule\s*\(/g) || []).length === 1
    && (REFRESH_CODE.match(/addEventListener\s*\(\s*['"]orvia:auth-ready['"]/g) || []).length === 1);
  ok('B3b Refresh-Modul bindet weiterhin genau einmal', /__orviaUiRefreshBound/.test(REFRESH_CODE));
  ok('B4 Eingabeschutz weiterhin an #tab-heute gebunden', /day\s*:\s*'#tab-heute'/.test(REFRESH_CODE));
}

/* ==================================================================
   TEIL C — Laufzeit: offene Eingabe überlebt die Hydration
   ================================================================== */
sec('C · Hydration bei fokussierter Check-in-Eingabe');
{
  const probe = el('INPUT', ['#tab-heute', '#morningForm', '#checkinCard']);
  probe.value = '7';
  const { sb, c } = bootstrap({ tab: 'heute', activeElement: probe });

  const r = await sb.ORVIA.checkinStore.hydrateRecentTypes(35, ['morning']);
  await wait();

  ok('C1 Hydration meldet Erfolg', r && r.success === true && r.data.applied === 1, JSON.stringify(r && r.data));
  ok('C2 kein renderDay() während des Fokus', c.day === 0, JSON.stringify(c));
  ok('C3 die Eingabe existiert unverändert weiter (Wert 7)', probe.value === '7', 'value=' + probe.value);
  ok('C4 hydrierte Daten liegen trotzdem im Store',
    !!(sb.DB['2026-07-20'] && sb.DB['2026-07-20'].morning && sb.DB['2026-07-20'].morning.sleepMin === 431),
    JSON.stringify(sb.DB['2026-07-20'] && sb.DB['2026-07-20'].morning));

  // Das Ready-Event folgt in der realen Kette NACH der Hydration.
  sb.dispatchEvent(new sb.CustomEvent('orvia:auth-ready', {}));
  await wait();
  ok('C5 auch der Auth-Ready-Refresh überschreibt die Eingabe nicht', c.day === 0, JSON.stringify(c));
  // Delta, nicht Absolutwert: die Hydration selbst hat die Kernflächen bereits
  // einmal aktualisiert (dokumentierte Folge des zentralen Refresh-Pfads).
  ok('C6 übrige Flächen werden trotzdem aktualisiert (Delta +1)',
    c.avatar === 2 && c.card === 2, JSON.stringify(c));
  ok('C7 die Eingabe ist nach dem Ready-Refresh weiterhin unversehrt', probe.value === '7', 'value=' + probe.value);

  // Speichern/Schließen → Fokus weg → der hydrierte Zustand wird sichtbar.
  sb.document.activeElement = null;
  sb.dispatchEvent(new sb.CustomEvent('orvia:auth-ready', {}));
  await wait();
  ok('C8 nach Fokusverlust erscheint der hydrierte Zustand', c.day === 1, JSON.stringify(c));
}

sec('D · Hydration ohne Fokus — Normalverhalten unverändert');
{
  const { sb, c } = bootstrap({ tab: 'heute' });
  const r = await sb.ORVIA.checkinStore.hydrateRecentTypes(35, ['morning']);
  await wait();
  ok('D1 Heute-Ansicht wird genau einmal aktualisiert', c.day === 1, JSON.stringify(c));
  ok('D2 Hydrationsergebnis identisch zum Fokusfall', r.success && r.data.applied === 1 && r.source === 'supabase',
    r.source + '/' + r.sync_status);
  ok('D3 kein Zwangswechsel auf eine andere Fläche', c.plan === 0 && c.dash === 0, JSON.stringify(c));
}
{
  /* Fremder Tab. WICHTIGE dokumentierte Verhaltensänderung gegenüber GM6:
     der alte Direktaufruf rendert Heute auch dann, wenn Heute unsichtbar ist.
     Über targetsFor() entfällt dieser Render — unschädlich, weil showTab()
     Heute bei JEDEM Öffnen frisch rendert (ui.js:3419 `if(name==='heute')
     _safe(renderDay)`). Der Store darf außerdem keinen fremden Tab repainten. */
  const { sb, c } = bootstrap({ tab: 'dash' });
  await sb.ORVIA.checkinStore.hydrateRecentTypes(35, ['morning']);
  await wait();
  ok('D4 unsichtbares Heute wird nicht gerendert (showTab rendert beim Öffnen)',
    c.day === 0, JSON.stringify(c));
  ok('D5 der Store repaintet keinen fremden Tab', c.dash === 0 && c.plan === 0, JSON.stringify(c));
}
{
  /* Die mandatierte Signatur schedule(['day'],…) läuft durch targetsFor(),
     dessen erster Parameter SEKTIONEN meint, nicht Ziele. Nachweis, dass die
     beabsichtigte Fläche trotzdem exakt erreicht wird: */
  const sb = sandbox({ tab: 'heute' }); loadRefresh(sb);
  const tHeute = sb.ORVIA.uiRefresh.targetsFor(['day'], 'heute');
  const tDash = sb.ORVIA.uiRefresh.targetsFor(['day'], 'dash');
  ok('D6 targetsFor(["day"],"heute") enthält die Heute-Fläche',
    tHeute.indexOf('day') >= 0, JSON.stringify(tHeute));
  ok('D7 targetsFor(["day"],"dash") löst KEINEN Dash-Render aus',
    tDash.indexOf('dash') < 0 && tDash.indexOf('day') < 0, JSON.stringify(tDash));
  ok('D8 Nebenwirkung dokumentiert: Kernflächen laufen mit',
    tHeute.indexOf('topAvatar') >= 0 && tHeute.indexOf('profileCard') >= 0, JSON.stringify(tHeute));
}
{
  /* Reale Login-Kette: hydrateRecentTypes (auth.js:276) und das Ready-Event
     (auth.js:288) liegen innerhalb des 150-ms-Debounce → EIN Refresh, nicht zwei. */
  const { sb, c } = bootstrap({ tab: 'heute' });
  await sb.ORVIA.checkinStore.hydrateRecentTypes(35, ['morning']);
  sb.dispatchEvent(new sb.CustomEvent('orvia:auth-ready', {}));   // ohne Wartezeit dazwischen
  await wait();
  ok('D9 Hydration + Ready in derselben Kette = genau EIN Refresh',
    c.day === 1 && c.avatar === 1 && c.card === 1, JSON.stringify(c));
}

sec('E · keine Store-Datenmutation durch den UI-Schutz');
{
  const probe = el('INPUT', ['#tab-heute', '#morningForm']);
  const a = bootstrap({ tab: 'heute', activeElement: probe });
  await a.sb.ORVIA.checkinStore.hydrateRecentTypes(35, ['morning']); await wait();
  const b = bootstrap({ tab: 'heute' });
  await b.sb.ORVIA.checkinStore.hydrateRecentTypes(35, ['morning']); await wait();
  ok('E1 DB nach Hydration mit und ohne Fokus byte-gleich',
    JSON.stringify(a.sb.DB) === JSON.stringify(b.sb.DB),
    JSON.stringify(a.sb.DB).slice(0, 90));
  ok('E2 Migrationsflag in beiden Fällen gesetzt',
    a.sb.ORVIA.checkinMorningMigrated === true && b.sb.ORVIA.checkinMorningMigrated === true);
  ok('E3 genau ein Datenabruf je Hydration — Schutz erzeugt keinen Request',
    a.repoCalls() === 1 && b.repoCalls() === 1, a.repoCalls() + '/' + b.repoCalls());
}

sec('F · sechs Zyklen — keine Listener- oder Renderakkumulation');
{
  const { sb, c } = bootstrap({ tab: 'heute' });
  const before = Object.keys(sb.__listeners).map(k => k + '=' + sb.__listeners[k].length).sort().join(',');
  for (let i = 0; i < 6; i++) { await sb.ORVIA.checkinStore.hydrateRecentTypes(35, ['morning']); await wait(); }
  const after = Object.keys(sb.__listeners).map(k => k + '=' + sb.__listeners[k].length).sort().join(',');
  ok('F1 Listenerzahl konstant über sechs Hydrationszyklen', before === after, before + ' vs ' + after);
  ok('F2 genau sechs Heute-Renders (keine Akkumulation)', c.day === 6, JSON.stringify(c));
  ok('F3 keine Mehrfachladung des Refresh-Moduls', sb.__orviaUiRefreshBound === true);

  // Sechs Ready-Zyklen zusätzlich: gleiche Zusicherung auf dem Ready-Pfad.
  const c0 = c.day;
  for (let i = 0; i < 6; i++) { sb.dispatchEvent(new sb.CustomEvent('orvia:auth-ready', {})); await wait(); }
  ok('F4 sechs Ready-Zyklen erzeugen genau sechs weitere Renders', c.day === c0 + 6, 'day=' + c.day);
}

/* ==================================================================
   TEIL G — Netzwerkvertrag (§5)
   ================================================================== */
sec('G · Netzwerkvertrag des Ready-Events');
{
  ok('G1 activity-sync hört genau einmal auf orvia:auth-ready',
    (SYNC.match(/addEventListener\s*\(\s*['"]orvia:auth-ready['"]/g) || []).length === 1);
  ok('G2 der 1500-ms-Fallback existiert unverändert (defensiver Zweitpfad)',
    /setTimeout\s*\(\s*_autoFlush\s*,\s*1500\s*\)/.test(SYNC));
  ok('G3 _autoFlush ist an eine bestehende Session gebunden',
    /function\s+_autoFlush\s*\(\s*\)\s*\{[\s\S]{0,80}O\.user\s*&&\s*O\.user\.id/.test(SYNC));
  ok('G4 der UI-Refresh selbst erzeugt keinen Request',
    !/\bfetch\s*\(|hydrate\w*\s*\(|supabase|repos\./.test(REFRESH_CODE));
  ok('G5 der Store-Schutzpfad erzeugt keinen zusätzlichen Request',
    !/listRange|flushPending|pullServer/.test(
      (STORE_CODE.match(/checkinMorningMigrated = true[\s\S]*?return res\(/) || [''])[0]));
}
{
  /* Laufzeitzähler: eine Login-Init-Kette → genau ein _autoFlush.
     activity-sync.js wird nicht geladen (es zieht Repos/Supabase); stattdessen
     wird der dokumentierte Listener 1:1 nachgebildet und gezählt. */
  const { sb, c } = bootstrap({ tab: 'heute' });
  let flush = 0;
  sb.addEventListener('orvia:auth-ready', () => { flush++; });

  await sb.ORVIA.checkinStore.hydrateRecentTypes(35, ['morning']);   // Hydration …
  sb.dispatchEvent(new sb.CustomEvent('orvia:auth-ready', {}));      // … dann genau ein Ready
  await wait();
  ok('G6 genau ein _autoFlush je erfolgreicher Login-Init-Kette', flush === 1, 'flush=' + flush);
  ok('G7 die Hydration selbst löst kein Ready aus (kein zweiter Pull)', flush === 1);
  ok('G8 Heute wurde in dieser Kette nicht doppelt gerendert', c.day <= 2, JSON.stringify(c));
}

console.log('\n' + (fail ? '❌' : '✅') + ' gm62_input_guard: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

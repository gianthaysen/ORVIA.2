/* ============================================================
   ORVIA · GM6.1 — Hydrations-/Ready-Vertrag (Phase 7).

   Prüft ausschließlich den in GM6.1 ergänzten Boot-Vertrag:
     „Nach abgeschlossener Auth-/Store-Hydration wird die aktuell sichtbare
      Oberfläche genau einmal mit den hydrierten Daten aktualisiert."

   Bewusst NICHT geprüft (liegt in den bestehenden Suites):
     - Mood-Projektion und Supplement-Leerzustand → gm61_contract_test.mjs (Teil C/D)
     - GM-Zustandskomponenten allgemein            → gm6_state_contract_test.mjs
     - targetsFor-Reinheit / Coalescing            → ui_refresh_p1_test.mjs

   node supabase/tests/gm61_hydration_contract_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 62 - t.length)));

const base = new URL('../../js/', import.meta.url);
const R = p => readFileSync(new URL(p, base), 'utf8');
const AUTH = R('auth.js');
const REFRESH = R('ui-refresh.js');
const UI = R('ui.js');
const HTML = readFileSync(new URL('../index.html', base), 'utf8');
const SW = readFileSync(new URL('../sw.js', base), 'utf8');

/* Verträge über AUSFÜHRBAREN Code prüfen, nicht über Kommentartext —
   sonst würde eine erklärende Zeile den Vertrag rot färben. */
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const REFRESH_CODE = stripComments(REFRESH);

/* ------------------------------------------------------------------
   Sandbox (Muster aus ui_refresh_p1_test.mjs, um Doppel-Wahrheiten zu
   vermeiden) — erweitert um activeElement/closest für den Input-Schutz.
   ------------------------------------------------------------------ */
function sandbox(opts) {
  opts = opts || {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object;
  sb.String = String; sb.Number = Number; sb.Set = Set; sb.Promise = Promise;
  sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout;
  sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN; sb.isFinite = isFinite;
  sb.navigator = { onLine: true };

  const wl = {};
  sb.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
  sb.addEventListener = (t, f) => { (wl[t] = wl[t] || []).push(f); };
  sb.removeEventListener = () => {};
  sb.dispatchEvent = e => { (wl[e.type] || []).slice().forEach(f => f(e)); return true; };

  sb.document = {
    activeElement: opts.activeElement || null,
    querySelector: sel => (sel === '.tabbar button.on[data-tab]' && opts.tab
      ? { dataset: { tab: opts.tab } } : null),
    querySelectorAll: () => [],
    getElementById: () => null,
    body: { appendChild() {} },
    documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } }
  };
  sb.ORVIA = {};
  vm.createContext(sb);
  return { sb, wl };
}
const load = sb => vm.runInContext(REFRESH, sb, { filename: 'ui-refresh.js' });
const wait = ms => new Promise(r => setTimeout(r, ms == null ? 260 : ms));

/* Zähler-Stubs für die realen Renderer. */
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
const authReady = sb => sb.dispatchEvent(new sb.CustomEvent('orvia:auth-ready', {}));

/* ==================================================================
   TEIL A — Ready-Vertrag im Quelltext (Phase 4: eng begrenzte Ausnahme)
   ================================================================== */
sec('A · Ready-Signal (auth.js)');
{
  const disp = AUTH.match(/dispatchEvent\s*\(\s*new\s+CustomEvent\s*\(\s*['"]orvia:auth-ready['"]/g) || [];
  ok('A1 auth.js löst orvia:auth-ready genau einmal aus', disp.length === 1, 'gefunden=' + disp.length);

  const iMark = AUTH.indexOf("_P.mark('onAuthed: TOTAL login-init chain'");
  const iDisp = AUTH.indexOf('orvia:auth-ready');
  ok('A2 Dispatch steht NACH dem Ende der Hydrationskette',
    iMark > 0 && iDisp > iMark, 'mark=' + iMark + ' dispatch=' + iDisp);

  const iLatch = AUTH.indexOf('onAuthed._initFor = session.user.id');
  ok('A3 Dispatch liegt hinter dem Einmal-Latch (kein Modul-Level-Dispatch)',
    iLatch > 0 && iDisp > iLatch, 'latch=' + iLatch);

  // Der Dispatch darf keine neuen Auth-Datenfelder transportieren.
  const line = (AUTH.split('\n').find(l => l.indexOf('orvia:auth-ready') >= 0) || '');
  ok('A4 kein detail-Payload (keine neuen Auth-Datenfelder)',
    !/detail\s*:/.test(line), line.trim().slice(0, 120));

  ok('A5 SIGNED_OUT gibt den Latch weiterhin frei (kein paralleler Ready-State)',
    /onAuthed\._initFor\s*=\s*null/.test(AUTH));

  // TOKEN_REFRESHED/USER_UPDATED laufen in denselben Latch → kein zweiter Ready.
  ok('A6 TOKEN_REFRESHED/USER_UPDATED teilen den Latch-Pfad',
    /evt\s*===\s*'SIGNED_IN'\s*\|\|\s*evt\s*===\s*'TOKEN_REFRESHED'\s*\|\|\s*evt\s*===\s*'USER_UPDATED'/.test(AUTH)
    && /if\s*\(onAuthed\._initFor\s*===\s*session\.user\.id\)\s*return;/.test(AUTH));

  // Genau eine Zeile Delta gegenüber der eingefrorenen Datei: kein zweiter Lebenszyklus.
  ok('A7 kein zweites Ready-Flag in auth.js',
    !/_authReady|authReady\s*=|orviaReady/.test(AUTH));
}

sec('B · Kein künstliches appweites Loading (Phase 2)');
{
  ok('B1 Boot bleibt synchron (kein defer/async/module in index.html)',
    !/<script[^>]+(defer|async|type=["']module["'])/.test(HTML));
  ok('B2 kein appweiter Spinner/Overlay im Markup',
    !/id=["'](appLoading|bootLoader|globalSpinner)["']/.test(HTML));
  // gmStateLoading darf nur INNERHALB von Renderfunktionen stehen, nie auf Modulebene.
  const modLevel = UI.split('\n').filter(l => /^\s*gmStateLoading\s*\(/.test(l));
  ok('B3 kein gmStateLoading auf Modulebene', modLevel.length === 0, 'gefunden=' + modLevel.length);
}

sec('C · Registrierung im zentralen Helfer (Phase 3)');
{
  const reg = REFRESH.match(/addEventListener\s*\(\s*['"]orvia:auth-ready['"]/g) || [];
  ok('C1 ui-refresh.js registriert orvia:auth-ready genau einmal', reg.length === 1, 'gefunden=' + reg.length);

  const iGuard = REFRESH.indexOf('__orviaUiRefreshBound');
  const iReg = REFRESH.indexOf("addEventListener('orvia:auth-ready'");
  ok('C2 Registrierung liegt im bestehenden Doppel-Load-Guard', iGuard > 0 && iReg > iGuard);

  ok('C3 kein erzwungener Tabwechsel im Refresh-Pfad',
    !/showTab\s*\(/.test(REFRESH_CODE));
  ok('C4 keine zusätzlichen Store-/Netzwerkaufrufe im Refresh-Pfad',
    !/\bfetch\s*\(|hydrate\w*\s*\(|supabase|repos\./.test(REFRESH_CODE));
  ok('C5 keine neue Renderlogik — nur bestehende Renderer über window',
    /RENDERERS\s*=\s*\{[^}]*renderDay[^}]*\}/.test(REFRESH_CODE) && !/innerHTML/.test(REFRESH_CODE));
  ok('C6 ui-refresh.js weiterhin in index.html nach ui.js',
    HTML.indexOf('js/ui-refresh.js') > HTML.indexOf('js/ui.js'));
  ok('C7 ui-refresh.js weiterhin in sw-ASSETS', /ui-refresh\.js/.test(SW));
}

/* ==================================================================
   TEIL D — Laufzeitverhalten des Refresh-Vertrags (Phase 5)
   ================================================================== */
sec('D · Refresh nach abgeschlossener Hydration');
{
  const h = sandbox({ tab: 'heute' });
  const c = stubRenderers(h.sb);
  load(h.sb);
  authReady(h.sb);
  await wait();
  ok('D1 Hydration abgeschlossen → genau EIN UI-Refresh',
    c.avatar === 1 && c.card === 1 && c.day === 1, JSON.stringify(c));
  ok('D2 kein doppelter Render-Loop (Heute genau einmal)', c.day === 1);
}
{
  const h = sandbox({ tab: 'dash' });
  const c = stubRenderers(h.sb);
  load(h.sb);
  authReady(h.sb);
  await wait();
  ok('D3 aktueller Tab bleibt aktiv (dash gerendert, Heute NICHT)',
    c.dash === 1 && c.day === 0, JSON.stringify(c));
}
{
  const h = sandbox({ tab: 'plan' });
  const c = stubRenderers(h.sb);
  load(h.sb);
  authReady(h.sb);
  await wait();
  ok('D4 Plan-Tab bleibt aktiv und wird aktualisiert',
    c.plan === 1 && c.day === 0 && c.dash === 0, JSON.stringify(c));
}
{
  // Profil-/Kernflächen laufen unabhängig vom aktiven Tab.
  const h = sandbox({ tab: 'akt' });
  const c = stubRenderers(h.sb);
  load(h.sb);
  authReady(h.sb);
  await wait();
  ok('D5 fremder Tab: nur Kernflächen, kein fremder Tab-Renderer',
    c.avatar === 1 && c.card === 1 && c.zones === 1 && c.day === 0 && c.plan === 0 && c.dash === 0, JSON.stringify(c));
}
{
  // Hydrierte Daten müssen tatsächlich sichtbar werden: der Renderer liest
  // beim Refresh den bereits hydrierten Zustand (nicht den Boot-Zustand).
  const h = sandbox({ tab: 'heute' });
  let seen = null;
  h.sb.DB = { checkins: null };
  h.sb.renderDay = () => { seen = h.sb.DB.checkins; };
  h.sb.renderTopAvatar = () => {}; h.sb.renderProfileScreen = () => {};
  h.sb.renderZones = () => {}; h.sb.renderPlan = () => {}; h.sb.renderDash = () => {};
  load(h.sb);
  h.sb.DB.checkins = { '2026-07-27': { feel: 8 } };   // Hydration hat stattgefunden
  authReady(h.sb);
  await wait();
  ok('D6 hydrierte Daten sind im Refresh sichtbar', seen && seen['2026-07-27'] && seen['2026-07-27'].feel === 8,
    JSON.stringify(seen));
}
{
  const h = sandbox({ tab: 'heute' });
  const c = stubRenderers(h.sb);
  load(h.sb);
  await wait();
  ok('D7 keine Hydration → kein Refresh, kein falsches Ready-Event',
    c.avatar === 0 && c.day === 0, JSON.stringify(c));
}

sec('E · Konkurrenz, Wiederholung, Listener-Stabilität');
{
  // Ein noch offener profile-updated-Refresh und das nachfolgende auth-ready
  // dürfen zusammen genau EINEN Render ergeben — der jüngere Anlass gewinnt
  // (weitere Ziele), der ältere überschreibt ihn nicht.
  const h = sandbox({ tab: 'dash' });
  const c = stubRenderers(h.sb);
  load(h.sb);
  h.sb.dispatchEvent(new h.sb.CustomEvent('orvia:profile-updated', { detail: { changedSections: ['sports'] } }));
  authReady(h.sb);                                  // jünger, breiter (alle Sektionen)
  await wait();
  ok('E1 konkurrierende Läufe → genau ein Refresh', c.avatar === 1, 'avatar=' + c.avatar);
  ok('E2 jüngerer Lauf wird nicht vom älteren überschrieben (dash gerendert)',
    c.dash === 1, JSON.stringify(c));
}
{
  // Token-Refresh-Szenario: mehrfaches Laden des Scripts + mehrfaches Ready
  // darf keine Listener akkumulieren.
  const h = sandbox({ tab: 'heute' });
  const c = stubRenderers(h.sb);
  load(h.sb); load(h.sb); load(h.sb);
  ok('E3 genau eine auth-ready-Registrierung nach Dreifach-Load',
    (h.wl['orvia:auth-ready'] || []).length === 1, 'n=' + (h.wl['orvia:auth-ready'] || []).length);
  ok('E4 genau eine profile-updated-Registrierung nach Dreifach-Load',
    (h.wl['orvia:profile-updated'] || []).length === 1, 'n=' + (h.wl['orvia:profile-updated'] || []).length);
  authReady(h.sb);
  await wait();
  ok('E5 Dreifach-Load erzeugt trotzdem nur einen Render', c.day === 1, 'day=' + c.day);
}
{
  // Sechs Wiederholungen (Logout/Login-Zyklen): konstante Listener- und Renderzahl.
  const h = sandbox({ tab: 'heute' });
  const c = stubRenderers(h.sb);
  load(h.sb);
  const n0 = (h.wl['orvia:auth-ready'] || []).length;
  for (let i = 0; i < 6; i++) { authReady(h.sb); await wait(); }
  ok('E6 sechs Wiederholungen → Listener-Anzahl konstant',
    (h.wl['orvia:auth-ready'] || []).length === n0, 'n=' + (h.wl['orvia:auth-ready'] || []).length);
  ok('E7 sechs Wiederholungen → genau sechs Renders, keine Akkumulation',
    c.day === 6 && c.avatar === 6, JSON.stringify(c));
}

sec('F · Schutz offener Benutzereingaben (Phase 5)');
{
  // Fokussiertes Eingabefeld im Heute-Host: renderMorning() ersetzt das Formular
  // per innerHTML komplett — der auth-ready-Refresh darf diesen Host auslassen.
  const focused = {
    tagName: 'INPUT', isContentEditable: false,
    closest: sel => (sel.indexOf('#tab-heute') >= 0 ? {} : null)
  };
  const h = sandbox({ tab: 'heute', activeElement: focused });
  const c = stubRenderers(h.sb);
  load(h.sb);
  authReady(h.sb);
  await wait();
  ok('F1 offene Eingabe: Heute wird NICHT überschrieben', c.day === 0, 'day=' + c.day);
  ok('F2 übrige Flächen werden trotzdem aktualisiert',
    c.avatar === 1 && c.card === 1, JSON.stringify(c));
}
{
  // Ohne Fokus keine Schutzwirkung (der Schutz darf nicht generell blockieren).
  const idle = { tagName: 'BODY', isContentEditable: false, closest: () => null };
  const h = sandbox({ tab: 'heute', activeElement: idle });
  const c = stubRenderers(h.sb);
  load(h.sb);
  authReady(h.sb);
  await wait();
  ok('F3 ohne offene Eingabe wird Heute normal aktualisiert', c.day === 1, 'day=' + c.day);
}
{
  // Der Schutz gilt AUSSCHLIESSLICH für den auth-ready-Pfad; ein bewusster
  // Profil-Save muss weiterhin sofort durchschlagen (P1-Vertrag unverändert).
  const focused = { tagName: 'INPUT', isContentEditable: false, closest: () => ({}) };
  const h = sandbox({ tab: 'heute', activeElement: focused });
  const c = stubRenderers(h.sb);
  load(h.sb);
  h.sb.dispatchEvent(new h.sb.CustomEvent('orvia:profile-updated', { detail: { changedSections: ['personal'] } }));
  await wait();
  ok('F4 profile-updated bleibt ungeschützt (P1-Vertrag unverändert)', c.day === 1, 'day=' + c.day);
}

/* ==================================================================
   TEIL G — Die vier echten Async-Grenzen behalten ihre lokalen Skeletons
   ================================================================== */
sec('G · Vier echte Loading-Hosts mit Race-Guard (Phase 2/7)');
{
  const guards = ['_mvReq', '_rcvReq', '_gmAnaReq', '_gmMvReq2'];
  guards.forEach(g => {
    const decl = new RegExp('var\\s+' + g + '\\s*=\\s*0');
    const cmp = new RegExp('!==\\s*' + g);
    ok('G· ' + g + ': Sequenz deklariert und geprüft (Race-Guard)',
      decl.test(UI) && cmp.test(UI));
  });
  const calls = (UI.match(/gmStateLoading\(/g) || []).length - 1;   // minus Definition
  /* Kalibrierung GM7.5i: sechster produktiver Aufruf — Ladezustand der neuen
     Kennzahlenbibliothek (gmOpenMetricsLibrary), gleiches kcard-Skelett wie die Analyse. */
  ok('G5 genau die bekannten produktiven gmStateLoading-Aufrufe', calls === 6, 'calls=' + calls);
  ok('G6 Loading-Zustand ist an einen Promise gebunden (kein Timer-Fake)',
    !/setTimeout\([^)]*gmStateLoading/.test(UI));
}

sec('H · Offline/Cache bleibt vom Hard-Error getrennt');
{
  ok('H1 gmStateError und gmStateEmpty existieren als getrennte Komponenten',
    /function\s+gmStateError\(/.test(UI) && /function\s+gmStateEmpty\(/.test(UI));
  ok('H2 Offline-Pfad rendert keinen Hard-Error (indexeddb bleibt Erfolgspfad)',
    !/offline[^\n]*gmStateError/i.test(UI));
}

console.log('\n' + (fail ? '❌' : '✅') + ' gm61_hydration_contract: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

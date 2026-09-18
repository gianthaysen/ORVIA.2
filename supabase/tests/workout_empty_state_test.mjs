/* ============================================================
   ORVIA · workout_empty_state — v8-395
   ------------------------------------------------------------
   Drei gemeldete Defekte, drei Abschnitte:

     A/B. Der Kraft-Player zeigte im leeren Zustand IMMER nur
          „Noch keine Übung." — auch bei einer als GEPLANT
          gestarteten Einheit. Kopfzeile „Geplant · 0/0 Übungen"
          plus ein Satz ohne Erklaerung liest sich wie ein Defekt,
          obwohl der Plan schlicht keine strukturierte Vorgabe
          traegt (nur Text in item.d). Der Leerzustand muss die
          drei Faelle unterscheiden — aus den Daten, nicht geraten.

     C.   Alle grossen Goldbuttons trugen fast schwarze Schrift auf
          fast schwarzem Grund (pauschale v5-Farbregel gewann gegen
          den spaeteren durchscheinenden .btn-Block).

     D.   Die Uebungskarte lief auf dem Handy aus dem Rahmen
          (.wo-cur-top ohne Umbruch).

     E.   Wortlaut-Kollision: „Readiness 63" direkt ueber „Keine
          kanonische Readiness-Bewertung verfuegbar".

   node supabase/tests/workout_empty_state_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _ex } from 'node:fs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

/* ---- Mini-DOM (wie workout_gym_wiring) ---- */
const ELS = {};
function el(id) {
  const cls = new Set();
  const e = { id, innerHTML: '', textContent: '', value: '', style: {}, onclick: null,
    classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c), toggle: (c, f) => { f ? cls.add(c) : cls.delete(c); } },
    appendChild: () => {}, focus: () => {}, setAttribute: () => {}, querySelectorAll: () => [], querySelector: () => null };
  if (id) ELS[id] = e; return e;
}
global.window = { addEventListener: () => {}, dispatchEvent: () => {}, matchMedia: () => ({ matches: false }) };
global.document = { getElementById: id => ELS[id] || null, createElement: () => el(null), body: { appendChild: e => { if (e.id) ELS[e.id] = e; } },
  addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [], readyState: 'complete', hidden: false };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const _ls = {}; global.localStorage = { getItem: k => (k in _ls ? _ls[k] : null), setItem: (k, v) => { _ls[k] = String(v); }, removeItem: k => { delete _ls[k]; } };
global.todayStr = () => '2026-09-16';
global.getDecision = () => null;
global.toast = () => {};
el('workoutOverlay'); el('workoutPicker'); el('woLast'); el('woSuggest');
const load = f => (0, eval)(rd(f));
load('js/repos/repoBase.js'); load('js/training-domain.js'); load('js/workout-store.js');
globalThis.ORVIA = global.window.ORVIA;
load('js/i18n.js'); load('locales/de.js');   /* Reihenfolge wie im Browser: Katalog vor den UI-Modulen */
load('js/workout-ui.js');
const O = global.window.ORVIA, WS = O.workoutStore, UI = O.workoutUI;
O.user = { id: 'u1' };
O.repos = O.repos || {};
O.repos.workout = {
  getActiveSession: async () => ({ success: true, data: null, error: null, source: 'empty', sync_status: 'synced' }),
  createSession: async (s) => ({ success: true, data: { id: 'sess1', status: 'active', local_date: s.localDate, started_at: s.started_at || new Date().toISOString(), sport: s.sport, client_session_id: s.clientSessionId }, error: null, source: 'supabase', sync_status: 'synced' })
};
const ov = ELS.workoutOverlay;
const tick = () => new Promise(r => setTimeout(r, 5));

const PLAN_TEXT = 'Oberkörper · Push, moderat';
const snapText = { occurrenceId: 'occ1', plannedDate: '2026-09-16', t: 'Krafttraining', l: 'Kraft A', d: PLAN_TEXT };
const snapEx = Object.assign({}, snapText, { plannedExercises: [{ slug: 'bench_press' }, { slug: 'barbell_row' }] });

sec('A · Leerzustand unterscheidet die drei Faelle');
{
  UI._planNote = null;
  const free = UI._emptyState({ id: 's', sport: 'Gym' });
  ok('A1 freies Training: unveraenderter Satz', free.kind === 'free' && free.text === 'Noch keine Übung.' && free.plan === null, JSON.stringify(free));

  const p1 = UI._emptyState({ id: 's', planned_session_id: 'occ1' });
  ok('A2 geplant ohne Snapshot → Erklaerung statt „Noch keine Übung."',
    p1.kind === 'planned_text' && /nur als Text/.test(p1.text) && p1.text !== 'Noch keine Übung.', p1.text);

  const p2 = UI._emptyState({ id: 's', planned_session_id: 'occ1', planned_session_snapshot: snapText });
  ok('A3 Plantext wird aus dem Snapshot gezeigt (reload-fest)', p2.kind === 'planned_text' && p2.plan === PLAN_TEXT, String(p2.plan));

  const p3 = UI._emptyState({ id: 's', planned_session_id: 'occ1', planned_session_snapshot: snapEx });
  ok('A4 Plan MIT Uebungen, aber Player leer → ehrlicher Fehlerfall mit Anzahl',
    p3.kind === 'planned_failed' && p3.count === 2 && /2 Übungen/.test(p3.text), p3.text);

  UI._planNote = PLAN_TEXT;
  const p4 = UI._emptyState({ id: 's', planned_session_id: 'occ1', planned_session_snapshot: snapText });
  ok('A5 keine Dopplung: steht der Plantext schon im Kopf, wiederholt ihn der Leerzustand nicht', p4.plan === null);
  UI._planNote = null;

  const p5 = UI._emptyState({ id: 's', plannedSessionSnapshot: snapText });
  ok('A6 camelCase-Schreibweise (lokale Session) wird ebenso erkannt', p5.kind === 'planned_text' && p5.plan === PLAN_TEXT);

  ok('A7 kein Roh-Key im Ergebnis (Katalogtexte aufgeloest)', !/^wo\./.test(free.text) && !/^wo\./.test(p2.text));
}

sec('B · Der Player rendert den Leerzustand');
{
  const r = await WS.startFreeWorkout({ sport: 'Gym' });
  ok('B0 Session gestartet', r.success);
  UI.open(); await tick();
  ok('B1 frei: unveraendert', ov.innerHTML.indexOf('Noch keine Übung.') >= 0 && ov.innerHTML.indexOf('wo-empty free') >= 0);
  ok('B2 „Übung hinzufügen" bleibt erreichbar', ov.innerHTML.indexOf('pickExercise()') >= 0 && ov.innerHTML.indexOf('Übung hinzufügen') >= 0);

  const sess = WS.state().session;
  sess.planned_session_id = 'occ1'; sess.planned_session_snapshot = snapText;
  UI._planNote = null; UI._render(); await tick();
  const html = ov.innerHTML;
  ok('B3 geplant/Text: Erklaerung im HTML', /nur als Text/.test(html) && html.indexOf('wo-empty planned_text') >= 0);
  ok('B4 Plantext sichtbar', html.indexOf(PLAN_TEXT) >= 0 && html.indexOf('wo-empty-plan') >= 0);
  ok('B5 Button weiterhin da', html.indexOf('pickExercise()') >= 0);
  ok('B6 kein roher i18n-Key im gerenderten Leerzustand', !/wo\.empty/.test(html.replace(/onclick="[^"]*"/g, '')));

  sess.planned_session_snapshot = snapEx; UI._render(); await tick();
  ok('B7 geplant/Uebungen fehlen: Fehlerfall statt stiller Leere',
    /konnte übernommen werden/.test(ov.innerHTML) && ov.innerHTML.indexOf('wo-empty planned_failed') >= 0);
}

sec('C · Goldbuttons: Schrift wieder lesbar');
{
  const css = rd('styles.css').replace(/\/\*[\s\S]*?\*\//g, '');   /* Kommentare zaehlen nicht als Regel */
  ok('C1 pauschale v5-Farbregel ist weg', css.indexOf('.btn:not(.sec):not(.gline){color:#20180a}') < 0 && !/\.btn:not\(\.sec\):not\(\.gline\)\s*\{[^}]*color:\s*#20180a/.test(css));
  ok('C2 durchscheinender .btn-Block behaelt helle Schrift', /\.btn\{background:linear-gradient\(180deg,rgba\(201,174,124,\.15\)[\s\S]{0,120}color:#E9DCBE/.test(css));
  ok('C3 echte Goldflaechen erklaeren ihre dunkle Schrift selbst',
    css.indexOf('.cta.prim{background:var(--gold-grad);color:#20180a') >= 0 &&
    css.indexOf('.sheet-cta .prim{background:var(--gold-grad);color:#231a09}') >= 0 &&
    css.indexOf('.segs button.on{color:#20180a}') >= 0);
}

sec('D · Uebungskarte laeuft nicht mehr aus dem Rahmen');
{
  const css = rd('styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const top = (css.match(/\.wo-cur-top\{[^}]*\}/) || [''])[0];
  const name = (css.match(/\.wo-exname\{[^}]*\}/) || [''])[0];
  const act = (css.match(/\.wo-exact\{[^}]*\}/) || [''])[0];
  ok('D1 .wo-cur-top bricht um', /flex-wrap:wrap/.test(top), top);
  ok('D2 .wo-exname darf schrumpfen und umbrechen', /min-width:0/.test(name) && /overflow-wrap:anywhere/.test(name), name);
  ok('D3 .wo-exact bricht um', /flex-wrap:wrap/.test(act), act);
  ok('D4 <=430px: Name und Aktionen jeweils volle Zeile', /@media \(max-width:430px\)\{[\s\S]{0,200}\.wo-exname\{flex:1 1 100%\}/.test(css));
}

sec('E · Readiness-Wortlaut kollidiert nicht mehr');
{
  const de = rd('locales/de.js');
  const v = (de.match(/'ui\.keine_kanonische_readiness_bewertung_verfuegbar':\s*'([^']*)'/) || [])[1] || '';
  ok('E1 Text spricht von fehlender EMPFEHLUNG, nicht von fehlender Readiness', /Trainingsempfehlung/.test(v) && !/Keine kanonische Readiness-Bewertung verfügbar/.test(v), v);
  ok('E2 Hinweis erfindet weiterhin nichts', /leitet aus dem Readiness-Wert allein keine ab/.test(v), v);
}

console.log('\n' + (fail ? '❌' : '✅') + ' ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

/* ============================================================
   ORVIA · AD1 — Vertragstest: kanonischer Activity-Detail-Einstieg
   (AD1a: rot bewiesen · AD1b: Zielvertrag erfüllt → grün)

   Prüft VERHALTENSBASIERT mit echtem Produktivcode (vm-Sandboxes, kein
   Nachbau der Logik), dass ORVIA EINEN kanonischen, activity-id-basierten
   Detail-Einstieg besitzt: ein Renderer, ein Overlay-Owner, ein Löschpfad;
   alle Einstiege sind Adapter; Plan-Klick öffnet eine echte Aktivität nur bei
   eindeutigem Plan–Actual-Link (keiner/mehrdeutig → keine Blind-Auswahl).

   Geladen wird echter Code:
   - app/js/activity.js            (openActivityDetail/activityDetailViewModel/
                                     renderActivityDetail/closeActivityDetail/
                                     deleteActivityCanonical/resolvePlannedActivity + Adapter)
   - app/js/activity-normalize.js  (REAL, default-Export)
   - app/js/ui.js (Ausschnitte)    (planEntryClick + openUnit + markPlannedDone)

   [S] Setup · [G] grüner Vertrag/Diagnose · frühere [R] sind nach AD1b grün.
   node supabase/tests/activity_detail_ad1_contract_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const base = new URL('../../../app/js/', import.meta.url);
let pass = 0, fail = 0;
const results = [];
const ok = (n, c, info) => { console.log((c ? '✅' : '❌') + ' ' + n + (info != null ? '  — ' + info : '')); results.push({ n, c }); c ? pass++ : fail++; };

const AN = (await import(new URL('activity-normalize.js', base))).default;

/* Realer Store für den EHRLICHEN Plan-Link-Reload (AD1c): der Link wird über den echten
   Upsert-/Persist-/Read-Pfad erzeugt, nicht als Feld auf ein Objekt gesetzt. */
const _mem = {};
globalThis.ORVIA = { user: { id: 'u1' }, activityNormalize: AN, trainingDomain: { normSport: (v) => String(v || '').toLowerCase() } };
globalThis.localStorage = { getItem: (k) => (k in _mem ? _mem[k] : null), setItem: (k, v) => { _mem[k] = String(v); }, removeItem: (k) => { delete _mem[k]; } };
const RealStore = (await import(new URL('activity-store.js', base))).default;
function realReloaded(sessions) {
  for (const k of Object.keys(_mem)) delete _mem[k];
  for (const s of sessions) RealStore.upsertActivityFromWorkout(s, [{ name: 'X' }], { syncStatus: 'pending' });
  const blob = _mem['orvia_activities_u1'];
  for (const k of Object.keys(_mem)) delete _mem[k];  // frisches Gerät ohne Vorwissen
  _mem['orvia_activities_u1'] = blob;
  return RealStore.listActivities();
}
const _mkSess = (id, occ) => ({ id, sport: 'Gym', sport_key: 'gym', status: 'completed', local_date: '2026-07-01', started_at: '2026-07-01T18:00:00.000Z', finished_at: '2026-07-01T18:45:00.000Z', duration_min: 45, session_rpe: 6, planned_session_id: occ });

/* ---------- Minimaler DOM-Stub ---------- */
function makeEl(tag) {
  const node = {
    tag, className: '', style: {}, dataset: {}, id: '', children: [], _html: '', _parent: null, _removed: false,
    appendChild(c) { c._parent = this; this.children.push(c); },
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    remove() { this._removed = true; if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  };
  Object.defineProperty(node, 'innerHTML', { get() { return this._html; }, set(v) { this._html = String(v); } });
  return node;
}
function makeDocument() {
  const body = makeEl('body');
  body.classList = { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } };
  return { createElement: makeEl, body, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, documentElement: { classList: { add() {}, remove() {} } } };
}
function detailOverlaysIn(body) { return body.children.filter((c) => c.className === 'orvia-modal-bg'); }

/* ================= Sandbox A — activity.js ================= */
function normSportStub(t) { const M = { 'Laufen': 'running', 'Rad': 'cycling', 'Schwimmen': 'swimming', 'Gym': 'gym' }; return M[t] || String(t || '').toLowerCase(); }
function makeActivitySandbox(seed, DB) {
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.console = console; sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Object = Object;
  sb.Array = Array; sb.String = String; sb.Number = Number; sb.Set = Set; sb.Map = Map;
  sb.CustomEvent = function (t, o) { this.type = t; this.detail = o && o.detail; };
  sb.document = makeDocument();
  sb.addEventListener = () => {};
  sb.escH = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  sb.toast = (m) => { (sb._toasts = sb._toasts || []).push(m); };
  sb.fmtDate = (s) => s;
  sb.save = () => {};
  sb.orviaConfirm = (o) => { if (o && typeof o.onOk === 'function') o.onOk(); };  // Auto-Bestätigung
  sb.isDay = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k);
  sb.DB = DB;
  sb._workoutUICalls = [];
  sb._storeDeleteCalls = [];
  sb._storeList = [];
  const store = {
    getActivityById: (id) => (seed[id] || null),
    getActivityBySource: (source, srcId) => { for (const k in seed) { const a = seed[k]; if (a && a.source === source && a.sourceRecordId === srcId) return a; } return null; },
    getWorkoutDetailsForActivity: () => ({ ok: false, hasDetails: false }),
    isTombstoned: () => false,
    listActivities: () => (sb._storeList || []),
    deleteActivity: (id) => { sb._storeDeleteCalls.push(id); }
  };
  sb.ORVIA = {
    user: { id: 'u:test' },
    activityStore: store,
    activityNormalize: AN,
    activityConfig: {
      sportLabel: (id) => String(id), enumLabel: (k, v) => v, sportIcon: () => 'pulse',
      legacySessionToActivity: (date, type, sess) => {
        sess = sess || {}; const sportId = normSportStub(type); const summary = {};
        if (sess.dist != null) { if (sportId === 'swimming') summary.distanceM = sess.dist; else summary.distanceKm = sess.dist; }
        if (sess.hr != null) summary.avgHr = sess.hr;
        return { id: null, clientRecordId: 'legacy:' + date + ':' + sportId, userId: 'u:test', sportId, source: 'legacy_local', sourceRecordId: date + ':' + sportId, startedAt: date + 'T00:00:00.000Z', endedAt: null, durationSeconds: (sess.dur != null ? Math.round(sess.dur * 60) : null), status: 'completed', summary, workoutSnapshot: null, syncStatus: 'local', _legacy: { date, type } };
      }
    },
    workoutUI: { openDetails: (id, aid) => { sb._workoutUICalls.push([id, aid]); } },   // Alt-Sink-Spy (darf nach AD1b NIE feuern)
    activitySync: { flushPendingActivities: () => {} },
    repos: {}
  };
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('activity.js', base), 'utf8'), sb, { filename: 'activity.js' });
  return sb;
}

/* ================= Sandbox B/C — ui.js (Plan-Klick + Plan-Erledigung) ================= */
const _uiSrc = readFileSync(new URL('ui.js', base), 'utf8');
const _cutAfterMPD = _uiSrc.indexOf('/* Wochenziele NICHT mehr aus festen Defaults');
const _cutPlanPresets = _uiSrc.indexOf('var PLAN_PRESETS');
if (_cutAfterMPD < 0 || _cutPlanPresets < 0) throw new Error('Slice-Marker in ui.js nicht gefunden');
const SLICE_UNIT = _uiSrc.slice(0, _cutAfterMPD);   // enthält planEntryClick + openUnit
const SLICE_DONE = _uiSrc.slice(0, _cutPlanPresets) + '\n' + _uiSrc.slice(_uiSrc.indexOf('function markPlannedDone'), _cutAfterMPD);
function buildPlanSandbox(slice) {
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.console = console; sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Object = Object;
  sb.Array = Array; sb.String = String; sb.Number = Number; sb.Set = Set; sb.Map = Map;
  sb.document = makeDocument();
  sb.todayStr = (d) => { const x = d || new Date('2026-07-15T12:00'); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  sb.goalOf = () => ({ type: 'half_marathon', raceDate: '2026-09-06' });
  sb.Calc = { paceZones: () => null, fmtPace: (x) => String(x), fmtDuration: (v) => String(v), runnaWeek: () => 1, paceStr: () => '' };
  sb.escH = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  sb.toast = (m) => { (sb._toasts = sb._toasts || []).push(m); };
  sb.saveProfile = () => {}; sb.save = () => { sb._saved = (sb._saved || 0) + 1; return true; };
  sb.DB = {}; sb.entry = (d) => (sb.DB[d] = sb.DB[d] || {});
  sb.PROFILE = { sports: [{ sportId: 'running', activeInApp: true }], issues: [], trainingDays: null, weekPlan: [[], [], [{ id: 'ps:tmplX', t: 'Gym', l: 'Ganzkörper', d: '45 min' }], [], [], [], []] };
  sb.ORVIA = { profileModel: { canonGoalCategory: (t) => t, primarySportLevel: () => 'intermediate', effectiveTrainingConfig: () => ({ availableDayIdx: [0, 1, 2, 3, 4, 5, 6], targetDays: 3, daysSource: 'availability' }) } };
  // Plan-Klick-Spies: kanonischer Activity-Detail-Namespace.
  sb._planResolve = { status: 'none' };
  sb._openDetailCalls = [];
  sb.ORVIA.activityUI = {
    resolvePlannedActivity: () => sb._planResolve,
    openActivityDetail: (id, ctx) => { sb._openDetailCalls.push([id, ctx]); }
  };
  sb._oModalCalls = [];
  sb.oModal = (title, body, foot) => { sb._oModalCalls.push({ title, body, foot }); };
  sb.closeSupp = () => {}; sb.renderDay = () => {}; sb.renderWeekPlan = () => {}; sb.openPlanEditor = () => {}; sb.getDecision = () => null;
  vm.createContext(sb);
  vm.runInContext(slice, sb, { filename: 'ui.js#slice' });
  return sb;
}

/* ================= Fixtures ================= */
const importActivity = { id: 'a:imp', clientRecordId: 'a:imp', source: 'import', sportId: 'running', startedAt: '2026-07-01T09:00:00', durationSeconds: 3000, summary: { distanceKm: 10, avgHr: 150, caloriesKcal: 600, elevationM: 120, name: 'Import-Lauf' }, metrics: {} };
const workoutActivity = { id: 'a:wk', clientRecordId: 'a:wk', source: 'orvia_workout', workoutSessionId: 'sess:1', sourceRecordId: 'sess:1', sportId: 'gym', startedAt: '2026-07-01T18:00:00', durationSeconds: 2700, summary: {}, metrics: {}, workoutSnapshot: { exercises: [] } };
const DB_A = { '2026-07-01': { sessions: { Laufen: { dist: 10, dur: 50, hr: 150, source: 'live', note: 'Legacy-Lauf' } } }, '2026-07-02': { sessions: { Laufen: { dist: 8, dur: 42, hr: 148 } } } };

/* ================= Setup ================= */
const A = makeActivitySandbox({ 'a:imp': importActivity, 'a:wk': workoutActivity }, DB_A);
ok('[S1] activity.js geladen (openActivityDetail kanonisch vorhanden)', typeof A.openActivityDetail === 'function' && !!(A.ORVIA.activityUI && A.ORVIA.activityUI.openActivityDetail));
ok('[S2] activity-normalize.js REAL geladen', typeof AN.activityDetailModel === 'function');
const P = buildPlanSandbox(SLICE_UNIT);
const PM = buildPlanSandbox(SLICE_DONE);
ok('[S3] ui.js Plan-Ausschnitte geladen (planEntryClick + openUnit + markPlannedDone)', typeof P.planEntryClick === 'function' && typeof P.openUnit === 'function' && typeof PM.markPlannedDone === 'function');

/* ================= Zielvertrag (nach AD1b grün) ================= */
// Hilfsfunktion: Einstieg treiben, Renderer-Sink + geöffnete Activity-ID beobachten.
function drive(fn) { A.closeActivityDetail(); A._workoutUICalls.length = 0; let r; try { r = fn(); } catch (e) { return { err: e.message }; } const ov = A.window._activityDetailOverlay; return { ret: r, wuiCalls: A._workoutUICalls.length, overlay: ov, id: ov && ov.dataset.activityId, ctx: ov && ov.dataset.context, unavailable: ov && ov.dataset.unavailable === '1' }; }

// AD1-1: Workout- und Import-Einstieg nutzen DENSELBEN Renderer (kanonisches Overlay), Alt-Workout-Sink schweigt.
const wk = drive(() => A.openActivityDetails('a:wk'));
const imp = drive(() => A.openActivityDetails('a:imp'));
ok('[AD1-1] Workout- und Import-Einstieg nutzen denselben kanonischen Renderer, Alt-Workout-Sink feuert nie',
  !!wk.overlay && !!imp.overlay && wk.wuiCalls === 0 && imp.wuiCalls === 0 && wk.id === 'a:wk' && imp.id === 'a:imp',
  'wkId=' + wk.id + ' impId=' + imp.id + ' wuiTotal=' + (wk.wuiCalls + imp.wuiCalls));

// AD1-2: jeder Einstieg per kanonischer ID auflösbar; Datum-only ⇒ fail-closed (keine Blind-Auswahl).
const legById = drive(() => A.openActivityDetail('legacy:2026-07-01:running', 'legacy_adapter'));
const bareDate = drive(() => A.openActivityDetail('2026-07-01', 'legacy_adapter'));
ok('[AD1-2] Legacy per kanonischer ID öffnet; bloßes Datum ⇒ fail-closed (unavailable), kein Blind-Pick',
  legById.id === 'legacy:2026-07-01:running' && bareDate.unavailable === true && bareDate.ret && bareDate.ret.ok === false,
  'legId=' + legById.id + ' bareUnavailable=' + bareDate.unavailable);

// AD1-3 (aktualisiert): Cloud/Import-Detail kommt aus dem EINEN View-Model-Renderer (Overlay trägt data-activity-id, Summary-Zeilen).
const impHtml = imp.overlay ? imp.overlay.innerHTML : '';
ok('[AD1-3] Cloud/Import-Detail wird vom kanonischen View-Model-Renderer erzeugt (data-activity-id + wc-stats)',
  imp.id === 'a:imp' && /wc-stats/.test(impHtml) && /Import-Lauf/.test(impHtml),
  'id=' + imp.id + ' hatStats=' + /wc-stats/.test(impHtml));

// AD1-4 (aktualisiert): Legacy-Einstieg löst auf kanonische ID auf und nutzt DENSELBEN Renderer (kein separater DB-Struktur-Renderer).
const legacyEntry = drive(() => A.openActivity('2026-07-01', 'Laufen'));
ok('[AD1-4] Legacy-Einstieg (Datum,Typ) → kanonische ID im gemeinsamen Renderer (Kontext legacy_adapter)',
  legacyEntry.id === 'legacy:2026-07-01:running' && legacyEntry.ctx === 'legacy_adapter' && legacyEntry.wuiCalls === 0,
  'id=' + legacyEntry.id + ' ctx=' + legacyEntry.ctx);

// AD1-5 (aktualisiert): Plan-Klick — eindeutig → kanonische Activity öffnen; keiner → nur Vorgabe; mehrdeutig → keine Auto-Auswahl.
P._planResolve = { status: 'unique', id: 'a:linked' }; P._openDetailCalls.length = 0; P._oModalCalls.length = 0;
try { P.planEntryClick(2, 0); } catch (e) { ok('[AD1-5u] planEntryClick unique wirft nicht', false, e.message); }
const uniqueOpened = P._openDetailCalls.length === 1 && P._openDetailCalls[0][0] === 'a:linked' && P._openDetailCalls[0][1] === 'plan' && P._oModalCalls.length === 0;
P._planResolve = { status: 'none' }; P._openDetailCalls.length = 0; P._oModalCalls.length = 0;
try { P.planEntryClick(2, 0); } catch (e) {}
const noneShowsSpec = P._openDetailCalls.length === 0 && P._oModalCalls.length === 1;
P._planResolve = { status: 'ambiguous', ids: ['a:1', 'a:2'] }; P._openDetailCalls.length = 0; P._oModalCalls.length = 0;
try { P.planEntryClick(2, 0); } catch (e) {}
const ambiguousNoAutoOpen = P._openDetailCalls.length === 0 && P._oModalCalls.length === 1;
ok('[AD1-5] Plan-Klick: eindeutig→Activity(plan), keiner→Vorgabe, mehrdeutig→keine Auto-Auswahl',
  uniqueOpened && noneShowsSpec && ambiguousNoAutoOpen,
  'unique=' + uniqueOpened + ' none=' + noneShowsSpec + ' ambiguous=' + ambiguousNoAutoOpen);

// AD1-6 (AD1c-ehrlich): resolvePlannedActivity auf ECHT persistierten/reloaded Activities.
const listU = realReloaded([_mkSess('sess:link', 'po:X')]);
A._storeList = listU;
const linkedId = listU[0] && (listU[0].clientRecordId || listU[0].id);
const rUnique = A.resolvePlannedActivity('po:X');
const rNone = A.resolvePlannedActivity('po:MISSING');
const listAmb = realReloaded([_mkSess('sess:a1', 'po:Y'), _mkSess('sess:a2', 'po:Y')]);
A._storeList = listAmb;
const rAmb = A.resolvePlannedActivity('po:Y');
ok('[AD1-6] resolvePlannedActivity auf real reloaded Activities: eindeutig→id, keiner→none, mehrdeutig→ambiguous',
  rUnique.status === 'unique' && rUnique.id === linkedId && rNone.status === 'none' && rAmb.status === 'ambiguous' && (rAmb.ids || []).length === 2,
  JSON.stringify({ u: rUnique.status, id: rUnique.id === linkedId, n: rNone.status, a: rAmb.status }));

// AD1-7: EIN Overlay-Owner — zweimaliges Öffnen ⇒ genau ein Overlay; ein Close entfernt es.
A.closeActivityDetail();
A.openActivityDetail('a:imp', 'training');
A.openActivityDetail('a:imp', 'training');
const overlaysAfterTwoOpens = detailOverlaysIn(A.document.body).length;
A.closeActivityDetail();
const overlaysAfterClose = detailOverlaysIn(A.document.body).length;
ok('[AD1-7] EIN Overlay-Owner: zweimaliges Öffnen = genau ein Overlay; ein Close entfernt es',
  overlaysAfterTwoOpens === 1 && overlaysAfterClose === 0 && !A.window._activityDetailOverlay,
  'nachZweiOeffnen=' + overlaysAfterTwoOpens + ' nachClose=' + overlaysAfterClose);

// AD1-8: EIN Löschpfad — Legacy- und kanonische Löschung laufen über activityStore.deleteActivity.
A._storeDeleteCalls.length = 0;
try { A.deleteActivity('2026-07-02', 'Laufen'); } catch (e) {}   // Legacy-Adapter
const legacyViaStore = A._storeDeleteCalls.indexOf('legacy:2026-07-02:running') >= 0;
try { A.deleteActivityCanonical('a:imp'); } catch (e) {}          // kanonisch
const canonViaStore = A._storeDeleteCalls.indexOf('a:imp') >= 0;
ok('[AD1-8] EIN Löschpfad: Legacy- UND kanonische Löschung über activityStore.deleteActivity',
  legacyViaStore && canonViaStore, 'legacyÜberStore=' + legacyViaStore + ' canonÜberStore=' + canonViaStore + ' calls=' + JSON.stringify(A._storeDeleteCalls));

// AD1-9: derselbe Datensatz ergibt einstiegsunabhängig dasselbe View-Model/Overlay.
const viaDispatcher = drive(() => A.openActivityDetails('a:wk'));
const viaDirect = drive(() => A.renderGeneralActivityDetails(A.ORVIA.activityStore.getActivityById('a:wk')));
const vmA = JSON.stringify(A.activityDetailViewModel(workoutActivity));
const vmB = JSON.stringify(A.activityDetailViewModel(A.ORVIA.activityStore.getActivityById('a:wk')));
ok('[AD1-9] Derselbe Datensatz (a:wk): gleiche Activity-ID + identisches View-Model, egal welcher Einstieg',
  viaDispatcher.id === 'a:wk' && viaDirect.id === 'a:wk' && vmA === vmB,
  'dispatcher=' + viaDispatcher.id + ' direct=' + viaDirect.id + ' vmGleich=' + (vmA === vmB));

// Fail-closed: unbekannte ID.
const missing = drive(() => A.openActivityDetail('does-not-exist', 'training'));
ok('[G-failclosed] Unbekannte Activity-ID ⇒ fail-closed (unavailable, ok:false), kein Throw, kein Blind-Pick',
  missing.unavailable === true && missing.ret && missing.ret.ok === false && missing.ret.code === 'activity_not_found',
  'code=' + (missing.ret && missing.ret.code));

// Diagnose: markPlannedDone erfindet keine tatsächliche Aktivität (kein Activity-Link im plan_done-Record).
PM.markPlannedDone('Gym', 2, 0);
const rec = (function () { try { return PM.DB[PM.todayStr()].sessions['Gym']; } catch (e) { return null; } })();
const LINK = ['activityId', 'actualActivityId', 'linkedActivityId', 'clientRecordId'];
ok('[G-mpd] markPlannedDone erzeugt keinen erfundenen Ist-Activity-Link (source=plan_done, nur Plan-Anker)',
  !!rec && rec.source === 'plan_done' && !LINK.some((k) => rec[k] != null),
  rec ? JSON.stringify(Object.keys(rec)) : 'null');

// AD1-10: Aggregat des kanonischen Zielvertrags.
const contract = {
  einRenderer: wk.wuiCalls === 0 && imp.wuiCalls === 0 && !!wk.overlay && !!imp.overlay,
  idBasiert: legById.id === 'legacy:2026-07-01:running' && bareDate.unavailable === true,
  planKlick: uniqueOpened && noneShowsSpec && ambiguousNoAutoOpen,
  einClose: overlaysAfterTwoOpens === 1 && overlaysAfterClose === 0,
  einDelete: legacyViaStore && canonViaStore,
  identisch: vmA === vmB,
  failClosed: missing.unavailable === true
};
ok('[AD1-10] Kanonischer Zielvertrag insgesamt erfüllt', Object.values(contract).every(Boolean), JSON.stringify(contract));

/* ================= Trailer ================= */
console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
const clean = fail === 0;
console.log('AD1-SELBSTPRÜFUNG: ' + (clean
  ? 'GRÜN — kanonischer Activity-Detail-Vertrag erfüllt (ein Einstieg/Renderer/Overlay/Löschpfad, ID-basiert, Plan-Link eindeutig/keiner/mehrdeutig ohne Blind-Auswahl).'
  : 'ABWEICHUNG — ' + fail + ' Assertion(en) rot, bitte prüfen.'));

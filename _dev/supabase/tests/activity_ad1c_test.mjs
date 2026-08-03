/* ============================================================
   ORVIA · AD1c — Korrektur-/Abnahme-Vertragstest (drei Punkte)
   1) Plan–Actual REAL end-to-end: der Link muss über den echten Store-/Upsert-/
      Reload-Pfad persistieren (nicht nur auf präparierten Testobjekten).
   2) Cloud-only-Workoutdetails: asynchrones Nachladen in DENSELBEN Renderer/Overlay.
   3) Story-Zugang: bestehende Legacy-Story bleibt erreichbar, nur bei eindeutiger
      Legacy-Verknüpfung, kein Blind-Tages-/Sportvergleich.

   Vor dem AD1c-Fix ist dieser Test ROT (Link wird am Workout→Activity-Übergang
   verworfen; Cloud-Detail fehlt; kein Story-Button). Nach dem Fix GRÜN.
   node supabase/tests/activity_ad1c_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const base = new URL('../../../app/js/', import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, info) => { console.log((c ? '✅' : '❌') + ' ' + n + (info != null ? '  — ' + info : '')); c ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Echter Store + Normalizer (globalThis, wie activity_store_test) ---------- */
const mem = {};
globalThis.ORVIA = { user: { id: 'u1' } };
globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
globalThis.ORVIA.activityNormalize = (await import(new URL('activity-normalize.js', base))).default;
globalThis.ORVIA.trainingDomain = { normSport: (v) => String(v || '').toLowerCase() };
const Store = (await import(new URL('activity-store.js', base))).default;
const AKEY = 'orvia_activities_u1';

/* ================= 1) Plan–Actual REAL end-to-end ================= */
// Device A: Workout mit Plan-Occurrence-ID → Activity über den ECHTEN Upsert-Pfad.
const sessionA = { id: 'sess:1', client_session_id: 'cs:1', sport: 'Gym', sport_key: 'gym', status: 'completed', local_date: '2026-07-01', started_at: '2026-07-01T18:00:00.000Z', finished_at: '2026-07-01T18:45:00.000Z', duration_min: 45, session_rpe: 6, planned_session_id: 'po:2026-07-01:ps:tmplX' };
const arA = Store.upsertActivityFromWorkout(sessionA, [{ name: 'Kniebeuge', sets: 3, reps: 8 }], { syncStatus: 'pending' });
ok('[E1] Upsert erzeugt Activity', !!(arA && arA.ok && arA.activity));
ok('[E2] REAL: Activity persistiert Plan-Link (metrics.plannedSessionId aus der Session)',
  !!(arA && arA.activity && arA.activity.metrics && arA.activity.metrics.plannedSessionId === 'po:2026-07-01:ps:tmplX'),
  'metrics=' + JSON.stringify(arA && arA.activity && arA.activity.metrics));

// Serialisieren + „zweites Gerät": frischer Read-Pfad aus dem persistierten Blob.
const blob = mem[AKEY];
for (const k of Object.keys(mem)) delete mem[k];   // Gerät B: kein Vorwissen
mem[AKEY] = blob;
const devB = Store.listActivities();
const reloaded = devB.find((a) => a.sourceRecordId === 'sess:1');
ok('[E3] Reload/Zweitgerät: Activity über echten Read-Pfad geladen', !!reloaded);
ok('[E4] REAL: Plan-Link überlebt Reload (metrics.plannedSessionId erhalten)',
  !!(reloaded && reloaded.metrics && reloaded.metrics.plannedSessionId === 'po:2026-07-01:ps:tmplX'),
  'metrics=' + JSON.stringify(reloaded && reloaded.metrics));

// Cloud-Hydrate-Pfad (mergeServerActivities): Plan-Link im metrics-jsonb überlebt Server-Row.
for (const k of Object.keys(mem)) delete mem[k];
Store.mergeServerActivities([{ id: 'srv-uuid-cloud', client_record_id: 'a:cloud', sport_id: 'gym', source: 'orvia_workout', source_record_id: 'sess:2', started_at: '2026-07-02T18:00:00.000Z', duration_seconds: 2700, status: 'completed', summary: {}, metrics: { plannedSessionId: 'po:2026-07-02:ps:tmplY' } }]);
const cloudAct = Store.getActivityBySource('orvia_workout', 'sess:2');
ok('[E5] Cloud-Hydrate: Plan-Link im metrics-jsonb überlebt Server→Client',
  !!(cloudAct && cloudAct.metrics && cloudAct.metrics.plannedSessionId === 'po:2026-07-02:ps:tmplY'));

/* ---------- Resolver auf ECHT reloaded Activities (activity.js-Sandbox) ---------- */
function makeEl(tag) {
  const n = {
    tag, className: '', style: {}, dataset: {}, id: '', children: [], _html: '', _parent: null,
    appendChild(c) { c._parent = this; this.children.push(c); },
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  };
  Object.defineProperty(n, 'innerHTML', { get() { return this._html; }, set(v) { this._html = String(v); } });
  return n;
}
function makeDocument() {
  const body = makeEl('body');
  body.classList = { add() {}, remove() {}, contains() { return false; } };
  return { createElement: makeEl, body, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, documentElement: { classList: { add() {}, remove() {} } } };
}
function detailOverlays(body) { return body.children.filter((c) => c.className === 'orvia-modal-bg'); }
const AN = globalThis.ORVIA.activityNormalize;

function makeActSandbox(opts) {
  opts = opts || {};
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.console = console; sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Object = Object; sb.Array = Array; sb.String = String; sb.Number = Number; sb.Set = Set; sb.Map = Map; sb.Promise = Promise; sb.setTimeout = setTimeout;
  sb.CustomEvent = function (t, o) { this.type = t; this.detail = o && o.detail; };
  sb.document = makeDocument(); sb.addEventListener = () => {};
  sb.escH = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  sb.toast = () => {}; sb.fmtDate = (s) => s; sb.save = () => {}; sb.isDay = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k);
  sb.orviaConfirm = (o) => { if (o && o.onOk) o.onOk(); };
  sb.DB = opts.DB || {};
  sb._storeList = opts.storeList || [];
  const seed = opts.seed || {};
  const store = {
    getActivityById: (id) => seed[id] || (sb._storeList || []).find((a) => (a.clientRecordId || a.id) === id) || null,
    getActivityBySource: (src, sid) => (sb._storeList || []).find((a) => a.source === src && a.sourceRecordId === sid) || null,
    getWorkoutDetailsForActivity: (id) => (opts.workoutDetails ? opts.workoutDetails(id) : { ok: false, hasDetails: false }),
    isTombstoned: () => false, listActivities: () => (sb._storeList || []), deleteActivity: () => {}
  };
  sb.ORVIA = {
    user: { id: 'u1' }, activityStore: store, activityNormalize: AN,
    activityConfig: { sportLabel: (id) => String(id), enumLabel: (k, v) => v, sportIcon: () => 'pulse', legacySessionToActivity: (date, type) => ({ clientRecordId: 'legacy:' + date + ':' + type, sportId: type, source: 'legacy_local', _legacy: { date, type }, summary: {}, startedAt: date + 'T00:00:00.000Z' }) },
    workoutUI: { openDetails: () => {} }, activitySync: { flushPendingActivities: () => {} },
    repos: { workout: opts.loadWorkoutTree ? { loadWorkoutTree: opts.loadWorkoutTree } : undefined }
  };
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('activity.js', base), 'utf8'), sb, { filename: 'activity.js' });
  return sb;
}

// Resolver auf den ECHT persistierten/reloaded Activities.
for (const k of Object.keys(mem)) delete mem[k]; mem[AKEY] = blob;
const realList = Store.listActivities();
const RS = makeActSandbox({ storeList: realList });
const rU = RS.resolvePlannedActivity('po:2026-07-01:ps:tmplX');
ok('[E6] REAL: resolvePlannedActivity findet die reloaded Activity eindeutig',
  rU.status === 'unique' && rU.id === (reloaded && (reloaded.clientRecordId || reloaded.id)), JSON.stringify(rU));
ok('[E7] kein Link ⇒ none', RS.resolvePlannedActivity('po:GIBTESNICHT').status === 'none');
// Mehrdeutig + gleiche Sportart/Tag ohne Link ⇒ keine Blind-Zuordnung.
const RS2 = makeActSandbox({ storeList: [
  { clientRecordId: 'a:1', source: 'orvia_workout', sportId: 'gym', startedAt: '2026-07-03T10:00:00Z', metrics: { plannedSessionId: 'po:AMB' } },
  { clientRecordId: 'a:2', source: 'orvia_workout', sportId: 'gym', startedAt: '2026-07-03T17:00:00Z', metrics: { plannedSessionId: 'po:AMB' } },
  { clientRecordId: 'a:3', source: 'orvia_workout', sportId: 'gym', startedAt: '2026-07-03T20:00:00Z', metrics: {} }
] });
ok('[E8] mehrere eindeutige Kandidaten ⇒ ambiguous (keine Auto-Auswahl)', RS2.resolvePlannedActivity('po:AMB').status === 'ambiguous');
ok('[E9] gleiche Sportart/Tag OHNE Link ⇒ none (kein Blind-Match)', RS2.resolvePlannedActivity('po:NOLINK').status === 'none');

/* ================= 2) Cloud-only-Workoutdetails ================= */
const wkLocal = { id: 'a:wl', clientRecordId: 'a:wl', source: 'orvia_workout', sportId: 'gym', sourceRecordId: 'sess:L', workoutSessionId: 'sess:L', startedAt: '2026-07-01T18:00:00', durationSeconds: 2700, summary: {}, metrics: {}, workoutSnapshot: [{ n: 'Bankdrücken' }, { n: 'Rudern' }] };
const wkCloud = { id: 'a:wc', clientRecordId: 'a:wc', source: 'orvia_workout', sportId: 'gym', sourceRecordId: 'sess:C', workoutSessionId: 'sess:C', startedAt: '2026-07-02T18:00:00', durationSeconds: 2700, summary: {}, metrics: {}, workoutSnapshot: null };
// Lokaler Snapshot → sofort sichtbar.
const S2local = makeActSandbox({ seed: { 'a:wl': wkLocal }, workoutDetails: (id) => (id === 'a:wl' ? { ok: true, hasDetails: true, exercises: wkLocal.workoutSnapshot } : { ok: false, hasDetails: false }) });
S2local.openActivityDetail('a:wl', 'training');
const localHtml = S2local.window._activityDetailOverlay ? S2local.window._activityDetailOverlay.innerHTML : '';
ok('[W1] Lokale Workoutdetails sofort sichtbar (Übungen im gemeinsamen Renderer)', /Übungen \(2\)/.test(localHtml), 'html~=' + /Übungen/.test(localHtml));

// Cloud-only → asynchrones Nachladen in DASSELBE Overlay.
const treeCalls = [];
const S2cloud = makeActSandbox({ seed: { 'a:wc': wkCloud }, loadWorkoutTree: async (sid) => { treeCalls.push(sid); return { success: true, data: { session: { id: sid }, exercises: [{ exercise: { name: 'A' } }, { exercise: { name: 'B' } }, { exercise: { name: 'C' } }] } }; } });
S2cloud.openActivityDetail('a:wc', 'training');
await sleep(15);
const cloudHtml = S2cloud.window._activityDetailOverlay ? S2cloud.window._activityDetailOverlay.innerHTML : '';
ok('[W2] Cloud-only-Workoutdetails nach echtem async Nachladen sichtbar', /Übungen \(3\)/.test(cloudHtml) && treeCalls.length === 1, 'treeCalls=' + treeCalls.length + ' hat3=' + /Übungen \(3\)/.test(cloudHtml));
ok('[W3] Nachladen erzeugt kein zweites Overlay', detailOverlays(S2cloud.document.body).length === 1, 'overlays=' + detailOverlays(S2cloud.document.body).length);

// Fehlende Details bleiben ehrlich fehlend.
const S2none = makeActSandbox({ seed: { 'a:wc': wkCloud }, loadWorkoutTree: async () => ({ success: true, data: { session: {}, exercises: [] } }) });
S2none.openActivityDetail('a:wc', 'training');
await sleep(15);
const noneHtml = S2none.window._activityDetailOverlay ? S2none.window._activityDetailOverlay.innerHTML : '';
ok('[W4] Fehlende Details bleiben fehlend (ehrlich, kein erfundener Inhalt)', /keine Satzdetails|nicht.*hinterlegt|Übungen \(0\)|keine.*Details/i.test(noneHtml) && !/Übungen \([1-9]/.test(noneHtml), 'html~ok');

/* ================= 3) Story-Zugang (nur bei eindeutiger Legacy-Verknüpfung) ================= */
const DBstory = {
  '2026-07-05': { sessions: { Laufen: { dist: 10, dur: 50, route: [[54.7, 9.4], [54.71, 9.41], [54.72, 9.42]] } } },
  '2026-07-06': { sessions: { Laufen: { dist: 8, dur: 42 } } }   // ohne Route/Splits
};
const S3 = makeActSandbox({ DB: DBstory });
S3.openActivity('2026-07-05', 'Laufen');   // Legacy-Adapter → kanonischer Renderer
const storyHtml = S3.window._activityDetailOverlay ? S3.window._activityDetailOverlay.innerHTML : '';
ok('[T1] Legacy-Aktivität mit eindeutiger Route-Session ⇒ Story-Zugang sichtbar',
  /openStory\(/.test(storyHtml) && /2026-07-05/.test(storyHtml), 'hatStory=' + /openStory\(/.test(storyHtml));
S3.closeActivityDetail();
S3.openActivity('2026-07-06', 'Laufen');   // ohne Route/Splits
const noStoryHtml = S3.window._activityDetailOverlay ? S3.window._activityDetailOverlay.innerHTML : '';
ok('[T2] Legacy ohne Route/Splits ⇒ kein Story-Button', !/openStory\(/.test(noStoryHtml));
// Kanonische Import-Aktivität ⇒ kein Story-Button (keine unsichere Zuordnung).
/* Kalibrierung GM7.8: T3 stammt aus der Zeit VOR der GM7-Verknuepfung. GM7 ordnet
   Datei-Importe bewusst der Legacy-Session desselben Tages zu (Route/Splits landen dort),
   ABER nur bei uebereinstimmender Sportart (js/activity.js: normSport-Guard) — genau das
   ist der Schutz gegen eine Blind-Zuordnung. Beide Faelle werden jetzt geprueft. */
const S3b = makeActSandbox({ seed: { 'a:imp': { id: 'a:imp', clientRecordId: 'a:imp', source: 'import', sportId: 'running', startedAt: '2026-07-05T09:00:00', durationSeconds: 3000, summary: { distanceKm: 10 }, metrics: {} } }, DB: DBstory });
S3b.openActivityDetail('a:imp', 'import_review');
const impStoryHtml = S3b.window._activityDetailOverlay ? S3b.window._activityDetailOverlay.innerHTML : '';
ok('[T3] Import mit gleicher Sportart am selben Tag ⇒ Story-Zugang (GM7-Verknüpfung)', /openStory\(/.test(impStoryHtml) && /2026-07-05/.test(impStoryHtml));
/* Gegenprobe: fremde Sportart darf NIE verknüpft werden. */
const S3c = makeActSandbox({ seed: { 'a:imp2': { id: 'a:imp2', clientRecordId: 'a:imp2', source: 'import', sportId: 'cycling', startedAt: '2026-07-05T09:00:00', durationSeconds: 3000, summary: { distanceKm: 30 }, metrics: {} } }, DB: DBstory });
S3c.openActivityDetail('a:imp2', 'import_review');
const impStoryHtml2 = S3c.window._activityDetailOverlay ? S3c.window._activityDetailOverlay.innerHTML : '';
ok('[T3b] Import mit ABWEICHENDER Sportart ⇒ kein Story-Button (keine Blind-Zuordnung)', !/openStory\(/.test(impStoryHtml2));

/* ================= Trailer ================= */
console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
console.log('AD1c: ' + (fail === 0 ? 'GRÜN — Plan-Link real persistiert (E2E/Reload/Cloud), Cloud-Workoutdetail nachgeladen, Story-Zugang bei eindeutiger Legacy-Verknüpfung.' : 'ROT — ' + fail + ' offene Korrektur(en).'));
/* GM7.8 Testhygiene: ohne Exit-Code erschien ein ROTER Lauf in Sammellaeufen als gruen. */
if (fail) process.exit(1);

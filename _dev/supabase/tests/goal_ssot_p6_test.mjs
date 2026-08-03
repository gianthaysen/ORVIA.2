/* ============================================================
   ORVIA · Ziel-SSOT + Aktivitäten-Pull (2026-07-18)
   Verträge:
   - goalTargetMin(): kanonisches Ziel (user_goals via goalOf) gewinnt über
     Legacy-Blob (DB._hmTargetMin); Default 110 nur ohne jede Quelle.
   - setHmTarget (Pace-Seite) schreibt die Zielzeit ZUERST ins kanonische Ziel.
   - runsWindow/weekRunKm zählen synchronisierte Läufe aus dem Activity-Store
     mit (Blob-Session gewinnt je Tag; Einheiten m→km, s→min; lokaler Tag).
   - activityStore.mergeServerActivities: idempotent, Tombstone gewinnt,
     lokale Outbox (pending) wird nie überschrieben.
   - activitySync.pullServerActivities: Single-Flight + Throttle, invalidiert
     den Goal-Cache nach neuen Datensätzen, Offline ⇒ sauberer Fehler.
   Methodik: echte Module (activity-normalize/-store/-sync) komplett in vm;
   ui.js-Blöcke über benannte Funktionsgrenzen mit Stubs.
   node supabase/tests/goal_ssot_p6_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../../app/js/', import.meta.url);
const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');
const TODAY = '2026-07-18';

// I2: weekRunKm liest nun den kanonischen Wochenvertrag (weeklyActivityTotals). Für die
// weekRunKm-Assertions müssen die realen Aggregator-Module geladen und in die Sandbox
// injiziert werden. Erwartungswerte bleiben unverändert; nur die Sandbox-Treue steigt.
globalThis.window = globalThis;
globalThis.ORVIA = { user: { id: 'u1' } };
await import(new URL('training-domain.js', base));
await import(new URL('activity-normalize.js', base));
await import(new URL('activity-config.js', base));
const __CFG3c = globalThis.ORVIA.activityConfig;
const __TD3c = globalThis.ORVIA.trainingDomain;


function slice(src, startMarker, endMarker) {
  const s = src.indexOf(startMarker), e = src.indexOf(endMarker);
  if (s < 0 || e < 0 || e <= s) throw new Error('Funktionsgrenzen nicht gefunden: ' + startMarker + ' … ' + endMarker);
  return src.slice(s, e);
}

/* ---------- 1) goalTargetMin: kanonisch > Legacy > Default ---------- */
{
  const block = slice(uiSrc, 'function goalOf(', 'function renderRaceHeader');
  const mk = (goals, hmLegacy, profile) => {
    const sb = {}; sb.window = sb; sb.globalThis = sb;
    sb.Date = Date; sb.Object = Object; sb.Array = Array; sb.Number = Number; sb.isFinite = isFinite;
    sb.PROFILE = profile || {};
    sb.DB = { _hmTargetMin: hmLegacy != null ? hmLegacy : null };
    sb.listGoals = () => goals || [];
    sb.gcat = t => t;
    sb.RACE_DIST = { run_5k: 5, run_10k: 10, half_marathon: 21.0975, marathon: 42.195 };
    vm.createContext(sb);
    vm.runInContext(block, sb, { filename: 'ui.js#goal' });
    return sb;
  };
  const HM = (over) => Object.assign({ id: 'g1', category: 'half_marathon', status: 'active', priority: 1, targetDate: '2026-10-01', metricType: 'time', unit: 's', targetValue: 6300 }, over || {});
  ok('Z1 kanonische Zielzeit gewinnt (6300 s → 105 min, trotz Legacy 120)', mk([HM()], 120).goalTargetMin() === 105);
  ok('Z2 unit min wird direkt gelesen', mk([HM({ unit: 'min', targetValue: 105 })], 120).goalTargetMin() === 105);
  ok('Z3 kein kanonisches Ziel ⇒ Legacy-Fallback 120', mk([], 120).goalTargetMin() === 120);
  ok('Z4 gar keine Quelle ⇒ Default 110, OrNull ⇒ null', mk([], null).goalTargetMin() === 110 && mk([], null).goalTargetMinOrNull() === null);
  ok('Z5 kanonisches Ziel OHNE Zielzeit ⇒ Legacy-Fallback (kein 110-Überschreiben)', mk([HM({ targetValue: null })], 120).goalTargetMin() === 120);
  const s6 = mk([HM()], 120);
  ok('Z6 keine verbliebene Direktnutzung von DB._hmTargetMin||110 in ui.js', !/DB\._hmTargetMin\|\|110/.test(uiSrc));
  ok('Z7 goalOf liefert weiterhin Typ/Datum/targetMin (Bestand)', (() => { const g = s6.goalOf(); return g.type === 'half_marathon' && g.raceDate === '2026-10-01' && g.targetMin === 105; })());
}

/* ---------- 2) setHmTarget schreibt kanonisch zuerst ---------- */
{
  const block = slice(uiSrc, 'function setHmTarget(', 'function renderPace(');
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.Date = Date; sb.Math = Math;
  sb.DB = { _hmTargetMin: 120 };
  sb.numIn = () => 105;
  sb.goalOf = () => ({ _canonicalId: 'g1' });
  const calls = [];
  sb.goalUpdate = (...a) => calls.push(a);
  sb.save = () => {}; sb.renderPace = () => {};
  vm.createContext(sb);
  vm.runInContext('let _goalCache=null;' + block, sb, { filename: 'ui.js#setHmTarget' });
  sb.setHmTarget();
  ok('P1 goalUpdate mit Sekunden + unit s aufgerufen', calls.length === 1 && calls[0][0] === 'g1' && calls[0][1].targetValue === 6300 && calls[0][1].unit === 's', JSON.stringify(calls[0] && calls[0][1]));
  ok('P2 Legacy-Spiegel wird mitgeführt (120 → 105)', sb.DB._hmTargetMin === 105);
}

/* ---------- 3) runsWindow/weekRunKm: Store-Läufe zählen mit ---------- */
{
  const block = slice(uiSrc, 'function _validRun(', 'function allLoads(');
  const mk = (db, acts) => {
    const sb = {}; sb.window = sb; sb.globalThis = sb;
    sb.Date = Date; sb.Math = Math; sb.Object = Object; sb.Array = Array; sb.isNaN = isNaN;
    sb.Calc = { isValidRunForAnalytics: r => !!r && r.dist > 0 };
    sb.DB = db || {};
    sb.todayStr = d => { const x = d || new Date(TODAY + 'T12:00:00'); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
    sb.dkey = off => { const d = new Date(TODAY + 'T12:00:00'); d.setDate(d.getDate() + off); return sb.todayStr(d); };
    const listCalls = [];
    sb.ORVIA = { activityConfig: __CFG3c, trainingDomain: __TD3c, profileStore: { effectiveTimezone: () => 'Europe/Vienna' }, activityStore: { listActivities: f => { listCalls.push(f); return acts || []; }, isTombstoned: () => false } };
    sb.__listCalls = listCalls;
    vm.createContext(sb);
    vm.runInContext(block, sb, { filename: 'ui.js#runs' });
    return sb;
  };
  // Zeiten mittags UTC ⇒ lokaler Tag == UTC-Tag (deterministisch für den Test).
  const act = (day, over) => Object.assign({ sportId: 'running', status: 'completed', startedAt: day + 'T10:00:00Z', durationSeconds: 2400, summary: { distanceKm: 8, distance_m: 8000, avg_hr: 152, elevation_gain_m: 40 } }, over || {});
  const s1 = mk({}, [act('2026-07-16'), act('2026-07-14')]);
  const rw = s1.runsWindow(42);
  ok('L1 synchronisierte Läufe werden gezählt (0 Blob + 2 Store ⇒ 2)', rw.length === 2, JSON.stringify(rw.map(r => r.date)));
  ok('L2 Einheiten korrekt: 8000 m ⇒ 8 km, 2400 s ⇒ 40 min, HF übernommen', rw[0].dist === 8 && rw[0].dur === 40 && rw[0].hr === 152);
  ok('L3 Store-Filter fragt explizit nach running', s1.__listCalls.length > 0 && s1.__listCalls[0] && s1.__listCalls[0].sportId === 'running');
  // Blob gewinnt je Tag (kein Doppelzählen).
  const s2 = mk({ '2026-07-16': { sessions: { Laufen: { sub: 'Tempo', dist: 7, dur: 33 } } } }, [act('2026-07-16')]);
  const rw2 = s2.runsWindow(42);
  ok('L4 Blob-Session gewinnt am selben Tag (1 Lauf, sub Tempo bleibt)', rw2.length === 1 && rw2[0].sub === 'Tempo' && rw2[0].dist === 7);
  ok('L5 nicht-completed Aktivitäten zählen nicht', mk({}, [act('2026-07-16', { status: 'in_progress' })]).runsWindow(42).length === 0);
  ok('L6 weekRunKm zählt Store-Kilometer mit', mk({}, [act('2026-07-16')]).weekRunKm(0) === 8);
}

/* ---------- 4) mergeServerActivities (echtes Modul) ---------- */
function makeStoreSb() {
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.JSON = JSON; sb.Object = Object; sb.Array = Array; sb.Math = Math;
  sb.Number = Number; sb.isNaN = isNaN; sb.isFinite = isFinite; sb.Promise = Promise;
  const store = {};
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb.navigator = { onLine: true };
  sb.ORVIA = { user: { id: 'u1' } };
  vm.createContext(sb);
  ['activity-normalize.js', 'activity-store.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  return sb;
}
{
  const row = (id, over) => Object.assign({ id: id, sport_id: 'running', source: 'garmin_unofficial', source_record_id: 'g-' + id, started_at: '2026-07-16T10:00:00Z', duration_seconds: 2400, status: 'completed', summary: { distance_m: 8000, avg_hr: 150 } }, over || {});
  const sb = makeStoreSb();
  const st = sb.ORVIA.activityStore;
  const r1 = st.mergeServerActivities([row('a1'), row('a2')]);
  ok('M1 neue Server-Läufe gemergt (2/0/0)', r1.merged === 2 && r1.updated === 0, JSON.stringify(r1));
  ok('M2 im Store sichtbar, syncStatus synced, sportId running', (() => { const l = st.listActivities({ sportId: 'running' }); return l.length === 2 && l.every(a => a.syncStatus === 'synced'); })());
  const r2 = st.mergeServerActivities([row('a1')]);
  ok('M3 idempotent: zweiter Merge aktualisiert statt dupliziert', r2.merged === 0 && r2.updated === 1 && st.listActivities({}).length === 2);
  // Tombstone gewinnt: gelöschte Aktivität taucht nicht wieder auf.
  const victim = st.listActivities({})[0];
  st.deleteActivity(victim.clientRecordId, victim);
  const r3 = st.mergeServerActivities([row(victim.id ? victim.id : 'a1', { id: victim.id, source: victim.source, source_record_id: victim.sourceRecordId })]);
  ok('M4 Tombstone gewinnt (gelöscht bleibt gelöscht)', r3.merged === 0 && r3.updated === 0 && r3.skipped === 1);
  // Outbox-Vorrang: lokal pending wird nie vom Server überschrieben.
  const sb2 = makeStoreSb();
  const st2 = sb2.ORVIA.activityStore;
  st2.upsertManualActivity({ source: 'garmin_unofficial', sourceRecordId: 'g-a9', sportId: 'running', durationSeconds: 999, summary: { distance_m: 1000 } });
  const r4 = st2.mergeServerActivities([row('a9', { source_record_id: 'g-a9' })]);
  const local = st2.getActivityBySource('garmin_unofficial', 'g-a9');
  ok('M5 lokale Outbox (pending) wird nicht überschrieben', r4.skipped === 1 && local.durationSeconds === 999 && local.syncStatus === 'pending');
}

/* ---------- 5) pullServerActivities (echtes Modul) ---------- */
await (async () => {
  const sb = makeStoreSb();
  let invalidated = 0, listCalls = 0;
  sb.orviaGoalCacheInvalidate = () => { invalidated++; };
  sb.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
  sb.dispatchEvent = () => true;
  sb.ORVIA.repos = { activity: { list: async () => { listCalls++; return { success: true, data: [{ id: 'a1', sport_id: 'running', source: 'garmin_unofficial', source_record_id: 'g-a1', started_at: '2026-07-16T10:00:00Z', duration_seconds: 2400, status: 'completed', summary: { distance_m: 8000 } }], error: null }; } } };
  sb.setTimeout = () => 0; sb.addEventListener = () => {};
  vm.runInContext(readFileSync(new URL('activity-sync.js', base), 'utf8'), sb, { filename: 'activity-sync.js' });
  const r = await sb.ORVIA.activitySync.pullServerActivities();
  ok('U1 Pull mergt Server-Läufe in den Store', r.ok === true && r.merged === 1 && sb.ORVIA.activityStore.listActivities({}).length === 1, JSON.stringify(r));
  ok('U2 Goal-Cache nach neuen Läufen invalidiert', invalidated === 1);
  const r2 = await sb.ORVIA.activitySync.pullServerActivities();
  ok('U3 Throttle: zweiter Aufruf innerhalb 5 min lädt nicht erneut', r2.ok === true && r2.throttled === true && listCalls === 1);
  const r3 = await sb.ORVIA.activitySync.pullServerActivities({ force: true });
  ok('U4 force umgeht den Throttle (idempotent: updated statt dupliziert)', r3.ok === true && r3.updated === 1 && sb.ORVIA.activityStore.listActivities({}).length === 1);
  sb.navigator.onLine = false;
  const r5 = await sb.ORVIA.activitySync.pullServerActivities({ force: true });
  ok('U5 offline ⇒ sauberer Fehler, kein Crash', r5.ok === false && /offline/.test(r5.error));
})();

/* ---------- 6) Verdrahtung ---------- */
{
  const sw = readFileSync(new URL('../sw.js', base), 'utf8');
  const v = (sw.match(/orvia-v8-(\d+)/) || [])[1];
  ok('W1 SW-Version ≥ v8-190', Number(v) >= 190, 'v8-' + v);
  const rgcBody = uiSrc.split('function renderGoalCard(elId){')[1] || '';
  ok('W2 renderGoalCard stößt den Pull an', rgcBody.slice(0, 500).includes('pullServerActivities'));
  ok('W3 Pull-Event aktualisiert sichtbare Zielkarten', /orvia:activities-pulled/.test(uiSrc));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

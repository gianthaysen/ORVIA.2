/* ============================================================
   ORVIA · Batch 2e — Integrationsbatch:
   1 Historienreife des Load-Quotienten (prior21/historySpanDays/
     activeLoadDays + insufficient_chronic_history)
   2 Offline-Plananker: PAYLOAD-/STORE-INTEGRATIONSTEST (offlineQueue.enqueue
     gemockt — prüft die vom Store erzeugten Upsert-Zeilen, NICHT die echte
     Queue-/Flush-Strecke; echte Queue: batch2f, Live-Strecke: ENV-Suite)
   3 Anker-Schutz in Migration 0025 (statischer SQL-Vertrag) + Release-Reihenfolge
   4 markPlannedDone mit Occurrence/Template/Snapshot ohne Messwerte
   node supabase/tests/batch2e_integration_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../js/', import.meta.url);
const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');
const sql0025 = readFileSync(new URL('../migrations/0025_workout_planned_snapshot.sql', import.meta.url), 'utf8');

function makeResolverSb() {
  const store = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object;
  sb.String = String; sb.Number = Number; sb.isNaN = isNaN; sb.isFinite = isFinite; sb.Intl = Intl;
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb._store = store;
  sb.ORVIA = { user: { id: 'u1' } };
  sb.todayStr = (d) => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  sb.DB = {};
  vm.createContext(sb);
  ['training-domain.js', 'activity-normalize.js', 'activity-store.js', 'activity-config.js',
   'engine/engine-contracts.js', 'engine/readiness-engine-v2.js', 'engine/decision-engine-v2.js',
   'checkin-field-resolver.js', 'engine/training-input-resolver.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  return sb;
}
const dayIso = (off) => { const d = new Date(); d.setDate(d.getDate() - off); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T09:00:00.000Z'; };
const mAct = (off) => ({ id: null, clientRecordId: 'm' + off, sportId: 'running', source: 'import', sourceRecordId: 'm' + off, workoutSessionId: null, startedAt: dayIso(off), durationSeconds: 3600, status: 'completed', summary: { rpe: 6 }, syncStatus: 'synced' });

/* ---------- H: Historienreife (Punkt 1) ---------- */
{
  // NEGATIVTEST (gefordert): 7 Tage vollständig gemessen, davor NICHTS.
  const sb = makeResolverSb();
  sb.localStorage.setItem('orvia_activities_u1', JSON.stringify([1, 2, 3, 4, 5, 6].map(mAct)));
  const rl = sb.ORVIA.trainingInputResolver.collectRaw().recentLoad;
  ok('H1 nur letzte Woche gemessen, keine Historie ⇒ ratio LOW + insufficientChronicHistory',
    rl.ratioConfidence === 'low' && rl.quality.insufficientChronicHistory === true &&
    rl.quality.prior21.activeLoadDays === 0 && rl.quality.historySpanDays <= 7, JSON.stringify(rl.quality));
  const E = sb.ORVIA.decisionEngineV2;
  const d = E.evaluate({ readiness: { score: 80, confidence: 'high', warnings: [], missingData: [] }, safetyFlags: {}, illness: false, constraints: [], plannedSession: { sport: 'running', intensity: 'easy', label: 'DL' }, recentLoad: Object.assign({}, rl, { acute7: 3000, chronic28PerWeek: 500, dataDays: 14 }), goalContext: {}, availabilityToday: true });
  ok('H2 kein Load-Ratio-Gate + eigener Reason-Code insufficient_chronic_history',
    !d.reasons.some(r => r.code === 'load_spike' || r.code === 'high_recent_load') &&
    d.reasons.some(r => r.code === 'insufficient_chronic_history' && r.inputValues.historySpanDays != null), JSON.stringify(d.reasons.map(r => r.code)));
  // Reife Historie ⇒ high (Gegenprobe) + getrennte Vorperioden-Qualität.
  const sb2 = makeResolverSb();
  sb2.localStorage.setItem('orvia_activities_u1', JSON.stringify([1, 2, 3, 8, 10, 12, 14, 16].map(mAct)));
  const rl2 = sb2.ORVIA.trainingInputResolver.collectRaw().recentLoad;
  ok('H3 reife Historie (prior21: 5 aktive Tage, Spanne 17) ⇒ ratio HIGH + priorConfidence ausgewiesen',
    rl2.ratioConfidence === 'high' && rl2.quality.priorConfidence === 'high' && rl2.quality.prior21.activeLoadDays === 5 && rl2.quality.historySpanDays === 17, JSON.stringify({ r: rl2.ratioConfidence, p: rl2.quality.prior21.activeLoadDays, s: rl2.quality.historySpanDays }));
  // Grenzfall: nur 3 aktive Vorperioden-Tage ⇒ unzureichend.
  const sb3 = makeResolverSb();
  sb3.localStorage.setItem('orvia_activities_u1', JSON.stringify([1, 2, 8, 12, 16].map(mAct)));
  const rl3 = sb3.ORVIA.trainingInputResolver.collectRaw().recentLoad;
  ok('H4 prior21 nur 3 aktive Tage ⇒ insufficient (low)', rl3.quality.insufficientChronicHistory === true && rl3.ratioConfidence === 'low');
  ok('H5 ehrlicher Feldname: activeLoadDays statt coverageDays', rl2.quality.acute7.activeLoadDays === 3 && rl2.quality.acute7.coverageDays === undefined);
}

/* ---------- O: Offline-Plananker — Payload-/Store-Integrationstest ----------
   (offlineQueue gemockt; die ECHTE offline-queue.js wird in
   batch2f_correctness_test geprüft, die Live-Flush-Strecke in
   batch2f_offline_queue_live_test als ENV-Suite) ---------- */
{
  const store = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object;
  sb.String = String; sb.Number = Number; sb.isNaN = isNaN; sb.isFinite = isFinite; sb.Promise = Promise; sb.Intl = Intl;
  sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout;
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb.todayStr = (d) => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const queued = [];
  sb.ORVIA = {
    user: { id: 'u1' },
    repoBase: { online: () => false },                          // erzwingt Offline-Pfad
    offlineQueue: { enqueue: async (table, row, meta) => { queued.push({ table, row: JSON.parse(JSON.stringify(row)), meta }); return { success: true }; } }
  };
  vm.createContext(sb);
  ['training-domain.js', 'activity-normalize.js', 'activity-store.js', 'workout-store.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  const WS = sb.ORVIA.workoutStore;
  const snap = { occurrenceId: 'po:2026-07-16:ps:tmpl1', templateSessionId: 'ps:tmpl1', plannedDate: '2026-07-16', t: 'Laufen', l: 'Intervalle', d: 'iv', capturedAt: 123 };
  await (async () => {
    const st = await WS.startFreeWorkout({ sport: 'Laufen', sessionType: 'planned', plannedSessionId: snap.occurrenceId, planSnapshot: snap });
    ok('O1 Offline-Start gequeued mit Occurrence + Snapshot', st.success === true &&
      queued.length === 1 && queued[0].row.planned_session_id === snap.occurrenceId &&
      JSON.stringify(queued[0].row.planned_session_snapshot) === JSON.stringify(snap), JSON.stringify(queued[0] && queued[0].row.planned_session_id));
    // Mutation des Originals nach dem Start darf den gesicherten Snapshot nicht ändern (tiefe Kopie).
    snap.l = 'MANIPULIERT';
    const fin = await WS.finishWorkout({});
    const sessRows = queued.filter(q => q.table === 'workout_sessions');
    const finRow = sessRows[sessRows.length - 1].row;
    ok('O2 Offline-Abschluss gequeued (completed)', fin.success === true && sessRows.length === 2 && finRow.status === 'completed', JSON.stringify({ n: sessRows.length, s: finRow.status }));
    ok('O3 Folge-Upsert behält Occurrence-ID und EXAKT denselben Snapshot (Mutation wirkungslos)',
      finRow.planned_session_id === 'po:2026-07-16:ps:tmpl1' &&
      finRow.planned_session_snapshot && finRow.planned_session_snapshot.l === 'Intervalle' &&
      JSON.stringify(finRow.planned_session_snapshot) === JSON.stringify(sessRows[0].row.planned_session_snapshot), JSON.stringify(finRow.planned_session_snapshot));
    ok('O4 Folge-Upsert nullt Bestandsfelder nicht (sport/started_at/session_type erhalten)',
      finRow.sport === 'Laufen' && finRow.session_type === 'planned' && finRow.started_at != null && finRow.started_at === sessRows[0].row.started_at, JSON.stringify({ sport: finRow.sport, st: finRow.started_at, ty: finRow.session_type }));
  })();
}

/* ---------- M: markPlannedDone mit Plananker (Punkt 4) ---------- */
{
  const planBlock = uiSrc.slice(0, uiSrc.indexOf('var PLAN_PRESETS'));
  const mpdBlock = (function (src) { const s = src.indexOf('function markPlannedDone'), e = src.indexOf('/* Wochenziele NICHT mehr aus festen Defaults'); return src.slice(s, e); })(uiSrc);
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.console = console; sb.Date = Date; sb.Math = Math; sb.Object = Object; sb.Array = Array;
  sb.String = String; sb.Number = Number; sb.Set = Set; sb.JSON = JSON;
  sb.todayStr = (d) => { const x = d || new Date('2026-07-15T12:00'); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  sb.goalOf = () => ({ type: 'half_marathon', raceDate: '2026-09-06' });
  sb.userLevel = () => 'fortgeschritten';
  sb.PROFILE = { sports: [{ sportId: 'running', activeInApp: true }], weekPlan: [[], [], [{ id: 'ps:tmplX', t: 'Laufen', l: 'Intervalle', d: 'iv' }], [], [], [], []], trainingDays: null, issues: [] };
  sb.ORVIA = { profileModel: { canonGoalCategory: t => t, effectiveTrainingConfig: () => ({ availableDayIdx: [0, 1, 2, 3, 4, 5, 6], targetDays: 1, daysSource: 'availability' }) } };
  sb.saveProfile = () => {};
  const DBv = {}; sb.entry = (d) => (DBv[d] = DBv[d] || {});
  sb.save = () => true; sb.toast = () => {}; sb.closeSupp = () => {}; sb.renderDay = () => {}; sb.renderWeekPlan = () => {};   // realer save()-Vertrag: true = persistiert
  vm.createContext(sb);
  vm.runInContext(planBlock + '\n' + mpdBlock, sb, { filename: 'ui.js#mpd' });
  const mres = sb.markPlannedDone('Laufen', 2, 0);
  ok('M0 Batch 2f: Erfolg nur mit ok:true nach verifizierter Speicherung', mres && mres.ok === true && mres.code === 'marked');
  const rec = DBv[sb.todayStr()].sessions['Laufen'];
  ok('M1 plan_done trägt Occurrence-/Template-Anker + Snapshot',
    !!rec && rec.source === 'plan_done' && rec.plannedSessionId === 'po:2026-07-15:ps:tmplX' &&
    rec.templateSessionId === 'ps:tmplX' && rec.planSnapshot && rec.planSnapshot.plannedDate === '2026-07-15' && rec.planSnapshot.d === 'iv', JSON.stringify(rec));
  ok('M2 KEINE erfundenen Messwerte (kein dur/rpe/dist/perf)', rec.dur === undefined && rec.rpe === undefined && rec.dist === undefined && rec.perf === undefined);
  // Lastausschluss: der Eintrag bleibt excluded_no_data.
  const sbL = makeResolverSb();
  const du = sbL.ORVIA.activityConfig.dailyLoadUnits([], { Laufen: rec });
  ok('M3 plan_done bleibt aus der Last ausgeschlossen (excluded_no_data, load 0)',
    du.load === 0 && du.units.length === 0 && du.excluded.some(x => x.dedupe.decision === 'excluded_no_data'));
}

/* ---------- S: Anker-Schutz + Release-Reihenfolge in 0025 (Punkt 3, statischer SQL-Vertrag) ---------- */
{
  // Batch 2f (append-only): Trigger-Logik lebt additiv in 0026; 0025 ist auf
  // den bereits AUSGEFÜHRTEN Stand eingefroren (Byte-Anker: batch2f S1).
  const sql0026 = readFileSync(new URL('../migrations/0026_protect_planned_anchor.sql', import.meta.url), 'utf8');
  ok('S1 Spalte idempotent in 0025 (add column if not exists)', /add column if not exists planned_session_snapshot jsonb/.test(sql0025));
  ok('S2 Schutzfunktion idempotent in 0026 (create or replace + drop trigger if exists + before insert or update)',
    /create or replace function public\.orvia_protect_planned_anchor/.test(sql0026) &&
    /drop trigger if exists trg_orvia_protect_planned_anchor/.test(sql0026) &&
    /before insert or update on public\.workout_sessions/.test(sql0026));
  ok('S3 Anker-Erhalt beider Felder in 0026 (is distinct from + Altwert wiederherstellen)',
    /old\.planned_session_id is not null/.test(sql0026) && /new\.planned_session_id := old\.planned_session_id/.test(sql0026) &&
    /old\.planned_session_snapshot is not null/.test(sql0026) && /new\.planned_session_snapshot := old\.planned_session_snapshot/.test(sql0026));
  ok('S4 Release-Reihenfolge + korrigierte Kompatibilitätsaussage in 0026 dokumentiert',
    /RELEASE-REIHENFOLGE/.test(sql0026) && /vor dem Client-Bundle/i.test(sql0026) && /trifft auf GEPLANTE Workout-Starts nicht zu/.test(sql0026));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

/* ORVIA · Phase 4.2 E3 — Single Source of Truth: abgeschlossenes Live-Training landet in der
   lokalen Aktivitätsquelle (DB[heute].sessions), die Insights/Plan/Heute speist.
   node supabase/tests/workout_ssot_phase42_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
global.window = { addEventListener: () => {}, ORVIA: {} };
global.document = { addEventListener: () => {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
const _ls = {}; global.localStorage = { getItem: k => (k in _ls ? _ls[k] : null), setItem: (k, v) => { _ls[k] = String(v); }, removeItem: k => { delete _ls[k]; } };
global.todayStr = () => '2026-06-21';
global.TYPES = { Gym: {}, Laufen: {}, Rad: {}, Schwimmen: {}, 'Mobilität': {} };
global.DB = {};
global.entry = (k) => { DB[k] = DB[k] || {}; return DB[k]; };
let saved = 0; global.save = () => { saved++; };

const O = global.window.ORVIA;
O.user = { id: 'A' };
O.trainingDomain = { MUSCLE_GROUPS_DE: [], labelMovement: x => x || '', groupOfMovement: () => null };
let FIN = { success: true, data: { completed: true, sport: 'Gym', durationMin: 42, sessionRpe: 7, sessionId: 'srv1', clientSessionId: 'workout:abc', loadStatus: 'written' } };
O.workoutStore = { state: () => ({ session: null, exercises: [] }), finishWorkout: async () => FIN, restoreActiveWorkout: async () => ({ success: true }), progress: () => ({}), restRemaining: () => 0, isPaused: () => false };
O.repos = { exercise: { list: async () => ({ success: true, data: [] }) }, workout: { listSessions: async () => ({ success: true, data: [] }) } };

const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/workout-ui.js');
const UI = O.workoutUI;

const run = async () => {
  // Abschluss → muss in DB[heute].sessions['Gym'] gespiegelt werden
  await UI._doFinish(false);
  const s = DB['2026-06-21'] && DB['2026-06-21'].sessions;
  ok('Live-Abschluss in lokale Aktivitätsquelle gespiegelt', !!(s && s.Gym));
  ok('Dauer + RPE übernommen', s && s.Gym.dur === 42 && s.Gym.rpe === 7);
  ok('Marker source=live + workoutSessionId (für Dedup)', s && s.Gym.source === 'live' && s.Gym.workoutSessionId === 'srv1' && s.Gym.clientSessionId === 'workout:abc');
  ok('save() ausgelöst (persistiert)', saved >= 1);

  // Laufen wird korrekt typisiert (nicht auf Gym gemappt) + Distanz aus Dauer-Modus übernommen
  DB = {}; saved = 0; UI._liveDist = 8.2;
  FIN = { success: true, data: { completed: true, sport: 'Laufen', durationMin: 35, sessionRpe: null, sessionId: 'srv2', clientSessionId: 'workout:run', loadStatus: 'incomplete_no_rpe' } };
  await UI._doFinish(true);
  const s2 = DB['2026-06-21'] && DB['2026-06-21'].sessions;
  ok('Laufen landet unter sessions.Laufen', !!(s2 && s2.Laufen && !s2.Gym));
  ok('Ohne RPE: kein rpe gesetzt', s2 && s2.Laufen.rpe == null);
  ok('Distanz aus Dauer-Modus übernommen', s2 && s2.Laufen.dist === 8.2);

  // Misserfolg → NICHTS spiegeln (kein Scheinerfolg)
  DB = {}; saved = 0; FIN = { success: false, error: { code: 'workout_close_failed' } };
  await UI._doFinish(false);
  ok('Abschluss-Fehler → keine Aktivität gespiegelt', !DB['2026-06-21']);

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });

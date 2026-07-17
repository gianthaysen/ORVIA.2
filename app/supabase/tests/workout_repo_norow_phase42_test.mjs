/* ORVIA · Phase 4.2f — workoutRepository: kein Scheinerfolg bei 0 betroffenen Zeilen.
   node supabase/tests/workout_repo_norow_phase42_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
global.window = {};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });

// Fake-Supabase: konfigurierbares Ergebnis für update/delete (.select() am Ende thenable).
let RESULT = { data: [], error: null };
let RPC_RESULT = { data: null, error: null };
function makeSb() {
  const chain = { update() { return chain; }, delete() { return chain; }, select() { return chain; }, eq() { return chain; }, then(res) { return Promise.resolve(RESULT).then(res); } };
  return { from() { return chain; }, rpc() { return Promise.resolve(RPC_RESULT); } };
}
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/repos/repoBase.js'); load('js/training-domain.js'); load('js/repos/workoutRepository.js');
const O = global.window.ORVIA;
O.user = { id: 'A' }; O.sb = makeSb();
const repo = O.repos.workout;

const run = async () => {
  // updateSession: 1 Zeile → Erfolg
  RESULT = { data: [{ id: 'x', status: 'completed' }], error: null };
  let r = await repo.updateSession('x', { status: 'completed' });
  ok('updateSession mit 1 Zeile → Erfolg', r.success && r.data.status === 'completed');

  // updateSession: 0 Zeilen → Fehler no_row_updated (KEIN Scheinerfolg)
  RESULT = { data: [], error: null };
  r = await repo.updateSession('x', { status: 'completed' });
  ok('updateSession mit 0 Zeilen → Fehler no_row_updated', !r.success && r.error.code === 'no_row_updated');

  // deleteSession: 1 Zeile → Erfolg
  RESULT = { data: [{ id: 'x' }], error: null };
  r = await repo.deleteSession('x');
  ok('deleteSession mit 1 Zeile → Erfolg', r.success);

  // deleteSession: 0 Zeilen → Fehler no_row_deleted
  RESULT = { data: [], error: null };
  r = await repo.deleteSession('x');
  ok('deleteSession mit 0 Zeilen → Fehler no_row_deleted', !r.success && r.error.code === 'no_row_deleted');

  // DB-Fehler wird durchgereicht
  RESULT = { data: null, error: { message: 'boom' } };
  r = await repo.updateSession('x', { status: 'completed' });
  ok('updateSession DB-Fehler → update_failed', !r.success && r.error.code === 'update_failed');

  // closeActiveSession (RPC): Zeile zurück → Erfolg
  RPC_RESULT = { data: { id: 'x', status: 'completed' }, error: null };
  r = await repo.closeActiveSession('x', 'completed', { sessionRpe: 7 });
  ok('closeActiveSession Zeile → Erfolg', r.success && r.data.status === 'completed');

  // closeActiveSession: Array zurück → normalisiert → Erfolg
  RPC_RESULT = { data: [{ id: 'x', status: 'aborted' }], error: null };
  r = await repo.closeActiveSession('x', 'aborted', {});
  ok('closeActiveSession Array → normalisiert', r.success && r.data.status === 'aborted');

  // closeActiveSession: falscher Status → unconfirmed
  RPC_RESULT = { data: { id: 'x', status: 'active' }, error: null };
  r = await repo.closeActiveSession('x', 'completed', {});
  ok('closeActiveSession falscher Status → unconfirmed', !r.success && r.error.code === 'workout_close_unconfirmed');

  // closeActiveSession: RPC-Fehler → workout_close_failed
  RPC_RESULT = { data: null, error: { message: 'active_workout_not_found' } };
  r = await repo.closeActiveSession('x', 'completed', {});
  ok('closeActiveSession RPC-Fehler → workout_close_failed', !r.success && r.error.code === 'workout_close_failed');

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });

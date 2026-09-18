/* ORVIA · Phase 4.2f — workoutRepository: kein Scheinerfolg bei 0 betroffenen Zeilen.
   node supabase/tests/workout_repo_norow_phase42_test.mjs */
import fs from 'fs';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
global.window = {};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });

// Fake-Supabase: konfigurierbares Ergebnis für update/delete (.select() am Ende thenable).
let RESULT = { data: [], error: null };
let RPC_RESULT = { data: null, error: null };
function makeSb() {
  const chain = { update() { return chain; }, delete() { return chain; }, upsert() { return chain; }, insert() { return chain; }, select() { return chain; }, eq() { return chain; }, then(res) { return Promise.resolve(RESULT).then(res); } };
  return { from() { return chain; }, rpc() { return Promise.resolve(RPC_RESULT); } };
}
const load = f => (0, eval)(fs.readFileSync(new URL(_APPREL + '' + f, import.meta.url), 'utf8'));
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

  /* ---- v8-391 · Dedupe-Schluessel ist Pflicht (Befund 18.09.2026) ----
     Der Unique-Index auf workout_exercises/workout_sets ist PARTIELL
     (where client_exercise_id / client_set_id is not null). Fehlte die Client-ID,
     lief der Aufruf als reines INSERT ohne Konfliktziel: jeder Doppelklick, Retry
     oder Offline-Nachlauf legte eine weitere Zeile an, die sich nie wieder
     deduplizieren liess. Belegt an der Einheit vom 20.06.2026 (drei Uebungszeilen
     mit order_index 0, vier von fuenf ohne einen einzigen Satz). Bei Saetzen wirkt
     das direkt auf Volumen, Tonnage und Saetze je Muskel.
     Der frueher strengere Index ueber (session, order_index) wurde in Migration 0004
     bewusst entfernt (Umsortieren erzeugte falsche Upserts) — der Ersatz greift aber
     nur mit gesetzter Client-ID. Deshalb: fail closed statt stiller Dublette. */
  RESULT = { data: [{ id: 'we1' }], error: null };
  r = await repo.addExercise('sess1', { exerciseId: 'ex1', order: 0 });
  ok('addExercise ohne clientExerciseId → Fehler statt nicht-deduplizierbarer Zeile',
    !r.success && r.error.code === 'client_exercise_id_required', JSON.stringify(r.error));
  r = await repo.addExercise('sess1', { clientExerciseId: 'we:1', exerciseId: 'ex1', order: 0 });
  ok('addExercise mit clientExerciseId → Erfolg', r.success === true, JSON.stringify(r.error));

  RESULT = { data: [{ id: 's1' }], error: null };
  r = await repo.addSet('we1', { setNumber: 1, weight: 80, reps: 10 });
  ok('addSet ohne clientSetId → Fehler statt doppelt gezaehltem Satz',
    !r.success && r.error.code === 'client_set_id_required', JSON.stringify(r.error));
  r = await repo.addSet('we1', { clientSetId: 'set:1', setNumber: 1, weight: 80, reps: 10 });
  ok('addSet mit clientSetId → Erfolg', r.success === true, JSON.stringify(r.error));

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });

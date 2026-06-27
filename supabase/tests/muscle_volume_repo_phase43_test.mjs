/* ORVIA · Phase 4.3 — workoutRepository.getMuscleVolume nutzt EINE RPC (kein N+1) + Fehlerbehandlung.
   node supabase/tests/muscle_volume_repo_phase43_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
global.window = {};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });

let RPC = { name: null, args: null, result: { data: [], error: null }, calls: 0 };
function makeSb() {
  return {
    rpc(name, args) { RPC.calls++; RPC.name = name; RPC.args = args; return Promise.resolve(RPC.result); },
    from() { throw new Error('from() darf NICHT genutzt werden (kein N+1)'); }
  };
}
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/repos/repoBase.js'); load('js/training-domain.js'); load('js/repos/workoutRepository.js');
const O = global.window.ORVIA; O.user = { id: 'A' }; O.sb = makeSb();
const repo = O.repos.workout;

const run = async () => {
  // Erfolg: genau EIN RPC-Aufruf, korrekte Args, Daten durchgereicht
  RPC = { name: null, args: null, calls: 0, result: { data: [{ muscle_key: 'chest', direct_sets: 8, indirect_sets: 0, effective_sets: 8, workout_count: 2, last_trained_at: '2026-06-20T10:00:00Z' }], error: null } };
  let r = await repo.getMuscleVolume('2026-06-14', '2026-06-20');
  ok('genau EIN RPC-Aufruf (kein N+1)', RPC.calls === 1);
  ok('richtige RPC + Zeitraum-Args', RPC.name === 'orvia_muscle_volume' && RPC.args.p_from === '2026-06-14' && RPC.args.p_to === '2026-06-20');
  ok('Erfolg, Zeile durchgereicht', r.success && r.data.length === 1 && r.data[0].muscle_key === 'chest' && r.data[0].effective_sets === 8);

  // Leeres Ergebnis → source empty
  RPC.result = { data: [], error: null };
  r = await repo.getMuscleVolume('2026-06-14', '2026-06-20');
  ok('leeres Ergebnis → success + source empty', r.success && r.data.length === 0 && r.source === 'empty');

  // Supabase-Fehler wird NICHT still verschluckt
  RPC.result = { data: null, error: { message: 'permission denied' } };
  r = await repo.getMuscleVolume('2026-06-14', '2026-06-20');
  ok('RPC-Fehler → success false (muscle_volume_failed)', !r.success && r.error.code === 'muscle_volume_failed');

  // Kein Auth → Fehler vor RPC
  O.user = null;
  r = await repo.getMuscleVolume('2026-06-14', '2026-06-20');
  ok('ohne Auth → kein Erfolg', !r.success);

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });

/* ORVIA · Phase 4.1 — Legacy-Trainingsmigration (Unit-Tests).
   node supabase/tests/training_migration_phase41_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

global.window = {};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/training-migration.js');
const O = global.window.ORVIA;

const DBX = {
  '2026-06-18': { date: '2026-06-18', sessions: { Laufen: { dur: 40, sub: 'Easy Z2', rpe: 4, note: 'locker' }, Gym: { dur: 50, rpe: 7 }, _ts: 1 } },
  '2026-06-19': { date: '2026-06-19', sessions: { Rad: { dur: 90 } } },
  '_meta': { foo: 1 }   // Nicht-Tagesschlüssel ignorieren
};

const run = async () => {
  // buildLegacyRows: reine Funktion
  const rows = O.trainingMigration.buildLegacyRows(DBX);
  ok('3 Legacy-Sessions (Laufen, Gym, Rad)', rows.length === 3);
  const lauf = rows.find(r => r.sport === 'Laufen');
  ok('Legacy-Status + Quelle legacy_blob', lauf.status === 'legacy' && lauf.source === 'legacy_blob');
  ok('Dauer/Typ übernommen, KEINE erfundenen Übungen/Sätze', lauf.duration_min === 40 && lauf.session_type === 'Easy Z2' && !('exercises' in lauf) && !('sets' in lauf));
  ok('client_session_id deterministisch (deckt sich mit migrate-blob)', lauf.client_session_id === 'blob:2026-06-18:Laufen');
  ok('Nicht-Tagesschlüssel (_meta) ignoriert', !rows.some(r => r.local_date === '_meta'));

  // Idempotenz: zweiter Lauf erzeugt identische Rows (gleiche client_session_id → Upsert, kein Dup)
  ok('buildLegacyRows deterministisch', JSON.stringify(O.trainingMigration.buildLegacyRows(DBX)) === JSON.stringify(rows));

  // run() über workoutRepository-Stub: createSession je Row, Upsert (idempotent)
  global.DB = DBX; O.user = { id: 'A' };
  const calls = [];
  O.repos = { workout: { createSession: async (s) => { calls.push(s); return { success: true, data: { id: 'x' } }; } } };
  const res = await O.trainingMigration.run();
  ok('run(): alle 3 Sessions migriert', res.success && res.data.migrated === 3 && res.data.found === 3);
  ok('run(): createSession mit clientSessionId + status legacy', calls[0].clientSessionId === 'blob:2026-06-18:Laufen' && calls[0].status === 'legacy' && calls[0].source === 'legacy_blob');

  // Fehlerpfad: ohne Sitzung → success false, kein Schreiben
  O.user = null; const r2 = await O.trainingMigration.run();
  ok('run() ohne Sitzung → success false', r2.success === false);

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });

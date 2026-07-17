/* ORVIA · Phase 4.3 — ECHTER SQL-Integrationstest von orvia_muscle_volume (0008).
   Deckt ab: Auth-Isolation, completed-only (active/aborted/cancelled aus), Warm-up & unvollständige
   Sätze aus, direkte/indirekte Trennung, gewichtete effective_sets, exakte Zeitgrenzen,
   Nullparameter, >366 Tage, zwei Übungen derselben Gruppe in einer Session, mehrere Sessions,
   count(distinct session_id), mehrere feine Muskel-Keys derselben Körperkartengruppe.
   SEED-ABHÄNGIGKEIT (aus 0003/0006 — wird vor dem Test geprüft, sonst Abbruch):
     bench_press:    chest direct 1.0, triceps indirect 0.5, front_delts indirect 0.4
     db_bench_press: chest direct 1.0, triceps indirect 0.5, front_delts indirect 0.4
     barbell_row:    upper_back direct 1.0, lats indirect 0.6, biceps indirect 0.4
   Voraussetzung: 0003–0008 eingespielt; zwei Test-Accounts. KEINE Service-Role.
   SUPABASE_URL=… SUPABASE_ANON_KEY=… A_EMAIL=… A_PW=… B_EMAIL=… B_PW=… \
   node supabase/tests/muscle_volume_sql_phase43_test.mjs */
import { createClient } from '@supabase/supabase-js';
const URL = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY;
const A = { email: process.env.A_EMAIL, pw: process.env.A_PW }, B = { email: process.env.B_EMAIL, pw: process.env.B_PW };
const miss = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'A_EMAIL', 'A_PW', 'B_EMAIL', 'B_PW'].filter(k => !process.env[k]);
if (miss.length) { console.error('ENV fehlt: ' + miss.join(', ')); process.exit(2); }
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.011;
const D1 = '2000-04-04', D2 = '2000-04-05';

async function login(c) { const s = createClient(URL, ANON, { auth: { persistSession: false } }); const { data, error } = await s.auth.signInWithPassword({ email: c.email, password: c.pw }); if (error) throw new Error('Login ' + c.email + ': ' + error.message); return { s, uid: data.user.id }; }
const G = (rows, g) => (rows || []).find(r => r.muscle_group === g) || null;
let A_, B_;
async function exId(slug) { const r = await A_.s.from('exercises').select('id').eq('slug', slug).maybeSingle(); if (r.error || !r.data) throw new Error('Seed-Übung fehlt: ' + slug); return r.data.id; }
// Bricht mit klarer Meldung ab, wenn die erwarteten Muskelrelationen/Gewichte (0003/0006) fehlen/abweichen.
async function requireSeed(exerciseId, expect, slug) {
  const r = await A_.s.from('exercise_muscles').select('muscle_key,weight,involvement').eq('exercise_id', exerciseId);
  if (r.error) throw new Error('SEED-PRÜFUNG (' + slug + '): ' + r.error.message);
  const have = {}; (r.data || []).forEach(x => { have[x.muscle_key] = x; });
  for (const [mk, inv, w] of expect) {
    const row = have[mk];
    if (!row || row.involvement !== inv || Math.abs(Number(row.weight) - w) > 0.001) {
      throw new Error('SEED-ABHÄNGIGKEIT verletzt: ' + slug + ' erwartet ' + mk + ' ' + inv + ' ' + w + ', gefunden ' + (row ? row.involvement + ' ' + row.weight : 'nichts') + '. Bitte 0003/0006 prüfen.');
    }
  }
}
let _n = 0;
async function ins(acc, table, row, label) { const r = await acc.s.from(table).insert(row).select().single(); if (r.error) throw new Error('INSERT ' + (label || table) + ': ' + r.error.message); return r.data; }
async function sets(acc, weId, list) { // list: [[set_number,type,completed]]
  const rows = list.map(x => ({ user_id: acc.uid, workout_exercise_id: weId, set_number: x[0], set_type: x[1], completed: x[2], client_set_id: 's_' + (++_n) + '_' + Date.now() }));
  const r = await acc.s.from('workout_sets').insert(rows); if (r.error) throw new Error('INSERT sets: ' + r.error.message);
}
async function session(acc, date, status) { return ins(acc, 'workout_sessions', { user_id: acc.uid, local_date: date, status: status, finished_at: status === 'completed' ? new Date().toISOString() : null, client_session_id: 'mv_' + (++_n) + '_' + Date.now() }, 'session'); }
async function exrc(acc, sessId, exerciseId) { return ins(acc, 'workout_exercises', { user_id: acc.uid, workout_session_id: sessId, exercise_id: exerciseId, order_index: _n % 7, client_exercise_id: 'we_' + (++_n) + '_' + Date.now() }, 'we'); }
async function cleanup() { for (const acc of [A_, B_]) { if (!acc) continue; for (const d of [D1, D2]) { const r = await acc.s.from('workout_sessions').delete().eq('user_id', acc.uid).eq('local_date', d); if (r.error) console.log('   (cleanup ' + d + ': ' + r.error.message + ')'); } } }

const run = async () => {
  A_ = await login(A); B_ = await login(B);
  try {
    await cleanup();
    const BENCH = await exId('bench_press');
    const DBBENCH = await exId('db_bench_press');
    const ROW = await exId('barbell_row');
    // Seed-Abhängigkeit HART prüfen — sonst klarer Abbruch statt späterem Zahlen-Mismatch.
    await requireSeed(BENCH, [['chest', 'direct', 1.0], ['triceps', 'indirect', 0.5], ['front_delts', 'indirect', 0.4]], 'bench_press');
    await requireSeed(DBBENCH, [['chest', 'direct', 1.0], ['triceps', 'indirect', 0.5], ['front_delts', 'indirect', 0.4]], 'db_bench_press');
    await requireSeed(ROW, [['upper_back', 'direct', 1.0], ['lats', 'indirect', 0.6], ['biceps', 'indirect', 0.4]], 'barbell_row');

    // S1 (D1, completed): bench (2 working, 1 warmup, 1 incomplete) + db_bench (2 working) → zwei Übungen, Gruppe Brust
    const s1 = await session(A_, D1, 'completed');
    await sets(A_, (await exrc(A_, s1.id, BENCH)).id, [[1, 'working', true], [2, 'working', true], [3, 'warmup', true], [4, 'working', false]]);
    await sets(A_, (await exrc(A_, s1.id, DBBENCH)).id, [[1, 'working', true], [2, 'working', true]]);
    // S2 (D2, completed): bench (2 working)
    const s2 = await session(A_, D2, 'completed');
    await sets(A_, (await exrc(A_, s2.id, BENCH)).id, [[1, 'working', true], [2, 'working', true]]);
    // S3 (D2, completed): barbell_row (2 working) → Gruppe Rücken aus zwei feinen Keys (upper_back+lats)
    const s3 = await session(A_, D2, 'completed');
    await sets(A_, (await exrc(A_, s3.id, ROW)).id, [[1, 'working', true], [2, 'working', true]]);
    // Ausgeschlossen: aborted / active / cancelled (je bench 2 working an D1)
    for (const stt of ['aborted', 'active', 'cancelled']) {
      const sx = await session(A_, D1, stt);
      await sets(A_, (await exrc(A_, sx.id, BENCH)).id, [[1, 'working', true], [2, 'working', true]]);
    }
    // B: eigene completed Session (Isolation)
    const sB = await session(B_, D1, 'completed');
    await sets(B_, (await exrc(B_, sB.id, BENCH)).id, [[1, 'working', true]]);

    // --- Q(D1..D2) ---
    const q = await A_.s.rpc('orvia_muscle_volume', { p_from: D1, p_to: D2 });
    ok('RPC ok', !q.error, q.error && q.error.message);
    const chest = G(q.data, 'chest'), tri = G(q.data, 'triceps'), back = G(q.data, 'back'), bi = G(q.data, 'biceps');
    ok('chest direct_sets = 6 (warmup/incomplete/aborted/active/cancelled aus)', chest && Number(chest.direct_sets) === 6, chest && JSON.stringify(chest));
    ok('chest workout_count = 2 (distinct Sessions)', chest && Number(chest.workout_count) === 2);
    ok('chest effective_sets = 6 (Gewicht 1.0)', chest && near(chest.effective_sets, 6));
    ok('triceps indirekt: indirect_sets = 6, effective = 3 (0.5)', tri && Number(tri.indirect_sets) === 6 && near(tri.effective_sets, 3) && Number(tri.direct_sets) === 0);
    ok('Rücken aus mehreren feinen Keys: direct=2, indirect=2, effective≈3.2', back && Number(back.direct_sets) === 2 && Number(back.indirect_sets) === 2 && near(back.effective_sets, 3.2));
    ok('Rücken workout_count = 1 (nicht durch Mehrfach-Keys verdoppelt)', back && Number(back.workout_count) === 1);
    ok('biceps indirekt aus Rudern: indirect_sets = 2', bi && Number(bi.indirect_sets) === 2);

    // --- Exakte Zeitgrenzen ---
    const qd1 = await A_.s.rpc('orvia_muscle_volume', { p_from: D1, p_to: D1 });
    ok('p_from=p_to=D1: chest direct = 4, workout_count = 1', G(qd1.data, 'chest') && Number(G(qd1.data, 'chest').direct_sets) === 4 && Number(G(qd1.data, 'chest').workout_count) === 1);
    ok('D1-Fenster enthält KEIN Rücken (S3 ist D2)', !G(qd1.data, 'back'));
    const qd2 = await A_.s.rpc('orvia_muscle_volume', { p_from: D2, p_to: D2 });
    ok('p_from=p_to=D2: chest direct = 2', G(qd2.data, 'chest') && Number(G(qd2.data, 'chest').direct_sets) === 2);
    ok('D2-Fenster enthält Rücken', !!G(qd2.data, 'back'));

    // --- Isolation ---
    const qB = await B_.s.rpc('orvia_muscle_volume', { p_from: D1, p_to: D2 });
    ok('B sieht nur eigene (chest direct = 1)', G(qB.data, 'chest') && Number(G(qB.data, 'chest').direct_sets) === 1);

    // --- Validierung ---
    ok('Nullparameter → Fehler', !!(await A_.s.rpc('orvia_muscle_volume', { p_from: null, p_to: D2 })).error);
    ok('from > to → Fehler', !!(await A_.s.rpc('orvia_muscle_volume', { p_from: D2, p_to: D1 })).error);
    ok('Zeitraum > 366 Tage → Fehler', !!(await A_.s.rpc('orvia_muscle_volume', { p_from: '2000-01-01', p_to: '2002-01-01' })).error);
  } catch (e) {
    ok('Testlauf ohne Setup-Fehler', false, e.message);
  } finally {
    await cleanup();
  }
  console.log(`\nErgebnis:\n${pass} bestanden\n${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Testlauf-Fehler:', e.message); process.exit(2); });

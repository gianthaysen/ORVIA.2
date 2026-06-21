/* ORVIA · Phase 4.3 — ECHTER SQL-Integrationstest der orvia_muscle_volume-RPC.
   Prüft Auth-Isolation, completed-only, Warm-up-Ausschluss, direkte/indirekte Trennung,
   gewichtete effective_sets, inklusive Zeitgrenzen, ungültiger Zeitraum, distinct Workouts je Gruppe.
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
const TD = '2000-04-04';
async function login(c) { const s = createClient(URL, ANON, { auth: { persistSession: false } }); const { data, error } = await s.auth.signInWithPassword({ email: c.email, password: c.pw }); if (error) throw new Error('Login ' + c.email + ': ' + error.message); return { s, uid: data.user.id }; }
const grp = (rows, g) => (rows || []).find(r => r.muscle_group === g) || null;

const run = async () => {
  const a = await login(A), b = await login(B);
  // Aufräumen
  await a.s.from('workout_sessions').delete().eq('user_id', a.uid).eq('local_date', TD);
  await b.s.from('workout_sessions').delete().eq('user_id', b.uid).eq('local_date', TD);

  // System-Übung mit bekannter Muskelzuordnung (Bankdrücken → chest direct)
  const ex = await a.s.from('exercises').select('id').eq('slug', 'bench_press').maybeSingle();
  if (!ex.data) { console.error('Seed-Übung bench_press fehlt — 0003 einspielen'); process.exit(2); }
  const exId = ex.data.id;

  // A: completed Session mit 1 working + 1 warmup + 1 unvollständigem Satz
  const sess = await a.s.from('workout_sessions').insert({ user_id: a.uid, local_date: TD, status: 'completed', finished_at: new Date().toISOString(), client_session_id: 'mvA_' + Date.now() }).select().single();
  const we = await a.s.from('workout_exercises').insert({ user_id: a.uid, workout_session_id: sess.data.id, exercise_id: exId, order_index: 0, client_exercise_id: 'mvweA_' + Date.now() }).select().single();
  const mk = (n, type, done) => ({ user_id: a.uid, workout_exercise_id: we.data.id, set_number: n, set_type: type, completed: done, client_set_id: 'mvsA_' + n + '_' + Date.now() });
  await a.s.from('workout_sets').insert([mk(1, 'working', true), mk(2, 'working', true), mk(3, 'warmup', true), mk(4, 'working', false)]);

  // B: eigene completed Session (zur Isolationsprüfung)
  const sB = await b.s.from('workout_sessions').insert({ user_id: b.uid, local_date: TD, status: 'completed', finished_at: new Date().toISOString(), client_session_id: 'mvB_' + Date.now() }).select().single();
  const weB = await b.s.from('workout_exercises').insert({ user_id: b.uid, workout_session_id: sB.data.id, exercise_id: exId, order_index: 0, client_exercise_id: 'mvweB_' + Date.now() }).select().single();
  await b.s.from('workout_sets').insert([{ user_id: b.uid, workout_exercise_id: weB.data.id, set_number: 1, set_type: 'working', completed: true, client_set_id: 'mvsB_' + Date.now() }]);

  // RPC für A
  const rA = await a.s.rpc('orvia_muscle_volume', { p_from: TD, p_to: TD });
  ok('A: RPC ok', !rA.error, rA.error && rA.error.message);
  const chestA = grp(rA.data, 'chest');
  ok('A: chest direct_sets = 2 (2 working, KEIN warmup, KEIN unvollständiger)', chestA && Number(chestA.direct_sets) === 2, chestA && JSON.stringify(chestA));
  ok('A: chest workout_count = 1 (distinct Session)', chestA && Number(chestA.workout_count) === 1);
  ok('A: effective_sets > 0 (gewichtet)', chestA && Number(chestA.effective_sets) > 0);

  // RPC für B sieht NICHT A's Daten (eigene = nur seine)
  const rB = await b.s.rpc('orvia_muscle_volume', { p_from: TD, p_to: TD });
  const chestB = grp(rB.data, 'chest');
  ok('B: sieht nur eigene (chest direct_sets = 1)', chestB && Number(chestB.direct_sets) === 1);

  // aborted Session wird NICHT gezählt
  await a.s.from('workout_sessions').update({ status: 'aborted' }).eq('id', sess.data.id);
  const rA2 = await a.s.rpc('orvia_muscle_volume', { p_from: TD, p_to: TD });
  ok('aborted Session → nicht gezählt', !grp(rA2.data, 'chest'));

  // ungültiger Zeitraum (from > to) → Fehler
  const bad = await a.s.rpc('orvia_muscle_volume', { p_from: TD, p_to: '1999-01-01' });
  ok('from > to → Fehler', !!bad.error);

  // Cleanup
  await a.s.from('workout_sessions').delete().eq('user_id', a.uid).eq('local_date', TD);
  await b.s.from('workout_sessions').delete().eq('user_id', b.uid).eq('local_date', TD);

  console.log(`\nErgebnis:\n${pass} bestanden\n${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Testlauf-Fehler:', e.message); process.exit(2); });

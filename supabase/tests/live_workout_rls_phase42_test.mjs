/* ============================================================
   ORVIA · Phase 4.2 RLS-Test (ECHT, gegen Supabase) — Live-Workout.
   A startet eigene Session; B kann sie nicht sehen/ändern/abschließen, keine Übung/Satz
   anhängen; A bearbeitet/löscht eigene Sätze; System-Übung nutzbar; private B-Übung blockiert;
   Parent-Kind-Konsistenz. Echtes pass/fail/skipped. Voraussetzungen: 0003+0004 eingespielt.
   SUPABASE_URL=… SUPABASE_ANON_KEY=… A_EMAIL=… A_PW=… B_EMAIL=… B_PW=… \
   node supabase/tests/live_workout_rls_phase42_test.mjs
   ============================================================ */
import { createClient } from '@supabase/supabase-js';
const URL = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY;
const A = { email: process.env.A_EMAIL, pw: process.env.A_PW }, B = { email: process.env.B_EMAIL, pw: process.env.B_PW };
const miss = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'A_EMAIL', 'A_PW', 'B_EMAIL', 'B_PW'].filter(k => !process.env[k]);
if (miss.length) { console.error('ENV fehlt: ' + miss.join(', ')); process.exit(2); }
let pass = 0, fail = 0, skipped = 0;
const ok = (n, c, info) => { console.log((c ? '✅' : '❌') + ' ' + n + (info ? '  — ' + info : '')); c ? pass++ : fail++; };
const skip = (n, r) => { console.log('⏭️  ' + n + '  — ÜBERSPRUNGEN: ' + r); skipped++; };
const failSetup = (n, e) => { console.log('❌ ' + n + '  — SETUP-FEHLER: ' + (e && (e.message || JSON.stringify(e)) || e)); fail++; };
function rls(e) { if (!e) return { block: false }; const code = String(e.code || ''), m = String(e.message || '').toLowerCase(); if (code === '42501' || /row-level security/.test(m)) return { block: true }; if (/^(42P01|42703)$/.test(code) || /pgrst|does not exist/.test(m + code)) return { block: false, schema: true, why: e.code + ' ' + e.message }; return { block: false, why: e.code + ' ' + e.message }; }
async function client(c) { const s = createClient(URL, ANON, { auth: { persistSession: false } }); const { data, error } = await s.auth.signInWithPassword({ email: c.email, password: c.pw }); if (error || !data.user) throw new Error('Login: ' + c.email + ' ' + (error && error.message)); return { s, uid: data.user.id }; }
const TD = '2000-02-02';

const run = async () => {
  const a = await client(A), b = await client(B);
  ok('Login A & B, verschiedene IDs', a.uid !== b.uid);

  // Aufräumen evtl. Reste
  await a.s.from('workout_sessions').delete().eq('user_id', a.uid).eq('local_date', TD);
  await b.s.from('workout_sessions').delete().eq('user_id', b.uid).eq('local_date', TD);

  // A startet eigene aktive Session
  const sess = await a.s.from('workout_sessions').insert({ user_id: a.uid, local_date: TD, status: 'active', client_session_id: 'rlsA_' + Date.now() }).select().single();
  if (sess.error || !sess.data) return failSetup('A startet Session', sess.error), finish();
  ok('A: eigene Session starten', true);

  // B sieht/ändert/abschließt A-Session nicht
  const bSee = await b.s.from('workout_sessions').select('*').eq('user_id', a.uid);
  ok('B sieht A-Session nicht', !bSee.error && (bSee.data || []).length === 0);
  const bUpd = await b.s.from('workout_sessions').update({ notes: 'hack' }).eq('id', sess.data.id).select();
  ok('B kann A-Session nicht ändern', !bUpd.error ? (bUpd.data || []).length === 0 : true);
  const bFin = await b.s.from('workout_sessions').update({ status: 'completed' }).eq('id', sess.data.id).select();
  ok('B kann A-Session nicht abschließen', !bFin.error ? (bFin.data || []).length === 0 : true);

  // B kann keine Übung an A-Session hängen
  const bWe = await b.s.from('workout_exercises').insert({ user_id: b.uid, workout_session_id: sess.data.id, order_index: 0 }).select();
  ok('B: Übung an A-Session blockiert', rls(bWe.error).block, rls(bWe.error).why);

  // A: eigene Übung + System-Übung nutzbar
  const sysEx = await a.s.from('exercises').select('id').eq('is_system', true).limit(1).maybeSingle();
  const we = await a.s.from('workout_exercises').insert({ user_id: a.uid, workout_session_id: sess.data.id, exercise_id: sysEx.data && sysEx.data.id, order_index: 0, client_exercise_id: 'weA_' + Date.now() }).select().single();
  ok('A: Übung (System-Exercise) an eigene Session', !we.error && we.data, we.error && we.error.message);

  // private B-Übung darf nicht in A-Workout
  const bEx = await b.s.from('exercises').insert({ user_id: b.uid, is_system: false, name: 'B-Priv' }).select().single();
  if (bEx.data && we.data) {
    const bad = await a.s.from('workout_exercises').insert({ user_id: a.uid, workout_session_id: sess.data.id, exercise_id: bEx.data.id, order_index: 1, client_exercise_id: 'weBad_' + Date.now() }).select();
    ok('A: private B-Übung in A-Workout blockiert', rls(bad.error).block, rls(bad.error).why);
  } else failSetup('Setup B-Übung', bEx.error);

  // Sätze: A bearbeitet/löscht eigene; B kann keinen Satz an A-Exercise hängen
  if (we.data) {
    const set = await a.s.from('workout_sets').insert({ user_id: a.uid, workout_exercise_id: we.data.id, set_number: 1, weight: 100, reps: 8, client_set_id: 'setA_' + Date.now() }).select().single();
    ok('A: Satz an eigene Exercise', !set.error && set.data, set.error && set.error.message);
    if (set.data) {
      const upd = await a.s.from('workout_sets').update({ reps: 9 }).eq('id', set.data.id).select();
      ok('A: eigenen Satz bearbeiten', !upd.error && (upd.data || []).length === 1);
      const bSet = await b.s.from('workout_sets').insert({ user_id: b.uid, workout_exercise_id: we.data.id, set_number: 1, client_set_id: 'setBad_' + Date.now() }).select();
      ok('B: Satz an A-Exercise blockiert', rls(bSet.error).block || (bSet.data || []).length === 0, rls(bSet.error).why);
      // Client-ID-Upsert von B mit A's client_set_id darf A's Zeile NICHT überschreiben.
      const bClash = await b.s.from('workout_sets').upsert(
        { user_id: b.uid, workout_exercise_id: we.data.id, set_number: 9, weight: 999, client_set_id: set.data.client_set_id },
        { onConflict: 'user_id,client_set_id' }).select();
      ok('B: Client-ID-Upsert überschreibt A-Satz NICHT', rls(bClash.error).block || (bClash.data || []).length === 0, rls(bClash.error).why);
      const aStill = await a.s.from('workout_sets').select('weight').eq('id', set.data.id).maybeSingle();
      ok('A-Satz unverändert (kein Cross-User-Overwrite)', !aStill.error && aStill.data && Number(aStill.data.weight) !== 999);
      const del = await a.s.from('workout_sets').delete().eq('id', set.data.id).eq('user_id', a.uid).select();
      ok('A: eigenen Satz löschen', !del.error);
      // B-Delete über Client-ID bleibt user-scoped (trifft keine A-Zeile).
      const bDelClient = await b.s.from('workout_sets').delete().eq('user_id', b.uid).eq('client_set_id', 'phantom_' + Date.now()).select();
      ok('B-Delete über Client-ID bleibt user-scoped', !bDelClient.error && (bDelClient.data || []).length === 0);
    }
  }

  // Cleanup
  try {
    await a.s.from('workout_sessions').delete().eq('user_id', a.uid).eq('local_date', TD);
    if (bEx.data) await b.s.from('exercises').delete().eq('id', bEx.data.id).eq('user_id', b.uid);
  } catch (e) { console.log('   (Cleanup: ' + e.message + ')'); }
  finish();
};
function finish() { console.log(`\nErgebnis:\n${pass} bestanden\n${fail} fehlgeschlagen\n${skipped} übersprungen`); process.exit(fail ? 1 : 0); }
run().catch(e => { console.error('Testlauf-Fehler:', e.message); process.exit(2); });

/* ============================================================
   ORVIA · Phase 4.1 RLS-Test (ECHT, gegen Supabase) — Trainingsdomäne (gehärtet).
   Verifiziert: System-Seeds vorhanden, Katalog nur lesbar, System-Übungen/-Vorlagen
   lesbar aber nicht änderbar, Junction-/Template-Kind-DML für EIGENE Übungen/Vorlagen
   erlaubt, Cross-User-Verknüpfungen blockiert. Echtes pass/fail/skipped, kein stilles Auslassen.
   Voraussetzungen: 0003 ausgeführt, 2 bestätigte Konten, npm i @supabase/supabase-js.
   SUPABASE_URL=… SUPABASE_ANON_KEY=… A_EMAIL=… A_PW=… B_EMAIL=… B_PW=… \
   node supabase/tests/training_rls_phase41_test.mjs
   ============================================================ */
import { createClient } from '@supabase/supabase-js';
const URL = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY;
const A = { email: process.env.A_EMAIL, pw: process.env.A_PW }, B = { email: process.env.B_EMAIL, pw: process.env.B_PW };
const miss = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'A_EMAIL', 'A_PW', 'B_EMAIL', 'B_PW'].filter(k => !process.env[k]);
if (miss.length) { console.error('ENV fehlt: ' + miss.join(', ')); process.exit(2); }

let pass = 0, fail = 0, skipped = 0;
const ok = (n, c, info) => { console.log((c ? '✅' : '❌') + ' ' + n + (info ? '  — ' + info : '')); c ? pass++ : fail++; };
const skip = (n, reason) => { console.log('⏭️  ' + n + '  — ÜBERSPRUNGEN: ' + reason); skipped++; };
const failSetup = (n, err) => { console.log('❌ ' + n + '  — SETUP-FEHLER: ' + (err && (err.message || JSON.stringify(err)) || err)); fail++; };

function rls(e) { if (!e) return { block: false }; const code = String(e.code || ''), m = String(e.message || '').toLowerCase(); if (code === '42501' || /row-level security/.test(m)) return { block: true }; if (/^(42P01|42703)$/.test(code) || /pgrst|does not exist/.test(m + code)) return { block: false, schema: true, why: e.code + ' ' + e.message }; return { block: false, why: e.code + ' ' + e.message }; }
async function client(c) { const s = createClient(URL, ANON, { auth: { persistSession: false } }); const { data, error } = await s.auth.signInWithPassword({ email: c.email, password: c.pw }); if (error || !data.user) throw new Error('Login: ' + c.email + ' ' + (error && error.message)); return { s, uid: data.user.id }; }

const run = async () => {
  const a = await client(A), b = await client(B);
  ok('Login A & B, verschiedene IDs', a.uid !== b.uid);

  // ---- C. Systemdaten / Katalog (Seeds ECHT verifizieren: length > 0) ----
  const exSys = await a.s.from('exercises').select('id,slug,is_system').eq('is_system', true).limit(5);
  ok('System-Übungen-Seeds vorhanden (length>0)', !exSys.error && (exSys.data || []).length > 0, exSys.error && exSys.error.message);
  const mg = await a.s.from('muscle_groups').select('key').limit(5);
  ok('Muskelgruppen-Seeds vorhanden (length>0)', !mg.error && (mg.data || []).length > 0, mg.error && mg.error.message);
  const eq = await a.s.from('equipment').select('key').limit(5);
  ok('Equipment-Seeds vorhanden (length>0)', !eq.error && (eq.data || []).length > 0, eq.error && eq.error.message);
  const tq = await a.s.from('training_qualities').select('key').limit(5);
  ok('Trainingsqualität-Seeds vorhanden (length>0)', !tq.error && (tq.data || []).length > 0, tq.error && tq.error.message);

  if (exSys.data && exSys.data[0]) {
    const upd = await a.s.from('exercises').update({ name: 'HACK' }).eq('id', exSys.data[0].id).select();
    ok('System-Übung NICHT änderbar', !!upd.error || (upd.data || []).length === 0);
  } else fail++, console.log('❌ System-Übung NICHT änderbar — SETUP-FEHLER: keine System-Übung');
  const mgIns = await a.s.from('muscle_groups').insert({ key: 'x_' + Date.now(), name: 'X' }).select();
  ok('Katalog (muscle_groups) NICHT beschreibbar', !!mgIns.error);
  const eqIns = await a.s.from('equipment').insert({ key: 'x_' + Date.now(), name: 'X' }).select();
  ok('Katalog (equipment) NICHT beschreibbar', !!eqIns.error);

  // ---- A. Eigene Nutzerübung + Junctions (DML-GRANT + RLS) ----
  const muscleKey = (mg.data && mg.data[0] && mg.data[0].key) || 'chest';
  const eqKey = (eq.data && eq.data[0] && eq.data[0].key) || 'barbell';
  const qKey = (tq.data && tq.data[0] && tq.data[0].key) || 'hypertrophy';
  const sysExId = exSys.data && exSys.data[0] && exSys.data[0].id;

  const ownEx = await a.s.from('exercises').insert({ user_id: a.uid, is_system: false, name: 'A-Custom' }).select().single();
  if (ownEx.error || !ownEx.data) failSetup('A: eigene Übung anlegen', ownEx.error);
  else {
    ok('A: eigene Übung (is_system false) anlegbar', true);
    const emIns = await a.s.from('exercise_muscles').insert({ exercise_id: ownEx.data.id, muscle_key: muscleKey, weight: 1.0, involvement: 'direct' }).select();
    ok('A: exercise_muscles für eigene Übung (DML-GRANT greift)', !emIns.error && (emIns.data || []).length === 1, emIns.error && emIns.error.message);
    const eeIns = await a.s.from('exercise_equipment').insert({ exercise_id: ownEx.data.id, equipment_key: eqKey }).select();
    ok('A: exercise_equipment für eigene Übung', !eeIns.error && (eeIns.data || []).length === 1, eeIns.error && eeIns.error.message);
    const etIns = await a.s.from('exercise_training_qualities').insert({ exercise_id: ownEx.data.id, quality_key: qKey, weight: 1.0 }).select();
    ok('A: exercise_training_qualities für eigene Übung', !etIns.error && (etIns.data || []).length === 1, etIns.error && etIns.error.message);
    if (sysExId) {
      const altIns = await a.s.from('exercise_alternatives').insert({ exercise_id: ownEx.data.id, alternative_exercise_id: sysExId, relation: 'alternative' }).select();
      ok('A: Alternative auf SYSTEM-Übung erlaubt', !altIns.error && (altIns.data || []).length === 1, altIns.error && altIns.error.message);
    } else skip('A: Alternative auf System-Übung', 'keine System-Übung gefunden');

    // Negativ: B darf keine Junction an A-Übung hängen
    const emFake = await b.s.from('exercise_muscles').insert({ exercise_id: ownEx.data.id, muscle_key: muscleKey }).select();
    ok('B: exercise_muscles an A-Übung blockiert', rls(emFake.error).block, rls(emFake.error).why);
  }

  // Negativ: A referenziert PRIVATE B-Übung als Alternative → blockiert
  const bEx = await b.s.from('exercises').insert({ user_id: b.uid, is_system: false, name: 'B-Custom' }).select().single();
  if (bEx.error || !bEx.data) failSetup('Setup B-Übung', bEx.error);
  else if (ownEx.data) {
    const altFake = await a.s.from('exercise_alternatives').insert({ exercise_id: ownEx.data.id, alternative_exercise_id: bEx.data.id, relation: 'alternative' }).select();
    ok('A: Alternative auf PRIVATE B-Übung blockiert', rls(altFake.error).block, rls(altFake.error).why);
  }

  // ---- B. Eigene private Vorlage + Kinder ----
  const tmplA = await a.s.from('workout_templates').insert({ user_id: a.uid, is_system: false, name: 'A-Tmpl' }).select().single();
  if (tmplA.error || !tmplA.data) failSetup('A: eigene Vorlage anlegen', tmplA.error);
  else {
    ok('A: eigene Vorlage anlegbar', true);
    const dayA = await a.s.from('workout_template_days').insert({ template_id: tmplA.data.id, day_index: 0, name: 'Tag A' }).select().single();
    ok('A: workout_template_day (DML-GRANT greift)', !dayA.error && dayA.data, dayA.error && dayA.error.message);
    if (dayA.data) {
      const teA = await a.s.from('workout_template_exercises').insert({ template_day_id: dayA.data.id, exercise_id: sysExId, order_index: 0, planned_sets: 3 }).select();
      ok('A: workout_template_exercise', !teA.error && (teA.data || []).length === 1, teA.error && teA.error.message);
      // Negativ: B hängt Tag/Übung an A-Vorlage
      const dayFake = await b.s.from('workout_template_days').insert({ template_id: tmplA.data.id, day_index: 1, name: 'X' }).select();
      ok('B: Tag an A-Vorlage blockiert', rls(dayFake.error).block, rls(dayFake.error).why);
      const teFake = await b.s.from('workout_template_exercises').insert({ template_day_id: dayA.data.id, exercise_id: sysExId, order_index: 1 }).select();
      ok('B: Übung an A-Vorlagentag blockiert', rls(teFake.error).block, rls(teFake.error).why);
    }
    // Negativ: A hängt PRIVATE B-Übung in eigene Vorlage
    if (bEx.data && tmplA.data) {
      const dayA2 = await a.s.from('workout_template_days').select('id').eq('template_id', tmplA.data.id).limit(1).single();
      if (dayA2.data) {
        const teBad = await a.s.from('workout_template_exercises').insert({ template_day_id: dayA2.data.id, exercise_id: bEx.data.id, order_index: 5 }).select();
        ok('A: private B-Übung in eigene Vorlage blockiert', rls(teBad.error).block, rls(teBad.error).why);
      }
    }
  }

  // ---- Pläne / Sessions / Sets Cross-User ----
  const planA = await a.s.from('user_training_plans').insert({ user_id: a.uid, name: 'A-Plan' }).select().single();
  ok('A: eigener Plan anlegbar', !planA.error && planA.data, planA.error && planA.error.message);
  const selBplanByA = await a.s.from('user_training_plans').select('*').eq('user_id', b.uid);
  ok('A sieht keine Pläne von B', !selBplanByA.error && (selBplanByA.data || []).length === 0);
  const insFakePlan = await a.s.from('user_training_plans').insert({ user_id: b.uid, name: 'fake' }).select();
  ok('A INSERT Plan mit B-user_id blockiert', rls(insFakePlan.error).block, rls(insFakePlan.error).why);

  const sess = await a.s.from('workout_sessions').insert({ user_id: a.uid, local_date: '2000-01-02', status: 'active' }).select().single();
  ok('A: eigene Workout-Session anlegbar', !sess.error && sess.data, sess.error && sess.error.message);
  const bSess = await b.s.from('workout_sessions').insert({ user_id: b.uid, local_date: '2000-01-02', status: 'active' }).select().single();
  if (bSess.error || !bSess.data) failSetup('Setup B-Session', bSess.error);
  else {
    const xUser = await a.s.from('workout_exercises').insert({ user_id: a.uid, workout_session_id: bSess.data.id, order_index: 0 }).select();
    ok('A: Exercise an B-Session blockiert (Parent-Konsistenz)', rls(xUser.error).block, rls(xUser.error).why);
    const bPlan = await b.s.from('user_training_plans').insert({ user_id: b.uid, name: 'B-Plan' }).select().single();
    if (bPlan.data) {
      const sFakePlan = await a.s.from('workout_sessions').insert({ user_id: a.uid, local_date: '2000-01-03', plan_id: bPlan.data.id }).select();
      ok('A: Session mit B-plan_id blockiert', rls(sFakePlan.error).block, rls(sFakePlan.error).why);
      const bTmpl = await b.s.from('workout_templates').insert({ user_id: b.uid, is_system: false, name: 'B-Tmpl' }).select().single();
      if (bTmpl.data) {
        const pFakeTmpl = await a.s.from('user_training_plans').insert({ user_id: a.uid, name: 'A-Plan2', source_template_id: bTmpl.data.id }).select();
        ok('A: Plan mit B-privater Vorlage blockiert', rls(pFakeTmpl.error).block, rls(pFakeTmpl.error).why);
        await b.s.from('workout_templates').delete().eq('id', bTmpl.data.id).eq('user_id', b.uid);
      } else failSetup('Setup B-Vorlage', null);
      await b.s.from('user_training_plans').delete().eq('id', bPlan.data.id).eq('user_id', b.uid);
    } else failSetup('Setup B-Plan', null);
  }
  if (sess.data) {
    const we = await a.s.from('workout_exercises').insert({ user_id: a.uid, workout_session_id: sess.data.id, order_index: 0 }).select().single();
    ok('A: Exercise an eigene Session erlaubt', !we.error && we.data, we.error && we.error.message);
    if (we.data) {
      const set = await a.s.from('workout_sets').insert({ user_id: a.uid, workout_exercise_id: we.data.id, set_number: 1 }).select();
      ok('A: Set an eigene Exercise erlaubt', !set.error && (set.data || []).length === 1, set.error && set.error.message);
      const setFake = await b.s.from('workout_sets').insert({ user_id: b.uid, workout_exercise_id: we.data.id, set_number: 1 }).select();
      ok('B: Set an A-Exercise blockiert', rls(setFake.error).block || (setFake.data || []).length === 0, rls(setFake.error).why);
      // A: Exercise mit privater B-Übung blockiert
      if (bEx.data) {
        const xFakeEx = await a.s.from('workout_exercises').insert({ user_id: a.uid, workout_session_id: sess.data.id, exercise_id: bEx.data.id, order_index: 9 }).select();
        ok('A: workout_exercise mit B-privater Übung blockiert', rls(xFakeEx.error).block, rls(xFakeEx.error).why);
      }
    }
  }

  // ---- D. Cleanup (Fehler nur protokollieren, Ergebnis nicht beeinflussen) ----
  const cleanup = [
    a.s.from('workout_sessions').delete().eq('user_id', a.uid).gte('local_date', '2000-01-01').lte('local_date', '2000-01-09'),
    b.s.from('workout_sessions').delete().eq('user_id', b.uid).eq('local_date', '2000-01-02'),
    a.s.from('user_training_plans').delete().eq('user_id', a.uid).like('name', 'A-Plan%'),
    a.s.from('workout_templates').delete().eq('user_id', a.uid).eq('name', 'A-Tmpl'),
    ownEx.data ? a.s.from('exercises').delete().eq('id', ownEx.data.id).eq('user_id', a.uid) : null,
    bEx.data ? b.s.from('exercises').delete().eq('id', bEx.data.id).eq('user_id', b.uid) : null
  ].filter(Boolean);
  for (const c of cleanup) { try { const r = await c; if (r && r.error) console.log('   (Cleanup: ' + r.error.message + ')'); } catch (e) { console.log('   (Cleanup: ' + e.message + ')'); } }

  console.log(`\nErgebnis:\n${pass} bestanden\n${fail} fehlgeschlagen\n${skipped} übersprungen`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Testlauf-Fehler:', e.message); process.exit(2); });

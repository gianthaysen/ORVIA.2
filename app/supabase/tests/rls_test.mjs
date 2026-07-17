/* ============================================================
   ORVIA · RLS-Test (ECHT, gegen dein Supabase-Projekt)
   Beweist BEIDES:
   (A) Positivkontrolle: jeder Nutzer kann EIGENE Datensätze anlegen/lesen/ändern/löschen.
   (B) Negativkontrolle: Nutzer A kann B NIE lesen/ändern/einfügen/löschen.
   Echte RLS-Blockaden (SQLSTATE 42501 / "row-level security") werden von Schemafehlern
   (fehlende Tabelle/Spalte) unterschieden — Schemafehler & fehlgeschlagene Positivtests
   führen zu Exit-Code 1. Ein vollständiges Tabellenverbot gilt NICHT als RLS-Erfolg,
   weil die Positivkontrolle es dann als Fehlschlag aufdeckt.

   Voraussetzungen: 2 bestätigte Test-Accounts, `npm i @supabase/supabase-js`.
   Ausführen:
   SUPABASE_URL=… SUPABASE_ANON_KEY=… A_EMAIL=… A_PW=… B_EMAIL=… B_PW=… \
   node supabase/tests/rls_test.mjs
   ============================================================ */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY;
const A = { email: process.env.A_EMAIL, pw: process.env.A_PW };
const B = { email: process.env.B_EMAIL, pw: process.env.B_PW };
const miss = ['SUPABASE_URL','SUPABASE_ANON_KEY','A_EMAIL','A_PW','B_EMAIL','B_PW'].filter(k => !process.env[k]);
if (miss.length) { console.error('ENV fehlt: ' + miss.join(', ')); process.exit(2); }

const TDATE = '2000-01-02';                 // eindeutiges Testdatum
const TAG = 'rls_test_' + Date.now();       // eindeutige Markierung der Testdaten
let pass = 0, fail = 0;
const ok = (n, c, note) => { console.log((c ? '✅' : '❌') + ' ' + n + (note ? '  — ' + note : '')); c ? pass++ : fail++; };

function isRlsBlock(error) {
  if (!error) return { block: false };
  const code = String(error.code || ''); const msg = String(error.message || '').toLowerCase();
  if (code === '42501' || /row-level security|violates row-level/.test(msg)) return { block: true };
  if (/^(42P01|42703|42704)$/.test(code) || /pgrst/i.test(code) ||
      /does not exist|undefined column|undefined table|could not find/.test(msg))
    return { block: false, schema: true, why: error.code + ' ' + error.message };
  return { block: false, why: error.code + ' ' + error.message };
}

async function client(cred) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: cred.email, password: cred.pw });
  if (error || !data.user) throw new Error('Login fehlgeschlagen: ' + cred.email + ' — ' + (error && error.message));
  return { c, uid: data.user.id };
}

// Valide Minimal-Payload + Update-Feld je Tabelle. pk='user_id' → Upsert (PK auf user_id).
function specs() {
  return {
    user_profiles:        { pk: 'user_id', payload: { name: TAG },                                   upd: { name: TAG + '_u' } },
    daily_checkins:       { pk: 'id',      payload: { local_date: TDATE, checkin_type: 'morning', feel: 5 }, upd: { feel: 6 } },
    readiness_baselines:  { pk: 'id',      payload: { metric: 'rhr', valid_days: 1 },                 upd: { valid_days: 2 } },
    readiness_scores:     { pk: 'id',      payload: { local_date: TDATE, score: 50 },                 upd: { score: 60 } },
    training_load_daily:  { pk: 'id',      payload: { local_date: TDATE, sport: 'Laufen', client_session_id: TAG, duration_min: 30 }, upd: { duration_min: 40 } },
    user_goals:           { pk: 'id',      payload: { client_goal_id: TAG, title: TAG },              upd: { title: TAG + '_u' } },
    user_sports:          { pk: 'id',      payload: { sport: 'TS_' + TAG, priority: 0 },              upd: { priority: 1 } },
    weekly_availability:  { pk: 'id',      payload: { weekday: 3, max_minutes: 60 },                  upd: { max_minutes: 90 } },
    fixed_schedule_items: { pk: 'id',      payload: { sport: 'X', weekday: 2, start_time: '08:30' },  upd: { duration_min: 45 } },
    orvia_migrations:     { pk: 'user_id', payload: { status: 'in_progress' },                        upd: { status: 'completed' } }
  };
}

// Positiv-CRUD eines EIGENEN Datensatzes. Selbstaufräumend (DELETE am Ende). Gibt id zurück.
async function crud(cl, table, sp, keepRow) {
  const full = Object.assign({ user_id: cl.uid }, sp.payload);
  const ins = sp.pk === 'user_id'
    ? await cl.c.from(table).upsert(full, { onConflict: 'user_id' }).select()
    : await cl.c.from(table).insert(full).select();
  if (ins.error) { const r = isRlsBlock(ins.error); ok('POS ' + table + ' INSERT (eigen)', false, r.schema ? 'SCHEMAFEHLER: ' + r.why : r.why); return null; }
  ok('POS ' + table + ' INSERT (eigen)', (ins.data || []).length === 1);
  const idVal = sp.pk === 'user_id' ? cl.uid : (ins.data[0] && ins.data[0].id);

  const rd = await cl.c.from(table).select('*').eq(sp.pk, idVal).limit(1);
  ok('POS ' + table + ' SELECT (eigen)', !rd.error && (rd.data || []).length === 1, rd.error && rd.error.message);

  const ud = await cl.c.from(table).update(sp.upd).eq(sp.pk, idVal).select();
  ok('POS ' + table + ' UPDATE (eigen)', !ud.error && (ud.data || []).length === 1, ud.error && ud.error.message);

  if (!keepRow) {
    const dd = await cl.c.from(table).delete().eq(sp.pk, idVal).select();
    ok('POS ' + table + ' DELETE (eigen)', !dd.error && (dd.data || []).length === 1, dd.error && dd.error.message);
  }
  return idVal;
}

const run = async () => {
  const a = await client(A), b = await client(B);
  ok('Login A & B, verschiedene IDs', a.uid !== b.uid);
  const SP = specs();

  // ---------- (A) POSITIVKONTROLLEN ----------
  // Alle Tabellen außer readiness_components (braucht Parent-Score) als Nutzer A.
  for (const t of Object.keys(SP)) await crud(a, t, SP[t]);

  // readiness_components: Score anlegen (behalten), Komponente CRUD, dann Score löschen.
  const scoreId = await crud(a, 'readiness_scores', SP.readiness_scores, true);
  if (scoreId) {
    const cSp = { pk: 'id', payload: { readiness_score_id: scoreId, component: 'HRV', weight: 1 }, upd: { weight: 2 } };
    await crud(a, 'readiness_components', cSp);
    await a.c.from('readiness_scores').delete().eq('user_id', a.uid).eq('id', scoreId);
  }

  // Stichprobe: Nutzer B kann ebenfalls EIGENE Datensätze CRUDen.
  for (const t of ['daily_checkins', 'user_goals', 'training_load_daily']) await crud(b, t, SP[t]);

  // ---------- (B) NEGATIVKONTROLLEN ----------
  // B legt eine Referenzzeile an (für SELECT/UPDATE/DELETE-auf-B-Tests).
  await b.c.from('daily_checkins').upsert({ user_id: b.uid, local_date: TDATE, checkin_type: 'live', feel: 9 }, { onConflict: 'user_id,local_date,checkin_type' });

  for (const t of Object.keys(SP)) {
    const sel = await a.c.from(t).select('user_id').eq('user_id', b.uid).limit(1);
    if (sel.error) ok('NEG SELECT ' + t + ' ohne Schemafehler', false, sel.error.message);
    else ok('NEG SELECT ' + t + ': A sieht 0 Zeilen von B', (sel.data || []).length === 0);

    const ins = await a.c.from(t).insert(Object.assign({ user_id: b.uid }, SP[t].payload)).select();
    const r = isRlsBlock(ins.error);
    ok('NEG INSERT ' + t + ' mit B-user_id durch RLS blockiert', r.block, r.schema ? 'SCHEMAFEHLER: ' + r.why : r.why);
  }

  // Eigene Zeile auf fremde user_id umschreiben → blockiert.
  await a.c.from('daily_checkins').upsert({ user_id: a.uid, local_date: TDATE, checkin_type: 'live', feel: 7 }, { onConflict: 'user_id,local_date,checkin_type' });
  const hij = await a.c.from('daily_checkins').update({ user_id: b.uid }).eq('user_id', a.uid).eq('local_date', TDATE).eq('checkin_type', 'live').select();
  ok('NEG A kann eigene Zeile NICHT auf B umschreiben', !!hij.error || (hij.data || []).length === 0);

  const upd = await a.c.from('daily_checkins').update({ feel: 1 }).eq('user_id', b.uid).select();
  ok('NEG A UPDATE auf B betrifft 0 Zeilen', !upd.error && (upd.data || []).length === 0);
  const del = await a.c.from('daily_checkins').delete().eq('user_id', b.uid).select();
  ok('NEG A DELETE auf B betrifft 0 Zeilen', !del.error && (del.data || []).length === 0);

  // ---- readiness_scores / readiness_components verschachtelt cross-user ----
  // Sauberer Ausgangszustand, damit der Insert genau eine Zeile erzeugt (.single()).
  await a.c.from('readiness_scores').delete().eq('user_id', a.uid).eq('local_date', TDATE);
  await b.c.from('readiness_scores').delete().eq('user_id', b.uid).eq('local_date', TDATE);

  const saIns = await a.c.from('readiness_scores').insert({ user_id: a.uid, local_date: TDATE, score: 50 }).select('id,user_id').single();
  const sbIns = await b.c.from('readiness_scores').insert({ user_id: b.uid, local_date: TDATE, score: 50 }).select('id,user_id').single();
  if (saIns.error) console.error('   Score A Insert-Fehler:', JSON.stringify(saIns.error));
  if (sbIns.error) console.error('   Score B Insert-Fehler:', JSON.stringify(sbIns.error));
  const scoreA = saIns.data && saIns.data.id;
  const scoreB = sbIns.data && sbIns.data.id;
  ok('Score A & B angelegt (IDs vorhanden, nicht NULL)', !!scoreA && !!scoreB,
     (saIns.error && saIns.error.message) || (sbIns.error && sbIns.error.message) || '');

  if (!scoreA || !scoreB) {
    // Ohne valide Score-IDs ist der Parent-Konsistenz-Test bedeutungslos → als Fehlschlag werten,
    // niemals einen NULL-Score-Pfad (P0001 "nicht gefunden") als bestandene RLS-Isolation zählen.
    ok('NEG Komponente A auf B-Score (A-uid) blockiert', false, 'übersprungen: Score-ID fehlt');
    ok('NEG Komponente A auf B-Score (B-uid) blockiert', false, 'übersprungen: Score-ID fehlt');
  } else {
    // Positivkontrolle: A darf Komponente auf EIGENEN Score schreiben.
    const cPos = await a.c.from('readiness_components').insert({ readiness_score_id: scoreA, user_id: a.uid, component: 'HRV', weight: 1 }).select();
    ok('POS Komponente A auf eigenen Score', !cPos.error && (cPos.data || []).length === 1, cPos.error && cPos.error.message);

    // A → Komponente auf B-Score mit A-user_id → Parent-Konsistenz/RLS blockiert (42501 erwartet).
    const c1 = await a.c.from('readiness_components').insert({ readiness_score_id: scoreB, user_id: a.uid, component: 'X' }).select();
    const r1 = isRlsBlock(c1.error);
    ok('NEG Komponente A auf B-Score (A-uid) blockiert', r1.block, r1.schema ? 'SCHEMA: ' + r1.why : r1.why);

    // A → Komponente auf B-Score mit B-user_id → blockiert.
    const c2 = await a.c.from('readiness_components').insert({ readiness_score_id: scoreB, user_id: b.uid, component: 'X' }).select();
    const r2 = isRlsBlock(c2.error);
    ok('NEG Komponente A auf B-Score (B-uid) blockiert', r2.block, r2.schema ? 'SCHEMA: ' + r2.why : r2.why);
  }

  // ---------- CLEANUP ----------
  try {
    await a.c.from('readiness_scores').delete().eq('user_id', a.uid).eq('local_date', TDATE);
    await b.c.from('readiness_scores').delete().eq('user_id', b.uid).eq('local_date', TDATE);
    await a.c.from('daily_checkins').delete().eq('user_id', a.uid).eq('local_date', TDATE);
    await b.c.from('daily_checkins').delete().eq('user_id', b.uid).eq('local_date', TDATE);
    // user_sports-Positivzeile von B-Stichprobe ist self-cleaning; Reste defensiv entfernen.
    await a.c.from('user_sports').delete().eq('user_id', a.uid).like('sport', 'TS_%');
    await b.c.from('user_sports').delete().eq('user_id', b.uid).like('sport', 'TS_%');
  } catch (e) { console.log('   (Cleanup-Hinweis: ' + e.message + ')'); }

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Testlauf-Fehler:', e.message); process.exit(2); });

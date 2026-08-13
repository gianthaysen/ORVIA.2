/* ORVIA · Phase 4.2f — ECHTER Supabase-Smoke-Test der atomaren Terminal-RPC.
   Bestätigt: completed/aborted werden serverseitig gesetzt, getActiveSession → null,
   active-Count → 0. KEINE Service-Role. Voraussetzung: 0004–0007 eingespielt.
   SUPABASE_URL=… SUPABASE_ANON_KEY=… A_EMAIL=… A_PW=… \
   node supabase/tests/live_workout_rpc_smoke_phase42_test.mjs */
import { existsSync as _exApp3 } from 'node:fs';
import { join as _j3, dirname as _d3 } from 'node:path';
import { fileURLToPath as _f3 } from 'node:url';
const HERE = _d3(_f3(import.meta.url));
const _hx3 = _j3(_d3(_f3(import.meta.url)), '..', '..');
const APP = [_hx3, _j3(_hx3, 'app'), _j3(_hx3, '..', 'app')].find(p => _exApp3(_j3(p, 'index.html'))) || _hx3;
/* supabase-js layoutrobust aufloesen — VOLLSTAENDIG SELBSTVERSORGEND (eigene
   Imports, eigene Pfade), damit dieser Block in jeder Testdatei identisch
   funktioniert. Statisch importiert stuerzte der Test VOR dem env-Guard ab
   und zaehlte als rot statt uebersprungen. */
const { createRequire: _crSB } = await import('node:module');
const { existsSync: _exSB } = await import('node:fs');
const { join: _jSB, dirname: _dSB } = await import('node:path');
const { fileURLToPath: _fSB } = await import('node:url');
const _hereSB = _dSB(_fSB(import.meta.url));
const _rootSB = _jSB(_hereSB, '..', '..');
const _appSB = [_rootSB, _jSB(_rootSB, 'app'), _jSB(_rootSB, '..', 'app')]
  .find(p => _exSB(_jSB(p, 'index.html'))) || _rootSB;
const _sbReq = (() => {
  for (const base of [_appSB, _jSB(_appSB, '..'), _jSB(_appSB, '..', '_dev'), _hereSB]) {
    try { const r = _crSB(_jSB(base, 'package.json')); r.resolve('@supabase/supabase-js'); return r; } catch (e) {}
    try { const r = _crSB(_jSB(base, 'x.js')); r.resolve('@supabase/supabase-js'); return r; } catch (e) {}
  }
  return null;
})();
if (!_sbReq) { console.log('⏭️  ÜBERSPRUNGEN — @supabase/supabase-js nicht auffindbar (npm i im App- oder Wurzelordner)'); process.exit(2); }
const { createClient } = _sbReq('@supabase/supabase-js');

const URL = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY;
const A = { email: process.env.A_EMAIL, pw: process.env.A_PW };
const miss = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'A_EMAIL', 'A_PW'].filter(k => !process.env[k]);
if (miss.length) { console.error('ENV fehlt: ' + miss.join(', ')); process.exit(2); }
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const TD = '2000-03-03';

const run = async () => {
  const s = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: au, error: ae } = await s.auth.signInWithPassword({ email: A.email, password: A.pw });
  if (ae || !au.user) { console.error('Login fehlgeschlagen: ' + (ae && ae.message)); process.exit(2); }
  const uid = au.user.id;
  await s.from('workout_sessions').delete().eq('user_id', uid).eq('local_date', TD);

  // completed via RPC
  let ins = await s.from('workout_sessions').insert({ user_id: uid, local_date: TD, status: 'active', started_at: new Date(Date.now() - 30 * 60000).toISOString(), client_session_id: 'rpc_c_' + Date.now() }).select().single();
  ok('aktive Session angelegt', !ins.error && ins.data);
  let rpc = await s.rpc('orvia_close_active_workout', { p_session_id: ins.data.id, p_target_status: 'completed', p_session_rpe: 7 });
  const cRow = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
  ok('RPC completed → Rückgabe completed', !rpc.error && cRow && cRow.status === 'completed' && cRow.finished_at, rpc.error && rpc.error.message);
  let chk = await s.from('workout_sessions').select('status,finished_at,duration_min').eq('id', ins.data.id).single();
  ok('DB bestätigt completed', !chk.error && chk.data.status === 'completed' && chk.data.finished_at != null);
  let act = await s.from('workout_sessions').select('id').eq('user_id', uid).eq('status', 'active');
  ok('keine aktive Session nach completed', !act.error && (act.data || []).length === 0);

  // aborted via RPC
  ins = await s.from('workout_sessions').insert({ user_id: uid, local_date: TD, status: 'active', started_at: new Date(Date.now() - 10 * 60000).toISOString(), client_session_id: 'rpc_a_' + Date.now() }).select().single();
  rpc = await s.rpc('orvia_close_active_workout', { p_session_id: ins.data.id, p_target_status: 'aborted', p_cancel_reason: 'smoke' });
  const aRow = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
  ok('RPC aborted → Rückgabe aborted', !rpc.error && aRow && aRow.status === 'aborted', rpc.error && rpc.error.message);
  chk = await s.from('workout_sessions').select('status').eq('id', ins.data.id).single();
  ok('DB bestätigt aborted', !chk.error && chk.data.status === 'aborted');
  act = await s.from('workout_sessions').select('id').eq('user_id', uid).eq('status', 'active');
  ok('active sessions = 0 nach Abbruch', !act.error && (act.data || []).length === 0);

  // RPC auf bereits beendete Session → Fehler (nicht aktiv)
  rpc = await s.rpc('orvia_close_active_workout', { p_session_id: ins.data.id, p_target_status: 'completed' });
  ok('RPC auf nicht-aktive Session → Fehler', !!rpc.error);

  await s.from('workout_sessions').delete().eq('user_id', uid).eq('local_date', TD);
  console.log(`\nErgebnis:\n${pass} bestanden\n${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Testlauf-Fehler:', e.message); process.exit(2); });

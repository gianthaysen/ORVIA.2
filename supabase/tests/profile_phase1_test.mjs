/* ORVIA · Phase-1 Profil — Unit-Tests (Ergebnisformat, computeAge, Neuer-Nutzer).
   Lädt die echten Module mit gestubbtem Supabase/Queue. Ausführen: node supabase/tests/profile_phase1_test.mjs */
import fs from 'fs';
import { fixedClock, installClock } from './_helpers.mjs';
let pass = 0, fail = 0;
const ok = (n, c, info) => { console.log((c ? '✅' : '❌') + ' ' + n + (info ? '  — ' + info : '')); c ? pass++ : fail++; };

global.window = {}; global.PROFILE = {};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/repos/repoBase.js');
load('js/repos/profileRepository.js');
load('js/profile-store.js');
const O = global.window.ORVIA;

// Konfigurierbarer Supabase-Stub (chainbar + awaitable).
function sbStub(result) {
  const obj = {};
  ['select', 'eq', 'order', 'limit', 'upsert', 'insert', 'update', 'delete'].forEach(m => obj[m] = () => obj);
  obj.maybeSingle = () => Promise.resolve(result);
  obj.then = (res, rej) => Promise.resolve(result).then(res, rej);
  return { from: () => obj };
}
const VALID_SOURCE = ['supabase', 'indexeddb', 'legacy_blob', 'empty'];
const VALID_SYNC = ['synced', 'pending', 'conflict', 'failed'];
function shape(r) {
  return r && typeof r.success === 'boolean'
    && ('data' in r) && ('error' in r)
    && VALID_SOURCE.includes(r.source) && VALID_SYNC.includes(r.sync_status)
    && (r.error === null || (typeof r.error === 'object'));
}

const run = async () => {
  // ---- Ergebnisformat (9 Fälle) ----
  // 1) Erfolgreicher Supabase-Load
  O.user = { id: 'A' }; O.sb = sbStub({ data: { user_id: 'A', name: 'Anna' }, error: null }); navigator.onLine = true;
  let r = await O.repos.profile.get();
  ok('1 Load: Format + success+supabase', shape(r) && r.success && r.source === 'supabase' && r.data.name === 'Anna');

  // 2) Profil nicht vorhanden
  O.sb = sbStub({ data: null, error: null });
  r = await O.repos.profile.get();
  ok('2 Kein Profil: success, data null, source empty', shape(r) && r.success && r.data === null && r.source === 'empty');

  // 3) Auth fehlt
  O.user = null; O.sb = sbStub({ data: null, error: null });
  r = await O.repos.profile.get();
  ok('3 Auth fehlt: success false, source empty, no_session', shape(r) && !r.success && r.source === 'empty' && r.error.code === 'no_session');

  // 4) Supabase fehlt
  O.user = { id: 'A' }; O.sb = null;
  r = await O.repos.profile.get();
  ok('4 Supabase fehlt: success false, no_client', shape(r) && !r.success && r.error.code === 'no_client');

  // 5) Repository fehlt (persist ohne O.repos.profile)
  const savedRepo = O.repos.profile; O.sb = sbStub({ data: [{}], error: null });
  delete O.repos.profile;
  r = await O.profileStore.persist();
  ok('5 Repository fehlt: success false, Meldung', shape(r) && !r.success && /Repository fehlt/.test(r.error.message));
  O.repos.profile = savedRepo;

  // 6) Offline (get)
  navigator.onLine = false;
  r = await O.repos.profile.get();
  ok('6 Offline get: success false, source indexeddb, pending', shape(r) && !r.success && r.source === 'indexeddb' && r.sync_status === 'pending');

  // 7) Offline-Queue fehlt (persist offline ohne Queue)
  global.PROFILE = { name: 'A' }; O.offlineQueue = undefined;
  r = await O.profileStore.persist();
  ok('7 Offline-Queue fehlt: success false, indexeddb', shape(r) && !r.success && r.source === 'indexeddb' && /Queue nicht verfügbar/.test(r.error.message));

  // 8) Queue wirft Fehler
  O.offlineQueue = { enqueue: () => { throw new Error('idb kaputt'); } };
  r = await O.profileStore.persist();
  ok('8 Queue-Fehler: success false, indexeddb failed', shape(r) && !r.success && r.sync_status === 'failed' && /idb kaputt/.test(r.error.message));

  // 8b) Queue meldet success:false
  O.offlineQueue = { enqueue: async () => ({ success: false, error: { message: 'voll' }, source: 'indexeddb', sync_status: 'failed' }) };
  r = await O.profileStore.persist();
  ok('8b Queue success:false → kein falscher Erfolg', shape(r) && !r.success);

  // 8c) Queue erfolgreich → pending
  O.offlineQueue = { enqueue: async () => ({ success: true, data: {}, error: null, source: 'indexeddb', sync_status: 'pending' }) };
  r = await O.profileStore.persist();
  ok('8c Queue ok → success true, pending', shape(r) && r.success && r.source === 'indexeddb' && r.sync_status === 'pending');

  // 9) Supabase-Fehler
  navigator.onLine = true; O.sb = sbStub({ data: null, error: { message: 'db down' } });
  r = await O.repos.profile.get();
  ok('9 Supabase-Fehler: success false, query_failed', shape(r) && !r.success && r.error.code === 'query_failed');

  // ---- computeAge (8 Fälle) — P0: feste Uhr (12:00 lokal, keine Mitternachts-/Geburtstagsgrenze) ----
  const CLK = fixedClock(new Date(2026, 5, 15, 12).getTime());
  installClock(O, CLK);
  const ca = O.profileStore.computeAge;
  const today = new Date(CLK.now());
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const bdToday = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
  const bdTomorrow = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate() + 1);
  const bdYesterday = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate() - 1);
  ok('A Geburtstag heute → 30', ca(iso(bdToday), null) === 30);
  ok('B Geburtstag morgen → 29', ca(iso(bdTomorrow), null) === 29);
  ok('C Geburtstag gestern → 30', ca(iso(bdYesterday), null) === 30);
  ok('D Schaltjahr 2000-02-29 gültig (Zahl)', typeof ca('2000-02-29', null) === 'number');
  ok('E ungültiges Datum 2023-13-40 → Fallback est 40', ca('2023-13-40', 40) === 40);
  ok('F kein birthDate, est 25 → 25', ca('', 25) === 25);
  ok('G weder noch → null', ca('', null) === null);
  ok('H unrealistisch (Jahr 1800) → null', ca('1800-01-01', null) === null);

  // ---- Neuer Nutzer: nur Mapped neutralisieren, Legacy bleibt ----
  global.PROFILE = {
    name: 'ALT', hfMax: 201, rhrBaseline: 58, weightKg: 80, age: 99, sleepGoalH: 7, timezone: 'X',
    // Legacy:
    goals: ['x'], sports: ['Gym'], weekPlan: [[1]], level: 'profi', gear: ['shoe'], issues: ['knee'], location: 'Flensburg'
  };
  O.user = { id: 'B' }; O.sb = sbStub({ data: null, error: null }); navigator.onLine = true;
  const hr = await O.profileStore.hydrate();
  const P = global.PROFILE;
  ok('Neuer Nutzer: hydrate success, source empty', hr.success && hr.source === 'empty');
  ok('Mapped neutralisiert (name/hfMax/rhr/weight/age/sleep/tz = null)',
     P.name === null && P.hfMax === null && P.rhrBaseline === null && P.weightKg === null && P.age === null && P.sleepGoalH === null && P.timezone === null);
  ok('Legacy ERHALTEN (goals/sports/weekPlan/level/gear/issues/location)',
     JSON.stringify(P.goals) === '["x"]' && P.sports[0] === 'Gym' && P.weekPlan && P.level === 'profi' && P.gear[0] === 'shoe' && P.issues[0] === 'knee' && P.location === 'Flensburg');

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });

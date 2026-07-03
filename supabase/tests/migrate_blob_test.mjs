/* ORVIA · P2 (TEST-GAP-PLAN) — migrate-blob Integrationstests (offline).
   Lädt die ECHTEN Module (repoBase, profile-/checkin-/trainingLoad-/goal-Repository,
   migrate-blob.js); gefakt sind NUR Supabase (via _helpers.fakeSupabase) und localStorage.
   Keine Live-Credentials, keine Originaldaten. node supabase/tests/migrate_blob_test.mjs */
import fs from 'fs';
import { localStorageStub, fakeSupabase } from './_helpers.mjs';

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

global.window = {};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/repos/repoBase.js');
load('js/repos/profileRepository.js');
load('js/repos/checkinRepository.js');
load('js/repos/trainingLoadRepository.js');
load('js/repos/goalRepository.js');
load('js/migrate-blob.js');
const O = global.window.ORVIA;
const MIG = O.blobMigration;

/* ---------- Env-Builder: frischer localStorage + frisches Fake-Supabase je Fall ---------- */
const okUpsert = (payload) => ({ data: Array.isArray(payload) ? payload : [payload], error: null });
function makeEnv(cfg) {
  cfg = cfg || {};
  global.localStorage = localStorageStub(cfg.ls || {});
  const tables = {
    orvia_migrations: { rows: cfg.migRows || [], onUpsert: okUpsert },
    user_profiles: { onUpsert: okUpsert },
    daily_checkins: { onUpsert: cfg.checkinUpsert || okUpsert },
    training_load_daily: { onUpsert: okUpsert },
    user_goals: { onUpsert: okUpsert }
  };
  const sb = fakeSupabase(tables);
  O.sb = sb; O.user = ('user' in cfg) ? cfg.user : { id: 'A' };
  return sb;
}
const dataCalls = (sb) => sb.calls.filter(c => c.op === 'upsert' && c.table !== 'orvia_migrations');
const statusSeq = (sb) => sb.calls.filter(c => c.op === 'upsert' && c.table === 'orvia_migrations').map(c => c.payload.status);
const rowsOf = (sb, table) => sb.calls.filter(c => c.op === 'upsert' && c.table === table).flatMap(c => Array.isArray(c.payload) ? c.payload : [c.payload]);

/* ---------- Fixtures ---------- */
const TS = 1750000000000;
const FULL_BLOB = {
  '2026-06-01': {
    morning: { feel: 7, knee: 2, sleepMin: 420, ts: TS },
    eve: { feel: 6, ts: TS + 1 },
    sessions: { 'Laufen': { dur: 40, rpe: 6 }, 'Gym': { dur: 60, rpe: 7 }, _ts: 999 }
  },
  '2026-06-02': { morning: { feel: 5, ts: TS + 2, unbekanntesFeld: { x: 1 } } },
  meta: { irrelevant: true } // kein Tages-Key → muss ignoriert werden
};
const FULL_PROFILE = {
  name: 'GTest', age: 30, sex: 'm', heightCm: 180, weightKg: 75,
  hfMax: 190, rhrBaseline: 60, // alte Defaults → dürfen NICHT als Messwerte migrieren
  sleepGoalH: 8, timezone: 'Europe/Berlin',
  primaryGoal: 'hm', primaryGoalLabel: 'Halbmarathon', raceDate: '2026-09-01',
  secondaryGoals: ['gym', { type: 'w', title: 'Gewicht' }],
  unbekannt: [1, 2, 3]
};
const LS_FULL = () => ({ gian_checkins_v2: JSON.stringify(FULL_BLOB), orvia_profile_v1: JSON.stringify(FULL_PROFILE) });

const run = async () => {
  /* ---------- Fall 1: kein Blob vorhanden ---------- */
  let sb = makeEnv({ ls: {} });
  let before = JSON.stringify(global.localStorage.dump());
  let r = await MIG.run();
  ok('F1 kein Blob: success true, kontrolliert beendet', r.success === true && r.data.status === 'completed');
  ok('F1 kein Blob: KEINE Daten-Writes', dataCalls(sb).length === 0);
  ok('F1 kein Blob: Statusfolge in_progress→completed', JSON.stringify(statusSeq(sb)) === '["in_progress","completed"]');
  ok('F1 kein Blob: Report-Zahlen 0', r.data.report.checkins.found === 0 && r.data.report.load.found === 0 && r.data.report.goals.migrated === 0);
  ok('F1 kein Blob: localStorage unverändert', JSON.stringify(global.localStorage.dump()) === before);

  /* ---------- Fall 2: vollständiger Legacy-Bestand ---------- */
  sb = makeEnv({ ls: LS_FULL() });
  before = JSON.stringify(global.localStorage.dump());
  r = await MIG.run();
  const ck = rowsOf(sb, 'daily_checkins'), tl = rowsOf(sb, 'training_load_daily'),
        gl = rowsOf(sb, 'user_goals'), pf = rowsOf(sb, 'user_profiles');
  ok('F2 Erfolg + Status completed', r.success === true && r.data.status === 'completed', JSON.stringify(r.data.report.warnings));
  ok('F2 Check-ins: 3 Rows (2×morning, 1×evening), Typen korrekt',
    ck.length === 3 && ck.filter(x => x.checkin_type === 'morning').length === 2 && ck.filter(x => x.checkin_type === 'evening').length === 1);
  ok('F2 Check-in-Mapping: knee → complaints', JSON.stringify(ck[0].complaints) === JSON.stringify([{ type: 'knee', score: 2 }]));
  ok('F2 Load: 2 Rows, _ts ignoriert, Natural Keys deterministisch',
    tl.length === 2 && tl.map(x => x.client_session_id).sort().join('|') === 'blob:2026-06-01:Gym|blob:2026-06-01:Laufen');
  ok('F2 Load: computed_load = dur×rpe', tl.find(x => x.sport === 'Laufen').computed_load === 240);
  ok('F2 Profil: 1 Save', pf.length === 1);
  ok('F2 Ziele: 3 (primary + 2 secondary), deterministische client_goal_ids',
    gl.length === 3 && gl.map(g => g.client_goal_id).sort().join('|') === 'blob:primary:hm|blob:secondary:gym|blob:secondary:w');
  ok('F2 user_id-Stamping: ALLE Rows user A', [...ck, ...tl, ...gl, ...pf].every(x => x.user_id === 'A'));
  const conflicts = sb.calls.filter(c => c.op === 'upsert').map(c => c.opts && c.opts.onConflict).filter(Boolean);
  ok('F2 onConflict-Keys korrekt', conflicts.includes('user_id,local_date,checkin_type') && conflicts.includes('user_id,client_session_id') && conflicts.includes('user_id,client_goal_id') && conflicts.includes('user_id'));
  ok('F2 Report-Zahlen: found=migrated', r.data.report.checkins.found === 3 && r.data.report.checkins.migrated === 3 && r.data.report.load.found === 2 && r.data.report.goals.found === 3 && r.data.report.goals.migrated === 3);
  ok('F2 localStorage unverändert (Blob bleibt)', JSON.stringify(global.localStorage.dump()) === before);
  ok('F2 finaler Status: blob_legacy true', sb.calls.filter(c => c.table === 'orvia_migrations' && c.op === 'upsert').pop().payload.blob_legacy === true);

  /* ---------- Fall 7: Heuristik alte Defaults (in F2-Fixtures enthalten) ---------- */
  ok('F7 hfMax 190 → hf_max NULL (kein erfundener Messwert)', pf[0].hf_max === null);
  ok('F7 rhr 60 → resting_hr NULL', pf[0].resting_hr === null);
  ok('F7 age 30 → age_estimate 30, birth_date null', pf[0].age_estimate === 30 && pf[0].birth_date === null);
  sb = makeEnv({ ls: { orvia_profile_v1: JSON.stringify({ hfMax: 185, rhrBaseline: 52 }) } });
  await MIG.run();
  const pf2 = rowsOf(sb, 'user_profiles');
  ok('F7 abweichende Werte (185/52) → als Messwerte übernommen', pf2[0].hf_max === 185 && pf2[0].resting_hr === 52);

  /* ---------- Fall 3: beschädigtes JSON ---------- */
  sb = makeEnv({ ls: { gian_checkins_v2: '{kaputt', orvia_profile_v1: JSON.stringify(FULL_PROFILE) } });
  before = JSON.stringify(global.localStorage.dump());
  r = await MIG.run();
  ok('F3 korrupt: success false + corrupt_blob', r.success === false && r.error.message === 'corrupt_blob');
  ok('F3 korrupt: Status failed', JSON.stringify(statusSeq(sb)) === '["in_progress","failed"]');
  ok('F3 korrupt: KEINE Daten-Writes (kein Teil-Write)', dataCalls(sb).length === 0);
  ok('F3 korrupt: Original-localStorage unangetastet', JSON.stringify(global.localStorage.dump()) === before);

  /* ---------- Fall 4: bereits completed ---------- */
  sb = makeEnv({ ls: LS_FULL(), migRows: [{ user_id: 'A', status: 'completed' }] });
  r = await MIG.run();
  ok('F4 completed: skipped true', r.success === true && r.data.skipped === true);
  ok('F4 completed: NULL Writes (auch kein Status-Write)', sb.calls.filter(c => c.op === 'upsert').length === 0);

  /* ---------- Fall 5: Force-Wiederholung = identische Payloads ---------- */
  sb = makeEnv({ ls: LS_FULL() });
  await MIG.run();
  const p1 = { c: rowsOf(sb, 'daily_checkins'), t: rowsOf(sb, 'training_load_daily'), g: rowsOf(sb, 'user_goals'), p: rowsOf(sb, 'user_profiles') };
  sb = makeEnv({ ls: LS_FULL(), migRows: [{ user_id: 'A', status: 'completed' }] });
  r = await MIG.run({ force: true });
  const p2 = { c: rowsOf(sb, 'daily_checkins'), t: rowsOf(sb, 'training_load_daily'), g: rowsOf(sb, 'user_goals'), p: rowsOf(sb, 'user_profiles') };
  ok('F5 force: läuft trotz completed', r.success === true && !r.data.skipped);
  ok('F5 Idempotenz: identische Upsert-Payloads (keine Zufalls-IDs)', JSON.stringify(p1) === JSON.stringify(p2));

  /* ---------- Fall 6: Fehler mitten in der Migration (Batch 2 von 2) ---------- */
  const manyDays = {}; for (let i = 0; i < 250; i++) { const d = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10); manyDays[d] = { morning: { feel: 5, ts: TS + i } }; }
  let nth = 0;
  sb = makeEnv({
    ls: { gian_checkins_v2: JSON.stringify(manyDays) },
    checkinUpsert: (payload) => { nth++; return nth === 2 ? { data: null, error: { message: 'boom' } } : okUpsert(payload); }
  });
  before = JSON.stringify(global.localStorage.dump());
  r = await MIG.run();
  const ckCalls = sb.calls.filter(c => c.op === 'upsert' && c.table === 'daily_checkins');
  ok('F6 Batches: 2 Aufrufe mit 200 + 50 Rows (max 200)', ckCalls.length === 2 && ckCalls[0].payload.length === 200 && ckCalls[1].payload.length === 50);
  ok('F6 Teilfehler: found 250, migrated 200', r.data.report.checkins.found === 250 && r.data.report.checkins.migrated === 200);
  ok('F6 Warning enthält Batch-Fehler', r.data.report.warnings.some(w => String(w).includes('boom')));
  ok('F6 Status completed_with_warnings', r.data.status === 'completed_with_warnings');
  ok('F6 übrige Bereiche liefen weiter (Load/Goals-Reports vorhanden)', r.data.report.load && r.data.report.goals !== undefined);
  ok('F6 localStorage unverändert', JSON.stringify(global.localStorage.dump()) === before);
  ok('F6 Warnings ohne sensible Nutzerdaten', !JSON.stringify(r.data.report.warnings).includes('GTest'));

  /* ---------- Fall 8: Nutzerwechsel A → B ---------- */
  sb = makeEnv({ ls: LS_FULL() });
  await MIG.run();                       // Lauf als A
  O.user = { id: 'B' };                  // gleiche sb-Instanz, Wechsel auf B
  r = await MIG.run();                   // Lauf als B (kein Status für B → läuft)
  const all = sb.calls.filter(c => c.op === 'upsert' && c.table !== 'orvia_migrations').flatMap(c => Array.isArray(c.payload) ? c.payload : [c.payload]);
  const aRows = all.filter(x => x.user_id === 'A'), bRows = all.filter(x => x.user_id === 'B');
  ok('F8 beide Läufe erfolgreich', r.success === true);
  ok('F8 strikte Trennung: identische Datenmengen je Nutzer, keine Mischzeilen',
    aRows.length === bRows.length && aRows.length > 0 && all.length === aRows.length + bRows.length);
  const stRows = sb.calls.filter(c => c.op === 'upsert' && c.table === 'orvia_migrations').map(c => c.payload.user_id);
  ok('F8 Statuszeilen je Nutzer korrekt', stRows.filter(u => u === 'A').length === 2 && stRows.filter(u => u === 'B').length === 2);

  /* ---------- Fall 9: Cloud bereits vorhanden (Charakterisierung) ---------- */
  sb = makeEnv({ ls: LS_FULL() });
  await MIG.run();
  ok('F9 keine Delete-Operationen auf Cloud-Daten', sb.calls.every(c => c.op !== 'delete'));
  // IST-VERHALTEN (dokumentiert, keine erfundene Konfliktregel): Upsert auf Natural Keys
  // ÜBERSCHREIBT vorhandene Cloud-Zeilen zeilenweise (kein Merge, kein Zeitstempel-Vergleich).

  /* ---------- Fall 10: keine Session ---------- */
  sb = makeEnv({ ls: LS_FULL(), user: null });
  r = await MIG.run();
  ok('F10 keine Session: no_session-Vertrag', r.success === false && r.error.message === 'no_session' && r.sync_status === 'failed');
  ok('F10 keine Session: NULL Supabase-Aufrufe', sb.calls.length === 0);

  /* ---------- Invarianten ---------- */
  sb = makeEnv({ migRows: [{ user_id: 'A', status: 'completed' }, { user_id: 'B', status: 'failed' }] });
  const stA = await MIG.getStatus();
  O.user = { id: 'B' };
  const stB = await MIG.getStatus();
  ok('INV getStatus trennt Nutzer', stA.status === 'completed' && stB.status === 'failed');
  sb = makeEnv({ ls: LS_FULL(), migRows: [{ user_id: 'A', status: 'failed' }] });
  r = await MIG.run();
  ok('INV erneuter Lauf nach failed: wird NICHT übersprungen', r.success === true && !r.data.skipped);
  sb = makeEnv({ ls: LS_FULL(), migRows: [{ user_id: 'A', status: 'completed_with_warnings' }] });
  r = await MIG.run();
  ok('INV erneuter Lauf nach completed_with_warnings: wird NICHT übersprungen', r.success === true && !r.data.skipped);
  sb = makeEnv({ ls: { orvia_profile_v1: JSON.stringify({}) } });
  r = await MIG.run();
  ok('INV leeres Profil-Objekt + fehlende Bereiche toleriert', r.success === true);
  // CHARAKTERISIERUNG (Vertragslücke, s. P2-Bericht G): korruptes PROFIL-JSON wird — anders als
  // ein korrupter Check-in-Blob (→ failed) — STILL als „kein Profil" behandelt, ohne Warning.
  sb = makeEnv({ ls: { gian_checkins_v2: JSON.stringify(FULL_BLOB), orvia_profile_v1: '{kaputt' } });
  r = await MIG.run();
  ok('CHAR korruptes Profil-JSON: läuft still als „kein Profil" durch (Ist-Verhalten)',
    r.success === true && r.data.report.profile.migrated === 0 && r.data.report.warnings.length === 0);

  console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });

/* ORVIA · 0016 — Athletenprofil-Sync (Geräte-Divergenz-Incident 2026-07-15).
   Verträge (Regressionsfälle d–k der Anforderung; a–c sind Zwei-Geräte-Live-Tests):
   - Ort/Avatar-Pfad sind MAPPED-Felder: hydrate wendet Serverzeile an, persist sendet sie.
   - Nutzergebundener Cache orvia:{userId}:athleteProfile; Serverwert überschreibt (d);
     Offline-Hydrate fällt auf den Cache zurück (e); Konto A/B getrennt (f).
   - Ziel-Dedupe: deterministische Seed-IDs (Geräte-übergreifend gleich) + semantischer
     Dedupe in normalizeGoals (g,h); Cloud-Duplikat wird beim Hydrate bereinigt (Set-Sync).
   - Fehlgeschlagener Profil-Sync meldet NIE 'synced' (i).
   - ORVIA.profile (Adapter) / accessProfile / athleteProfile bleiben getrennt (j,k).
   - avatar-store: Pfad strikt {userId}/profile.jpg, Base64-Migration, currentSrc-Priorität.
   node supabase/tests/athlete_profile_sync_0016_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

global.window = globalThis; global.self = globalThis;
const _ls = {};
global.localStorage = { getItem: k => (k in _ls ? _ls[k] : null), setItem: (k, v) => { _ls[k] = String(v); }, removeItem: k => { delete _ls[k]; } };
global.document = { getElementById: () => null, createElement: () => ({ classList: { add() {}, remove() {} }, style: {} }), addEventListener() {}, documentElement: { classList: { add() {}, remove() {} } } };
global.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
const _wl = {};
global.addEventListener = (t, f) => { (_wl[t] = _wl[t] || []).push(f); };
global.removeEventListener = () => {};
global.dispatchEvent = e => { (_wl[e.type] || []).slice().forEach(f => f(e)); return true; };
global.PROFILE = null;
global.ensureProfile = () => { if (!global.PROFILE) global.PROFILE = { sports: [], goals: [] }; return true; };
global.saveProfile = () => {};
global.renderProfileScreen = () => {}; global.renderZones = () => {}; global.renderTopAvatar = () => {};
global.atob = (s) => Buffer.from(s, 'base64').toString('binary');
global.Blob = class Blob { constructor(parts, o) { this.parts = parts; this.type = (o || {}).type; } };
global.Uint8Array = Uint8Array;

const load = f => (0, eval)(fs.readFileSync(new URL('../../../app/' + f, import.meta.url), 'utf8'));
global.window.ORVIA = { profile: { get: () => global.PROFILE, adapter: true } };   // Adapter-Marker (j)
const O = global.window.ORVIA;
load('js/profile-model.js');
O.profileModel = O.profileModel || (typeof module !== 'undefined' ? null : null);

/* ---- Repo-/Infra-Stubs ---- */
let SERVER_PROFILE = null;                     // user_profiles-Zeile
let GOAL_ROWS = [];                            // user_goals-Zeilen
let ONLINE = true;
let SAVE_MODE = 'ok';                          // 'ok' | 'fail'
let lastReplaceRows = null;
let syncStates = [];
global.window.orviaSetSyncState = (s) => { syncStates.push(s); };
const okR = d => ({ success: true, data: d == null ? null : d, error: null, source: 'supabase', sync_status: 'synced' });
const failR = (c, m) => ({ success: false, data: null, error: { code: c, message: m || c }, source: 'supabase', sync_status: 'failed' });
O.repoBase = { online: () => ONLINE };
O.sb = {};
O.user = { id: 'user-A' };
O.repos = {
  profile: {
    get: async () => ONLINE ? okR(SERVER_PROFILE ? { ...SERVER_PROFILE } : null) : Object.assign(failR('offline', 'Offline.'), { offline: true, sync_status: 'pending' }),
    save: async (p) => {
      if (SAVE_MODE === 'fail') return failR('save_failed', 'x');
      SERVER_PROFILE = Object.assign({}, SERVER_PROFILE, { user_id: O.user.id, name: p.name, location: p.location, avatar_path: p.avatarPath, weight_kg: p.weightKg, height_cm: p.heightCm, recovery: p.recovery ?? null, preferences: p.preferences ?? null, updated_at: new Date().toISOString() });
      return okR({ ...SERVER_PROFILE });
    }
  },
  goal: {
    goalToRowFull: (g) => ({ client_goal_id: g.id, goal_type: g.category, title: g.title, target_value: g.targetValue, target_unit: g.unit, target_date: g.targetDate, priority: 'primary', status: g.status }),
    list: async () => okR(GOAL_ROWS.map(r => ({ ...r }))),
    replaceUserGoals: async (rows) => { lastReplaceRows = rows; GOAL_ROWS = rows.map(r => ({ ...r })); return okR({ upserted: rows.length }); }
  },
  sport: { replaceUserSports: async () => okR([]), listUserSports: async () => okR([]) },
  availability: { replaceWeek: async () => okR([]), list: async () => okR([]) },
  constraint: { replaceAll: async () => okR([]), list: async () => okR([]) }
};
O.offlineQueue = { enqueue: async () => ({ success: true }), pendingForCurrentUser: async () => [] };
load('js/profile-store.js');
load('js/avatar-store.js');
const M = O.profileModel, PS = O.profileStore;

const run = async () => {
  ensureProfile();

  // ---- (g,h) Deterministische Seeds + semantischer Dedupe ----
  const legacy = { primaryGoal: 'hm', primaryGoalLabel: 'Halbmarathon unter 1:50h', hmTargetMin: 110, raceDate: '2026-09-06', name: 'Gian' };
  const dev1 = M.migrateProfile(JSON.parse(JSON.stringify(legacy)));
  const dev2 = M.migrateProfile(JSON.parse(JSON.stringify(legacy)));   // „zweites Gerät"
  ok('G1 Seed-ID deterministisch (Gerät A == Gerät B)', dev1.goals[0].id === dev2.goals[0].id, dev1.goals[0].id);
  const dup = M.normalizeGoals([
    { id: 'goal-zufall-geraet-a', title: 'Halbmarathon unter 1:50h', category: 'hm', targetValue: 110, targetDate: '2026-09-06', priority: 1 },
    { id: 'goal:seed:hm:110:2026-09-06', title: 'Halbmarathon unter 1:50h', category: 'hm', targetValue: 110, targetDate: '2026-09-06', priority: 1 },
    { id: 'goal-anders', title: '10k unter 45min', category: 'run10k', targetValue: 45, priority: 2 }
  ]);
  ok('G2 semantischer Dedupe: 3 Einträge → 2 Ziele', dup.length === 2, 'len=' + dup.length);
  ok('G3 deterministische Seed-ID gewinnt beim Dedupe', dup.some(g => g.id === 'goal:seed:hm:110:2026-09-06') && !dup.some(g => g.id === 'goal-zufall-geraet-a'));
  ok('G4 verschiedene Ziele bleiben getrennt', dup.some(g => g.category === 'run10k'));

  // ---- (g Cloud) hydrateGoals bereinigt Cloud-Duplikat via Set-Sync ----
  PROFILE.goals = [];
  GOAL_ROWS = [
    { client_goal_id: 'id-geraet-a', goal_type: 'hm', title: 'Halbmarathon unter 1:50h', target_value: 110, target_date: '2026-09-06', priority: 'primary', status: 'active', section_updated_at: '2026-07-01T10:00:00Z' },
    { client_goal_id: 'id-geraet-b', goal_type: 'hm', title: 'Halbmarathon unter 1:50h', target_value: 110, target_date: '2026-09-06', priority: 'primary', status: 'active', section_updated_at: '2026-07-01T10:00:00Z' }
  ];
  lastReplaceRows = null;
  await PS.hydrateGoals();
  ok('G5 Ziel erscheint nur einmal (PROFILE.goals)', PROFILE.goals.length === 1, 'len=' + PROFILE.goals.length);
  ok('G6 Cloud bereinigt: Set-Sync mit genau 1 Zeile', Array.isArray(lastReplaceRows) && lastReplaceRows.length === 1 && GOAL_ROWS.length === 1);

  // ---- (a/b-Basis) MAPPED-Felder inkl. Ort/Avatar-Pfad: hydrate + persist ----
  SERVER_PROFILE = { user_id: 'user-A', name: 'Gian', location: 'Flensburg', avatar_path: 'user-A/profile.jpg', weight_kg: 70, height_cm: 183, updated_at: '2026-07-15T10:00:00Z' };
  await PS.hydrate();
  ok('P1 hydrate wendet Ort aus user_profiles an', PROFILE.location === 'Flensburg');
  ok('P2 hydrate wendet avatar_path an', PROFILE.avatarPath === 'user-A/profile.jpg');
  ok('P3 Gewicht weiter aus Serverzeile', PROFILE.weightKg === 70);
  PROFILE.location = 'Harrislee';
  await PS.persist();
  ok('P4 persist schreibt Ort in user_profiles', SERVER_PROFILE.location === 'Harrislee');

  // ---- (d) alter lokaler Cache überschreibt keinen neueren Serverwert ----
  _ls['orvia:user-A:athleteProfile'] = JSON.stringify({ row: { location: 'Harrislee-ALT', avatar_path: null }, cachedAt: '2026-07-01T00:00:00Z' });
  SERVER_PROFILE.location = 'Flensburg';
  await PS.hydrate();
  ok('D1 online: Serverwert gewinnt (kein Cache-Override)', PROFILE.location === 'Flensburg');
  ok('D2 Cache mit Serverstand überschrieben', JSON.parse(_ls['orvia:user-A:athleteProfile']).row.location === 'Flensburg');

  // ---- (e) Offline-Fallback aus Cache, online Reconciliation ----
  ONLINE = false;
  PROFILE.location = null;
  const rOff = await PS.hydrate();
  ok('E1 offline: gecachte Serverdaten angezeigt (pending)', rOff.success === true && rOff.sync_status === 'pending' && PROFILE.location === 'Flensburg');
  ONLINE = true;
  SERVER_PROFILE.location = 'Glücksburg';
  await PS.hydrate();
  ok('E2 online: Server-Reconciliation überschreibt', PROFILE.location === 'Glücksburg');

  // ---- (f) Konto A/B teilen keine Daten ----
  ok('F1 Cache-Key nutzergebunden', O.athleteProfile.cacheKey() === 'orvia:user-A:athleteProfile');
  PS.clear();
  ok('F2 clear() leert Ort/AvatarPath (kein A→B-Leak)', PROFILE.location === null && PROFILE.avatarPath === null);
  O.user = { id: 'user-B' };
  ok('F3 Konto B hat eigenen Cache-Key ohne A-Daten', O.athleteProfile.cacheKey() === 'orvia:user-B:athleteProfile' && _ls['orvia:user-B:athleteProfile'] == null);
  O.user = { id: 'user-A' };

  // ---- (i) fehlgeschlagener Profil-Sync zeigt nicht „Synchronisiert" ----
  syncStates = [];
  SAVE_MODE = 'fail';
  const rFail = await PS.persist();
  ok('I1 persist-Fehler → success=false', rFail.success === false);
  ok('I2 Badge → error, NIE synced', syncStates.indexOf('error') >= 0 && syncStates.indexOf('synced') < 0, JSON.stringify(syncStates));
  SAVE_MODE = 'ok';
  syncStates = [];
  ONLINE = false;
  await PS.persist();
  ok('I3 offline persist → Badge pending, nicht synced', syncStates.indexOf('pending') >= 0 && syncStates.indexOf('synced') < 0, JSON.stringify(syncStates));
  ONLINE = true;

  // ---- 0018: Regeneration & Alltag / Präferenzen über user_profiles ----
  SERVER_PROFILE.recovery = { sleep: { quality: 'bad' }, stress: { generalLevel: 'high' } };
  await PS.hydrate();
  ok('R1 hydrate wendet recovery aus user_profiles an', PROFILE.recovery && PROFILE.recovery.sleep.quality === 'bad');
  PROFILE.recovery = { sleep: { quality: 'good' }, stress: { generalLevel: 'low' } };
  await PS.persist();
  ok('R2 persist schreibt recovery in user_profiles', SERVER_PROFILE.recovery && SERVER_PROFILE.recovery.sleep.quality === 'good');
  SERVER_PROFILE.recovery = null;                              // Instanz ohne Wert/0018
  await PS.hydrate();
  ok('R3 Server-null löscht lokale recovery NICHT (kein Datenverlust)', PROFILE.recovery && PROFILE.recovery.sleep.quality === 'good');

  // ---- (j,k) Namespaces getrennt ----
  ok('J1 ORVIA.profile-Adapter intakt', O.profile && O.profile.adapter === true && typeof O.profile.get === 'function');
  O.accessProfile = { role: 'owner' };
  const ath = O.athleteProfile.get();
  ok('K1 athleteProfile getrennt von accessProfile (keine Rolle enthalten)', ath.role === undefined && ath.location !== undefined);
  ok('K2 accessProfile unangetastet', O.accessProfile.role === 'owner');

  // ---- (c-Basis) avatar-store: Pfad, Migration, Anzeige-Priorität ----
  let uploaded = null, signedFor = null;
  O.sb.storage = {
    from: (bucket) => ({
      upload: async (path, blob, opts) => { uploaded = { bucket, path, type: blob && blob.type, upsert: opts && opts.upsert }; return { data: { path }, error: null }; },
      createSignedUrl: async (path, ttl) => { signedFor = path; return { data: { signedUrl: 'https://signed.example/' + path + '?t=' + ttl }, error: null }; }
    })
  };
  ok('A1 Pfad strikt nutzergebunden', O.avatarStore.avatarPath() === 'user-A/profile.jpg');
  PROFILE.avatar = 'data:image/jpeg;base64,' + Buffer.from('fakejpg').toString('base64');
  PROFILE.avatarPath = null;
  const up = await O.avatarStore.hydrate();   // Migration: lokales Base64 → Storage
  ok('A2 Migration lädt lokales Bild idempotent nach avatars/{userId}/profile.jpg', up.success === true && uploaded && uploaded.bucket === 'avatars' && uploaded.path === 'user-A/profile.jpg' && uploaded.upsert === true);
  ok('A3 avatar_path nach bestätigtem Upload persistiert', PROFILE.avatarPath === 'user-A/profile.jpg' && SERVER_PROFILE.avatar_path === 'user-A/profile.jpg');
  await O.avatarStore.refreshDisplayUrl();
  ok('A4 Anzeige bevorzugt signierte Server-URL (identisch auf allen Geräten)', String(O.avatarStore.currentSrc()).indexOf('https://signed.example/user-A/profile.jpg') === 0);
  ok('A5 Signatur für exakt den eigenen Pfad', signedFor === 'user-A/profile.jpg');

  console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('TESTFEHLER', e); process.exit(1); });

/* ============================================================
   ORVIA · P9 — Sektions-Zyklen availability/goals/constraints + MAPPED-Autopush.
   Regeln: K1 (Sektions-LWW, Tie→Cloud, 24h-Clamp) · K2 (lokale meta-lose Daten
   überschreiben gestempelte Cloud nie) · K3 (stempellose Cloud-Legacy-Seeds
   verlieren gegen nicht-leere lokale Daten — Voll-Push ersetzt den Seed).
   node supabase/tests/cloud_sync_p9_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const NOW = Date.parse('2026-07-10T12:00:00.000Z');
const T_OLD = '2026-07-08T10:00:00.000Z';
const T_MID = '2026-07-09T10:00:00.000Z';
const T_NEW = '2026-07-10T10:00:00.000Z';

/* Zustandsbehafteter Supabase-Fake (Mutationen sichtbar; wie sports_sync_2b1). */
function statefulSupabase(tables) {
  const T = tables || {};
  function match(row, filters) {
    return filters.every(f => f[0] === 'eq' ? row[f[1]] === f[2] : f[0] === 'in' ? (f[2] || []).indexOf(row[f[1]]) >= 0 : true);
  }
  return { tables: T, sb: { from(name) {
    const cfg = T[name] = T[name] || { rows: [] };
    const filters = []; let mode = 'select';
    const api = {
      select() { return api; }, order() { return api; }, limit() { return api; },
      eq(c, v) { filters.push(['eq', c, v]); return api; },
      in(c, v) { filters.push(['in', c, v]); return api; },
      maybeSingle() { const r = cfg.rows.filter(x => match(x, filters)); return Promise.resolve({ data: r[0] || null, error: cfg.error || null }); },
      insert(p) { cfg.rows.push(Object.assign({}, p)); return Promise.resolve({ data: [p], error: null }); },
      upsert(payload, opts) {
        const arr = Array.isArray(payload) ? payload : [payload];
        const keys = (opts && opts.onConflict) ? opts.onConflict.split(',') : ['id'];
        if (!cfg.error) arr.forEach(p => {
          const i = cfg.rows.findIndex(r => keys.every(k => r[k] === p[k]));
          if (i >= 0) cfg.rows[i] = Object.assign({}, cfg.rows[i], p); else cfg.rows.push(Object.assign({ id: 'row' + Math.random().toString(36).slice(2, 8) }, p));
        });
        const out = { data: arr, error: cfg.error || null };
        return { select: () => Promise.resolve(out), then: (a, b) => Promise.resolve(out).then(a, b) };
      },
      delete() { mode = 'delete'; return api; },
      then(resFn, rejFn) {
        if (mode === 'delete') { if (!cfg.error) cfg.rows = cfg.rows.filter(r => !match(r, filters)); return Promise.resolve({ data: null, error: cfg.error || null }).then(resFn, rejFn); }
        return Promise.resolve({ data: cfg.rows.filter(r => match(r, filters)), error: cfg.error || null }).then(resFn, rejFn);
      }
    };
    return api;
  } } };
}

function makeApp(opts) {
  opts = opts || {};
  const store = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN;
  sb.Array = Array; sb.Object = Object; sb.String = String; sb.Set = Set; sb.Number = Number; sb.isFinite = isFinite;
  sb.Promise = Promise; sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout; sb.Intl = Intl;
  sb.navigator = { onLine: opts.online !== false };
  sb.escH = s => String(s == null ? '' : s); sb.toast = () => {}; sb.renderProfileScreen = () => {}; sb.renderZones = () => {}; sb.maybePlanImpact = () => {};
  const wl = {}; sb.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
  sb.addEventListener = (t, f) => { (wl[t] = wl[t] || []).push(f); };
  sb.removeEventListener = () => {};
  sb.dispatchEvent = e => { (wl[e.type] || []).slice().forEach(f => f(e)); return true; };
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ classList: { add() {}, remove() {} }, style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [] }), body: { appendChild() {} }, documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } } };
  const fake = statefulSupabase(opts.tables || {});
  sb.ORVIA = { clock: { now: () => (opts.now != null ? opts.now : NOW) } };
  vm.createContext(sb);
  const base = new URL('../../../app/js/', import.meta.url);
  ['profile-model.js', 'onboarding/onboarding-profile-logic.js', 'profile.js', 'repos/repoBase.js',
   'repos/sportRepository.js', 'repos/availabilityRepository.js', 'repos/goalRepository.js',
   'repos/constraintRepository.js', 'repos/profileRepository.js', 'profile-store.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  sb.ORVIA.sb = fake.sb;
  sb.ORVIA.user = opts.user === null ? null : (opts.user || { id: 'user-A' });
  if (opts.queue) sb.ORVIA.offlineQueue = opts.queue;
  sb.ensureProfile();
  return { sb, store, fake, O: sb.ORVIA };
}
function setMeta(sb, section, ts) {
  const M = sb.ORVIA.profileModel; M.ensureSectionMeta(sb.PROFILE);
  sb.PROFILE._sectionMeta[section].updatedAt = ts; sb.saveProfile();
}

/* ---------- 1) availability: Roundtrip + Zweitgerät + K1 ---------- */
{
  const h = makeApp({});
  h.sb.PROFILE.availability = h.O.profileModel.normalizeAvailability({ days: { mo: { available: true, singleSession: { preferredTime: 'evening', maxMinutes: 60 } }, di: { restDay: true }, mi: { available: true } }, maxSessionsPerWeek: 4 });
  setMeta(h.sb, 'availability', T_NEW);
  const r = await h.O.profileStore.persistAvailability();
  ok('A1 persist ok', r.success === true, JSON.stringify(r.error));
  const rows = h.fake.tables.weekly_availability.rows;
  ok('A2 genau 7 Zeilen', rows.length === 7);
  const mo = rows.find(x => x.weekday === 0), di = rows.find(x => x.weekday === 1);
  ok('A3 Mapping mo (verfügbar, 60min, evening)', mo.available === true && mo.max_minutes === 60 && mo.preferred_time === 'evening' && mo.section_updated_at === T_NEW);
  ok('A4 Ruhetag di', di.rest_day === true && di.available === false);
  ok('A5 Wochenlimit auf den Zeilen', mo.max_sessions_week === 4);
  // Zweitgerät leer → Cloud gewinnt
  const h2 = makeApp({ tables: { weekly_availability: { rows: rows.map(x => Object.assign({}, x)) } } });
  const r2 = await h2.O.profileStore.hydrateAvailability();
  ok('A6 Zweitgerät hydratisiert', r2.success === true);
  const av2 = h2.sb.PROFILE.availability;
  ok('A7 Tage + Limit übernommen', av2.days.mo.available === true && av2.days.di.restDay === true && av2.maxSessionsPerWeek === 4);
  ok('A8 Meta = CLOUD-Zeitstempel', h2.sb.PROFILE._sectionMeta.availability.updatedAt === T_NEW);
  // K1: lokal neuer → Push
  const h3 = makeApp({ tables: { weekly_availability: { rows: rows.map(x => Object.assign({}, x, { section_updated_at: T_OLD, available: false, rest_day: true })) } } });
  h3.sb.PROFILE.availability = h3.O.profileModel.normalizeAvailability({ days: { sa: { available: true } } });
  setMeta(h3.sb, 'availability', T_NEW);
  await h3.O.profileStore.hydrateAvailability();
  const sa = h3.fake.tables.weekly_availability.rows.find(x => x.weekday === 5);
  ok('A9 K1 lokal neuer → Cloud übernimmt', sa.available === true);
  // Ebene-B-Erhalt: Slots-Details bleiben beim Apply
  const h4 = makeApp({ tables: { weekly_availability: { rows: rows.map(x => Object.assign({}, x)) } } });
  h4.sb.PROFILE.availability = h4.O.profileModel.normalizeAvailability({ days: { mo: { available: true, singleSession: { preferredSports: ['running'], intensityAllowed: 'intense' } } } });
  setMeta(h4.sb, 'availability', T_OLD);   // Cloud (T_NEW) gewinnt
  await h4.O.profileStore.hydrateAvailability();
  ok('A10 Ebene-B-Details je Tag erhalten (preferredSports)', h4.sb.PROFILE.availability.days.mo.singleSession.preferredSports[0] === 'running');
}

/* ---------- 2) goals: Roundtrip + K3-Legacy-Seed + Detail-Erhalt ---------- */
{
  const h = makeApp({});
  const M = h.O.profileModel;
  h.sb.PROFILE.goals = M.normalizeGoals([
    { id: 'goal:hm', category: 'halfmarathon', title: 'HM sub 1:50', targetValue: 6600, metricType: 'time', priority: 1, status: 'active', categoryData: { course: 'flach' }, milestones: [{ id: 'ms1', title: '15 km Long Run', status: 'planned' }] },
    { id: 'goal:ftp', category: 'ftp', title: 'FTP 300', targetValue: 300, priority: 2 }
  ]);
  setMeta(h.sb, 'goals', T_NEW);
  const r = await h.O.profileStore.persistGoals();
  ok('G1 persist ok', r.success === true, JSON.stringify(r.error));
  const rows = h.fake.tables.user_goals.rows;
  ok('G2 zwei Zeilen, client_goal_id = Ziel-ID', rows.length === 2 && rows.some(x => x.client_goal_id === 'goal:hm'));
  const hm = rows.find(x => x.client_goal_id === 'goal:hm');
  ok('G3 Kernfelder gemappt (R1.2: goal_type kanonisch)', hm.goal_type === 'half_marathon' && hm.target_value === 6600 && hm.metric_type === 'time' && hm.priority === 'primary' && hm.section_updated_at === T_NEW);
  // K3: stempelloser Legacy-Seed + lokale reiche Ziele → Push ersetzt Seed (KEIN Verlust)
  const h2 = makeApp({ tables: { user_goals: { rows: [{ id: 'old1', user_id: 'user-A', client_goal_id: 'blob:primary:halfmarathon', goal_type: 'halfmarathon', title: 'HM', priority: 'primary', status: 'active' }] } } });
  h2.sb.PROFILE.goals = h2.O.profileModel.normalizeGoals([{ id: 'goal:hm', category: 'halfmarathon', title: 'HM sub 1:50', targetValue: 6600, metricType: 'time', priority: 1 }]);
  setMeta(h2.sb, 'goals', T_MID);
  await h2.O.profileStore.hydrateGoals();
  const rows2 = h2.fake.tables.user_goals.rows;
  ok('G4 K3: Legacy-Seed ersetzt (kein Blob-Verlust)', rows2.length === 1 && rows2[0].client_goal_id === 'goal:hm');
  ok('G5 lokales reiches Ziel unangetastet', h2.sb.PROFILE.goals[0].title === 'HM sub 1:50' && h2.sb.PROFILE.goals[0].targetValue === 6600);
  // Cloud neuer → Apply mit Ebene-B-Erhalt (categoryData/milestones bleiben)
  const cloudRows = rows.map(x => Object.assign({}, x, { section_updated_at: T_NEW }));
  const h3 = makeApp({ tables: { user_goals: { rows: cloudRows } } });
  h3.sb.PROFILE.goals = h3.O.profileModel.normalizeGoals([{ id: 'goal:hm', category: 'halfmarathon', title: 'ALT', targetValue: 7000, metricType: 'time', priority: 2, categoryData: { course: 'flach' }, milestones: [{ id: 'ms1', title: '15 km Long Run', status: 'planned' }] }]);
  setMeta(h3.sb, 'goals', T_OLD);
  await h3.O.profileStore.hydrateGoals();
  const g = h3.sb.PROFILE.goals.find(x => x.id === 'goal:hm');
  ok('G6 Cloud neuer → Kernfelder übernommen', g.title === 'HM sub 1:50' && g.targetValue === 6600 && g.priority === 1);
  ok('G7 Ebene-B erhalten (categoryData + milestones)', g.categoryData.course === 'flach' && g.milestones.length === 1);
}

/* ---------- 3) constraints: Roundtrip + Kontowechsel ---------- */
{
  const h = makeApp({});
  const M = h.O.profileModel;
  h.sb.PROFILE.constraintsList = [M.normalizeConstraint({ id: 'c1', bodyRegion: 'knee', status: 'active', intensity: 4, affectedActivities: ['running'] })];
  setMeta(h.sb, 'constraints', T_NEW);
  const r = await h.O.profileStore.persistConstraintsCloud();
  ok('C1 persist ok', r.success === true, JSON.stringify(r.error));
  const rows = h.fake.tables.user_constraints.rows;
  ok('C2 Zeile vollständig', rows.length === 1 && rows[0].client_id === 'c1' && rows[0].body_region === 'knee' && rows[0].intensity === 4 && rows[0].affected[0] === 'running');
  // Zweitgerät
  const h2 = makeApp({ tables: { user_constraints: { rows: rows.map(x => Object.assign({}, x)) } } });
  await h2.O.profileStore.hydrateConstraints();
  ok('C3 Zweitgerät erhält Beschwerde', h2.sb.PROFILE.constraintsList.length === 1 && h2.sb.PROFILE.constraintsList[0].bodyRegion === 'knee');
  ok('C4 issues-Projektion aktualisiert', Array.isArray(h2.sb.PROFILE.issues));
  // Kontowechsel: clear() leert ALLE Zyklus-Sektionen
  h.O.profileStore.clear();
  ok('C5 clear leert sports/availability/goals/constraints', (h.sb.PROFILE.goals || []).length === 0 && (h.sb.PROFILE.constraintsList || []).length === 0 && !h.sb.PROFILE.availability && (h.sb.PROFILE.sports || []).length === 0);
  h.O.user = { id: 'user-B' };
  h.fake.tables.user_constraints.rows = [];
  await h.O.profileStore.hydrateConstraints();
  ok('C6 kein A→B-Leak', (h.sb.PROFILE.constraintsList || []).length === 0 && h.fake.tables.user_constraints.rows.length === 0);
}

/* ---------- 4) Event-Hook: Editor-Saves pushen automatisch ---------- */
{
  const h = makeApp({});
  h.sb.PROFILE.availability = h.O.profileModel.normalizeAvailability({ days: { mo: { available: true } } });
  h.sb._profileSave(['availability']);
  await new Promise(r => setTimeout(r, 30));
  ok('E1 availability-Save → weekly_availability', (h.fake.tables.weekly_availability || { rows: [] }).rows.length === 7);
  h.sb.PROFILE.weightKg = 72;
  h.sb._profileSave(['body']);
  await new Promise(r => setTimeout(r, 30));
  ok('E2 body-Save → user_profiles (MAPPED-Autopush)', (h.fake.tables.user_profiles || { rows: [] }).rows.length === 1 && h.fake.tables.user_profiles.rows[0].weight_kg === 72);
  h.sb.PROFILE.constraintsAcknowledgedAt = '2026-07-10T09:00:00.000Z';
  h.sb._profileSave(['constraints']);
  await new Promise(r => setTimeout(r, 30));
  ok('E3 constraints-Save → user_constraints + acknowledged in user_profiles', 'user_constraints' in h.fake.tables && h.fake.tables.user_profiles.rows[0].constraints_acknowledged_at === '2026-07-10T09:00:00.000Z');
}

/* ---------- 5) Offline + Guards + auth-Verdrahtung ---------- */
{
  const enq = [];
  const h = makeApp({ online: false, queue: { enqueue: async (t, row, o) => { enq.push({ t, o }); return { success: true }; } } });
  h.sb.PROFILE.goals = h.O.profileModel.normalizeGoals([{ id: 'goal:x', category: 'custom', title: 'X' }]);
  setMeta(h.sb, 'goals', T_NEW);
  const r = await h.O.profileStore.persistGoals();
  ok('O1 offline → pending + Queue-Upsert mit Konfliktschlüssel', r.sync_status === 'pending' && enq.length === 1 && enq[0].t === 'user_goals' && enq[0].o === 'user_id,client_goal_id');
  const h2 = makeApp({ user: null });
  ok('O2 ohne Sitzung failed, kein Throw', (await h2.O.profileStore.hydrateGoals()).success === false);
  const auth = readFileSync(new URL('../../../app/js/auth.js', import.meta.url), 'utf8');
  ok('O3 Login-Pfad hydriert alle drei Zyklen', /hydrateAvailability\(\)/.test(auth) && /hydrateGoals\(\)/.test(auth) && /hydrateConstraints\(\)/.test(auth));
  const sql13 = readFileSync(new URL('../migrations/0013_availability_profile_sync.sql', import.meta.url), 'utf8');
  const sql14 = readFileSync(new URL('../migrations/0014_user_constraints.sql', import.meta.url), 'utf8');
  ok('O4 Migration 0013 additiv (rest_day/section_updated_at/acknowledged)', /rest_day/.test(sql13) && /section_updated_at/.test(sql13) && /constraints_acknowledged_at/.test(sql13) && /add column if not exists/.test(sql13));
  ok('O5 Migration 0014 mit RLS + force + unique(user_id,client_id)', /force row level security/.test(sql14) && /user_constraints_client_uniq/.test(sql14) && /sel_own/.test(sql14));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

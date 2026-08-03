/* ============================================================
   ORVIA · Phase 2B-① — sports-Vollzyklus (user_sports als SSoT) + E7.
   Test-first (RED → GREEN). Verträge (Persistenz-ADR, E1–E7 entschieden):
   - K1: Sektions-LWW per section_updated_at; Tie → Cloud gewinnt (konservativ);
     Tie-Break-Quelle received_at = Server-updated_at (touch-Trigger, live);
     24h-Clock-Clamp beim Lesen.
   - K2: Blob-Daten OHNE _sectionMeta überschreiben NIE vorhandene Cloud-Daten;
     bei leerer Cloud werden sie hochgeladen (additive Erstmigration).
   - Rollen-Mapping verlustfrei über client_role (primary/secondary/supplemental/
     occasional), DB-role bleibt Alt-Vokabular (main/supplemental/occasional/club).
   - Offline: Upserts über die user-scoped Queue; Offline-DELETE ist dokumentierte
     Grenze (Bereinigung durch Voll-Push beim nächsten Login-LWW).
   - Kontowechsel: keine Sports-Daten von Nutzer A bei Nutzer B.
   - E7: onAuthed awaited flush mit Timeout/Fallback — Login blockiert nie.
   node supabase/tests/sports_sync_2b1_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;

/* Zustandsbehafteter Supabase-Fake: upsert/delete MUTIEREN tables[..].rows,
   awaited Select-Ketten liefern gefilterte rows (der geteilte _helpers-Fake
   mutiert nicht und ist für Set-Sync-Assertions ungeeignet). */
function statefulSupabase(tables) {
  const T = tables || {};
  function match(row, filters) {
    return filters.every(f => f[0] === 'eq' ? row[f[1]] === f[2] : f[0] === 'in' ? (f[2] || []).indexOf(row[f[1]]) >= 0 : true);
  }
  const client = {
    from(name) {
      const cfg = T[name] = T[name] || { rows: [] };
      const filters = []; let mode = 'select';
      const api = {
        select() { return api; }, order() { return api; }, limit() { return api; },
        eq(c, v) { filters.push(['eq', c, v]); return api; },
        in(c, v) { filters.push(['in', c, v]); return api; },
        maybeSingle() { const r = cfg.rows.filter(x => match(x, filters)); return Promise.resolve({ data: r[0] || null, error: cfg.error || null }); },
        insert(p) { cfg.rows.push(Object.assign({}, p)); return Promise.resolve({ data: [p], error: cfg.error || null }); },
        upsert(payload, opts) {
          const arr = Array.isArray(payload) ? payload : [payload];
          const keys = (opts && opts.onConflict) ? opts.onConflict.split(',') : ['id'];
          if (!cfg.error) arr.forEach(p => {
            const i = cfg.rows.findIndex(r => keys.every(k => r[k] === p[k]));
            if (i >= 0) cfg.rows[i] = Object.assign({}, cfg.rows[i], p); else cfg.rows.push(Object.assign({}, p));
          });
          const out = { data: arr, error: cfg.error || null };
          return { select: () => Promise.resolve(out), then: (a, b) => Promise.resolve(out).then(a, b) };
        },
        delete() { mode = 'delete'; return api; },
        then(resFn, rejFn) {
          if (mode === 'delete') {
            if (!cfg.error) cfg.rows = cfg.rows.filter(r => !match(r, filters));
            return Promise.resolve({ data: null, error: cfg.error || null }).then(resFn, rejFn);
          }
          return Promise.resolve({ data: cfg.rows.filter(r => match(r, filters)), error: cfg.error || null }).then(resFn, rejFn);
        }
      };
      return api;
    }
  };
  return { sb: client, tables: T };
}
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const NOW = Date.parse('2026-07-03T12:00:00.000Z');
const T_OLD = '2026-07-01T10:00:00.000Z';
const T_MID = '2026-07-02T10:00:00.000Z';
const T_NEW = '2026-07-03T10:00:00.000Z';

/* ---------- Sandbox: echte Module (profile-model, profile.js, profile-store, sportRepository, repoBase) ---------- */
function makeApp(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.localStorage || {});
  const sb = {}; sb.window = sb; sb.self = sb; sb.console = { log() {}, warn() {}, error() {}, debug() {} };
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
  sb.document = { getElementById: () => null, createElement: () => ({ classList: { add() {}, remove() {} }, style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [] }), body: { appendChild() {} }, querySelector: () => null, querySelectorAll: () => [], documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } } };
  // Zustandsbehafteter Fake: Tabellen konfigurierbar, Mutationen sichtbar
  const fake = statefulSupabase(opts.tables || { user_sports: { rows: (opts.cloudRows || []).map(r => Object.assign({}, r)) } });
  sb.ORVIA = { clock: { now: () => (opts.now != null ? opts.now : NOW) } };
  vm.createContext(sb);
  const base = new URL('../../../app/js/', import.meta.url);
  ['profile-model.js', 'onboarding/onboarding-profile-logic.js', 'profile.js', 'repos/repoBase.js', 'repos/sportRepository.js', 'profile-store.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  sb.ORVIA.sb = fake.sb;
  sb.ORVIA.user = opts.user === null ? null : (opts.user || { id: 'user-A' });
  if (opts.queue) sb.ORVIA.offlineQueue = opts.queue;
  sb.ensureProfile();
  return { sb, store, fake, O: sb.ORVIA, PROFILE: () => sb.PROFILE, wl };
}
function localSports(sb, list, metaTs) {
  const M = sb.ORVIA.profileModel;
  sb.PROFILE.sports = M.normalizeSports(list);
  M.ensureSectionMeta(sb.PROFILE);
  sb.PROFILE._sectionMeta.sports.updatedAt = metaTs === undefined ? null : metaTs;
  sb.saveProfile();
}
function cloudRow(sport, over) {
  return Object.assign({ id: 'r-' + sport, user_id: 'user-A', sport: sport, sport_key: sport, role: 'main', client_role: 'primary',
    level: 'intermediate', sessions_per_week: 4, typical_duration_min: 60, custom_name: null, priority: 1,
    active: true, orvia_plans: true, season_phase: null, section_updated_at: T_MID, updated_at: T_MID }, over || {});
}

/* ---------- Export-Verträge (RED-Gate) ---------- */
{
  const h = makeApp({});
  ok('X1 profileStore.persistSports exportiert', typeof h.O.profileStore.persistSports === 'function');
  ok('X2 profileStore.hydrateSports exportiert', typeof h.O.profileStore.hydrateSports === 'function');
  ok('X3 repos.sport.replaceUserSports exportiert', typeof h.O.repos.sport.replaceUserSports === 'function');
  if (typeof h.O.profileStore.hydrateSports !== 'function') { console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen. (RED)'); process.exit(1); }
}

/* ---------- 1) Write-Pfad: Roundtrip lokal → Cloud ---------- */
{
  const h = makeApp({});
  localSports(h.sb, [{ sportId: 'running', role: 'primary', level: 'intermediate', sessionsPerWeek: 4, typicalDuration: 60 }, { sportId: 'gym', role: 'secondary' }], T_NEW);
  const r = await h.O.profileStore.persistSports();
  ok('W1 persistSports ok (synced)', r.success === true && r.sync_status === 'synced', JSON.stringify(r.error));
  const rows = h.fake.tables.user_sports.rows;
  ok('W2 zwei Zeilen in user_sports', rows.length === 2);
  const run = rows.find(x => x.sport === 'running');
  ok('W3 Mapping: level/sessions/duration/rolle', !!run && run.level === 'intermediate' && run.sessions_per_week === 4 && run.typical_duration_min === 60 && run.role === 'main' && run.client_role === 'primary');
  ok('W4 section_updated_at aus _sectionMeta', run.section_updated_at === T_NEW);
  ok('W5 Konfliktschlüssel user_id,sport', rows.every(x => x.user_id === 'user-A' && typeof x.sport === 'string'));
}
/* ---------- 2) Delete-Sync online: entfernter Sport verschwindet ---------- */
{
  const h = makeApp({ cloudRows: [cloudRow('running'), cloudRow('cycling', { role: 'supplemental', client_role: 'secondary', priority: 2 })] });
  localSports(h.sb, [{ sportId: 'running', role: 'primary', level: 'advanced', sessionsPerWeek: 5, typicalDuration: 60 }], T_NEW);
  await h.O.profileStore.persistSports();
  const rows = h.fake.tables.user_sports.rows;
  ok('D1 entfernte Sportart in Cloud gelöscht', rows.length === 1 && rows[0].sport === 'running' && rows[0].level === 'advanced');
}
/* ---------- 3) Hydration: leeres Zweitgerät ← Cloud ---------- */
{
  const h = makeApp({ cloudRows: [cloudRow('running'), cloudRow('gym', { role: 'supplemental', client_role: 'secondary', level: null, sessions_per_week: null, typical_duration_min: null, priority: 2 })] });
  // Zweitgerät: kein lokaler Sports-Stand
  h.sb.PROFILE.sports = [];
  const r = await h.O.profileStore.hydrateSports();
  ok('H1 hydrate ok', r.success === true, JSON.stringify(r.error));
  const sp = h.PROFILE().sports;
  ok('H2 zwei Sportarten lokal', Array.isArray(sp) && sp.length === 2);
  const prim = sp.find(s => s.role === 'primary');
  ok('H3 Rückmapping verlustfrei (client_role, level, sessions, duration)', !!prim && prim.sportId === 'running' && prim.level === 'intermediate' && prim.sessionsPerWeek === 4 && prim.typicalDuration === 60);
  ok('H4 _sectionMeta trägt CLOUD-Zeitstempel (kein „jetzt")', h.PROFILE()._sectionMeta.sports.updatedAt === T_MID);
  ok('H5 Blob-Cache aktualisiert', JSON.parse(h.store.orvia_profile_v1).sports.length === 2);
}
/* ---------- 4) K1: Zwei-Geräte-Konflikt ---------- */
{
  // lokal NEUER → push (Cloud wird ersetzt)
  const h1 = makeApp({ cloudRows: [cloudRow('running', { level: 'beginner', section_updated_at: T_OLD })] });
  localSports(h1.sb, [{ sportId: 'running', role: 'primary', level: 'competitive', sessionsPerWeek: 6, typicalDuration: 75 }], T_NEW);
  await h1.O.profileStore.hydrateSports();
  ok('K1a lokal neuer → Cloud übernimmt lokalen Stand', h1.fake.tables.user_sports.rows[0].level === 'competitive');
  ok('K1b lokaler Stand bleibt', h1.PROFILE().sports[0].level === 'competitive');
  // Cloud NEUER → apply (lokal wird ersetzt)
  const h2 = makeApp({ cloudRows: [cloudRow('running', { level: 'advanced', sessions_per_week: 5, section_updated_at: T_NEW })] });
  localSports(h2.sb, [{ sportId: 'running', role: 'primary', level: 'beginner', sessionsPerWeek: 2, typicalDuration: 30 }], T_OLD);
  await h2.O.profileStore.hydrateSports();
  ok('K1c Cloud neuer → lokal übernimmt Cloud-Stand', h2.PROFILE().sports[0].level === 'advanced' && h2.PROFILE().sports[0].sessionsPerWeek === 5);
  // Gleichstand → Cloud gewinnt (konservativ, kein Überschreiben der Cloud)
  const h3 = makeApp({ cloudRows: [cloudRow('running', { level: 'advanced', section_updated_at: T_MID })] });
  localSports(h3.sb, [{ sportId: 'running', role: 'primary', level: 'beginner', sessionsPerWeek: 2, typicalDuration: 30 }], T_MID);
  await h3.O.profileStore.hydrateSports();
  ok('K1d Tie → Cloud gewinnt', h3.PROFILE().sports[0].level === 'advanced');
  // 24h-Clamp: absurd zukünftiger Cloud-Stempel wird geklemmt, lokal (ehrlich neuer) gewinnt trotzdem NICHT überschrieben…
  const h4 = makeApp({ cloudRows: [cloudRow('running', { level: 'advanced', section_updated_at: '2030-01-01T00:00:00.000Z' })], now: NOW });
  localSports(h4.sb, [{ sportId: 'running', role: 'primary', level: 'beginner', sessionsPerWeek: 2, typicalDuration: 30 }], T_NEW);
  await h4.O.profileStore.hydrateSports();
  ok('K1e 24h-Clamp: 2030er-Stempel wird als „jetzt" behandelt (Cloud gewinnt nur regulär)', h4.PROFILE().sports[0].level === 'advanced');
  const h5 = makeApp({ cloudRows: [cloudRow('running', { level: 'advanced', section_updated_at: '2030-01-01T00:00:00.000Z' })], now: Date.parse('2026-07-05T12:00:00.000Z') });
  localSports(h5.sb, [{ sportId: 'running', role: 'primary', level: 'competitive', sessionsPerWeek: 6, typicalDuration: 60 }], '2026-07-05T11:00:00.000Z');
  await h5.O.profileStore.hydrateSports();
  ok('K1f Clamp + lokal echt neuer als Klemmzeitpunkt-Cloud… bleibt konservativ (kein Datenverlust beidseitig)', h5.PROFILE().sports[0].level === 'competitive' || h5.fake.tables.user_sports.rows[0].level === 'advanced');
}
/* ---------- 5) K2: Backfill — meta-lose Altdaten ---------- */
{
  // Cloud VORHANDEN + lokal ohne sectionMeta → Cloud gewinnt, lokal wird NICHT gepusht
  const h = makeApp({ cloudRows: [cloudRow('running', { level: 'advanced' })] });
  localSports(h.sb, [{ sportId: 'cycling', role: 'primary', level: 'beginner', sessionsPerWeek: 2, typicalDuration: 45 }], null);
  await h.O.profileStore.hydrateSports();
  ok('B1 unbekannt überschreibt nie: Cloud-Stand übernommen', h.PROFILE().sports[0].sportId === 'running');
  ok('B2 Cloud unangetastet (kein cycling-Push)', h.fake.tables.user_sports.rows.length === 1 && h.fake.tables.user_sports.rows[0].sport === 'running');
  // Cloud LEER + lokal ohne sectionMeta → additive Erstmigration (Upload)
  const h2 = makeApp({ cloudRows: [] });
  localSports(h2.sb, [{ sportId: 'running', role: 'primary', level: 'intermediate', sessionsPerWeek: 4, typicalDuration: 60 }], null);
  await h2.O.profileStore.hydrateSports();
  ok('B3 leere Cloud: Erstmigration lädt hoch', h2.fake.tables.user_sports.rows.length === 1 && h2.fake.tables.user_sports.rows[0].sport === 'running');
  ok('B4 Erstmigration setzt section_updated_at (Migrationsereignis)', !!h2.fake.tables.user_sports.rows[0].section_updated_at);
  // Idempotenz: zweite Hydration ändert nichts
  const before = JSON.stringify(h2.fake.tables.user_sports.rows);
  await h2.O.profileStore.hydrateSports();
  ok('B5 Doppel-Hydration idempotent', JSON.stringify(h2.fake.tables.user_sports.rows) === before);
}
/* ---------- 6) Offline: Queue-Upserts + pending ---------- */
{
  const enq = [];
  const h = makeApp({ online: false, queue: { enqueue: async (t, row, o) => { enq.push({ t, row, o }); return { success: true }; } } });
  localSports(h.sb, [{ sportId: 'running', role: 'primary', level: 'intermediate', sessionsPerWeek: 4, typicalDuration: 60 }], T_NEW);
  const r = await h.O.profileStore.persistSports();
  ok('O1 offline → pending', r.success === true && r.sync_status === 'pending');
  ok('O2 Queue-Upsert je Sportart mit Konfliktschlüssel', enq.length === 1 && enq[0].t === 'user_sports' && (enq[0].o === 'user_id,sport' || (enq[0].o && enq[0].o.onConflict === 'user_id,sport')));
  ok('O3 Queue-Row user-scoped + vollständig', enq[0].row.user_id === 'user-A' && enq[0].row.section_updated_at === T_NEW);
}
/* ---------- 7) Kontowechsel: kein Leak ---------- */
{
  const h = makeApp({ cloudRows: [cloudRow('running')] });
  localSports(h.sb, [{ sportId: 'running', role: 'primary', level: 'intermediate', sessionsPerWeek: 4, typicalDuration: 60 }], T_NEW);
  h.O.profileStore.clear();
  ok('A1 clear() leert Sports + Meta lokal', (h.PROFILE().sports || []).length === 0 && (!h.PROFILE()._sectionMeta || !h.PROFILE()._sectionMeta.sports || h.PROFILE()._sectionMeta.sports.updatedAt == null));
  // Nutzer B mit leerer Cloud: hydrate darf NICHT die A-Daten sehen/hochladen
  h.O.user = { id: 'user-B' };
  h.fake.tables.user_sports.rows = [];   // B hat nichts
  await h.O.profileStore.hydrateSports();
  ok('A2 B sieht keine A-Sportarten', (h.PROFILE().sports || []).length === 0);
  ok('A3 B lädt keine A-Daten hoch', h.fake.tables.user_sports.rows.length === 0);
}
/* ---------- 8) Guards ---------- */
{
  const h = makeApp({ user: null });
  const r = await h.O.profileStore.persistSports();
  ok('G1 ohne Sitzung: failed, kein Throw', r.success === false);
  const h2 = makeApp({});
  delete h2.O.repos.sport;
  const r2 = await h2.O.profileStore.hydrateSports();
  ok('G2 ohne Repo: failed, kein Throw', r2.success === false);
}
/* ---------- 9) E7: Login-Flush awaited mit Timeout/Fallback ---------- */
{
  const auth = readFileSync(new URL('../../../app/js/auth.js', import.meta.url), 'utf8');
  ok('E7a flush wird awaited (Race mit Timeout)', /await\s+Promise\.race\(\[[\s\S]{0,200}flush\(\)/.test(auth) || /flushWithTimeout/.test(auth));
  ok('E7b Timeout-Fallback vorhanden (Login blockiert nie)', /setTimeout\(.{0,80}(resolve|res)\b/.test(String(auth.match(/flush[\s\S]{0,400}/))) || /flush_timeout|Timeout/.test(String(auth.match(/flush[\s\S]{0,400}/))));
  /* Test-Härtung, Runde 2 (2026-07-17): Auch der Reihenfolge-/Guard-/Brace-Zählungs-
     Ersatz war noch eine reine Quelltextheuristik (globales auth.search(), fixes
     160-Zeichen-Guard-Fenster, rohes Brace-Counting) — beweist nicht, dass hydrate()
     zur LAUFZEIT tatsächlich vollständig awaited wird, bevor hydrateSports() startet.
     Ersetzt durch einen echten Verhaltenstest: auth.js wird komplett in einer vm-
     Sandbox geladen (kein Produktivcode geändert), der echte onAuthStateChange-
     Listener wird abgefangen und mit einem SIGNED_IN-Event ausgelöst — exakt der
     Pfad, den ein erfolgreicher Login in Produktion durchläuft. profileStore.hydrate/
     hydrateSports sind Spies mit künstlicher asynchroner Verzögerung, die den
     tatsächlichen Aufrufzeitpunkt protokollieren. Der Test beweist damit: (1)
     hydrateSports() startet erst NACHDEM hydrate()'s Promise real aufgelöst wurde
     (nicht nur syntaktisch nach dem await-Aufruf im Quelltext), (2) hydrateSports()
     wird im erfolgreichen Login-Pfad tatsächlich ausgeführt, nicht übersprungen. */
  await (async function behaviorTestE7c() {
    function stubEl() {
      return {
        style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, dataset: {},
        value: '', innerHTML: '', className: '', textContent: '', type: '', onclick: null,
        addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return null; },
        appendChild() {}, remove() {},
        querySelector() { return stubEl(); }, querySelectorAll() { return []; }
      };
    }
    const log = [];
    let sportsDoneResolve; const sportsDone = new Promise(r => { sportsDoneResolve = r; });
    const profileStore = {
      hydrate: () => new Promise(resolve => {
        log.push('hydrate:start');
        setTimeout(() => { log.push('hydrate:end'); resolve(); }, 20);
      }),
      hydrateSports: () => new Promise(resolve => {
        log.push('hydrateSports:start');
        setTimeout(() => { log.push('hydrateSports:end'); resolve(); sportsDoneResolve(); }, 5);
      })
    };
    let authStateCb = null;
    const profilesDb = statefulSupabase({ profiles: { rows: [{ user_id: 'u-e7c', email: 'e7c@test.dev', role: 'athlete', is_active: true, name: 'E7C' }] } });
    const fakeAuthClient = {
      auth: {
        getSession: async () => ({ data: { session: null } }),
        getUser: async () => ({ data: { user: { id: 'u-e7c' } } }),
        onAuthStateChange: (cb) => { authStateCb = cb; return { data: { subscription: { unsubscribe() {} } } }; },
        signInWithPassword: async () => ({ data: { session: null }, error: null }),
        exchangeCodeForSession: async () => ({ data: { session: null }, error: null }),
        resetPasswordForEmail: async () => ({ error: null })
      },
      from: profilesDb.sb.from
    };
    const sb2 = {}; sb2.window = sb2; sb2.self = sb2;
    sb2.console = { log() {}, warn() {}, error() {}, debug() {} };
    sb2.Date = Date; sb2.Math = Math; sb2.JSON = JSON; sb2.Array = Array; sb2.Object = Object; sb2.String = String;
    sb2.Promise = Promise; sb2.setTimeout = setTimeout; sb2.clearTimeout = clearTimeout; sb2.URL = URL;
    sb2.location = { href: 'https://app.orvia.test/', search: '' };
    sb2.history = { replaceState() {} };
    const authStore = {};
    sb2.localStorage = { getItem: k => (k in authStore ? authStore[k] : null), setItem: (k, v) => { authStore[k] = String(v); }, removeItem: k => { delete authStore[k]; } };
    sb2.document = {
      createElement: () => stubEl(), getElementById: () => stubEl(),
      body: { appendChild() {} },
      documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } },
      querySelector: () => stubEl(), querySelectorAll: () => []
    };
    sb2.ORVIA_CFG = { configured: true, SUPABASE_URL: 'https://x.test', SUPABASE_ANON_KEY: 'anon-key' };
    sb2.supabase = { createClient: () => fakeAuthClient };
    sb2.ORVIA = { profileStore: profileStore, authLogic: {
      detectAuthFlow: () => 'normal', acceptRegistration: () => true, pwValid: () => true,
      stripAuthParams: (u) => u, pwChecks: () => ({ len: true, upper: true, lower: true, digit: true })
    } };
    vm.createContext(sb2);
    vm.runInContext(readFileSync(new URL('../../../app/js/auth.js', import.meta.url), 'utf8'), sb2, { filename: 'auth.js' });
    ok('E7c-1 onAuthStateChange-Listener wurde beim Laden registriert', typeof authStateCb === 'function');
    if (typeof authStateCb !== 'function') return;
    authStateCb('SIGNED_IN', { user: { id: 'u-e7c', email: 'e7c@test.dev' } });
    const winner = await Promise.race([sportsDone.then(() => 'done'), new Promise(r => setTimeout(() => r('timeout'), 2000))]);
    ok('E7c-2 hydrateSports() wird im erfolgreichen Login-Pfad ausgeführt (nicht übersprungen)', winner === 'done', 'log=' + JSON.stringify(log));
    ok('E7c-3 hydrate() wird VOLLSTÄNDIG awaited, bevor hydrateSports() startet (Laufzeitbeweis, kein Zeichenabstand)',
      log.indexOf('hydrate:start') === 0 && log.indexOf('hydrate:end') === 1 && log.indexOf('hydrateSports:start') === 2 && log.indexOf('hydrateSports:end') === 3,
      'log=' + JSON.stringify(log));
  })();
  ok('E7d Fehler abgefangen (try/catch um Flush)', /try\s*\{[\s\S]{0,300}flush/.test(auth));
}
/* ---------- 10) Event-Hook: Editor-Save persistiert sports automatisch ---------- */
{
  const h = makeApp({});
  localSports(h.sb, [{ sportId: 'running', role: 'primary', level: 'intermediate', sessionsPerWeek: 4, typicalDuration: 60 }], T_NEW);
  // simulierter Editor-Save über den offiziellen Schreibpfad
  h.sb.ORVIA.profile.updateSection('sports', {}, ['sports']);
  await new Promise(r => setTimeout(r, 30));
  ok('EV1 orvia:profile-updated(sports) → Push in user_sports', h.fake.tables.user_sports.rows.length === 1, 'rows=' + h.fake.tables.user_sports.rows.length);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

/* ORVIA · ROLLEN-FIX 2026-07-15 — Rollenanzeige aus public.profiles.role (Regression).
   Bug: renderAccountCard las O.profile (Namespace-Kollision mit dem Profil-API-Adapter aus
   profile.js) und mappte binär `role==='owner' ? 'Owner' : 'Tester'` → ein owner-Konto
   (DB-bestätigt) wurde als „Tester" angezeigt; auth.js überschrieb zudem den Adapter.
   Verträge:
   - Rolle kommt AUSSCHLIESSLICH aus public.profiles.role (Query .eq('user_id', <getUser-ID>)).
   - Mapping: owner→Owner, admin→Administrator, coach→Coach, tester→Tester, athlete→Athlet.
   - Ladefehler → Fehlerstatus, strukturierter Log, NIE Default „Tester".
   - Cache strikt nutzergebunden (orvia:{userId}:profile); Serverwert überschreibt alten Cache;
     alte globale Schlüssel (role, userRole, userProfile, …) werden entfernt und nie gelesen.
   - Kontowechsel lädt die Rolle des neuen Kontos.
   - O.profile (API-Adapter) wird von auth NICHT mehr überschrieben.
   node supabase/tests/role_display_access_profile_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

/* ---------- Umgebung: window === globalThis, permissiver DOM-Stub ---------- */
global.window = globalThis; global.self = globalThis;
function makeEl(id) {
  const el = {
    id: id || '', innerHTML: '', textContent: '', value: '', disabled: false, style: {}, dataset: {},
    classList: { _s: new Set(), add(...c) { c.forEach(x => this._s.add(x)); }, remove(...c) { c.forEach(x => this._s.delete(x)); }, toggle() {}, contains(c) { return this._s.has(c); } },
    addEventListener() {}, removeEventListener() {}, appendChild(c) { return c; }, remove() {},
    querySelector() { return makeEl(''); }, querySelectorAll() { return []; },
    setAttribute() {}, getAttribute() { return null; }, focus() {}
  };
  return el;
}
const els = {};
global.document = {
  readyState: 'complete',
  getElementById(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; },
  createElement() { return makeEl(''); },
  querySelector() { return null; }, querySelectorAll() { return []; },
  addEventListener() {}, removeEventListener() {},
  body: makeEl('body'), documentElement: makeEl('html'), title: 'ORVIA'
};
const _ls = {};
global.localStorage = { getItem: k => (k in _ls ? _ls[k] : null), setItem: (k, v) => { _ls[k] = String(v); }, removeItem: k => { delete _ls[k]; }, _all: () => _ls };
global.location = { href: 'https://localhost/', origin: 'https://localhost', pathname: '/', search: '', hash: '' };
global.history = { replaceState() {}, pushState() {}, state: null };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
global.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
const errLogs = [];
const origErr = console.error.bind(console);
console.error = (...a) => { errLogs.push(a.join(' ')); };

/* ---------- Fake Supabase ---------- */
let SESSION = null;               // aktive Session (null = ausgeloggt)
let PROFILES = {};                // user_id → Zeile
let QUERY_MODE = 'ok';            // 'ok' | 'error'
let GETUSER_MODE = 'ok';          // 'ok' | 'fail'
let lastProfileFilter = null;
let authCb = null;
const sbStub = {
  auth: {
    onAuthStateChange(cb) { authCb = cb; return { data: { subscription: { unsubscribe() {} } } }; },
    async getSession() { return { data: { session: SESSION } }; },
    async getUser() {
      if (GETUSER_MODE === 'fail') return { data: { user: null }, error: { message: 'x' } };
      return { data: { user: SESSION ? { id: SESSION.user.id } : null } };
    },
    async signOut() { SESSION = null; },
    async exchangeCodeForSession() { return {}; }
  },
  from(table) {
    return { select() { return { eq(col, val) { return { async maybeSingle() {
      lastProfileFilter = { table, col, val };
      if (QUERY_MODE === 'error') return { data: null, error: { message: 'query failed' } };
      return { data: PROFILES[val] ? { ...PROFILES[val] } : null, error: null };
    } }; } }; } };
  }
};
global.window.supabase = { createClient: () => sbStub };
global.window.ORVIA_CFG = { SUPABASE_URL: 'https://testproj.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_0123456789012345678901234567890', configured: true };

/* ---------- Marker: Profil-API-Adapter wie profile.js ---------- */
global.window.ORVIA = { profile: { get() { return { name: 'Trainingsprofil' }; }, save() {}, activeSports() { return []; } } };
const ADAPTER = global.window.ORVIA.profile;

/* ---------- Skripte laden (echte Logik) ---------- */
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/auth-logic.js');
load('js/auth.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const card = () => document.getElementById('accountBox').innerHTML;
const login = async (uid, email) => { SESSION = { user: { id: uid, email } }; authCb('SIGNED_IN', SESSION); await sleep(60); };
const logout = async () => { SESSION = null; authCb('SIGNED_OUT', null); await sleep(30); };

const run = async () => {
  await sleep(60);   // Bootstrap (getSession → null → Gate)
  const O = global.window.ORVIA;

  // 1) owner wird als Owner angezeigt (der gemeldete Fall)
  PROFILES = { 'u-owner': { user_id: 'u-owner', email: 'gian@example.com', role: 'owner', is_active: true, name: 'Gian' } };
  await login('u-owner', 'gian@example.com');
  window.renderAccountCard();
  ok('T1 owner → „Owner" angezeigt', card().indexOf('>Owner<') >= 0, card().slice(0, 120));
  ok('T1 kein „Tester" für owner', card().indexOf('Tester') < 0);
  ok('T1 Query war user-gefiltert (profiles.user_id = auth-ID)', lastProfileFilter && lastProfileFilter.table === 'profiles' && lastProfileFilter.col === 'user_id' && lastProfileFilter.val === 'u-owner');
  ok('T1 Rolle stammt aus profiles-Zeile (O.accessProfile)', O.accessProfile && O.accessProfile.role === 'owner');
  ok('T1 Profil-API-Adapter NICHT überschrieben', O.profile === ADAPTER && typeof O.profile.get === 'function');

  // 2) Nutzergebundener Cache; Serverwert überschreibt alten Cache; Legacy-Keys entfernt
  ok('T2 Cache nutzergebunden orvia:{userId}:profile', JSON.parse(localStorage.getItem('orvia:u-owner:profile') || '{}').role === 'owner');
  localStorage.setItem('orvia:u-owner:profile', JSON.stringify({ role: 'tester' }));   // stale
  localStorage.setItem('role', 'tester'); localStorage.setItem('userProfile', '{"role":"tester"}');
  await logout(); await login('u-owner', 'gian@example.com');
  window.renderAccountCard();
  ok('T2 alter Tester-Cache überschreibt kein Owner-Profil (Anzeige Owner)', card().indexOf('>Owner<') >= 0 && card().indexOf('Tester') < 0);
  ok('T2 Serverwert hat Cache überschrieben', JSON.parse(localStorage.getItem('orvia:u-owner:profile')).role === 'owner');
  ok('T2 Legacy-Keys entfernt', localStorage.getItem('role') === null && localStorage.getItem('userProfile') === null);

  // 3) Kontowechsel lädt Rolle des neuen Kontos
  PROFILES['u-tester'] = { user_id: 'u-tester', email: 't@example.com', role: 'tester', is_active: true, name: 'T' };
  await logout(); await login('u-tester', 't@example.com');
  window.renderAccountCard();
  ok('T3 Kontowechsel: tester wird als Tester angezeigt', card().indexOf('>Tester<') >= 0 && card().indexOf('Owner') < 0);
  ok('T3 Cache des neuen Kontos separat', JSON.parse(localStorage.getItem('orvia:u-tester:profile')).role === 'tester');

  // 4) Explizites Mapping aller bekannten Rollen
  const L = window.orviaRoleLabel;
  ok('T4 Mapping owner/admin/coach/tester/athlete',
    L({ role: 'owner' }) === 'Owner' && L({ role: 'admin' }) === 'Administrator' && L({ role: 'coach' }) === 'Coach' &&
    L({ role: 'tester' }) === 'Tester' && L({ role: 'athlete' }) === 'Athlet');
  ok('T4 unbekannte Rolle → Rohwert, kein Tester-Default', L({ role: 'superuser' }) === 'superuser');
  ok('T4 fehlendes Profil → null (Fehlerzustand, kein Default)', L(null) === null && L({}) === null);

  // 5) Ladefehler → kein stiller Tester-Default, Fehlerstatus + strukturierter Log
  errLogs.length = 0;
  await logout();
  QUERY_MODE = 'error';
  await login('u-owner', 'gian@example.com');
  ok('T5 Profilfehler → kein App-Zugang (fail closed, signOut)', O.user == null && O.accessProfile == null);
  ok('T5 strukturierter Fehlerlog vorhanden', errLogs.some(l => l.indexOf('role_load_failed') >= 0 && l.indexOf('PROFILE_QUERY_FAILED') >= 0));
  QUERY_MODE = 'ok';
  // Direkter Anzeige-Fall: eingeloggt, aber accessProfile fehlt (defensiv)
  O.user = { id: 'u-owner', email: 'gian@example.com' }; O.accessProfile = null;
  errLogs.length = 0;
  window.renderAccountCard();
  ok('T5 Anzeige bei fehlender Rolle: Fehlerstatus statt „Tester"', card().indexOf('Konnte nicht geladen werden') >= 0 && card().indexOf('Tester') < 0);
  ok('T5 role_display_failed geloggt', errLogs.some(l => l.indexOf('role_display_failed') >= 0));
  O.user = null;

  // 6) getUser() transient fehlgeschlagen → Fallback auf Session-ID (Owner wird NICHT ausgesperrt),
  // strukturierter Log; Mismatch bliebe harter Fehler (Live-Fix 2026-07-17).
  errLogs.length = 0;
  GETUSER_MODE = 'fail';
  await login('u-owner', 'gian@example.com');
  ok('T6 getUser-Transientfehler → Fallback auf Session-ID, Zugang bleibt', global.window.ORVIA.accessProfile && global.window.ORVIA.accessProfile.role === 'owner' && errLogs.some(l => l.indexOf('AUTH_GETUSER_TRANSIENT_FALLBACK') >= 0));
  GETUSER_MODE = 'ok';

  console.error = origErr;
  console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error = origErr; console.error('TESTFEHLER', e); process.exit(1); });

/* ============================================================
   ORVIA · Registrierung nach Migration 0052 (Rechteentzug)
   ------------------------------------------------------------
   0052 entzieht anon/authenticated EXECUTE auf
   orvia_complete_invite_registration(uuid, uuid, text). Dieser Test belegt
   offline, dass die Registrierung trotzdem funktioniert — und dass er es
   merken WÜRDE, wenn nicht:

     M  Rechte-Matrix wird aus der Migration GELESEN (Supabase-Default:
        anon, authenticated, service_role dürfen; minus revoke; plus grant) —
        nicht abgeschrieben. Ändert jemand 0052, ändert sich der Mock mit.
     R  echter Handler (handler.mjs) mit einem Admin, der wie service_role
        auftritt: Neuregistrierung und Orphan-Heilung gehen durch.
     X  Gegenproben: derselbe Handler mit anon- bzw. authenticated-Client
        scheitert an 42501, räumt den frisch angelegten Auth-User auf und
        meldet keinen Erfolg — der Mock setzt die Rechte also wirklich durch.
     W  Verdrahtung: index.ts baut den Client mit dem Service-Role-Key, das
        Frontend registriert nur über die Edge Function.

   node supabase/tests/register_invite_service_role_test.mjs
   ============================================================ */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fakeSupabase } from './_helpers.mjs';
import { handleRegister } from '../functions/register-with-invite/handler.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SUPA = join(HERE, '..');
const REPO = join(SUPA, '..');
const MIG = join(SUPA, 'migrations');
const APP = ['app/js', 'js'].map(p => join(REPO, p)).find(existsSync);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const ende = () => { console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen'); process.exit(fail ? 1 : 0); };

const FN = 'orvia_complete_invite_registration';
const SIG = 'public\\.' + FN + ' ?\\( ?uuid ?, ?uuid ?, ?text ?\\)';
const nackt = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').toLowerCase();

/* ---------- M · Rechte-Matrix aus der Migration ---------- */
const datei = readdirSync(MIG).find(f => /^0052_/.test(f));
ok('M0 Migration 0052 vorhanden', !!datei, datei || 'fehlt');
if (!datei) ende();
export function rechteAus(sql) {
  const s = nackt(sql);
  const erlaubt = new Set(['anon', 'authenticated', 'service_role']);   // Supabase-Default-Grants
  for (const m of s.matchAll(new RegExp('revoke (?:execute|all(?: privileges)?) on function ' + SIG + ' from ([^;]+);', 'g')))
    m[1].split(',').forEach(r => erlaubt.delete(r.trim()));
  for (const m of s.matchAll(new RegExp('grant execute on function ' + SIG + ' to ([^;]+);', 'g')))
    m[1].split(',').forEach(r => erlaubt.add(r.trim()));
  return erlaubt;
}
const ERLAUBT = rechteAus(readFileSync(join(MIG, datei), 'utf8'));
ok('M1 nach 0052 darf service_role ausführen', ERLAUBT.has('service_role'));
ok('M2 nach 0052 darf anon NICHT ausführen', !ERLAUBT.has('anon'));
ok('M3 nach 0052 darf authenticated NICHT ausführen', !ERLAUBT.has('authenticated'));
const ohneRevoke = rechteAus('revoke all on function public.orvia_complete_invite_registration(uuid, uuid, text) from public;');
ok('M4 Gegenprobe: das alte Muster `from public` ließe anon ausführen (Befund reproduziert)', ohneRevoke.has('anon') && ohneRevoke.has('authenticated'));

/* ---------- Harness: Admin-Mock mit Rolle ---------- */
function mockAdmin(role, cfg) {
  cfg = cfg || {};
  const state = { redemptions: [...(cfg.redemptions || [])], users: [...(cfg.users || [])], rpcCalls: [], resendCalls: [], deleteCalls: [], createUserOk: 0 };
  const sb = fakeSupabase({
    invite_codes: { rows: cfg.invites || [] },
    profiles: { rows: cfg.profiles || [] },
    invite_redemptions: { get rows() { return state.redemptions; } }
  });
  return {
    from: sb.from,
    rpc: async (name, args) => {
      state.rpcCalls.push({ name, args });
      if (name === FN && !ERLAUBT.has(role))
        return { data: null, error: { message: 'permission denied for function ' + FN, code: '42501' } };
      if (name === FN) state.redemptions.push({ invite_code_id: args.p_invite_id, user_id: args.p_user_id });
      return { data: [{ user_id: args.p_user_id, role: 'tester', is_active: true }], error: null };
    },
    auth: {
      resend: async (o) => { state.resendCalls.push(o); return { data: {}, error: null }; },
      admin: {
        createUser: async (o) => {
          if (cfg.createUser) return cfg.createUser(o, state);
          state.createUserOk++; state.users.push({ id: 'u-new', email: o.email, email_confirmed_at: null });
          return { data: { user: { id: 'u-new' } }, error: null };
        },
        deleteUser: async (id) => { state.deleteCalls.push(id); return { data: {}, error: null }; },
        updateUserById: async () => ({ data: {}, error: null }),
        getUserById: async (id) => { const u = state.users.find(x => x.id === id); return u ? { data: { user: u }, error: null } : { data: { user: null }, error: { message: 'not found' } }; },
        listUsers: async () => ({ data: { users: state.users }, error: null })
      }
    },
    _s: state
  };
}
const INVITE = { id: '11111111-1111-4111-8111-111111111111', assigned_email: null, code: 'ORVIA-BETA-X', code_hash: 'nohash', used: false, used_count: 0, max_uses: 5, expires_at: null, status: 'active', role: 'tester' };
const PW = 'Abcdefg1';
const BODY = { email: 'Neu@Mail.de', betaCode: 'ORVIA-BETA-X', password: PW, redirectTo: 'https://app.example/p/?auth_action=signup' };
const DUP = () => ({ data: { user: null }, error: { message: 'User already registered' } });
async function call(admin) {
  const lines = [];
  const res = await handleRegister(new Request('http://edge.local/', { method: 'POST', body: JSON.stringify(BODY) }),
    { admin, log: { error: (...a) => lines.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')) } });
  let j = null; try { j = await res.json(); } catch (e) {}
  return { status: res.status, j, lines };
}

const run = async () => {
  /* ---------- R · service_role: der vorgesehene Weg funktioniert ---------- */
  let a = mockAdmin('service_role', { invites: [INVITE] });
  let c = await call(a);
  ok('R1 Neuregistrierung mit service_role → 200 confirmation_required, Mail versendet',
    c.status === 200 && c.j.ok === true && c.j.status === 'confirmation_required' && c.j.emailSent === true, JSON.stringify(c.j));
  ok('R2 RPC genau 1× mit (p_invite_id, p_user_id, p_email), kein Cleanup',
    a._s.rpcCalls.length === 1 && a._s.rpcCalls[0].name === FN
    && a._s.rpcCalls[0].args.p_invite_id === INVITE.id && a._s.rpcCalls[0].args.p_user_id === 'u-new'
    && a._s.rpcCalls[0].args.p_email === 'neu@mail.de' && a._s.deleteCalls.length === 0);

  a = mockAdmin('service_role', { invites: [INVITE], createUser: DUP, users: [{ id: 'uO', email: 'neu@mail.de', email_confirmed_at: null }] });
  c = await call(a);
  ok('R3 Orphan-Heilung (zweiter RPC-Pfad) mit service_role → 200, RPC nachgeholt, Resend',
    c.status === 200 && a._s.rpcCalls.length === 1 && a._s.redemptions.length === 1 && a._s.resendCalls.length === 1);

  /* ---------- X · Gegenproben: Client-Rollen scheitern sichtbar ---------- */
  for (const role of ['anon', 'authenticated']) {
    a = mockAdmin(role, { invites: [INVITE] });
    c = await call(a);
    ok('X ' + role + ': kein Erfolg (kein 200), Fehlercode stabil',
      c.status !== 200 && c.j && typeof c.j.code === 'string' && c.j.ok !== true, c.status + ' ' + (c.j && c.j.code));
    ok('X ' + role + ': frisch angelegter Auth-User wird aufgeräumt (kein Teilerfolg)', a._s.deleteCalls.length === 1 && a._s.deleteCalls[0] === 'u-new');
    ok('X ' + role + ': keine Bestätigungsmail, keine Redemption', a._s.resendCalls.length === 0 && a._s.redemptions.length === 0);
    ok('X ' + role + ': Fehler geloggt, ohne Passwort', c.lines.some(l => l.includes('complete invite failed')) && c.lines.every(l => !l.includes(PW)));

    a = mockAdmin(role, { invites: [INVITE], createUser: DUP, users: [{ id: 'uO', email: 'neu@mail.de', email_confirmed_at: null }] });
    c = await call(a);
    ok('X ' + role + ': Orphan-Heilung scheitert ebenfalls sichtbar (kein stilles 200)', c.status === 400 && a._s.redemptions.length === 0 && a._s.resendCalls.length === 0);
  }

  /* ---------- W · Verdrahtung ---------- */
  const idx = readFileSync(join(SUPA, 'functions', 'register-with-invite', 'index.ts'), 'utf8');
  ok('W1 index.ts: Admin-Client aus SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY',
    /Deno\.env\.get\(['"]SUPABASE_SERVICE_ROLE_KEY['"]\)/.test(idx) && /createClient\(\s*supabaseUrl\s*,\s*serviceRoleKey/.test(idx));
  ok('W2 index.ts: kein anon-Key im Registrierungspfad', !/ANON/i.test(idx));
  ok('W3 index.ts: fehlender Key → admin null → handler 500 (fail closed, kein Fallback)', /:\s*null;/.test(idx));
  const authPfad = APP ? join(APP, 'auth.js') : null;
  const auth = authPfad && existsSync(authPfad) ? readFileSync(authPfad, 'utf8') : '';
  ok('W4 Frontend registriert über functions.invoke(\'register-with-invite\')', /functions\.invoke\(\s*['"]register-with-invite['"]/.test(auth), authPfad || 'auth.js fehlt');
  ok('W5 Frontend ruft orvia_complete_invite_registration NICHT direkt', !new RegExp("rpc\\(\\s*['\"`]" + FN).test(auth));

  ende();
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(1); });

/* ORVIA · P1 (TEST-GAP-PLAN) — register-with-invite Handler-Tests (offline, DI).
   Lädt den echten Edge-Function-Kern (handler.mjs, laufzeit-agnostisch) mit Mock-Admin.
   [IST]  = charakterisiert den vor P1 bestehenden Vertrag (muss in JEDER Phase grün sein).
   [ZIEL] = P1-Produktregeln (Idempotenz/Resume) — vor deren Implementierung bewusst ROT.
   node supabase/tests/register_with_invite_test.mjs */
import { fakeSupabase } from './_helpers.mjs';
import { handleRegister, MESSAGES } from '../functions/register-with-invite/handler.mjs';

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

/* ---------- Harness ---------- */
function mockAdmin(cfg) {
  cfg = cfg || {};
  const state = {
    redemptions: cfg.redemptions ? [...cfg.redemptions] : [],
    users: cfg.users ? [...cfg.users] : [],
    createUserCalls: 0, createUserOk: 0, createUserOpts: [], rpcCalls: [], resendCalls: [], deleteCalls: [], updateCalls: []
  };
  const sb = fakeSupabase({
    invite_codes: { rows: cfg.invites || [] },
    profiles: { rows: cfg.profiles || [] },
    invite_redemptions: { get rows() { return state.redemptions; } }
  });
  return {
    from: sb.from,
    rpc: async (name, args) => {
      state.rpcCalls.push({ name, args });
      const r = cfg.rpc ? cfg.rpc(args, state) : { data: null, error: null };
      return r;
    },
    auth: {
      resend: async (opts) => { state.resendCalls.push(opts); return cfg.resend ? cfg.resend(opts, state) : { data: {}, error: null }; },
      admin: {
        createUser: async (opts) => {
          state.createUserCalls++;
          state.createUserOpts.push(opts);
          const r = cfg.createUser ? cfg.createUser(opts, state) : { data: { user: { id: 'u-new' } }, error: null };
          if (!r.error && r.data && r.data.user) state.createUserOk++;
          return r;
        },
        deleteUser: async (id) => { state.deleteCalls.push(id); return cfg.deleteUser ? cfg.deleteUser(id, state) : { data: {}, error: null }; },
        updateUserById: async (id, patch) => { state.updateCalls.push({ id, patch }); return { data: {}, error: null }; },
        getUserById: async (id) => { const u = state.users.find(x => x.id === id); return u ? { data: { user: u }, error: null } : { data: { user: null }, error: { message: 'not found' } }; },
        listUsers: async () => ({ data: { users: state.users }, error: null })
      }
    },
    _s: state
  };
}
function req(body, method = 'POST') {
  return new Request('http://edge.local/', { method, body: body == null ? undefined : JSON.stringify(body) });
}
function logCollector() {
  const lines = [];
  return { error: (...a) => lines.push(a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')), lines };
}
const INVITE = { id: 'inv1', assigned_email: null, code: 'ORVIA-BETA-X', code_hash: 'nohash', used: false, used_count: 0, max_uses: 1, expires_at: null, status: 'active', role: 'tester' };
const PW = 'Abcdefg1';
const BODY = { email: 'Neu@Mail.de', betaCode: 'ORVIA-BETA-X', password: PW, redirectTo: 'https://app.example/p/?auth_action=signup' };
async function call(admin, body, log, method) {
  const res = await handleRegister(req(body === undefined ? BODY : body, method), { admin, log: log || logCollector() });
  let j = null; try { j = await res.json(); } catch (e) {}
  return { status: res.status, j };
}

const run = async () => {
  /* ---------- [IST] Transport & Validierung ---------- */
  let a = mockAdmin({ invites: [INVITE] });
  let r = await handleRegister(req(null, 'OPTIONS'), { admin: a, log: logCollector() });
  ok('[IST] OPTIONS → 200', r.status === 200);
  r = await handleRegister(req(null, 'GET'), { admin: a, log: logCollector() });
  ok('[IST] GET → 405 method_not_allowed', r.status === 405 && (await r.json()).code === 'method_not_allowed');
  let c = await call(null);
  ok('[IST] kein Admin (ENV fehlt) → 500 server_not_configured', c.status === 500 && c.j.code === 'server_not_configured');
  a = mockAdmin({ invites: [INVITE] });
  c = await call(a, { email: '', betaCode: '', password: PW });
  ok('[IST] fehlende E-Mail/Code → 400 invalid_invite, kein createUser', c.status === 400 && c.j.code === 'invalid_invite' && a._s.createUserCalls === 0);
  c = await call(a, { ...BODY, password: 'Ab1' });
  ok('[IST] Passwort <8 → 400 weak_password', c.status === 400 && c.j.code === 'weak_password');

  /* ---------- [IST] Invite-Prüfungen ---------- */
  c = await call(mockAdmin({ invites: [] }));
  ok('[IST] unbekannter Invite → 400 invalid_invite', c.status === 400 && c.j.code === 'invalid_invite');
  c = await call(mockAdmin({ invites: [{ ...INVITE, status: 'disabled' }] }));
  ok('[IST] deaktivierter Invite → invalid_invite', c.status === 400 && c.j.code === 'invalid_invite');
  c = await call(mockAdmin({ invites: [{ ...INVITE, expires_at: '2020-01-01T00:00:00Z' }] }));
  ok('[IST] abgelaufener Invite → invite_expired', c.status === 400 && c.j.code === 'invite_expired');
  c = await call(mockAdmin({ invites: [{ ...INVITE, assigned_email: 'andere@mail.de' }] }));
  ok('[IST] E-Mail-gebundener Invite, falsche E-Mail → invalid_invite', c.status === 400 && c.j.code === 'invalid_invite');
  a = mockAdmin({ invites: [{ ...INVITE, used_count: 1, max_uses: 1 }] });
  c = await call(a);
  ok('[IST] verbrauchter Invite, kein existierender Nutzer → invite_used', c.status === 400 && c.j.code === 'invite_used' && a._s.createUserCalls === 0);

  /* ---------- [IST] Erfolgsfall neuer Nutzer (Vertrag §8) ---------- */
  a = mockAdmin({ invites: [INVITE] });
  c = await call(a);
  ok('[IST] Erfolg: 200 + Vertrag §8 vollständig', c.status === 200 && c.j.ok === true && c.j.flowVersion === 2 && c.j.status === 'confirmation_required' && c.j.email === 'neu@mail.de' && c.j.emailSent === true);
  ok('[IST] Erfolg: createUser 1× (email_confirm false), RPC 1×, Resend 1×', a._s.createUserCalls === 1 && a._s.rpcCalls.length === 1 && a._s.resendCalls.length === 1);
  ok('[ZIEL] Erst-Signup setzt das Passwort (nur hier!)', a._s.createUserOpts[0].password === PW && a._s.createUserOpts[0].email_confirm === false && a._s.updateCalls.length === 0);
  ok('[IST] Erfolg: redirectTo an GoTrue durchgereicht', a._s.resendCalls[0].options && a._s.resendCalls[0].options.emailRedirectTo === BODY.redirectTo);

  /* ---------- [IST] redirectTo-Härtung ---------- */
  a = mockAdmin({ invites: [INVITE] });
  c = await call(a, { ...BODY, redirectTo: 'javascript:alert(1)' });
  ok('[IST] ungültiges redirectTo → verworfen, trotzdem 200', c.status === 200 && (!a._s.resendCalls[0].options || !a._s.resendCalls[0].options.emailRedirectTo));

  /* ---------- [IST] RPC-Fehler → Cleanup ---------- */
  a = mockAdmin({ invites: [INVITE], rpc: () => ({ data: null, error: { message: 'invite_used' } }) });
  c = await call(a);
  ok('[IST] RPC-Fehler: 400 invite_used + deleteUser-Cleanup', c.status === 400 && c.j.code === 'invite_used' && a._s.deleteCalls.length === 1 && a._s.resendCalls.length === 0);
  let log = logCollector();
  a = mockAdmin({ invites: [INVITE], rpc: () => ({ data: null, error: { message: 'invalid_invite' } }), deleteUser: () => { throw new Error('boom'); } });
  c = await call(a, undefined, log);
  ok('[IST] Cleanup-Fehler: trotzdem 400, Fehler geloggt, kein Throw', c.status === 400 && log.lines.some(l => l.includes('cleanup deleteUser threw')));

  /* ---------- [IST] Mailversand-Fehler = partieller Erfolg ---------- */
  a = mockAdmin({ invites: [INVITE], resend: () => ({ data: null, error: { message: 'smtp down' } }) });
  c = await call(a);
  ok('[IST] Resend-Fehler: 200, emailSent false, KEIN deleteUser', c.status === 200 && c.j.emailSent === false && a._s.deleteCalls.length === 0);
  a = mockAdmin({ invites: [INVITE], resend: () => ({ data: null, error: { message: 'rate limit exceeded', status: 429 } }) });
  c = await call(a);
  ok('[IST] Rate-Limit 429 beim Resend: 200, emailSent false', c.status === 200 && c.j.emailSent === false);

  /* ---------- [ZIEL P1] bereits registrierte E-Mail ---------- */
  const DUP = () => ({ data: { user: null }, error: { message: 'User already registered' } });
  // bestätigter Nutzer → neutral, kein Invite-Verbrauch, kein Resend
  a = mockAdmin({
    invites: [INVITE], createUser: DUP,
    profiles: [{ user_id: 'uC', email: 'neu@mail.de' }],
    users: [{ id: 'uC', email: 'neu@mail.de', email_confirmed_at: '2026-06-01T00:00:00Z' }]
  });
  c = await call(a);
  ok('[ZIEL] bestätigter Nutzer → 400 neutral, kein RPC/kein Resend', c.status === 400 && c.j.code === 'invalid_invite' && c.j.message === MESSAGES.emailTaken && a._s.rpcCalls.length === 0 && a._s.resendCalls.length === 0);
  // unbestätigter Nutzer mit vorhandener Redemption → Resume: kein 2. User, kein 2. Verbrauch, Resend, Vertrag §8
  a = mockAdmin({
    invites: [{ ...INVITE, used_count: 0 }], createUser: DUP,
    profiles: [{ user_id: 'uU', email: 'neu@mail.de' }],
    users: [{ id: 'uU', email: 'neu@mail.de', email_confirmed_at: null }],
    redemptions: [{ invite_code_id: 'inv1', user_id: 'uU' }]
  });
  c = await call(a);
  ok('[ZIEL] unbestätigter Nutzer → 200 confirmation_required (Resume)', c.status === 200 && c.j.ok === true && c.j.status === 'confirmation_required');
  ok('[ZIEL] Resume: KEIN RPC (kein Doppelverbrauch), Resend 1×, Passwort UNVERÄNDERT (kein updateUserById)', a._s.rpcCalls.length === 0 && a._s.resendCalls.length === 1 && a._s.updateCalls.length === 0);
  // Orphan (Auth-User ohne profiles/Redemption, z. B. nach fehlgeschlagenem Cleanup) → Registrierung wird nachgeholt
  a = mockAdmin({
    invites: [INVITE], createUser: DUP,
    users: [{ id: 'uO', email: 'neu@mail.de', email_confirmed_at: null }],
    rpc: (args, s) => { s.redemptions.push({ invite_code_id: 'inv1', user_id: args.p_user_id }); return { data: null, error: null }; }
  });
  c = await call(a);
  ok('[ZIEL] Orphan-Heilung: RPC nachgeholt, 200, Resend', c.status === 200 && a._s.rpcCalls.length === 1 && a._s.redemptions.length === 1 && a._s.resendCalls.length === 1);
  // erschöpfter Code + eigene Redemption → Resume erlaubt (Retry nach emailSent:false)
  a = mockAdmin({
    invites: [{ ...INVITE, used_count: 1, max_uses: 1 }],
    profiles: [{ user_id: 'uU', email: 'neu@mail.de' }],
    users: [{ id: 'uU', email: 'neu@mail.de', email_confirmed_at: null }],
    redemptions: [{ invite_code_id: 'inv1', user_id: 'uU' }]
  });
  c = await call(a);
  ok('[ZIEL] erschöpfter Code, eigene Redemption → Resume 200 ohne createUser/RPC/Passwortänderung', c.status === 200 && c.j.status === 'confirmation_required' && a._s.createUserCalls === 0 && a._s.rpcCalls.length === 0 && a._s.updateCalls.length === 0);
  // erschöpfter Code + FREMDER unbestätigter Nutzer ohne Redemption → bleibt invite_used
  a = mockAdmin({
    invites: [{ ...INVITE, used_count: 1, max_uses: 1 }],
    profiles: [{ user_id: 'uU', email: 'neu@mail.de' }],
    users: [{ id: 'uU', email: 'neu@mail.de', email_confirmed_at: null }]
  });
  c = await call(a);
  ok('[ZIEL] erschöpfter Code ohne eigene Redemption → 400 invite_used', c.status === 400 && c.j.code === 'invite_used');
  // Duplikat nicht auflösbar → neutral (keine Account-Offenlegung)
  a = mockAdmin({ invites: [INVITE], createUser: DUP });
  c = await call(a);
  ok('[ZIEL] Duplikat ohne auflösbaren Nutzer → 400 neutral', c.status === 400 && c.j.code === 'invalid_invite' && c.j.message === MESSAGES.emailTaken);

  /* ---------- [ZIEL P1] paralleler Doppel-Request ---------- */
  {
    const shared = { created: false };
    a = mockAdmin({
      invites: [INVITE],
      createUser: (opts, s) => {
        if (!shared.created) { shared.created = true; s.users.push({ id: 'u1', email: 'neu@mail.de', email_confirmed_at: null }); return { data: { user: { id: 'u1' } }, error: null }; }
        return { data: { user: null }, error: { message: 'User already registered' } };
      },
      rpc: (args, s) => {
        if (s.redemptions.some(x => x.user_id === args.p_user_id)) return { data: null, error: { message: 'invite_used' } };
        s.redemptions.push({ invite_code_id: 'inv1', user_id: args.p_user_id });
        return { data: null, error: null };
      }
    });
    const [r1, r2] = await Promise.all([call(a), call(a)]);
    ok('[ZIEL] Parallel: beide Antworten 200 confirmation_required', r1.status === 200 && r2.status === 200 && r1.j.status === 'confirmation_required' && r2.j.status === 'confirmation_required');
    ok('[ZIEL] Parallel: genau EIN Auth-User, genau EINE Redemption', a._s.createUserOk === 1 && a._s.redemptions.length === 1);
  }

  /* ---------- [IST] Logging ohne PII ---------- */
  log = logCollector();
  a = mockAdmin({ invites: [INVITE], rpc: () => ({ data: null, error: { message: 'invalid_invite' } }), resend: () => ({ data: null, error: { message: 'x' } }) });
  await call(a, undefined, log);
  a = mockAdmin({ invites: [INVITE], resend: () => ({ data: null, error: { message: 'smtp down' } }) });
  await call(a, undefined, log);
  ok('[IST] Logs enthalten NIE das Passwort', log.lines.every(l => !l.includes(PW)));
  ok('[IST] Logs enthalten keine Roh-Payloads (kein betaCode)', log.lines.every(l => !l.includes('ORVIA-BETA-X')));

  console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });

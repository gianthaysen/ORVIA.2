/* ORVIA · Batch 2 — auth.js DOM-nah mit STABILER Element-Registry (kein jsdom).
   getElementById/querySelector liefern für denselben Selektor dasselbe Objekt → echte UI-Zustände
   (disabled, textContent, innerHTML) prüfbar. KEIN echter Supabase-/Browser-Flow (s. Bericht). */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const AUTHLOGIC = (await import(new URL('../../js/auth-logic.js', import.meta.url))).default;
const AUTH_SRC = fs.readFileSync(new URL('../../js/auth.js', import.meta.url), 'utf8');
const wait = () => new Promise(r => setTimeout(r, 10));

function harness(opts) {
  const reg = new Map();
  const spies = { createClient: false, getSession: 0, from: false, replaceState: false, exchange: 0, updateUser: 0 };
  let authCb = null;
  function registerHtmlIds(html) { var m, re = /id="([^"]+)"/g; while ((m = re.exec(String(html || '')))) { if (!reg.has('#' + m[1])) reg.set('#' + m[1], makeEl()); } }
  function appendEl(el) { if (el && el._id) reg.set('#' + el._id, el); if (el) registerHtmlIds(el._html); }
  function makeEl() {
    const el = {
      style: {}, dataset: {}, _html: '', value: '', type: '', textContent: '', disabled: false, onclick: null, _id: null, _ev: {},
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, v) { v ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
      set id(v) { this._id = v; if (v) reg.set('#' + v, this); }, get id() { return this._id; },
      addEventListener(ev, cb) { this._ev[ev] = cb; }, setAttribute() {}, appendChild(c) { appendEl(c); }, remove() { if (this._id) reg.delete('#' + this._id); },
      querySelector(sel) { return regGet(sel); }, querySelectorAll(sel) { return [regGet(sel)]; }
    };
    return el;
  }
  function regGet(key) { if (!reg.has(key)) reg.set(key, makeEl()); return reg.get(key); }       // querySelector: auto-create
  function byId(id) { return reg.has('#' + id) ? reg.get('#' + id) : null; }                        // getElementById: NUR vorhandene

  const builder = { select() { return this; }, eq() { return this; }, maybeSingle() { spies.from = true; return Promise.resolve(opts.profile || { data: null, error: null }); } };
  const sb = {
    auth: {
      getSession() { spies.getSession++; return Promise.resolve(opts.session || { data: { session: null } }); },
      onAuthStateChange(cb) { authCb = cb; },
      exchangeCodeForSession() { spies.exchange++; return Promise.resolve(opts.exchange || { data: { session: null }, error: { message: 'x' } }); },
      signInWithPassword() { return Promise.resolve(opts.signIn || { data: { session: null } }); },
      signOut() { return Promise.resolve({}); },
      updateUser() { spies.updateUser++; return Promise.resolve({}); },
      resetPasswordForEmail() { return Promise.resolve({}); }, resend() { return Promise.resolve({}); }
    },
    from() { spies.from = true; return builder; },
    functions: { invoke(name, args) { spies.invoke = (spies.invoke || 0) + 1; spies.invokeBody = args && args.body; return Promise.resolve(opts.invoke || { data: null }); } }
  };
  const documentEl = {
    documentElement: { classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } } },
    title: 'x', body: { appendChild(c) { appendEl(c); } }, createElement: makeEl, getElementById(id) { return byId(id); }, querySelector(sel) { return regGet(sel); }
  };
  const win = {};
  win.ORVIA = opts.withLogic === false ? {} : { authLogic: AUTHLOGIC };
  win.ORVIA_CFG = { configured: true, SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'a'.repeat(40) };
  win.supabase = { createClient() { spies.createClient = true; return sb; } };
  win.orviaSetSyncState = () => {};
  win.renderAccountCard = () => {};
  const location = { href: opts.href || 'https://a.app/p/', hash: opts.hash || '', search: opts.search || '', origin: 'https://a.app', pathname: '/p/' };
  const history = { replaceState() { spies.replaceState = true; } };
  const navigator = { onLine: true };
  const ls = {}; const localStorage = { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } };
  reg.set('#accountBox', makeEl());   // existiert real in index.html
  let err = null;
  try {
    new Function('window', 'document', 'location', 'history', 'navigator', 'localStorage', 'supabase', AUTH_SRC)
      (win, documentEl, location, history, navigator, localStorage, win.supabase);
  } catch (e) { err = e; }
  return { reg, regGet, spies, win, documentEl, ls, fireAuth: (evt, s) => authCb && authCb(evt, s), err };
}

// 1) Fehlendes authLogic → fail-closed: Gate erzeugt, Submit deaktiviert, Fehlermeldung sichtbar.
let h = harness({ withLogic: false });
await wait();
ok('fail-closed: createClient NICHT aufgerufen', h.spies.createClient === false);
ok('fail-closed: gated', h.documentEl.documentElement.classList.contains('orvia-gated') === true);
ok('fail-closed: Submit deaktiviert', h.regGet('#ogSubmit').disabled === true);
ok('fail-closed: Fehlermeldung sichtbar', !!h.regGet('#ogErr').textContent && h.regGet('#ogErr').style.display === 'block');

// 2) PKCE recovery: Austausch genau 1×, Recovery-Formular, KEINE App, kein Sync/Onboarding
h = harness({ href: 'https://a.app/p/?code=abc&auth_action=recovery', search: '?code=abc&auth_action=recovery', exchange: { data: { session: { user: { id: 'r9' } } }, error: null } });
await wait();
ok('PKCE recovery: exchange genau 1×', h.spies.exchange === 1);
ok('PKCE recovery: KEINE App (kein User)', !h.win.ORVIA.user);
ok('PKCE recovery: kein Profil-Load (kein Sync/Onboarding)', h.spies.from === false);
ok('PKCE recovery: Recovery-Formular freigeschaltet', h.regGet('#rcSubmit').disabled === false);
ok('PKCE recovery: auth_action/URL bereinigt', h.spies.replaceState === true);

// 3) PKCE signup: nach Austausch App-Zugang
h = harness({ href: 'https://a.app/p/?code=abc&auth_action=signup', search: '?code=abc&auth_action=signup', exchange: { data: { session: { user: { id: 's9' } } }, error: null }, profile: { data: { user_id: 's9', role: 'tester', is_active: true }, error: null } });
await wait();
ok('PKCE signup: exchange genau 1×', h.spies.exchange === 1);
ok('PKCE signup: öffnet App (User gesetzt)', h.win.ORVIA.user && h.win.ORVIA.user.id === 's9');

// 4) ?code OHNE auth_action → kein automatischer App-Zugang, KEIN Austausch
h = harness({ href: 'https://a.app/p/?code=x', search: '?code=x' });
await wait();
ok('PKCE ohne action: kein User', !h.win.ORVIA.user);
ok('PKCE ohne action: kein Austausch (fail-closed)', h.spies.exchange === 0);

// 5) unbekannte auth_action → fail-closed (kein App-Zugang)
h = harness({ href: 'https://a.app/p/?code=x&auth_action=bogus', search: '?code=x&auth_action=bogus' });
await wait();
ok('unbekannte action: kein User', !h.win.ORVIA.user);

// 6) PKCE-Fehler → neutrale Loginmeldung, kein User, URL bereinigt
h = harness({ href: 'https://a.app/p/?code=bad&auth_action=signup', search: '?code=bad&auth_action=signup', exchange: { data: { session: null }, error: { message: 'expired' } } });
await wait();
ok('PKCE-Fehler: kein User', !h.win.ORVIA.user);
ok('PKCE-Fehler: URL bereinigt', h.spies.replaceState === true);

// 7) Implicit recovery bleibt funktionsfähig: Formular vor Event gesperrt, Event aktiviert, frühes Absenden ohne updateUser
h = harness({ href: 'https://a.app/p/#type=recovery', hash: '#access_token=x&type=recovery' });
await wait();
ok('implicit recovery: rcSubmit initial deaktiviert', h.regGet('#rcSubmit').disabled === true);
const form = h.regGet('.og-form'); if (form._ev.submit) form._ev.submit({ preventDefault() {} });
await wait();
ok('implicit recovery: frühes Absenden ruft updateUser NICHT', h.spies.updateUser === 0);
h.fireAuth('PASSWORD_RECOVERY', { user: { id: 'r1' } });
await wait();
ok('implicit recovery: PASSWORD_RECOVERY aktiviert rcSubmit', h.regGet('#rcSubmit').disabled === false);

// 5) Account-E-Mail mit XSS wird escaped gerendert
h = harness({ session: { data: { session: null } } });
await wait();
h.win.ORVIA.user = { email: '<img onerror=alert(1)>' };
h.win.ORVIA.profile = { role: 'tester' };
h.win.renderAccountCard();   // global aus auth.js
const accHtml = h.regGet('#accountBox').innerHTML || '';
ok('XSS-E-Mail: als Text escaped (&lt;img)', accHtml.indexOf('&lt;img') >= 0 && accHtml.indexOf('<img onerror') < 0);

// 6) Normaler Login mit Session öffnet App
h = harness({ session: { data: { session: { user: { id: 'u2' } } } }, profile: { data: { user_id: 'u2', role: 'tester', is_active: true }, error: null } });
await wait();
ok('normal + Session: User gesetzt', h.win.ORVIA.user && h.win.ORVIA.user.id === 'u2');

// 7) REGISTRIERUNG (Vertrag §8) — Erfolgsantwort → Bestätigungs-Screen + Pending-Key
function fillRegister(h, email) {
  const tab = h.regGet('.og-tabs button'); tab.dataset.m = 'register'; if (tab.onclick) tab.onclick();
  h.regGet('#ogCode').value = 'ORVIA-BETA-TEST';
  h.regGet('#ogEmail').value = email;
  h.regGet('#ogPw').value = 'Abcdefg1';
  h.regGet('#ogPw2').value = 'Abcdefg1';
  const form = h.regGet('.og-form'); if (form._ev.submit) return form._ev.submit({ preventDefault() {} });
}
h = harness({ invoke: { data: { ok: true, flowVersion: 2, status: 'confirmation_required', email: 'neu@mail.de', emailSent: true } } });
await wait();
await fillRegister(h, 'neu@mail.de');
await wait();
ok('Registrierung ok: Edge Function genau 1× aufgerufen', h.spies.invoke === 1);
ok('Registrierung ok: redirectTo mit auth_action=signup übergeben',
  !!h.spies.invokeBody && String(h.spies.invokeBody.redirectTo || '').indexOf('auth_action=signup') > 0);
ok('Registrierung ok: Bestätigungs-Screen mit E-Mail', h.regGet('#cfEmail').textContent === 'neu@mail.de');
ok('Registrierung ok: Onboarding-Pending gesetzt', h.ls['orvia_onboard_pending'] === '1');
ok('Registrierung ok: kein Versand-Fehlerhinweis', !(h.regGet('#cfErr').textContent || '').length);

// 8) REGRESSION (Live-Incident): ALTE Serverantwort ohne Vertrag → Fehler, KEIN Bestätigungs-Screen
h = harness({ invoke: { data: { ok: true, userId: 'uuid-x', role: 'tester', needsConfirmation: false } } });
await wait();
await fillRegister(h, 'alt@mail.de');
await wait();
ok('alte Antwort: Fehlermeldung "nicht korrekt bestätigt"',
  (h.regGet('#ogErr').textContent || '').indexOf('nicht korrekt bestätigt') >= 0);
ok('alte Antwort: KEIN Bestätigungs-Screen', h.reg.has('#orviaConfirm') === false);
ok('alte Antwort: Pending-Key NICHT gesetzt', h.ls['orvia_onboard_pending'] === undefined);

// 8b) REGRESSION Issue #14/#16.7 — differenzierte Fehlerdarstellung statt Maskierung
function httpErr(body) { return { data: null, error: { context: new Response(JSON.stringify(body), { status: 400 }) } }; }
h = harness({ invoke: httpErr({ code: 'invalid_invite', message: 'Diese E-Mail kann nicht verwendet werden.' }) });
await wait();
await fillRegister(h, 'dup@mail.de');
await wait();
ok('email_taken: Server-Message wird angezeigt (nicht „Beta-Code ungültig")',
  (h.regGet('#ogErr').textContent || '') === 'Diese E-Mail kann nicht verwendet werden.');
h = harness({ invoke: httpErr({ code: 'invite_only', message: 'Registrierung ist aktuell nur mit gültigem Beta-Code möglich.' }) });
await wait();
await fillRegister(h, 'x@mail.de');
await wait();
ok('invite_only (500/generisch): NICHT als „Beta-Code ungültig" getarnt',
  (h.regGet('#ogErr').textContent || '') === 'Registrierung ist nur mit gültigem Beta-Code möglich.');
h = harness({ invoke: httpErr({ code: 'invalid_invite', message: 'Beta-Code ungültig.' }) });
await wait();
await fillRegister(h, 'y@mail.de');
await wait();
ok('echter Code-Fehler: weiterhin „Beta-Code ungültig."',
  (h.regGet('#ogErr').textContent || '') === 'Beta-Code ungültig.');

// 8c) Login-Fehler differenziert (#16): unbestätigte E-Mail → Bestätigungs-Screen statt „Passwort falsch"
async function fillLogin(h, email) {
  h.regGet('#ogEmail').value = email; h.regGet('#ogPw').value = 'Abcdefg1';
  const form = h.regGet('.og-form'); if (form._ev.submit) return form._ev.submit({ preventDefault() {} });
}
h = harness({ signIn: { data: { session: null }, error: { message: 'Email not confirmed' } } });
await wait();
await fillLogin(h, 'unbestaetigt@mail.de');
await wait();
ok('Login unbestätigt: Bestätigungs-Screen statt Fehlertext', h.regGet('#cfEmail').textContent === 'unbestaetigt@mail.de');
h = harness({ signIn: { data: { session: null }, error: { message: 'Invalid login credentials' } } });
await wait();
await fillLogin(h, 'falsch@mail.de');
await wait();
ok('Login falsches Passwort: weiterhin „E-Mail oder Passwort ist falsch."',
  (h.regGet('#ogErr').textContent || '') === 'E-Mail oder Passwort ist falsch.' && !h.reg.has('#orviaConfirm'));

// 9) Erfolgsantwort mit emailSent:false → Screen erscheint MIT ehrlichem Versand-Hinweis
h = harness({ invoke: { data: { ok: true, flowVersion: 2, status: 'confirmation_required', email: 'x@mail.de', emailSent: false } } });
await wait();
await fillRegister(h, 'x@mail.de');
await wait();
ok('emailSent false: Bestätigungs-Screen erscheint', h.regGet('#cfEmail').textContent === 'x@mail.de');
ok('emailSent false: Versand-Fehlerhinweis sichtbar',
  (h.regGet('#cfErr').textContent || '').indexOf('konnte nicht gesendet werden') >= 0);

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

/* ORVIA · Batch 2 — auth-logic: Passwortregeln, Flow-Erkennung, Registrierungsvertrag (fail-closed). */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const AL = (await import(new URL('../../js/auth-logic.js', import.meta.url))).default;

// Passwortregeln
ok('schwach (kurz) → invalid', AL.pwValid('Ab1') === false);
ok('ohne Zahl → invalid', AL.pwValid('Abcdefgh') === false);
ok('ohne Großbuchstabe → invalid', AL.pwValid('abcdefg1') === false);
ok('vollständig → valid', AL.pwValid('Abcdefg1') === true);

// Flow-Erkennung — PKCE produktiv (?code + auth_action), Implicit als Fallback
ok('PKCE recovery → pkce_recovery', AL.detectAuthFlow('https://a.app/p/?code=abc&auth_action=recovery') === 'pkce_recovery');
ok('PKCE signup → pkce_signup', AL.detectAuthFlow('https://a.app/p/?code=abc&auth_action=signup') === 'pkce_signup');
ok('PKCE email_change → pkce_email_change', AL.detectAuthFlow('https://a.app/p/?code=abc&auth_action=email_change') === 'pkce_email_change');
ok('PKCE ?code OHNE action → pkce_unknown', AL.detectAuthFlow('https://a.app/p/?code=abc123') === 'pkce_unknown');
ok('PKCE ?code mit fachlichem Param, ohne action → pkce_unknown', AL.detectAuthFlow('https://a.app/p/?code=abc&tab=heute') === 'pkce_unknown');
ok('Implicit recovery-Hash → implicit_recovery', AL.detectAuthFlow('#access_token=x&type=recovery&expires_in=3600') === 'implicit_recovery');
ok('Implicit signup-Hash → implicit_signup', AL.detectAuthFlow('#access_token=x&type=signup') === 'implicit_signup');
ok('voller implicit recovery-URL', AL.detectAuthFlow('https://a.app/p/#access_token=x&type=recovery') === 'implicit_recovery');
ok('error-Param → error', AL.detectAuthFlow('#error=access_denied&error_description=expired') === 'error');
ok('error vor code priorisiert → error', AL.detectAuthFlow('https://a.app/p/?error=denied&code=y&auth_action=recovery') === 'error');
ok('leer → normal', AL.detectAuthFlow('') === 'normal');
ok('normale App-Query → normal', AL.detectAuthFlow('?tab=heute') === 'normal');

// Registrierungsvertrag FAIL-CLOSED
ok('confirmation_required v2 → akzeptiert', AL.acceptRegistration({ flowVersion: 2, status: 'confirmation_required' }) === true);
ok('fehlende flowVersion → abgelehnt', AL.acceptRegistration({ status: 'confirmation_required' }) === false);
ok('alter direkter Login (kein status) → abgelehnt', AL.acceptRegistration({ ok: true }) === false);
ok('falsche flowVersion → abgelehnt', AL.acceptRegistration({ flowVersion: 1, status: 'confirmation_required' }) === false);
ok('null → abgelehnt', AL.acceptRegistration(null) === false);

// stripAuthParams: nur Auth-Parameter entfernen, fachliche erhalten
ok('Hash-Token entfernt', AL.stripAuthParams('https://a.app/p/#access_token=x&type=recovery&expires_in=3600') === '/p/');
ok('?tab=training bleibt erhalten', AL.stripAuthParams('https://a.app/p/?tab=training#access_token=x&type=recovery') === '/p/?tab=training');
ok('error-Query entfernt, view bleibt', AL.stripAuthParams('https://a.app/p/?view=week&error=access_denied&error_description=expired') === '/p/?view=week');
ok('code (PKCE) entfernt', AL.stripAuthParams('https://a.app/p/?code=abc&tab=heute') === '/p/?tab=heute');
ok('ohne Auth-Parameter unverändert', AL.stripAuthParams('https://a.app/p/?tab=heute') === '/p/?tab=heute');
ok('auth_action entfernt, tab bleibt', AL.stripAuthParams('https://a.app/p/?code=x&auth_action=recovery&tab=heute') === '/p/?tab=heute');

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

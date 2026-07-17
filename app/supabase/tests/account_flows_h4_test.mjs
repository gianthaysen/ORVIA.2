/* ============================================================
   ORVIA · H4 — Konto-Flows (Master-Anweisung §18): Passwort/E-Mail ändern,
   ECHTE serverseitige Löschung (Edge Function, fail-closed), Profil-Center-
   Account-Karte ehrlich verlinkt.
   node supabase/tests/account_flows_h4_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../js/', import.meta.url);

/* ---------- 1) auth.js: neue Flows ---------- */
{
  const a = readFileSync(new URL('auth.js', base), 'utf8');
  ok('K1 Passwort ändern für Eingeloggte (updateUser password)', /orviaChangePassword/.test(a) && /updateUser\(\{ password: p1 \}\)/.test(a));
  ok('K2 Passwortregeln erzwungen (AL.pwValid)', /AL\.pwValid\(p1\)/.test(a));
  ok('K3 E-Mail ändern mit Bestätigungs-Redirect (email_change-Router)', /orviaChangeEmail/.test(a) && /authRedirectUrl\('email_change'\)/.test(a));
  ok('K4 Löschung ruft Edge Function delete-account mit Bearer-Token', /functions\/v1\/delete-account/.test(a) && /'Authorization': 'Bearer ' \+ token/.test(a));
  // fail-closed: INNERHALB von orviaDeleteAccount kommt der ok-Check VOR jedem lokalen Löschen.
  const delBlock = a.split('window.orviaDeleteAccount')[1] || '';
  ok('K5 fail-closed: lokal wird NUR nach ok:true gelöscht', /body && body\.ok/.test(delBlock) && delBlock.indexOf('body && body.ok') < delBlock.indexOf('localStorage.removeItem'));
  ok('K6 explizite Bestätigung (LÖSCHEN-Eingabe)', /LÖSCHEN/.test(a));
  ok('K7 Konto-Karte bietet alle vier Aktionen', /orviaChangePassword&&/.test(a) && /orviaChangeEmail&&/.test(a) && /orviaDeleteAccount&&/.test(a) && !/vorbereitet\)<\/button>/.test(a));
  ok('K8 kein Alert-Stub mehr', !/Support kontaktieren/.test(a));
}

/* ---------- 2) Edge Function: Sicherheitsverträge ---------- */
{
  const f = readFileSync(new URL('../functions/delete-account/index.ts', import.meta.url), 'utf8');
  ok('E1 Identität NUR aus dem JWT (getUser(token)), nie aus dem Body', /auth\.getUser\(token\)/.test(f) && !/body\.user_id|body\.uid/.test(f));
  ok('E2 confirm:true Pflicht', /body\.confirm !== true/.test(f));
  ok('E3 Admin-Delete (Cascade räumt alle Tabellen)', /auth\.admin\.deleteUser\(uid\)/.test(f));
  ok('E4 Service-Key nur aus Function-Env', /SUPABASE_SERVICE_ROLE_KEY/.test(f) && !/eyJ/.test(f));
  ok('E5 Fehler ⇒ ok:false (Client löscht dann nichts)', /delete_failed/.test(f));
}

/* ---------- 3) Profil-Center: Account-Karte ehrlich ---------- */
{
  const pc = readFileSync(new URL('profile-center.js', base), 'utf8');
  ok('C1 kein toter Klick mehr — Karte öffnet openLegal', /sid === 'account'\) \{/.test(pc) && /openLegal/.test(pc));
  ok('C2 kein irreführendes „in Vorbereitung" für Export/Löschung', !/Export & Konto-Löschung in Vorbereitung/.test(pc));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

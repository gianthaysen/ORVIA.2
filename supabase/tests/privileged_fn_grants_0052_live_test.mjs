/* ============================================================
   ORVIA · privileged_fn_grants_0052 — LIVE gegen die echte Instanz
   ------------------------------------------------------------
   Prüft über die öffentliche REST-Schnittstelle (wie ein Angreifer mit dem
   anon-Key aus env.js), dass die beiden Funktionen aus 0052 für anon UND
   authenticated nicht ausführbar sind.

   SICHER GEGEN PRODUKTION — auch falls die Rechte doch noch offen wären:
   - orvia_complete_invite_registration wird mit zufälliger Invite-ID gerufen.
     Die Funktion bricht dann VOR jedem Schreibzugriff mit invalid_invite ab.
   - prune_engine_decision_log wird mit keep_days = 2147483647 gerufen.
     now() - 2^31 Tage (~5,9 Mio. Jahre) liegt außerhalb des timestamptz-
     Bereichs → Fehler und Transaktionsabbruch; selbst ohne Fehler träfe die
     Bedingung keine Zeile. Gelöscht wird in keinem Fall etwas.
   Bestanden heißt: Antwort 401/403/404 mit Code 42501 (permission denied) bzw.
   PGRST202 (Funktion für die Rolle nicht sichtbar). Ein invalid_invite /
   22008 / 2xx heißt: die Funktion LIEF → Rechte offen → rot.

   NUR mit einem Testkonto (A_EMAIL), NIE mit Produktivkonten.
     SUPABASE_URL=… SUPABASE_ANON_KEY=… A_EMAIL=… A_PW=… \
       node supabase/tests/privileged_fn_grants_0052_live_test.mjs
   Ohne ENV: Exit 2 (übersprungen, NIE grün).
   ============================================================ */
import { randomUUID } from 'node:crypto';

const miss = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'A_EMAIL', 'A_PW'].filter(k => !process.env[k]);
if (miss.length) { console.error('ENV fehlt: ' + miss.join(', ') + ' — übersprungen, nicht bestanden.'); process.exit(2); }
const URL_ = process.env.SUPABASE_URL.replace(/\/+$/, '');
const ANON = process.env.SUPABASE_ANON_KEY;

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

async function rpc(fn, body, bearer) {
  const res = await fetch(URL_ + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: 'Bearer ' + (bearer || ANON), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let j = null; try { j = await res.json(); } catch (e) {}
  return { status: res.status, code: j && j.code, message: j && j.message };
}
const gesperrt = r => r.status >= 400 && (r.code === '42501' || r.code === 'PGRST202');
const zeig = r => r.status + ' ' + (r.code || '-') + ' ' + String(r.message || '').slice(0, 70);

const PROBEN = [
  ['orvia_complete_invite_registration', () => ({ p_invite_id: randomUUID(), p_user_id: randomUUID(), p_email: 'probe-0052@invalid.example' })],
  ['prune_engine_decision_log', () => ({ keep_days: 2147483647 })]
];

const run = async () => {
  for (const [fn, body] of PROBEN) {
    const r = await rpc(fn, body());
    ok('anon: ' + fn + ' nicht ausführbar', gesperrt(r), zeig(r));
  }
  const login = await fetch(URL_ + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.A_EMAIL, password: process.env.A_PW })
  });
  const lj = await login.json().catch(() => ({}));
  ok('Testkonto angemeldet (Voraussetzung für authenticated-Proben)', login.ok && !!lj.access_token, String(login.status));
  if (lj.access_token) {
    for (const [fn, body] of PROBEN) {
      const r = await rpc(fn, body(), lj.access_token);
      ok('authenticated: ' + fn + ' nicht ausführbar', gesperrt(r), zeig(r));
    }
  }
  console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Netzwerk-/Harness-Fehler:', e.message); process.exit(1); });

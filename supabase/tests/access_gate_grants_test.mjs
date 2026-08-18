/* ============================================================
   ORVIA · access_gate_grants — die Zusagen aus Migration 0036 festhalten
   ------------------------------------------------------------
   BEFUND 17.08.2026: `authenticated` hatte UPDATE auf jeder Spalte von
   `profiles`, auch auf `role`. Zusammen mit `orvia_user_role()` (liest genau
   diese Spalte) und den `owner_all`-Policies (qual = orvia_is_owner(), ohne
   user_id-Bedingung) genuegte
       update profiles set role='owner' where user_id=auth.uid();
   um Lese- und Schreibzugriff auf die Daten ALLER Nutzer zu erhalten.

   Dieser Test kann die Instanz nicht befragen — dafuer fehlen in CI die
   Zugangsdaten, und ein Test, der ohne sie still gruen meldet, waere genau die
   Sorte Gruen, die dieses Projekt zweimal teuer bezahlt hat. Er sichert die
   Stufe davor: dass die Migration existiert, ihre Aussagen traegt, und dass
   niemand im Frontend anfaengt, `profiles` zu beschreiben — denn genau das
   waere der Grund, die Rechte spaeter wieder aufzuweichen.

   node supabase/tests/access_gate_grants_test.mjs
   ============================================================ */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const APP  = ['app/js', 'js'].map(p => join(REPO, p)).find(existsSync);
const MIG  = join(REPO, 'supabase', 'migrations');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const datei = readdirSync(MIG).find(f => /^0036_/.test(f));
ok('A1 Migration 0036 existiert', !!datei, datei || 'nicht gefunden');
if (!datei) { console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen'); process.exit(1); }
const sql = readFileSync(join(MIG, datei), 'utf8');
const nackt = sql.replace(/^\s*--.*$/gm, ' ').replace(/\s+/g, ' ').toLowerCase();

/* ---------- A · Der Fix selbst ---------- */
ok('A2 anon verliert alle Rechte auf profiles',
  /revoke all on public\.profiles from anon/.test(nackt));
ok('A3 authenticated darf profiles NICHT mehr schreiben',
  /revoke insert, update, delete[^;]*on public\.profiles from authenticated/.test(nackt));
ok('A4 … und behaelt ausdruecklich das Lesen (sonst sperrt der Gate jeden aus)',
  /grant select on public\.profiles to authenticated/.test(nackt));
ok('A5 KEIN Spalten-Grant auf role oder is_active',
  !/grant update \([^)]*\brole\b[^)]*\)/.test(nackt) && !/grant update \([^)]*is_active[^)]*\)/.test(nackt));
ok('A6 oauth_tokens hart gesperrt (wie provider_credentials in 0019)',
  /revoke all on public\.oauth_tokens from anon, authenticated/.test(nackt));
ok('A7 schema_migrations unter RLS',
  /alter table public\.schema_migrations enable row level security/.test(nackt));
ok('A8 anon verliert die Tabellenrechte in public',
  /revoke all on all tables in schema public from anon/.test(nackt));
ok('A9 die Migration laeuft als eine Transaktion',
  /\bbegin;/.test(nackt) && /\bcommit;/.test(nackt));

/* ---------- B · profiles ist jetzt versioniert ---------- */
ok('B1 0036 legt profiles idempotent an (vorher in KEINER Migration)',
  /create table if not exists public\.profiles/.test(nackt));
ok('B2 die Spalten, an denen der Gate haengt, sind Teil der Definition',
  /\brole\b[^,]*not null default 'tester'/.test(nackt) && /is_active[^,]*not null default true/.test(nackt));
const liste = join(REPO, 'supabase', 'tests', '_live-check.sql');
ok('B3 profiles steht damit im Schema-Abgleich', existsSync(liste)
  && /\('0036','tabelle','profiles',''\)/.test(readFileSync(liste, 'utf8')),
  'sonst: node app/tools/gen-live-check.mjs');

/* ---------- C · Der Grund, warum der Entzug nichts bricht ---------- */
/* Faengt den Tag ab, an dem jemand im Frontend anfaengt, profiles zu
   beschreiben — dann waere nicht die Migration falsch, sondern der neue Code. */
let schreibstellen = [];
(function scan(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { scan(p); continue; }
    if (!/\.js$/.test(e.name)) continue;
    const s = readFileSync(p, 'utf8');
    for (const m of s.matchAll(/from\(\s*['"]profiles['"]\s*\)\s*\.\s*(\w+)/g))
      if (!['select'].includes(m[1])) schreibstellen.push(e.name + ':' + m[1]);
  }
})(APP);
ok('C1 kein Frontend-Code schreibt in profiles', schreibstellen.length === 0,
  schreibstellen.length ? schreibstellen.join(', ') : 'nur lesende Zugriffe');

/* ---------- D · Der einzig zulaessige Schreibpfad ---------- */
const schema = join(REPO, 'supabase', 'schema.sql');
if (existsSync(schema)) {
  const sch = readFileSync(schema, 'utf8');
  ok('D1 Profilzeilen entstehen nur in orvia_complete_invite_registration',
    /insert into public\.profiles/.test(sch)
    && /create or replace function public\.orvia_complete_invite_registration/.test(sch));
  ok('D2 … und diese Funktion ist ausschliesslich an service_role vergeben',
    /grant execute on function public\.orvia_complete_invite_registration\([^)]*\) to service_role/.test(sch)
    && !/grant execute on function public\.orvia_complete_invite_registration\([^)]*\) to (authenticated|anon)/.test(sch));
}

console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

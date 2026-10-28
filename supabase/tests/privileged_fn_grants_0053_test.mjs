/* ============================================================
   ORVIA · privileged_fn_grants_0053 — Rechtekette nach 0052 + 0053 (offline)
   ------------------------------------------------------------
   Nutzt das gemeinsame Rechtemodell (_grant-model.mjs): Supabase-Default-
   Grants + alle revoke/grant/drop aus schema.sql und den Migrationen in
   Reihenfolge.

     K  Kalibrierung: VOR 0052 liefert das Modell exakt die 14 Funktionen, die
        der Supabase-Linter am 28.10.2026 live gemeldet hat — sonst taugt das
        Modell nicht als Prüfer.
     R  Nach der ganzen Kette: Rechtematrix der 14 + keine SECURITY-DEFINER-
        Funktion mehr für anon ausführbar.
     S  0053 selbst: genau einmal, Status-Kopf, nur idempotente Statements,
        search_path für 4 Funktionen, Selbstprüfung.
     P  Alle Policies, die eine Hilfsfunktion nutzen, gelten `to authenticated`
        (eine Policy für PUBLIC würde anon nach 0053 einen Fehler statt
        „keine Zeilen" liefern).
     G  Kein Client-, Edge- oder Worker-Code ruft eine der 16 Funktionen per RPC.
     N  Gegenproben: kaputte 0053-Fassungen lassen R/S rot werden.

   Laufzeitverhalten (RLS, Trigger) prüft rls_helper_trigger_0053_db_test.mjs.
   node supabase/tests/privileged_fn_grants_0053_test.mjs
   ============================================================ */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { quellen, modell, bereinigen } from './_grant-model.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SUPA = join(HERE, '..');
const REPO = join(SUPA, '..');
const MIG = join(SUPA, 'migrations');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const ende = () => { console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen'); process.exit(fail ? 1 : 0); };

const HELP = ['orvia_user_role/0', 'orvia_is_owner/0', 'orvia_exercise_allowed/1', 'orvia_template_allowed/1', 'orvia_own_plan/1', 'orvia_own_plan_day/1', 'orvia_own_session/1', 'orvia_own_workout_exercise/1'];
const TRIG = ['dc_force_owner/0', 'rc_force_owner/0', 'orvia_ledger_mark_dirty/0', 'seed_default_feature_flags/0'];
const K52 = ['prune_engine_decision_log/1', 'orvia_complete_invite_registration/3'];
const PATHFN = ['touch_updated_at', 'touch_user_feature_flags', 'orvia_protect_planned_anchor', 'orvia_activities_link_normalize'];
const LINTER_14 = [...K52, ...HELP, ...TRIG].sort();

const files = readdirSync(MIG).filter(f => f.endsWith('.sql')).sort();
const d52 = files.find(f => /^0052_/.test(f));
const d53s = files.filter(f => /^0053_/.test(f));
ok('S0 genau EINE Migration 0053', d53s.length === 1, d53s.join(', ') || 'keine');
if (!d52 || d53s.length !== 1) ende();
const d53 = d53s[0];
const Q = quellen(SUPA);

/* ---------- K · Kalibrierung gegen den Live-Linter ---------- */
const vor52 = modell(Q, { bis: d52 });
const anonDefVor = [...vor52.rechte.keys()].filter(k => vor52.definer.get(k) && vor52.darf(k, 'anon')).sort();
ok('K1 Modell VOR 0052 = exakt die 14 vom Linter live gemeldeten Funktionen',
  JSON.stringify(anonDefVor) === JSON.stringify(LINTER_14), anonDefVor.length + ': ' + anonDefVor.filter(k => !LINTER_14.includes(k)).join(','));
const vor53 = modell(Q, { bis: d53 });
ok('K2 Modell VOR 0053 = die 12 aus der Live-Triage', [...vor53.rechte.keys()].filter(k => vor53.definer.get(k) && vor53.darf(k, 'anon')).length === 12);

/* ---------- R · Rechtematrix nach der ganzen Kette ---------- */
function matrix(M) {
  const r = {};
  r.help_anon_nein = HELP.every(k => M.rechte.has(k) && !M.darf(k, 'anon'));
  r.help_auth_ja = HELP.every(k => M.darf(k, 'authenticated'));
  r.help_service_ja = HELP.every(k => M.darf(k, 'service_role'));
  r.trig_anon_nein = TRIG.every(k => M.rechte.has(k) && !M.darf(k, 'anon'));
  r.trig_auth_nein = TRIG.every(k => !M.darf(k, 'authenticated'));
  r.k52_zu = K52.every(k => !M.darf(k, 'anon') && !M.darf(k, 'authenticated') && M.darf(k, 'service_role'));
  r.keine_anon_definer = [...M.rechte.keys()].filter(k => M.definer.get(k) && M.darf(k, 'anon')).length === 0;
  return r;
}
const R = matrix(modell(Q));
ok('R1 Hilfsfunktionen: anon darf NICHT', R.help_anon_nein);
ok('R2 Hilfsfunktionen: authenticated darf weiterhin (RLS)', R.help_auth_ja);
ok('R3 Hilfsfunktionen: service_role darf', R.help_service_ja);
ok('R4 Trigger-Funktionen: anon darf NICHT', R.trig_anon_nein);
ok('R5 Trigger-Funktionen: authenticated darf NICHT', R.trig_auth_nein);
ok('R6 0052-Funktionen bleiben zu (nur service_role)', R.k52_zu);
ok('R7 keine SECURITY-DEFINER-Funktion mehr für anon ausführbar', R.keine_anon_definer);

/* ---------- S · 0053 statisch ---------- */
const SQL = readFileSync(join(MIG, d53), 'utf8');
function statisch(sql) {
  const s = bereinigen(sql);
  const r = {};
  r.transaktion = /(^| )begin;/.test(s) && /commit;\s*$/.test(s);
  const stmts = s.replace(/do __body__ ?;/g, ' ').split(';').map(x => x.trim()).filter(Boolean);
  r.idempotent = stmts.every(x => /^(begin|commit)$/.test(x) || /^(revoke|grant) execute on function /.test(x)
    || /^alter function public\.[a-z_]+\(\) set search_path = public$/.test(x)
    || /^insert into public\.schema_migrations ?\(version\) values \('0053_[a-z0-9_]+'\) on conflict \(version\) do nothing$/.test(x));
  r.search_path = PATHFN.every(n => new RegExp('alter function public\\.' + n + '\\(\\) set search_path = public;').test(s));
  r.selbstpruefung = /do __body__ ?;/.test(s);
  return r;
}
const S = statisch(SQL);
ok('S1 Kopf dokumentiert Produktionsstatus (angewendet + verifiziert 28.10.2026)', /STATUS PRODUKTION: ANGEWENDET am 28\.10\.2026/.test(SQL) && /16\/16 ok/.test(SQL));
ok('S2 eine Transaktion', S.transaktion);
ok('S3 nur idempotente Statements (revoke/grant/alter … set search_path/schema_migrations)', S.idempotent);
ok('S4 search_path=public für alle 4 Funktionen der Gruppe C', S.search_path);
ok('S5 Selbstprüfung vorhanden und prüft authenticated-Erhalt', S.selbstpruefung && /RLS wuerde brechen/.test(SQL) && /search_path fuer % nicht gesetzt/.test(SQL));

/* ---------- P · Policies mit Hilfsfunktionen nur für authenticated ---------- */
const HNAMES = HELP.map(k => k.split('/')[0]);
const policies = [];
for (const q of Q) {
  const raw = q.sql.replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').toLowerCase();   // Strings bleiben: format('create policy …') zählt mit
  for (const m of raw.matchAll(/create policy [^;']*?(?:'|;|$)?[^;]*?;/g)) {
    const t = m[0];
    const used = HNAMES.filter(h => new RegExp('\\b' + h + '\\s*\\(').test(t));
    if (used.length) policies.push({ datei: q.datei, to: (t.match(/ to ([a-z_, ]+?) (using|with)/) || [])[1] || '(PUBLIC)', used });
  }
}
const fremdeRolle = policies.filter(p => p.to.trim() !== 'authenticated');
ok('P1 Policies mit Hilfsfunktionen gefunden', policies.length >= 10, policies.length + ' Policies');
ok('P2 jede davon gilt ausschließlich `to authenticated`', fremdeRolle.length === 0, fremdeRolle.map(p => p.datei + ':' + p.to).join(', '));

/* ---------- G · keine RPC-Aufrufer ---------- */
const ALLE = [...HNAMES, ...TRIG.map(k => k.split('/')[0]), ...PATHFN];
const rpcRe = new RegExp("rpc\\(\\s*['\"`](" + ALLE.join('|') + ")['\"`]");
const treffer = [];
(function scan(dir) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!/^(node_modules|\.|_)/.test(e.name)) scan(p); continue; }
    if (/\.(m?js|ts|py)$/.test(e.name) && rpcRe.test(readFileSync(p, 'utf8'))) treffer.push(p.slice(REPO.length + 1));
  }
})(REPO);
ok('G1 kein Code im Repo (App, Edge Functions, Worker) ruft eine der 16 Funktionen per RPC', treffer.filter(t => !/supabase[\\/]tests[\\/]/.test(t)).length === 0, treffer.join(', '));

/* ---------- N · Gegenproben ---------- */
const mit = sql => modell(Q.map(q => q.datei === d53 ? { datei: d53, sql } : q));
const NEG = [
  ['N1 Hilfsfunktionen auch authenticated entzogen (RLS bräche)', SQL.replace(/\n  from public, anon;/, '\n  from public, anon, authenticated;').replace(/\n  to authenticated, service_role;/, '\n  to service_role;'), 'help_auth_ja'],
  ['N2 Hilfsfunktionen nur `from public` (alte Ursache)', SQL.replace(/\n  from public, anon;/, '\n  from public;'), 'help_anon_nein'],
  ['N3 Trigger: authenticated vergessen', SQL.replace(/\n  from public, anon, authenticated;/, '\n  from public, anon;'), 'trig_auth_nein'],
  ['N4 Trigger-Block fehlt ganz', SQL.replace(/revoke execute on function\s+public\.dc_force_owner\(\)[\s\S]*?from public, anon, authenticated;/, ''), 'keine_anon_definer']
];
for (const [n, v, key] of NEG) {
  ok(n + ' → Variante weicht ab', v !== SQL);
  ok(n + ' → Prüfer schlägt an (' + key + ')', matrix(mit(v))[key] === false);
}
const NEG_S = [
  ['N5 search_path-Zeile fehlt', SQL.replace(/alter function public\.orvia_protect_planned_anchor\(\) set search_path = public;\n/, ''), 'search_path'],
  ['N6 Fachdaten-DML eingeschmuggelt', SQL.replace(/\ncommit;/, '\ndelete from public.profiles;\ncommit;'), 'idempotent'],
  ['N7 Selbstprüfung entfernt', SQL.replace(/do \$\$[\s\S]*?end \$\$;/, ''), 'selbstpruefung']
];
for (const [n, v, key] of NEG_S) {
  ok(n + ' → Variante weicht ab', v !== SQL);
  ok(n + ' → Prüfer schlägt an (' + key + ')', statisch(v)[key] === false);
}

ende();

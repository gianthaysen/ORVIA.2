/* ============================================================
   ORVIA · privileged_fn_grants_0052 — Zusagen aus Migration 0052 festhalten
   ------------------------------------------------------------
   BEFUND 28.10.2026: prune_engine_decision_log(integer) (löscht engine_decision_log
   über ALLE Nutzer) und orvia_complete_invite_registration(uuid, uuid, text)
   (schreibt profiles inkl. role) waren für anon/authenticated ausführbar.
   Ursache: `revoke … from public` entzieht in Supabase NICHT die direkten
   Default-Grants an anon/authenticated.

   Dieser Test befragt KEINE Instanz (dafür: privileged_fn_grants_0052_live_test.mjs).
   Er sichert die Stufe davor:
     A  die Migration existiert genau einmal und läuft als Transaktion
     B  sie entzieht die Rechte ausdrücklich von public, anon UND authenticated —
        mit exakt der Signatur, mit der die Funktionen definiert sind
     C  service_role behält EXECUTE
     D  sie prüft ihren Endzustand selbst (fail closed)
     E  sie ist idempotent (nur revoke/grant/schema_migrations-Eintrag)
     F  keine Datei vergibt die Rechte wieder an Client-Rollen
     G  kein Client-Code ruft die beiden Funktionen auf (Grund, warum der Entzug nichts bricht)
     N  Gegenproben: der Prüfer schlägt bei kaputten Varianten an — sonst wäre sein Grün wertlos

   node supabase/tests/privileged_fn_grants_0052_test.mjs
   ============================================================ */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SUPA = join(HERE, '..');
const REPO = join(SUPA, '..');
const MIG = join(SUPA, 'migrations');
const SCHEMA = join(SUPA, 'schema.sql');
const APP = ['app/js', 'js'].map(p => join(REPO, p)).find(existsSync);
const FUNCS = join(SUPA, 'functions');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const ende = () => { console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen'); process.exit(fail ? 1 : 0); };

const FN = {
  prune: { name: 'prune_engine_decision_log', defIn: 'migrations' },
  invite: { name: 'orvia_complete_invite_registration', defIn: 'schema' }
};
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Kommentare raus, Whitespace normalisieren, klein. Auskommentierter Code zählt nicht. */
export function nackt(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

/* Signatur aus der Definition lesen: create [or replace] function public.<name>(a typ [default x], …) */
export function signaturAusDefinition(sql, name) {
  const m = nackt(sql).match(new RegExp('create (?:or replace )?function public\\.' + esc(name) + ' ?\\(([^)]*)\\)'));
  if (!m) return null;
  return m[1].split(',').map(a => a.trim()).filter(Boolean)
    .map(a => a.replace(/ default .*$/, '').split(' ').slice(1).join(' ').trim());
}

/* Prüft eine 0052-Fassung. Rückgabe: { schluessel: bool } — alles true = vertragskonform. */
export function pruefe(sql, sig) {
  const s = nackt(sql);
  const r = {};
  r.transaktion = /(^|; ?)begin;/.test(s) && /commit;\s*$/.test(s);
  for (const k of Object.keys(FN)) {
    const name = FN[k].name;
    const sigTxt = sig[k].join(', ');
    const sigRe = esc(name) + ' ?\\( ?' + sig[k].map(esc).join(' ?, ?') + ' ?\\)';
    const rollen = new Set();
    for (const m of s.matchAll(new RegExp('revoke (?:execute|all(?: privileges)?) on function public\\.' + sigRe + ' from ([^;]+);', 'g')))
      m[1].split(',').forEach(x => rollen.add(x.trim()));
    r[k + '_revoke_public'] = rollen.has('public');
    r[k + '_revoke_anon'] = rollen.has('anon');
    r[k + '_revoke_authenticated'] = rollen.has('authenticated');
    r[k + '_service_role'] = new RegExp('grant execute on function public\\.' + sigRe + ' to [^;]*\\bservice_role\\b').test(s);
    r[k + '_kein_client_grant'] = !new RegExp('grant (?:execute|all)[^;]* on function public\\.' + esc(name) + '\\b[^;]* to [^;]*\\b(anon|authenticated|public)\\b').test(s);
    r[k + '_selbstpruefung'] = s.includes("'public." + name + '(' + sigTxt + ")'");
  }
  const doBlock = (s.match(/do \$\$[\s\S]*?\$\$;/) || [''])[0];
  r.selbstpruefung_rollen = /has_function_privilege\(r, fn, 'execute'\)/.test(doBlock)
    && /array\['anon', 'authenticated'\]/.test(doBlock) && /raise exception/.test(doBlock)
    && /has_function_privilege\('service_role', fn, 'execute'\)/.test(doBlock);
  /* Idempotenz: außerhalb des do-Blocks nur begin/commit/revoke/grant/schema_migrations-Eintrag. */
  const stmts = s.replace(/do \$\$[\s\S]*?\$\$;/g, ' ').split(';').map(x => x.trim()).filter(Boolean);
  const fremd = stmts.filter(x => !(/^(begin|commit)$/.test(x) || /^(revoke|grant) /.test(x)
    || /^insert into public\.schema_migrations ?\(version\) values \('0052_[a-z0-9_]+'\) on conflict \(version\) do nothing$/.test(x)));
  r.nur_idempotente_statements = fremd.length === 0;
  r._fremd = fremd;
  r.registriert_sich = /insert into public\.schema_migrations ?\(version\) values \('0052_[a-z0-9_]+'\) on conflict \(version\) do nothing/.test(s);
  return r;
}
const alleOk = r => Object.keys(r).filter(k => k[0] !== '_').every(k => r[k] === true);

/* ---------- A · Datei ---------- */
const files = readdirSync(MIG).filter(f => f.endsWith('.sql')).sort();
const d0052 = files.filter(f => /^0052_/.test(f));
ok('A1 genau EINE Migration 0052', d0052.length === 1, d0052.join(', ') || 'keine');
if (d0052.length !== 1) ende();
const SQL = readFileSync(join(MIG, d0052[0]), 'utf8');
ok('A3 Kopf dokumentiert: in Produktion bereits manuell angewendet', /BEREITS ANGEWENDET am 28\.10\.2026/.test(SQL));

/* Signaturen aus den echten Definitionen (nicht abgeschrieben). */
const defPrune = files.map(f => readFileSync(join(MIG, f), 'utf8')).find(t => /function public\.prune_engine_decision_log/i.test(t));
const sig = {
  prune: defPrune ? signaturAusDefinition(defPrune, FN.prune.name) : null,
  invite: existsSync(SCHEMA) ? signaturAusDefinition(readFileSync(SCHEMA, 'utf8'), FN.invite.name) : null
};
ok('A4 Signatur prune aus Definition (0032) gelesen', JSON.stringify(sig.prune) === '["integer"]', JSON.stringify(sig.prune));
ok('A5 Signatur invite aus Definition (schema.sql) gelesen', JSON.stringify(sig.invite) === '["uuid","uuid","text"]', JSON.stringify(sig.invite));
if (!sig.prune || !sig.invite) ende();

/* ---------- B–E · Inhalt ---------- */
const R = pruefe(SQL, sig);
ok('B0 als eine Transaktion (begin … commit)', R.transaktion);
for (const k of Object.keys(FN)) {
  const n = FN[k].name;
  ok('B ' + n + ': EXECUTE von public entzogen', R[k + '_revoke_public']);
  ok('B ' + n + ': EXECUTE von anon entzogen (direkter Supabase-Grant!)', R[k + '_revoke_anon']);
  ok('B ' + n + ': EXECUTE von authenticated entzogen', R[k + '_revoke_authenticated']);
  ok('C ' + n + ': service_role behält EXECUTE', R[k + '_service_role']);
  ok('B ' + n + ': kein Grant an anon/authenticated/public in 0052', R[k + '_kein_client_grant']);
  ok('D ' + n + ': in der Selbstprüfung mit exakter Signatur', R[k + '_selbstpruefung']);
}
ok('D  Selbstprüfung: anon+authenticated dürfen nicht, service_role muss — sonst raise exception (Rollback)', R.selbstpruefung_rollen);
ok('E1 nur idempotente Statements (revoke/grant/begin/commit/schema_migrations)', R.nur_idempotente_statements, R._fremd.join(' | ').slice(0, 160));
ok('E2 trägt sich mit on conflict do nothing in schema_migrations ein', R.registriert_sich);

/* ---------- F · Niemand vergibt die Rechte wieder ---------- */
const quellen = files.map(f => ({ f, t: readFileSync(join(MIG, f), 'utf8') }));
if (existsSync(SCHEMA)) quellen.push({ f: 'schema.sql', t: readFileSync(SCHEMA, 'utf8') });
const wiederVergeben = [];
for (const q of quellen) for (const k of Object.keys(FN))
  if (new RegExp('grant (?:execute|all)[^;]* on function public\\.' + esc(FN[k].name) + '\\b[^;]* to [^;]*\\b(anon|authenticated|public)\\b').test(nackt(q.t)))
    wiederVergeben.push(q.f + ':' + FN[k].name);
ok('F1 keine Migration / schema.sql vergibt EXECUTE an anon/authenticated/public', wiederVergeben.length === 0, wiederVergeben.join(', '));
/* drop function + create setzt die Default-Grants zurück → spätere Migration muss erneut entziehen. */
const spaeter = quellen.filter(q => /^\d{4}_/.test(q.f) && parseInt(q.f, 10) > 52);
const neuOhneRevoke = [];
for (const q of spaeter) for (const k of Object.keys(FN)) {
  const t = nackt(q.t);
  if (new RegExp('drop function (?:if exists )?public\\.' + esc(FN[k].name)).test(t)
    && !new RegExp('revoke [^;]* on function public\\.' + esc(FN[k].name) + '[^;]* from [^;]*anon[^;]*authenticated|revoke [^;]* on function public\\.' + esc(FN[k].name) + '[^;]* from [^;]*authenticated[^;]*anon').test(t))
    neuOhneRevoke.push(q.f + ':' + FN[k].name);
}
ok('F2 spätere Migrationen, die eine der Funktionen neu anlegen, entziehen erneut', neuOhneRevoke.length === 0, neuOhneRevoke.join(', ') || spaeter.length + ' spätere Migrationen');

/* ---------- G · Aufrufer ---------- */
function scan(dir, re, out, filt) {
  if (!dir || !existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') scan(p, re, out, filt); continue; }
    if (!filt.test(e.name)) continue;
    if (re.test(readFileSync(p, 'utf8'))) out.push(p.slice(REPO.length + 1));
  }
  return out;
}
ok('G0 Frontend-Verzeichnis gefunden', !!APP, String(APP));
const rpcPrune = /rpc\(\s*['"`]prune_engine_decision_log['"`]/;
const rpcInvite = /rpc\(\s*['"`]orvia_complete_invite_registration['"`]/;
ok('G1 kein Frontend-Code ruft prune_engine_decision_log', scan(APP, rpcPrune, [], /\.(m?js|ts)$/).length === 0);
ok('G2 kein Frontend-Code ruft orvia_complete_invite_registration', scan(APP, rpcInvite, [], /\.(m?js|ts)$/).length === 0);
ok('G3 keine Edge Function ruft prune_engine_decision_log', scan(FUNCS, rpcPrune, [], /\.(m?js|ts)$/).length === 0);
const inviteAufrufer = scan(FUNCS, rpcInvite, [], /\.(m?js|ts)$/);
ok('G4 orvia_complete_invite_registration nur aus register-with-invite/handler.mjs',
  inviteAufrufer.length === 1 && /register-with-invite[\\/]handler\.mjs$/.test(inviteAufrufer[0]), inviteAufrufer.join(', '));
const idx = join(FUNCS, 'register-with-invite', 'index.ts');
const idxT = existsSync(idx) ? readFileSync(idx, 'utf8') : '';
ok('G5 register-with-invite baut den Admin-Client mit SUPABASE_SERVICE_ROLE_KEY (nicht anon)',
  /Deno\.env\.get\(['"]SUPABASE_SERVICE_ROLE_KEY['"]\)/.test(idxT) && /createClient\(\s*supabaseUrl\s*,\s*serviceRoleKey/.test(idxT) && !/ANON_KEY/.test(idxT));

/* ---------- N · Gegenproben: der Prüfer muss bei kaputten Fassungen anschlagen ---------- */
const NEG = [
  ['N1 altes Muster nur `from public` (die eigentliche Ursache)', SQL.replace(/from public, anon, authenticated/g, 'from public')],
  ['N2 authenticated vergessen', SQL.replace(/from public, anon, authenticated/g, 'from public, anon')],
  ['N3 falsche Signatur bei prune', SQL.replace(/revoke execute on function public\.prune_engine_decision_log\(integer\)/, 'revoke execute on function public.prune_engine_decision_log()')],
  ['N4 Rechte danach wieder an anon vergeben', SQL.replace(/\ncommit;/, '\ngrant execute on function public.prune_engine_decision_log(integer) to anon;\ncommit;')],
  ['N5 Selbstprüfung entfernt', SQL.replace(/do \$\$[\s\S]*?\$\$;/, '')],
  ['N6 nicht-idempotente Fachdaten-DML eingeschmuggelt', SQL.replace(/\ncommit;/, '\ndelete from public.engine_decision_log;\ncommit;')],
  ['N7 Revoke nur noch auskommentiert', SQL.replace(/\nrevoke execute on function public\.orvia_complete_invite_registration/, '\n-- revoke execute on function public.orvia_complete_invite_registration')],
  ['N8 service_role-Grant fehlt', SQL.replace(/grant execute on function public\.orvia_complete_invite_registration\(uuid, uuid, text\) to service_role;/, '')],
  ['N9 ohne Transaktion', SQL.replace(/\nbegin;/, '\n').replace(/\ncommit;/, '\n')]
];
for (const [n, v] of NEG) {
  ok(n + ' → Variante unterscheidet sich vom Original', v !== SQL);
  ok(n + ' → Prüfer schlägt an', !alleOk(pruefe(v, sig)));
}
ok('N0 Positivkontrolle: Originaldatei ist vollständig vertragskonform', alleOk(R));

ende();

/* ============================================================
   ORVIA · performance_ledger_db (v8-448A) — Migration 0051 gegen ein WEGWERF-Postgres

   Kein Zugriff auf die Produktionsdatenbank. Startet ein eigenes Postgres (initdb), legt die Supabase-
   Stuetzen an (auth.users, auth.uid(), Rolle authenticated, activities mit RLS, user_feature_flags) und prueft:
   M1  Migration laeuft zweimal (idempotent)
   M2  Zeilen aus dem echten Rechenkern (performance-ledger.js) landen ueber orvia_ledger_apply
   M3  zweites Speichern derselben Zeilen: keine Dubletten
   M4  RLS: anderer Nutzer sieht nichts und kann fremde Aktivitaeten nicht eintragen
   M5  Loeschen einer Aktivitaet: Eintraege/Ereignisse fallen weg, Kennzahl wird „neu zu berechnen";
       Neuberechnung speichert den vorherigen Bestwert und loescht den Vermerk
   M6  Konsistenzregeln (Wert ↔ Status, erstes Ereignis ohne Vorgaenger)
   M7  Protokoll nur anhaengen; Flag-Name erlaubt, Standard AUS
   M8  Rueckweg entfernt alles, Aktivitaeten bleiben; erneutes Einspielen geht
   Ohne Postgres: uebersprungen (Exit 2), nie „bestanden".
   ============================================================ */
import fs from 'fs';
import os from 'os';
import path from 'path';
import net from 'net';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync as _ex } from 'node:fs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const _ROOT = _ex(new URL('../../supabase/migrations/', import.meta.url)) ? '../../' : '../../../';
const require = createRequire(import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const binDir = (() => { try { const d = fs.readdirSync('/usr/lib/postgresql').sort().pop(); return d ? '/usr/lib/postgresql/' + d + '/bin' : null; } catch (e) { return null; } })();
const MIG = new URL(_ROOT + 'supabase/migrations/0051_performance_ledger.sql', import.meta.url).pathname;
const RB = new URL(_ROOT + 'supabase/migrations_rollback/0051_performance_ledger_rollback.sql', import.meta.url).pathname;
if (!binDir || !fs.existsSync(binDir + '/initdb')) { console.log('⏭️  ÜBERSPRUNGEN — kein Postgres (initdb) in dieser Umgebung; Migration 0051 NICHT geprueft'); process.exit(2); }

const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
const base = fs.mkdtempSync(path.join('/tmp', 'orvia-pg-ledger-'));
const port = await new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const sh = cmd => asRoot ? spawnSync('su', ['postgres', '-c', cmd], { encoding: 'utf8' }) : spawnSync('bash', ['-c', cmd], { encoding: 'utf8' });
if (asRoot) { fs.chmodSync(base, 0o755); spawnSync('chown', ['postgres', base]); }
const st = sh(`${binDir}/initdb -D ${base}/data -A trust -U postgres >/dev/null 2>&1 && ${binDir}/pg_ctl -D ${base}/data -o '-p ${port} -c listen_addresses=127.0.0.1 -k ${base}' -l ${base}/log -w start >/dev/null`);
if (st.status !== 0) { console.log('⏭️  ÜBERSPRUNGEN — Wegwerf-Postgres startet nicht; Migration 0051 NICHT geprueft'); process.exit(2); }
const stop = () => { sh(`${binDir}/pg_ctl -D ${base}/data -m immediate stop >/dev/null 2>&1`); try { fs.rmSync(base, { recursive: true, force: true }); } catch (e) {} };
process.on('exit', stop);

function psql(sql, { file = null, expectError = false } = {}) {
  const args = ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qtAX'];
  if (file) args.push('-f', file);
  args.push('postgres');
  const r = spawnSync(binDir + '/psql', args, { input: file ? undefined : sql, encoding: 'utf8' });
  if (!expectError && r.status !== 0) throw new Error((r.stderr || '').slice(-800));
  return expectError ? { ok: r.status === 0, err: r.stderr || '' } : r.stdout.trim();
}
const q = o => "'" + JSON.stringify(o).replace(/'/g, "''") + "'::jsonb";
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
const as = (uid, sql) => `set role authenticated; set request.jwt.claims = '{"sub":"${uid}"}';\n${sql}`;

psql(`
create schema if not exists auth;
create table auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
create role authenticated nologin;
grant usage on schema public, auth to authenticated;
grant execute on function auth.uid() to authenticated;
insert into auth.users values ('${A}'), ('${B}');
create table public.activities (id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  sport_id text not null, source text not null, started_at timestamptz);
alter table public.activities enable row level security;
create policy act_own on public.activities for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.activities to authenticated;
create table public.user_feature_flags (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  flag text not null, enabled boolean not null default false, reason text, unique (user_id, flag));
alter table public.user_feature_flags add constraint user_feature_flags_flag_known check (flag in ('engine_v2_plan', 'engine_v2_readiness',
  'canary_diagnostics', 'prediction_observer', 'goal_plan_input', 'absence_replanner'));
`);

/* ---- Rechenkern laden und echte Zeilen erzeugen -------------------------------- */
globalThis.window = globalThis;
for (const f of ['js/onboarding/onboarding-sports-logic.js', 'js/training-domain.js', 'js/activity-normalize.js', 'js/activity-config.js', 'js/activity-time.js'])
  require(new URL(_APPREL + f, import.meta.url).pathname);
const GEN = await import(new URL(_APPREL + 'tools/gen-eligibility-doc.mjs', import.meta.url));
require(new URL(_APPREL + 'js/engine/performance-ledger.js', import.meta.url).pathname);
const L = globalThis.ORVIA.performanceLedger;
const uuid = i => '00000000-0000-4000-8000-' + String(i).padStart(12, '0');
function run(i, date, s5k) {
  const a = GEN.referenceActivity('running', 'best');
  a.id = uuid(i); a.startedAt = date + 'T06:00:00.000Z';
  a.metrics.garmin.start_local = date + 'T08:00:00'; a.metrics.garmin.start_gmt = date + 'T06:00:00Z';
  a.metrics.best_efforts.distance.targets['5000'] = { s: s5k, over_m: 2, at: 0, q: 'measured' };
  return a;
}
const runs = [run(1, '2026-08-02', 1510), run(2, '2026-08-16', 1482), run(3, '2026-09-13', 1445), run(4, '2026-09-27', 1419)];
psql(runs.map(r => `insert into public.activities values ('${r.id}', '${A}', 'running', 'garmin', '${r.startedAt}');`).join('\n'));
const opt = { timeZone: 'Europe/Berlin' };
let res = L.update(null, runs, opt);
const apply = (uid, state, actIds, keys, ms, log) => {
  const r = L.rows(state, actIds, keys);
  return `select public.orvia_ledger_apply('${L.CALC_VERSION}', array[${actIds.map(x => `'${x}'`).join(',')}]::uuid[], ${q(r.entries)}, array[${keys.map(k => `'${k}'`).join(',')}]::text[], ${q(r.events)}, ${ms ? q(r.milestones) : 'null'}, ${q(log || [])});`;
};
const K5 = 'running.fastest_5000m@standard';

/* M1 */
psql(null, { file: MIG }); psql(null, { file: MIG });
ok('M1 Migration zweimal eingespielt (idempotent)', psql("select count(*) from information_schema.tables where table_name like 'performance_%'") === '5');

/* M2 */
const ids = runs.map(r => r.id), keys = res.changes.affectedKeys;
const out1 = psql(as(A, apply(A, res.state, ids, keys, true, res.changes.log)));
const cnt = () => psql(as(A, `select (select count(*) from performance_ledger_entries)||','||(select count(*) from performance_record_events)||','||(select count(*) from performance_milestones)||','||(select count(*) from performance_ledger_log);`));
const c1 = cnt();
const nEntries = L.rows(res.state).entries.length, nEvents = L.rows(res.state).events.length;
ok('M2 echte Zeilen gespeichert (Eintraege, Ereignisse, Protokoll)', c1.split(',')[0] === String(nEntries) && c1.split(',')[1] === String(nEvents), c1 + ' / ' + out1);
const best = psql(as(A, `select value || ' ' || previous_value || ' ' || improvement || ' ' || local_date from performance_record_events where metric_key = '${K5}' order by seq desc limit 1`));
ok('M2b Rekordereignis in der Datenbank: 23:39 nach 24:05, Verbesserung 26 s, Aktivitaetsdatum', best === '1419 1445 26 2026-09-27', best);

/* M2c · v8-449.1 Zeitkategorie */
const tc = psql(as(A, `select (select string_agg(distinct coalesce(time_category,'-'), ',' order by coalesce(time_category,'-')) from performance_ledger_entries)
  || '|' || (select count(*) from performance_ledger_entries where metric_key = 'running.fastest_5000m_active@standard' and time_category = 'active')
  || '|' || (select count(*) from performance_record_events where metric_key = '${K5}' and time_category = 'elapsed')
  || '|' || (select count(*) from performance_record_events where metric_key = 'running.fastest_5000m_active@standard' and time_category = 'active')`));
ok('M2c Zeitkategorie gespeichert: aktiv und einschliesslich Pausen getrennt (Eintraege und Ereignisse)', /^-,active,elapsed\|[1-9]\d*\|[1-9]\d*\|[1-9]\d*$/.test(tc), tc);
const badCat = psql(as(A, `insert into performance_record_events (user_id, metric_key, time_category, calc_version, seq, event_type, activity_id, value)
  values ('${A}', 'x', 'moving', 'ledger@2', 1, 'first', '${runs[0].id}', 1)`), { expectError: true });
ok('M2d unbekannte Zeitkategorie abgelehnt (keine Bewegungszeit-Rekorde)', !badCat.ok && /pre_timecat_chk/.test(badCat.err));

/* M3 */
psql(as(A, apply(A, res.state, ids, keys, true, [])));
const c2 = cnt();
ok('M3 zweites Speichern: keine Dubletten (Eintraege/Ereignisse gleich)', c2.split(',').slice(0, 3).join() === c1.split(',').slice(0, 3).join(), c1 + ' → ' + c2);

/* M4 */
ok('M4a anderer Nutzer sieht keine Zeile', psql(as(B, 'select count(*) from performance_ledger_entries')) === '0' && psql(as(B, 'select count(*) from performance_record_events')) === '0');
const foreign = psql(as(B, apply(B, res.state, ids, keys, false, [])), { expectError: true });
ok('M4b fremde Aktivitaeten eintragen: abgelehnt (ledger_foreign_activity)', !foreign.ok && /ledger_foreign_activity/.test(foreign.err), foreign.err.slice(0, 120));
const unauth = psql(`set role authenticated; select public.orvia_ledger_apply('ledger@1', '{}'::uuid[], '[]', '{}'::text[], '[]', null, '[]');`, { expectError: true });
ok('M4c ohne Anmeldung: abgelehnt', !unauth.ok && /ledger_not_authenticated/.test(unauth.err));

/* M5 */
psql(`delete from public.activities where id = '${runs[3].id}';`);
ok('M5a Loeschung: Eintraege und Ereignisse der Aktivitaet fallen weg', psql(as(A, `select count(*) from performance_ledger_entries where activity_id = '${runs[3].id}'`)) === '0'
   && psql(as(A, `select count(*) from performance_record_events where activity_id = '${runs[3].id}'`)) === '0');
const dirty = psql(as(A, `select string_agg(metric_key, ',' order by metric_key) from performance_ledger_dirty`));
ok('M5b Kennzahl als „neu zu berechnen" vermerkt', dirty.split(',').includes(K5), dirty);
const r2 = L.update(res.state, runs.slice(0, 3), opt);
const dk = dirty.split(',');
const allKeys = [...new Set(r2.changes.affectedKeys.concat(dk))].sort();
psql(as(A, apply(A, r2.state, r2.changes.removed, allKeys, true, r2.changes.log)));
const best2 = psql(as(A, `select value from performance_record_events where metric_key = '${K5}' order by seq desc limit 1`));
ok('M5c Neuberechnung: Bestwert wieder 24:05, Vermerk geloescht', best2 === '1445' && psql(as(A, 'select count(*) from performance_ledger_dirty')) === '0', best2);
ok('M5d Protokoll nennt die Loeschung', psql(as(A, `select count(*) from performance_ledger_log where reason = 'activity_removed' and metric_key = '${K5}'`)) === '1');

/* M6 */
const bad1 = psql(as(A, `insert into performance_ledger_entries (user_id, activity_id, sport_id, metric_key, def_id, context_class, value, better, order_key, source, eligibility_status, validation_status, calc_version, input_fingerprint)
  values ('${A}', '${runs[0].id}', 'running', 'x@standard', 'x', 'standard', null, 'lower', 'k', 'garmin', 'eligible', 'validated', 'ledger@1', 'f')`), { expectError: true });
ok('M6a freigegeben ohne Wert: abgelehnt', !bad1.ok && /ple_value_chk/.test(bad1.err));
const bad2 = psql(as(A, `insert into performance_record_events (user_id, metric_key, calc_version, seq, event_type, activity_id, value, previous_value)
  values ('${A}', 'x', 'ledger@1', 1, 'first', '${runs[0].id}', 1, 2)`), { expectError: true });
ok('M6b erstes Ereignis mit Vorgaenger: abgelehnt', !bad2.ok && /pre_first_chk/.test(bad2.err));

/* M7 */
const delLog = psql(as(A, 'delete from performance_ledger_log;'), { expectError: true }), updLog = psql(as(A, "update performance_ledger_log set reason = 'x';"), { expectError: true });
ok('M7a Protokoll nur anhaengen: Loeschen und Aendern durch den Nutzer verweigert', !delLog.ok && !updLog.ok && /permission denied/.test(delLog.err) && Number(psql(as(A, 'select count(*) from performance_ledger_log'))) > 0);
psql(`insert into public.user_feature_flags (user_id, flag, enabled) values ('${A}', 'performance_ledger', false);`);
const badFlag = psql(`insert into public.user_feature_flags (user_id, flag, enabled) values ('${A}', 'ledger_typo', true);`, { expectError: true });
ok('M7b Flag performance_ledger erlaubt, Tippfehler abgelehnt', !badFlag.ok && psql("select count(*) from public.user_feature_flags where flag = 'performance_ledger' and enabled = false") === '1');

/* M8 */
psql(null, { file: RB });
ok('M8a Rueckweg: alle Register-Tabellen weg, Aktivitaeten bleiben', psql("select count(*) from information_schema.tables where table_name like 'performance_%'") === '0' && psql('select count(*) from public.activities') === '3');
const afterRb = psql(`insert into public.user_feature_flags (user_id, flag, enabled) values ('${B}', 'performance_ledger', true);`, { expectError: true });
ok('M8b Rueckweg: Flag-Name wieder unbekannt', !afterRb.ok);
psql(null, { file: MIG });
ok('M8c erneutes Einspielen nach dem Rueckweg', psql("select count(*) from information_schema.tables where table_name like 'performance_%'") === '5');

/* M9 · v8-449.1: wer die erste Fassung von 0051 (v8-448A, ohne time_category) eingespielt hat, bekommt die Spalten additiv.
   Die erste Fassung kommt aus Git (der Commit, der die Datei angelegt hat) — ohne Git wird M9 uebersprungen. */
{
  const cp = await import('node:child_process'), os = await import('node:os'), path = await import('node:path');
  const rel = 'supabase/migrations/0051_performance_ledger.sql', cwd = new URL(_ROOT, import.meta.url).pathname;
  const first = cp.spawnSync('git', ['log', '--diff-filter=A', '--format=%H', '--', rel], { cwd, encoding: 'utf8' });
  const sha = first.status === 0 ? first.stdout.trim().split('\n').pop() : '';
  const shown = sha ? cp.spawnSync('git', ['show', sha + ':' + rel], { cwd, encoding: 'utf8' }) : null;
  if (!shown || shown.status !== 0 || /time_category/.test(shown.stdout)) {
    console.log('⏭️  M9 uebersprungen (erste Fassung von 0051 nicht aus Git lesbar)');
  } else {
    const f = path.join(os.tmpdir(), 'orvia_0051_first_' + process.pid + '.sql'); fs.writeFileSync(f, shown.stdout);
    psql(null, { file: RB }); psql(null, { file: f });
    const before = psql("select count(*) from information_schema.columns where table_name = 'performance_ledger_entries' and column_name = 'time_category'");
    psql(null, { file: MIG });
    const after = psql("select count(*) from information_schema.columns where table_name in ('performance_ledger_entries','performance_record_events') and column_name = 'time_category'");
    const chk = psql("select count(*) from pg_constraint where conname in ('ple_timecat_chk','pre_timecat_chk')");
    ok('M9 erste Fassung 0051 (ohne Zeitkategorie) → aktuelle 0051 ergaenzt Spalten und Pruefungen additiv', before === '0' && after === '2' && chk === '2', before + ' → ' + after + ', ' + chk + ' Pruefungen');
    try { fs.unlinkSync(f); } catch (e) {}
  }
}

console.log('\n' + (fail ? '❌' : '✅') + ' performance_ledger_db_v448: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

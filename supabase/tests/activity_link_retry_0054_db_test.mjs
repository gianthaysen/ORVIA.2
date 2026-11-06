/* ============================================================
   ORVIA · 0054 gegen ein WEGWERF-Postgres (nie Produktion)
   Kraft-Kopplung: zweiter Versuch + gelöste Kopplung bleibt gelöst.
     V  Vorbedingung: 0048 allein koppelt eine Aufzeichnung, die VOR dem Workout
        in der Cloud lag, nie (der gemeldete Fall)
     R  orvia_autolink_recent koppelt sie nachträglich (Regel: ≤ 20 min, Überlappung)
     O  „Kopplung lösen" setzt link_opt_out; kein automatischer Lauf koppelt neu;
        ausdrückliches Koppeln hebt es wieder auf
     F  Grenzen: > 20 min, älter als das Fenster, fremder Nutzer, anon
     I  0054 ist wiederholbar (zweimal ausführen)
   Ohne Postgres: übersprungen (Exit 2), nie „bestanden".
   node supabase/tests/activity_link_retry_0054_db_test.mjs
   ============================================================ */
import fs from 'fs'; import path from 'path'; import net from 'net';
import { spawnSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)); const MIG = path.join(HERE, '..', 'migrations');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const binDir = (() => { try { const d = fs.readdirSync('/usr/lib/postgresql').sort().pop(); return d ? '/usr/lib/postgresql/' + d + '/bin' : null; } catch (e) { return null; } })();
if (!binDir || !fs.existsSync(binDir + '/initdb')) { console.log('⏭️  ÜBERSPRUNGEN — kein Postgres (initdb); 0054 NICHT geprueft'); process.exit(2); }
const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
const base = fs.mkdtempSync(path.join('/tmp', 'orvia-pg-0054-'));
const port = await new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const sh = cmd => asRoot ? spawnSync('su', ['postgres', '-c', cmd], { encoding: 'utf8' }) : spawnSync('bash', ['-c', cmd], { encoding: 'utf8' });
if (asRoot) { fs.chmodSync(base, 0o755); spawnSync('chown', ['postgres', base]); }
const st = sh(`${binDir}/initdb -D ${base}/data -A trust -U postgres >/dev/null 2>&1 && ${binDir}/pg_ctl -D ${base}/data -o '-p ${port} -c listen_addresses=127.0.0.1 -k ${base}' -l ${base}/log -w start >/dev/null`);
if (st.status !== 0) { console.log('⏭️  ÜBERSPRUNGEN — Wegwerf-Postgres startet nicht'); process.exit(2); }
process.on('exit', () => { sh(`${binDir}/pg_ctl -D ${base}/data -m immediate stop >/dev/null 2>&1`); try { fs.rmSync(base, { recursive: true, force: true }); } catch (e) {} });
const psql = sql => { const r = spawnSync(binDir + '/psql', ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qtAX', 'postgres'], { input: sql, encoding: 'utf8' }); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: r.stderr || '' }; };
const as = (uid, sql, role = 'authenticated') => psql(`set role ${role}; set request.jwt.claims = '{"sub":"${uid}"}';\n${sql}`);
const mig = nr => fs.readFileSync(path.join(MIG, fs.readdirSync(MIG).find(f => f.startsWith(nr + '_'))), 'utf8');

const U = '11111111-1111-1111-1111-111111111111', X = '22222222-2222-2222-2222-222222222222';
let r = psql(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role; grant execute on function auth.uid() to anon, authenticated, service_role;
create table public.schema_migrations (version text primary key, applied_at timestamptz not null default now());
create table public.activities (id uuid primary key default gen_random_uuid(), user_id uuid not null, source text not null, sport_id text,
  started_at timestamptz, ended_at timestamptz, duration_seconds integer, status text default 'completed',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.activities enable row level security;
create policy own on public.activities for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.activities to authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;`);
ok('Setup: Wegwerf-Schema mit RLS', r.ok, r.err.slice(-200));
r = psql(mig('0048')); ok('Setup: 0048 (echte Datei) angewendet', r.ok, r.err.slice(-300));

const ins = (id, uid, src, start, end) => psql(`insert into public.activities (id, user_id, source, sport_id, started_at, ended_at) values ('${id}', '${uid}', '${src}', 'gym', now() - interval '${start}', now() - interval '${end}');`);
const W1 = 'aaaaaaaa-0000-0000-0000-000000000001', G1 = 'bbbbbbbb-0000-0000-0000-000000000001';
/* Uhr-Aufzeichnung liegt ZUERST in der Cloud (Start vor 70 min, Ende vor 5 min); das Workout kommt danach (Start vor 68 min). */
ins(G1, U, 'garmin', '70 minutes', '5 minutes');
r = as(U, `select public.orvia_link_candidate('${G1}')`);
ok('V1 Worker-Zeitpunkt (Workout noch nicht in der Cloud): kein Kandidat — die Kopplung fiel bisher endgültig aus', r.ok && r.out === '');
ins(W1, U, 'orvia_workout', '68 minutes', '4 minutes');

r = psql(mig('0054')); ok('M1 0054 angewendet (inkl. Selbstprüfung)', r.ok, r.err.slice(-300));
r = psql(mig('0054')); ok('I1 0054 ein zweites Mal: idempotent', r.ok, r.err.slice(-300));
ok('M2 Spalte link_opt_out vorhanden, Standard false', psql(`select count(*) from public.activities where link_opt_out = false`).out === '2');

r = as(U, `select primary_id from public.orvia_autolink_recent()`);
ok('R1 autolink_recent koppelt die früher angekommene Aufzeichnung', r.ok && r.out === W1, r.out || r.err.slice(-200));
ok('R2 … als device_recording am Workout', psql(`select linked_activity_id || '|' || link_kind from public.activities where id='${G1}'`).out === W1 + '|device_recording');
r = as(U, `select count(*) from public.orvia_autolink_recent()`);
ok('R3 zweiter Lauf koppelt nichts doppelt', r.ok && r.out === '0');

r = as(U, `select (public.orvia_unlink_activity('${G1}')).link_opt_out`);
ok('O1 „Kopplung lösen" setzt link_opt_out', r.ok && r.out === 't', r.err.slice(-200));
r = as(U, `select count(*) from public.orvia_autolink_recent(); select count(*) from public.orvia_autolink_recordings();`);
ok('O2 weder autolink_recent noch autolink_recordings koppeln eine gelöste Aufzeichnung neu', r.ok && r.out.split('\n').every(x => x === '0'), r.out);
r = as(U, `select public.orvia_link_candidate('${G1}')`);
ok('O3 link_candidate liefert für eine gelöste Aufzeichnung keinen Kandidaten', r.ok && r.out === '');
r = as(U, `select (public.orvia_link_activities('${W1}', '${G1}')).link_opt_out`);
ok('O4 ausdrückliches Koppeln hebt die Sperre wieder auf', r.ok && r.out === 'f', r.err.slice(-200));

/* Grenzen */
const W2 = 'aaaaaaaa-0000-0000-0000-000000000002', G2 = 'bbbbbbbb-0000-0000-0000-000000000002';
ins(W2, U, 'orvia_workout', '30 hours', '29 hours'); ins(G2, U, 'garmin', '30 hours 25 minutes', '29 hours');
r = as(U, `select count(*) from public.orvia_autolink_recent()`);
ok('F1 Startabstand 25 min (> 20) → keine Kopplung', r.ok && r.out === '0');
const W3 = 'aaaaaaaa-0000-0000-0000-000000000003', G3 = 'bbbbbbbb-0000-0000-0000-000000000003';
ins(W3, U, 'orvia_workout', '72 hours', '71 hours'); ins(G3, U, 'garmin', '72 hours 2 minutes', '71 hours');
r = as(U, `select count(*) from public.orvia_autolink_recent(48)`);
ok('F2 älter als das 48-h-Fenster → autolink_recent lässt sie in Ruhe', r.ok && r.out === '0');
r = as(U, `select count(*) from public.orvia_autolink_recent(96)`);
ok('F3 … mit größerem Fenster wird sie gekoppelt', r.ok && r.out === '1');
const GX = 'bbbbbbbb-0000-0000-0000-00000000000x'.replace('x', '9');
ins(GX, X, 'garmin', '30 hours 2 minutes', '29 hours');
r = as(X, `select count(*) from public.orvia_autolink_recent()`);
ok('F4 fremder Nutzer: kein Zugriff auf andere Workouts (RLS)', r.ok && r.out === '0');
r = as(U, `select count(*) from public.orvia_autolink_recent()`, 'anon');
ok('F5 anon darf autolink_recent nicht ausführen', !r.ok && /permission denied/.test(r.err), r.err.split('\n')[0]);
r = as(U, `select public.orvia_unlink_activity('${G1}')`, 'anon');
ok('F6 anon darf unlink nicht ausführen', !r.ok && /permission denied/.test(r.err));

console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

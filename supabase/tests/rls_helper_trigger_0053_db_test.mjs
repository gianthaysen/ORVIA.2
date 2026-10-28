/* ============================================================
   ORVIA · Migration 0053 gegen ein WEGWERF-Postgres (nie Produktion)
   ------------------------------------------------------------
   Lädt die ECHTEN Funktionsrümpfe der 16 betroffenen Funktionen aus dem Repo,
   bildet die Supabase-Default-Grants nach (EXECUTE direkt an anon,
   authenticated, service_role), spielt die historischen revoke/grant-Zeilen
   des Repos ein (Zustand vor 0053 = Live-Befund) und danach 0053 — zweimal.

   V   Vorzustand reproduziert: anon darf die Hilfsfunktionen ausführen (der Befund)
   M   0053 läuft zweimal fehlerfrei; Endzustand laut Rechtematrix
   U   normaler Nutzer: eigene Pläne/Tage/Sessions/Übungen/Sätze anlegen, lesen,
       ändern, löschen; fremde Zeilen weder sehen noch referenzieren
   O   Owner (owner_all über orvia_is_owner) sieht weiterhin alle Zeilen
   T   Trigger feuern trotz entzogenem EXECUTE: rc/dc_force_owner, Ledger-Dirty,
       Feature-Flag-Seed bei neuem auth.users-Eintrag, touch_updated_at,
       Plananker-Schutz, Aktivitäts-Link-Normalisierung
   A   anon: Hilfsfunktion direkt → permission denied
   N   Gegenprobe: 0053 mit Entzug für authenticated → Selbstprüfung bricht ab,
       Transaktion rollt zurück, authenticated behält EXECUTE

   Tabellen/Policies sind REPRÄSENTATIV (gleiche Hilfsfunktionen, gleiche
   Rolle `to authenticated`), nicht die vollständigen Produktionstabellen.
   Ohne Postgres: übersprungen (Exit 2), nie „bestanden".
   ============================================================ */
import fs from 'fs';
import path from 'path';
import net from 'net';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SUPA = path.join(HERE, '..');
const MIGDIR = path.join(SUPA, 'migrations');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const binDir = (() => { try { const d = fs.readdirSync('/usr/lib/postgresql').sort().pop(); return d ? '/usr/lib/postgresql/' + d + '/bin' : null; } catch (e) { return null; } })();
if (!binDir || !fs.existsSync(binDir + '/initdb')) { console.log('⏭️  ÜBERSPRUNGEN — kein Postgres (initdb) in dieser Umgebung; Migration 0053 NICHT geprueft'); process.exit(2); }
const MIG53 = fs.readdirSync(MIGDIR).find(f => /^0053_/.test(f));
if (!MIG53) { ok('Migration 0053 vorhanden', false); process.exit(1); }

const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
const base = fs.mkdtempSync(path.join('/tmp', 'orvia-pg-0053-'));
const port = await new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const sh = cmd => asRoot ? spawnSync('su', ['postgres', '-c', cmd], { encoding: 'utf8' }) : spawnSync('bash', ['-c', cmd], { encoding: 'utf8' });
if (asRoot) { fs.chmodSync(base, 0o755); spawnSync('chown', ['postgres', base]); }
const st = sh(`${binDir}/initdb -D ${base}/data -A trust -U postgres >/dev/null 2>&1 && ${binDir}/pg_ctl -D ${base}/data -o '-p ${port} -c listen_addresses=127.0.0.1 -k ${base}' -l ${base}/log -w start >/dev/null`);
if (st.status !== 0) { console.log('⏭️  ÜBERSPRUNGEN — Wegwerf-Postgres startet nicht; Migration 0053 NICHT geprueft'); process.exit(2); }
const stop = () => { sh(`${binDir}/pg_ctl -D ${base}/data -m immediate stop >/dev/null 2>&1`); try { fs.rmSync(base, { recursive: true, force: true }); } catch (e) {} };
process.on('exit', stop);

function psql(sql, { file = null, expectError = false } = {}) {
  const args = ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qtAX'];
  if (file) args.push('-f', file);
  args.push('postgres');
  const r = spawnSync(binDir + '/psql', args, { input: file ? undefined : sql, encoding: 'utf8' });
  if (!expectError && r.status !== 0) throw new Error((r.stderr || '').slice(-800));
  return expectError ? { ok: r.status === 0, err: r.stderr || '', out: (r.stdout || '').trim() } : r.stdout.trim();
}
const tryAs = (role, uid, sql) => psql(`set role ${role}; set request.jwt.claims = '{"sub":"${uid || ''}"}';\n${sql}`, { expectError: true });
const as = (uid, sql) => { const r = tryAs('authenticated', uid, sql); if (!r.ok) throw new Error(r.err.slice(-400)); return r.out; };

/* ---------- echte Rümpfe aus dem Repo ---------- */
const read = f => fs.readFileSync(f, 'utf8');
const migFile = nr => path.join(MIGDIR, fs.readdirSync(MIGDIR).find(f => f.startsWith(nr + '_')));
function fnDef(file, name) {
  const s = read(file);
  const re = new RegExp('create or replace function public\\.' + name + '\\s*\\(', 'gi');
  let m, last = -1; while ((m = re.exec(s))) last = m.index;
  if (last < 0) throw new Error('Definition fehlt: ' + name + ' in ' + file);
  const d1 = s.indexOf('$$', last), d2 = s.indexOf('$$', d1 + 2), end = s.indexOf(';', d2);
  return s.slice(last, end + 1);
}
const DEFS = [
  [path.join(SUPA, 'schema.sql'), 'orvia_user_role'], [path.join(SUPA, 'schema.sql'), 'orvia_is_owner'],
  ...['orvia_exercise_allowed', 'orvia_template_allowed', 'orvia_own_plan', 'orvia_own_plan_day', 'orvia_own_session', 'orvia_own_workout_exercise'].map(n => [migFile('0003'), n]),
  [migFile('0019'), 'dc_force_owner'], [migFile('0002'), 'rc_force_owner'],
  [migFile('0051'), 'orvia_ledger_mark_dirty'], [migFile('0046'), 'seed_default_feature_flags'],
  [migFile('0003'), 'touch_updated_at'], [migFile('0031'), 'touch_user_feature_flags'],
  [migFile('0026'), 'orvia_protect_planned_anchor'], [migFile('0048'), 'orvia_activities_link_normalize']
];
/* historische Rechtezeilen des Repos (der Zustand, den Produktion vor 0053 hat) */
const HIST = [
  ...read(path.join(SUPA, 'schema.sql')).split('\n').filter(l => /^(revoke|grant) .*function public\.orvia_(user_role|is_owner)\(\)/.test(l)),
  ...read(migFile('0003')).split('\n').filter(l => /^(revoke|grant) .*function public\.orvia_exercise_allowed/.test(l))
];
ok('Setup: 16 echte Rümpfe, historische Rechtezeilen gefunden', DEFS.length === 16 && HIST.length >= 4, HIST.length + ' Zeilen');

const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', O = '33333333-3333-3333-3333-333333333333';
psql(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create role supabase_auth_admin nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role, supabase_auth_admin;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant insert, select on auth.users to supabase_auth_admin;
-- Supabase-Default: EXECUTE auf neue Funktionen in public DIREKT an die API-Rollen
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create table public.schema_migrations (version text primary key, applied_at timestamptz not null default now());
create table public.profiles (user_id uuid primary key, role text not null default 'tester', is_active boolean not null default true);
create table public.exercises (id uuid primary key, is_system boolean not null default false, user_id uuid);
create table public.workout_templates (id uuid primary key, is_system boolean not null default false, user_id uuid);
create table public.user_training_plans (id uuid primary key, user_id uuid not null, name text);
create table public.training_plan_days (id uuid primary key, user_id uuid not null, plan_id uuid, note text, updated_at timestamptz not null default now());
create table public.workout_sessions (id uuid primary key, user_id uuid not null, plan_day_id uuid, template_id uuid, planned_session_id text, planned_session_snapshot jsonb);
create table public.workout_exercises (id uuid primary key, user_id uuid not null, session_id uuid, exercise_id uuid);
create table public.workout_sets (id uuid primary key, user_id uuid not null, workout_exercise_id uuid, reps int);
create table public.connected_devices (id uuid primary key, user_id uuid not null);
create table public.device_capabilities (id uuid primary key, device_id uuid not null, user_id uuid);
create table public.readiness_scores (id uuid primary key, user_id uuid not null);
create table public.readiness_components (id uuid primary key, readiness_score_id uuid not null, user_id uuid);
create table public.performance_ledger_entries (user_id uuid not null, metric_key text not null, calc_version text not null);
create table public.performance_ledger_dirty (user_id uuid not null, metric_key text not null, calc_version text not null, reason text, unique (user_id, metric_key, calc_version));
create table public.user_feature_flags (user_id uuid not null, flag text not null, enabled boolean not null default false, reason text, set_by text, updated_at timestamptz not null default now(), unique (user_id, flag));
create table public.activities (id uuid primary key, user_id uuid not null, linked_activity_id uuid, link_kind text);
`);
for (const [f, n] of DEFS) psql(fnDef(f, n));
for (const l of HIST) psql(l);
psql(`
create trigger tpd_touch before update on public.training_plan_days for each row execute function public.touch_updated_at();
create trigger uff_touch before update on public.user_feature_flags for each row execute function public.touch_user_feature_flags();
create trigger ws_anchor before insert or update on public.workout_sessions for each row execute function public.orvia_protect_planned_anchor();
create trigger act_link before insert or update of linked_activity_id, link_kind on public.activities for each row execute function public.orvia_activities_link_normalize();
create trigger dc_force before insert or update of device_id on public.device_capabilities for each row execute function public.dc_force_owner();
create trigger rc_force before insert or update on public.readiness_components for each row execute function public.rc_force_owner();
create trigger ple_dirty after delete on public.performance_ledger_entries for each row execute function public.orvia_ledger_mark_dirty();
create trigger seed_flags after insert on auth.users for each row execute function public.seed_default_feature_flags();
do $$ declare t text; begin
  foreach t in array array['profiles','exercises','workout_templates','user_training_plans','training_plan_days','workout_sessions','workout_exercises','workout_sets','connected_devices','device_capabilities','readiness_scores','readiness_components','performance_ledger_entries','performance_ledger_dirty','user_feature_flags','activities'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy owner_all on public.%I for all to authenticated using (public.orvia_is_owner()) with check (public.orvia_is_owner())', t);
  end loop; end $$;
create policy own on public.profiles for select to authenticated using (auth.uid() = user_id);
create policy own on public.exercises for all to authenticated using (is_system or auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own on public.workout_templates for all to authenticated using (is_system or auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own on public.user_training_plans for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own on public.training_plan_days for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id and public.orvia_own_plan(plan_id));
create policy own on public.workout_sessions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id and public.orvia_own_plan_day(plan_day_id) and public.orvia_template_allowed(template_id));
create policy own on public.workout_exercises for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id and public.orvia_own_session(session_id) and public.orvia_exercise_allowed(exercise_id));
create policy own on public.workout_sets for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id and public.orvia_own_workout_exercise(workout_exercise_id));
create policy own on public.connected_devices for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own on public.device_capabilities for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own on public.readiness_scores for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own on public.readiness_components for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own on public.performance_ledger_entries for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own on public.performance_ledger_dirty for select to authenticated using (auth.uid() = user_id);
create policy own on public.user_feature_flags for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own on public.activities for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
insert into auth.users values ('${A}'), ('${B}'), ('${O}');
insert into public.profiles values ('${A}','tester',true), ('${B}','tester',true), ('${O}','owner',true);
insert into public.exercises values ('e0000000-0000-4000-8000-000000000001', true, null), ('e0000000-0000-4000-8000-0000000000b1', false, '${B}');
insert into public.workout_templates values ('70000000-0000-4000-8000-0000000000b1', false, '${B}');
insert into public.user_training_plans values ('b0000000-0000-4000-8000-0000000000b1', '${B}', 'B-Plan');
`);

const priv = (role, fn) => psql(`select has_function_privilege('${role}', '${fn}', 'EXECUTE')`) === 't';
const HELP = ['public.orvia_user_role()', 'public.orvia_is_owner()', 'public.orvia_exercise_allowed(uuid)', 'public.orvia_template_allowed(uuid)', 'public.orvia_own_plan(uuid)', 'public.orvia_own_plan_day(uuid)', 'public.orvia_own_session(uuid)', 'public.orvia_own_workout_exercise(uuid)'];
const TRIG = ['public.dc_force_owner()', 'public.rc_force_owner()', 'public.orvia_ledger_mark_dirty()', 'public.seed_default_feature_flags()'];
const PATHFN = ['touch_updated_at', 'touch_user_feature_flags', 'orvia_protect_planned_anchor', 'orvia_activities_link_normalize'];

/* ---------- V · Vorzustand = Live-Befund ---------- */
ok('V1 vor 0053: anon darf alle 8 Hilfsfunktionen (trotz `revoke … from public`)', HELP.every(f => priv('anon', f)));
ok('V2 vor 0053: anon + authenticated dürfen alle 4 Trigger-Funktionen', TRIG.every(f => priv('anon', f) && priv('authenticated', f)));
ok('V3 Seed-Trigger hat für die Testnutzer je 2 Flags angelegt', psql(`select count(*) from public.user_feature_flags where user_id='${A}'`) === '2');

/* ---------- M · Migration zweimal ---------- */
const m1 = psql('', { file: path.join(MIGDIR, MIG53), expectError: true });
ok('M1 0053 läuft fehlerfrei (inkl. Selbstprüfung)', m1.ok, m1.err.slice(-200));
const m2 = psql('', { file: path.join(MIGDIR, MIG53), expectError: true });
ok('M2 0053 ein zweites Mal: fehlerfrei (idempotent)', m2.ok, m2.err.slice(-200));
ok('M3 schema_migrations: genau ein Eintrag', psql(`select count(*) from public.schema_migrations where version like '0053_%'`) === '1');
ok('M4 Hilfsfunktionen: anon NEIN, authenticated JA, service_role JA', HELP.every(f => !priv('anon', f) && priv('authenticated', f) && priv('service_role', f)),
  HELP.filter(f => priv('anon', f) || !priv('authenticated', f)).join(', '));
ok('M5 Trigger-Funktionen: anon NEIN, authenticated NEIN', TRIG.every(f => !priv('anon', f) && !priv('authenticated', f)));
ok('M6 search_path=public auf allen 4 Funktionen der Gruppe C',
  psql(`select count(*) from pg_proc where proname in (${PATHFN.map(n => `'${n}'`).join(',')}) and 'search_path=public' = any(coalesce(proconfig,'{}'))`) === '4');
ok('M7 keine SECURITY-DEFINER-Funktion in public mehr für anon ausführbar',
  psql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE')`) === '0');

/* ---------- U · normaler Nutzer A ---------- */
const P = 'a0000000-0000-4000-8000-0000000000a1', D = 'd0000000-0000-4000-8000-0000000000a1', S = '50000000-0000-4000-8000-0000000000a1', WE = 'c0000000-0000-4000-8000-0000000000a1';
let r = tryAs('authenticated', A, `
insert into public.user_training_plans values ('${P}', '${A}', 'A-Plan');
insert into public.training_plan_days (id, user_id, plan_id) values ('${D}', '${A}', '${P}');
insert into public.workout_sessions (id, user_id, plan_day_id, template_id) values ('${S}', '${A}', '${D}', null);
insert into public.workout_exercises values ('${WE}', '${A}', '${S}', 'e0000000-0000-4000-8000-000000000001');
insert into public.workout_sets values ('5e000000-0000-4000-8000-0000000000a1', '${A}', '${WE}', 8);`);
ok('U1 Nutzer legt Plan → Tag → Session → Übung (System) → Satz an (6 Hilfsfunktionen im with check)', r.ok, r.err.slice(-200));
ok('U2 Nutzer liest eigene Kette vollständig', as(A, `select (select count(*) from public.user_training_plans)||'/'||(select count(*) from public.training_plan_days)||'/'||(select count(*) from public.workout_sessions)||'/'||(select count(*) from public.workout_exercises)||'/'||(select count(*) from public.workout_sets)`) === '1/1/1/1/1');
r = tryAs('authenticated', A, `update public.training_plan_days set note = 'x' where id = '${D}'; update public.workout_sets set reps = 10 where workout_exercise_id = '${WE}';`);
ok('U3 Nutzer ändert eigene Zeilen', r.ok && as(A, `select reps from public.workout_sets`) === '10', r.err.slice(-200));
ok('U4 Nutzer sieht fremden Plan NICHT', as(A, `select count(*) from public.user_training_plans where user_id='${B}'`) === '0');
r = tryAs('authenticated', A, `insert into public.training_plan_days (id, user_id, plan_id) values (gen_random_uuid(), '${A}', 'b0000000-0000-4000-8000-0000000000b1');`);
ok('U5 Tag an FREMDEN Plan hängen → abgelehnt (orvia_own_plan)', !r.ok && /row-level security/.test(r.err), r.err.slice(-120));
r = tryAs('authenticated', A, `insert into public.workout_exercises values (gen_random_uuid(), '${A}', '${S}', 'e0000000-0000-4000-8000-0000000000b1');`);
ok('U6 fremde private Übung referenzieren → abgelehnt (orvia_exercise_allowed)', !r.ok && /row-level security/.test(r.err));
r = tryAs('authenticated', A, `insert into public.workout_sessions (id, user_id, template_id) values (gen_random_uuid(), '${A}', '70000000-0000-4000-8000-0000000000b1');`);
ok('U7 fremde Vorlage referenzieren → abgelehnt (orvia_template_allowed)', !r.ok && /row-level security/.test(r.err));
r = tryAs('authenticated', A, `delete from public.workout_sets; delete from public.workout_exercises; select count(*) from public.workout_exercises;`);
ok('U8 Nutzer löscht eigene Zeilen', r.ok && r.out.endsWith('0'), r.err.slice(-200));

/* ---------- O · Owner ---------- */
ok('O1 Owner sieht über owner_all/orvia_is_owner alle Pläne (A + B)', as(O, `select count(*) from public.user_training_plans`) === '2');
ok('O2 Nicht-Owner bekommt über orvia_is_owner() false', as(A, `select public.orvia_is_owner()`) === 'f');

/* ---------- T · Trigger feuern ohne EXECUTE der aufrufenden Rolle ---------- */
psql(`insert into public.readiness_scores values ('ab000000-0000-4000-8000-000000000001', '${A}'); insert into public.connected_devices values ('de000000-0000-4000-8000-000000000001', '${A}');`);
r = tryAs('authenticated', A, `insert into public.readiness_components (id, readiness_score_id, user_id) values (gen_random_uuid(), 'ab000000-0000-4000-8000-000000000001', '${A}'); select user_id from public.readiness_components;`);
ok('T1 rc_force_owner feuert für authenticated (EXECUTE entzogen)', r.ok && r.out.endsWith(A), r.err.slice(-200));
r = tryAs('authenticated', A, `insert into public.device_capabilities (id, device_id) values (gen_random_uuid(), 'de000000-0000-4000-8000-000000000001'); select user_id from public.device_capabilities;`);
ok('T2 dc_force_owner feuert und setzt user_id aus dem Gerät', r.ok && r.out.endsWith(A), r.err.slice(-200));
r = tryAs('authenticated', A, `insert into public.performance_ledger_entries values ('${A}', 'run_5k', 'v1'); delete from public.performance_ledger_entries; select count(*) from public.performance_ledger_dirty;`);
ok('T3 orvia_ledger_mark_dirty feuert beim Löschen', r.ok && r.out.endsWith('1'), r.err.slice(-200));
const NEU = '44444444-4444-4444-4444-444444444444';
r = tryAs('supabase_auth_admin', '', `insert into auth.users values ('${NEU}');`);
ok('T4 neuer auth.users-Eintrag (Registrierung): Seed-Trigger feuert, 2 Flags', r.ok && psql(`select count(*) from public.user_feature_flags where user_id='${NEU}'`) === '2', r.err.slice(-200));
r = tryAs('authenticated', A, `update public.training_plan_days set note = 'y', updated_at = '2000-01-01' where id = '${D}'; select updated_at > '2020-01-01' from public.training_plan_days;`);
ok('T5 touch_updated_at (search_path gesetzt) setzt updated_at', r.ok && r.out.endsWith('t'), r.err.slice(-200));
r = tryAs('authenticated', A, `update public.user_feature_flags set updated_at = '2000-01-01', enabled = false where flag = 'goal_plan_input'; select updated_at > '2020-01-01' from public.user_feature_flags where flag = 'goal_plan_input';`);
ok('T6 touch_user_feature_flags setzt updated_at', r.ok && r.out.endsWith('t'), r.err.slice(-200));
r = tryAs('authenticated', A, `insert into public.workout_sessions (id, user_id, planned_session_id, planned_session_snapshot) values ('5a000000-0000-4000-8000-000000000001', '${A}', 'occ-1', '{"occurrenceId":"occ-1"}');
update public.workout_sessions set planned_session_id = 'occ-2' where id = '5a000000-0000-4000-8000-000000000001';
select planned_session_id from public.workout_sessions where id = '5a000000-0000-4000-8000-000000000001';`);
ok('T7 orvia_protect_planned_anchor hält den gesetzten Anker', r.ok && r.out.endsWith('occ-1'), r.err.slice(-200));
r = tryAs('authenticated', A, `insert into public.activities (id, user_id, linked_activity_id) values (gen_random_uuid(), '${A}', gen_random_uuid()); select link_kind from public.activities;`);
ok('T8 orvia_activities_link_normalize setzt link_kind', r.ok && r.out.endsWith('device_recording'), r.err.slice(-200));

/* ---------- A · anon ---------- */
r = tryAs('anon', '', `select public.orvia_is_owner();`);
ok('A1 anon: orvia_is_owner() → permission denied', !r.ok && /permission denied for function/.test(r.err), r.err.slice(-100));
r = tryAs('anon', '', `select public.orvia_own_plan('${P}');`);
ok('A2 anon: orvia_own_plan() → permission denied', !r.ok && /permission denied for function/.test(r.err));

/* ---------- N · Gegenprobe: Selbstprüfung rollt zurück ---------- */
const kaputt = path.join(base, 'kaputt.sql');
const orig = read(path.join(MIGDIR, MIG53));
const variante = orig.replace(/\n  from public, anon;/, '\n  from public, anon, authenticated;').replace(/\n  to authenticated, service_role;/, '\n  to service_role;');
ok('N0 Gegenprobe-Variante unterscheidet sich vom Original', variante !== orig);
fs.writeFileSync(kaputt, variante);
if (asRoot) spawnSync('chown', ['postgres', kaputt]);
const mk = psql('', { file: kaputt, expectError: true });
ok('N1 kaputte Fassung (authenticated entzogen) bricht in der Selbstprüfung ab', !mk.ok && /RLS wuerde brechen/.test(mk.err), mk.err.slice(-160));
ok('N2 … und rollt zurück: authenticated behält EXECUTE, Nutzer liest weiter', HELP.every(f => priv('authenticated', f)) && as(A, `select count(*) from public.user_training_plans`) === '1');

console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

/* ============================================================
   ORVIA · K1 gegen ein WEGWERF-Postgres (nie Produktion)
   Belegt die Ursache und den Fix auf Datenbankebene, mit der echten Tabellendefinition
   von user_profiles aus 0002 + 0013/0016/0018/0029 und der echten toRow-Abbildung:
     D1  Zeile wie bisher (birth_date '') → Postgres lehnt den GANZEN Upsert ab
     D2  dieselbe Eingabe über toRow → Upsert gelingt, Name + Regeneration gespeichert
     D3  zweiter Upsert (Update) mit leerem Datum über toRow gelingt ebenfalls
   Ohne Postgres: übersprungen (Exit 2), nie „bestanden".
   ============================================================ */
import fs from 'fs';
import path from 'path';
import net from 'net';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync as _ex } from 'node:fs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIG = path.join(HERE, '..', 'migrations');
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const binDir = (() => { try { const d = fs.readdirSync('/usr/lib/postgresql').sort().pop(); return d ? '/usr/lib/postgresql/' + d + '/bin' : null; } catch (e) { return null; } })();
if (!binDir || !fs.existsSync(binDir + '/initdb')) { console.log('⏭️  ÜBERSPRUNGEN — kein Postgres (initdb) in dieser Umgebung; K1 NICHT gegen Postgres geprueft'); process.exit(2); }

global.window = {};
const load = f => (0, eval)(fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8'));
global.window.ORVIA = { repoBase: {} };
load('js/repos/profileRepository.js');
const toRow = global.window.ORVIA.repos.profile.toRow;

const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
const base = fs.mkdtempSync(path.join('/tmp', 'orvia-pg-k1-'));
const port = await new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const sh = cmd => asRoot ? spawnSync('su', ['postgres', '-c', cmd], { encoding: 'utf8' }) : spawnSync('bash', ['-c', cmd], { encoding: 'utf8' });
if (asRoot) { fs.chmodSync(base, 0o755); spawnSync('chown', ['postgres', base]); }
const st = sh(`${binDir}/initdb -D ${base}/data -A trust -U postgres >/dev/null 2>&1 && ${binDir}/pg_ctl -D ${base}/data -o '-p ${port} -c listen_addresses=127.0.0.1 -k ${base}' -l ${base}/log -w start >/dev/null`);
if (st.status !== 0) { console.log('⏭️  ÜBERSPRUNGEN — Wegwerf-Postgres startet nicht'); process.exit(2); }
process.on('exit', () => { sh(`${binDir}/pg_ctl -D ${base}/data -m immediate stop >/dev/null 2>&1`); try { fs.rmSync(base, { recursive: true, force: true }); } catch (e) {} });
function psql(sql) {
  const r = spawnSync(binDir + '/psql', ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qtAX', 'postgres'], { input: sql, encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: r.stderr || '' };
}

/* echte Tabellendefinition aus 0002 (create table … ;) + spätere add-column-Zeilen */
const m0002 = fs.readFileSync(path.join(MIG, fs.readdirSync(MIG).find(f => f.startsWith('0002_'))), 'utf8');
const ct = m0002.match(/create table if not exists public\.user_profiles \([\s\S]*?\n\);/);
const adds = fs.readdirSync(MIG).filter(f => /^(0013|0016|0018|0029)_/.test(f))
  .flatMap(f => fs.readFileSync(path.join(MIG, f), 'utf8').split('\n').filter(l => /^alter table public\.user_profiles add column if not exists/.test(l)));
ok('Setup: echte user_profiles-Definition + Spaltenergänzungen gefunden', !!ct && adds.length >= 6, adds.length + ' Spalten');
const setup = psql(`create schema auth; create table auth.users (id uuid primary key);
insert into auth.users values ('11111111-1111-1111-1111-111111111111');
${ct[0]}
${adds.join('\n')}`);
ok('Setup: Tabelle angelegt', setup.ok, setup.err.slice(-200));

const lit = v => v === null || v === undefined ? 'null' : (typeof v === 'object' ? "'" + JSON.stringify(v).replace(/'/g, "''") + "'::jsonb" : "'" + String(v).replace(/'/g, "''") + "'");
const upsertSql = row => {
  const cols = Object.keys(row);
  return `insert into public.user_profiles (${cols.join(',')}) values (${cols.map(c => lit(row[c])).join(',')})
    on conflict (user_id) do update set ${cols.filter(c => c !== 'user_id').map(c => c + '=excluded.' + c).join(',')};`;
};
const U = '11111111-1111-1111-1111-111111111111';
const eingabe = { name: 'Lena', birthDate: '', ageEstimate: '', sex: '', heightCm: '', weightKg: '', recovery: { sleepQuality: 3 }, preferences: null, handle: '', bio: '' };
const altZeile = { user_id: U, name: eingabe.name ?? null, birth_date: eingabe.birthDate ?? null, sex: eingabe.sex ?? null, recovery: eingabe.recovery ?? null };

const d1 = psql(upsertSql(altZeile));
ok('D1 alte Abbildung (birth_date "") → Postgres lehnt den ganzen Upsert ab', !d1.ok && /invalid input syntax for type date/.test(d1.err), d1.err.split('\n')[0]);
ok('D1b … und es wurde NICHTS gespeichert (auch nicht der Name)', psql(`select count(*) from public.user_profiles`).out === '0');
const d2 = psql(upsertSql(Object.assign({ user_id: U }, toRow(eingabe))));
ok('D2 dieselbe Eingabe über toRow → gespeichert', d2.ok, d2.err.slice(-160));
ok('D2b Name und Regeneration stehen in der Tabelle', psql(`select name || '|' || (recovery->>'sleepQuality') from public.user_profiles`).out === 'Lena|3');
const d3 = psql(upsertSql(Object.assign({ user_id: U }, toRow(Object.assign({}, eingabe, { name: 'Lena M.', weightKg: '61,5' })))));
ok('D3 Update mit leerem Datum über toRow gelingt (Name + Gewicht aktualisiert)', d3.ok && psql(`select name || '|' || weight_kg from public.user_profiles`).out === 'Lena M.|61.5', d3.err.slice(-160));

console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

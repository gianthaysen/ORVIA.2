// ORVIA · provider_metrics_0019_test — Vertragstest auf dem SQL-TEXT der
// Migration 0019 (Lehre aus Incident 0017/42P10: jeder Worker-on_conflict
// braucht einen exakt passenden Unique-Index).
// Ausführung (aus app/):  node supabase/tests/provider_metrics_0019_test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url)); // app/supabase/tests
const REG = require(path.join(HERE, '..', '..', '..', 'app', 'js', 'metrics', 'metric-registry.js'));

const SQL_PATH = path.join(HERE, '..', 'migrations', '0019_provider_metrics_foundation.sql');
const RAW = fs.readFileSync(SQL_PATH, 'utf8');
const SQL = RAW.replace(/\s+/g, ' '); // whitespace-normalisiert

const TABLES = ['data_providers', 'provider_credentials', 'connected_devices',
  'device_capabilities', 'user_metrics', 'profile_metric_settings',
  'daily_energy_expenditure', 'metric_anomalies'];

let n = 0;
function t(name, fn) {
  try { fn(); n++; }
  catch (e) {
    console.error('FAIL: ' + name + '\n' + (e && e.stack || e));
    process.exit(1);
  }
}

function hasUniqueIndex(table, cols, where) {
  const re = new RegExp(
    'create unique index if not exists \\S+ on public\\.' + table +
    ' \\(' + cols.replace(/[()]/g, '\\$&') + '\\)' +
    (where ? ' where ' + where : '')
  );
  return re.test(SQL);
}

// Alle do-$$-Blöcke extrahieren (für Loop-basierte RLS/Policy/Trigger-Checks).
const DO_BLOCKS = [];
{
  const re = /do \$\$([\s\S]*?)\$\$;/g;
  let m;
  while ((m = re.exec(SQL)) !== null) DO_BLOCKS.push(m[1]);
}

// ---------- Worker-on_conflict-Verträge: Unique-Indizes ------------

t('data_providers unique (user_id, provider_type)', () => {
  assert.ok(hasUniqueIndex('data_providers', 'user_id, provider_type'));
});

t('provider_credentials unique (user_id, provider_type, credential_kind)', () => {
  assert.ok(hasUniqueIndex('provider_credentials', 'user_id, provider_type, credential_kind'));
});

t('connected_devices unique (user_id, provider_id, provider_device_id)', () => {
  assert.ok(hasUniqueIndex('connected_devices', 'user_id, provider_id, provider_device_id'));
});

t('device_capabilities unique (device_id, metric_type)', () => {
  assert.ok(hasUniqueIndex('device_capabilities', 'device_id, metric_type'));
});

t('user_metrics PARTIELLER unique (user_id, metric_type, source_record_id) where not null', () => {
  assert.ok(hasUniqueIndex('user_metrics', 'user_id, metric_type, source_record_id',
    'source_record_id is not null'));
});

t('profile_metric_settings unique (user_id, metric_type)', () => {
  assert.ok(hasUniqueIndex('profile_metric_settings', 'user_id, metric_type'));
});

t('daily_energy_expenditure unique (user_id, metric_date)', () => {
  assert.ok(hasUniqueIndex('daily_energy_expenditure', 'user_id, metric_date'));
});

// ---------- RLS: enable + force für alle 8 Tabellen ----------------

t('RLS-Block: enable+force row level security, Array enthält alle 8 Tabellen', () => {
  const rls = DO_BLOCKS.find(b =>
    b.includes('enable row level security') && b.includes('force row level security'));
  assert.ok(rls, 'kein do-Block mit enable+force row level security gefunden');
  for (const tbl of TABLES) {
    assert.ok(rls.includes("'" + tbl + "'"), 'Tabelle fehlt im RLS-Array: ' + tbl);
  }
  assert.ok(rls.includes('revoke all on public.%I from anon'), 'anon-Revoke fehlt');
  assert.ok(rls.includes('revoke all on public.%I from public'), 'public-Revoke fehlt');
});

// ---------- provider_credentials: service_role-only ----------------

t('KEINE create policy für provider_credentials', () => {
  // Weder direkt …
  assert.ok(!/create policy[^;]*on public\.provider_credentials/.test(SQL));
  // … noch über den Policy-Loop (Array des create-policy-Blocks ohne provider_credentials).
  const polBlock = DO_BLOCKS.find(b => b.includes('create policy'));
  assert.ok(polBlock, 'Policy-Block nicht gefunden');
  assert.ok(!polBlock.includes("'provider_credentials'"),
    'provider_credentials darf NICHT im Policy-Array stehen (service_role-only)');
  // Alle anderen 7 Tabellen bekommen eigene-Zeilen-Policies (sel/ins/upd/del).
  for (const tbl of TABLES.filter(x => x !== 'provider_credentials')) {
    assert.ok(polBlock.includes("'" + tbl + "'"), 'Policy-Array ohne ' + tbl);
  }
  for (const p of ['sel_own', 'ins_own', 'upd_own', 'del_own']) {
    assert.ok(polBlock.includes(p), 'Policy fehlt: ' + p);
  }
});

t('provider_credentials: revoke von authenticated', () => {
  assert.ok(SQL.includes('revoke all on public.provider_credentials from authenticated'));
});

// ---------- touch_updated_at: wiederverwendet, NICHT neu definiert --

t('touch_updated_at wird referenziert, aber nicht neu definiert', () => {
  const trig = DO_BLOCKS.find(b => b.includes('touch_updated_at'));
  assert.ok(trig, 'Trigger-Block mit touch_updated_at fehlt');
  assert.ok(trig.includes('execute function public.touch_updated_at()'),
    'Trigger referenziert nicht die bestehende Funktion');
  for (const tbl of TABLES) {
    assert.ok(trig.includes("'" + tbl + "'"), 'updated_at-Trigger-Array ohne ' + tbl);
  }
  // Keine (Neu-)Definition der projektweiten Funktion in dieser Migration:
  assert.ok(!/create (or replace )?function (public\.)?touch_updated_at/.test(SQL),
    '0019 darf touch_updated_at nicht (neu) definieren — Funktion aus 0002 wiederverwenden');
});

// ---------- source_type-Check == Registry-sourcePriority-Keys ------

t('user_metrics.source_type-Check enthält exakt die 7 sourcePriority-Keys', () => {
  const m = SQL.match(/source_type in \(([^)]*)\)/);
  assert.ok(m, 'source_type-Check nicht gefunden');
  const inSql = m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).sort();
  const inRegistry = Object.keys(REG.SOURCE_PRIORITY).sort();
  assert.deepStrictEqual(inSql, inRegistry,
    'source_type-Whitelist der DB weicht von metric-registry.SOURCE_PRIORITY ab');
});

// ---------- weitere Verträge ---------------------------------------

t('override_reason-Check == Registry.OVERRIDE_REASONS', () => {
  const m = SQL.match(/override_reason is null or override_reason in \( ?([^)]*)\)/);
  assert.ok(m, 'override_reason-Check nicht gefunden');
  const inSql = m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).sort();
  assert.deepStrictEqual(inSql, [...REG.OVERRIDE_REASONS].sort());
});

t('validity-Check: valid/suspect/invalid', () => {
  assert.ok(/validity in \('valid','suspect','invalid'\)/.test(SQL));
});

t('provider_type-Check == Registry.PROVIDER_TYPES', () => {
  const m = SQL.match(/provider_type in \(([^)]*)\)/);
  assert.ok(m, 'provider_type-Check nicht gefunden');
  const inSql = m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).sort();
  assert.deepStrictEqual(inSql, [...REG.PROVIDER_TYPES].sort());
});

t('capability_status-Check == Registry.CAPABILITY_STATUSES', () => {
  const m = SQL.match(/capability_status in \(([^)]*)\)/);
  assert.ok(m, 'capability_status-Check nicht gefunden');
  const inSql = m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).sort();
  assert.deepStrictEqual(inSql, [...REG.CAPABILITY_STATUSES].sort());
});

t('activities-Check-Erweiterung ist durch if exists geschützt', () => {
  const blk = DO_BLOCKS.find(b => b.includes('activities_source_chk'));
  assert.ok(blk, 'activities-Block nicht gefunden');
  assert.ok(blk.includes('if exists'), 'if-exists-Guard fehlt');
  assert.ok(blk.includes('pg_constraint'), 'Guard prüft nicht pg_constraint');
  assert.ok(blk.includes("'garmin'") && blk.includes("'strava'"),
    'Whitelist-Erweiterung garmin/strava fehlt');
});

t("schema_migrations-Insert '0019_provider_metrics_foundation'", () => {
  assert.ok(SQL.includes("insert into public.schema_migrations(version) values ('0019_provider_metrics_foundation')"));
  assert.ok(SQL.includes('on conflict (version) do nothing'));
});

t('Migration ist als Transaktion geklammert (begin/commit)', () => {
  assert.ok(/^\s*begin;/m.test(RAW) && /commit;\s*$/m.test(RAW.trimEnd() + '\n'));
});

console.log('OK ' + n + ' Tests');

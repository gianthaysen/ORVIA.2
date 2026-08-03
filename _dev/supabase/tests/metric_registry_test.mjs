// ORVIA · metric_registry_test — Integrität des Metrik-Katalogs (SSOT) +
// Sync-Vertrag mit dem generierten Worker-JSON.
// Ausführung (aus app/):  node supabase/tests/metric_registry_test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url)); // app/supabase/tests
const R = require(path.join(HERE, '..', '..', '..', 'app', 'js', 'metrics', 'metric-registry.js'));

let n = 0;
function t(name, fn) {
  try { fn(); n++; }
  catch (e) {
    console.error('FAIL: ' + name + '\n' + (e && e.stack || e));
    process.exit(1);
  }
}

// ---------- (a) Registry-Integrität --------------------------------

t('Registry hat Metriken', () => {
  assert.ok(Array.isArray(R.METRICS) && R.METRICS.length >= 30);
});

t('IDs sind unique und wohlgeformt', () => {
  const seen = new Set();
  for (const m of R.METRICS) {
    assert.match(m.id, /^[a-z][a-z0-9_]*$/, 'ID-Format: ' + m.id);
    assert.ok(!seen.has(m.id), 'Doppelte ID: ' + m.id);
    seen.add(m.id);
  }
});

t('editMode jeder Metrik ist in EDIT_MODES', () => {
  for (const m of R.METRICS) {
    assert.ok(R.EDIT_MODES.includes(m.editMode), m.id + ': ' + m.editMode);
  }
});

t('plausible: null oder [min,max] mit min<max', () => {
  for (const m of R.METRICS) {
    if (m.plausible === null) continue;
    assert.ok(Array.isArray(m.plausible) && m.plausible.length === 2, m.id);
    assert.ok(typeof m.plausible[0] === 'number' && typeof m.plausible[1] === 'number', m.id);
    assert.ok(m.plausible[0] < m.plausible[1], m.id + ': min<max verletzt');
  }
});

t('numerische Metriken haben unit + plausible, text-Metriken unit=null', () => {
  for (const m of R.METRICS) {
    if (m.valueKind === 'numeric') {
      assert.ok(typeof m.unit === 'string' && m.unit.length > 0, m.id + ': unit fehlt');
      assert.ok(m.plausible !== null, m.id + ': plausible fehlt');
    } else {
      assert.equal(m.valueKind, 'text', m.id);
      assert.equal(m.unit, null, m.id + ': text-Metrik mit unit');
    }
  }
});

t('staleDays>0, decimals>=0, jumpMax null oder >0', () => {
  for (const m of R.METRICS) {
    assert.ok(typeof m.staleDays === 'number' && m.staleDays > 0, m.id + ': staleDays');
    assert.ok(Number.isInteger(m.decimals) && m.decimals >= 0, m.id + ': decimals');
    assert.ok(m.jumpMax === null || (typeof m.jumpMax === 'number' && m.jumpMax > 0), m.id + ': jumpMax');
  }
});

t('category jeder Metrik hat ein CATEGORY_LABEL', () => {
  for (const m of R.METRICS) {
    assert.ok(typeof R.CATEGORY_LABELS[m.category] === 'string', m.id + ': ' + m.category);
  }
});

t('SOURCE_PRIORITY: 7 Quellen, Ränge eindeutig, Design-Ordnung §8', () => {
  const p = R.SOURCE_PRIORITY;
  assert.equal(Object.keys(p).length, 7);
  const vals = Object.values(p);
  assert.equal(new Set(vals).size, vals.length, 'Ränge nicht eindeutig');
  assert.ok(p.lab_test > p.device_measurement, 'lab > device');
  assert.ok(p.device_measurement > p.provider_calculation, 'device > provider_calc');
  assert.ok(p.provider_calculation > p.manual_override, 'provider_calc > override');
  assert.ok(p.manual_override > p.manual_entry, 'override > manual_entry');
  assert.ok(p.manual_entry > p.orvia_estimate, 'manual_entry > estimate');
  assert.ok(p.orvia_estimate > p.historical, 'estimate > historical');
});

t('priorityOf: bekannte Quelle = Rang, unbekannte/null = 0', () => {
  assert.equal(R.priorityOf('device_measurement'), 90);
  assert.equal(R.priorityOf('kaputt'), 0);
  assert.equal(R.priorityOf(null), 0);
});

t('byId/ids konsistent', () => {
  assert.equal(R.ids().length, R.METRICS.length);
  assert.equal(R.byId('weight_kg').unit, 'kg');
  assert.equal(R.byId('gibt_es_nicht'), null);
});

t('dailyRecordId-Format: <provider>:daily:<datum>:<metric>', () => {
  const id = R.dailyRecordId('garmin_unofficial', '2026-07-17', 'steps');
  assert.equal(id, 'garmin_unofficial:daily:2026-07-17:steps');
  assert.match(id, /^[a-z_]+:daily:\d{4}-\d{2}-\d{2}:[a-z0-9_]+$/);
});

t('OVERRIDE_REASONS vorhanden und nicht leer', () => {
  assert.ok(Array.isArray(R.OVERRIDE_REASONS) && R.OVERRIDE_REASONS.length >= 3);
  assert.ok(R.OVERRIDE_REASONS.includes('manual_correction'));
});

// ---------- (b) SSOT-Sync mit dem Worker-JSON ----------------------
// Pfad: app/supabase/tests → app/supabase → app → <root>/garmin-worker/…

t('Worker-JSON existiert und ist identisch mit registry.toJSON()', () => {
  const jsonPath = path.join(HERE, '..', '..', '..', 'garmin-worker', 'orvia_worker', 'metric_registry.json');
  const HINT = '\nRegenerieren (aus app/): node js/metrics/export-registry.mjs > ../garmin-worker/orvia_worker/metric_registry.json';
  assert.ok(fs.existsSync(jsonPath), 'Worker-JSON fehlt: ' + jsonPath + HINT);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    assert.fail('Worker-JSON nicht parsebar: ' + e.message + HINT);
  }
  try {
    assert.deepStrictEqual(parsed, JSON.parse(JSON.stringify(R.toJSON())));
  } catch (e) {
    assert.fail('Worker-JSON weicht von metric-registry.js (SSOT) ab.' + HINT + '\n' + e.message);
  }
});

console.log('OK ' + n + ' Tests');

// ORVIA · metric_resolver_test — §4-Auflösungsregeln (pure Domain-Logik).
// Ausführung (aus app/):  node supabase/tests/metric_resolver_test.mjs
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REG = require(path.join(HERE, '..', '..', 'js', 'metrics', 'metric-registry.js'));
const RES = require(path.join(HERE, '..', '..', 'js', 'metrics', 'metric-resolver.js'));

const TODAY = '2026-07-17';
const OPTS = { today: TODAY };

let n = 0;
function t(name, fn) {
  try { fn(); n++; }
  catch (e) {
    console.error('FAIL: ' + name + '\n' + (e && e.stack || e));
    process.exit(1);
  }
}

// DB-Zeilen-Fixture (snake_case wie Supabase). weight_kg: staleDays 30.
let seq = 0;
function row(over) {
  seq++;
  return Object.assign({
    id: 'id-' + String(seq).padStart(3, '0'),
    metric_type: 'weight_kg',
    value_numeric: 80,
    value_text: null,
    unit: 'kg',
    metric_date: '2026-07-15',
    measured_at: '2026-07-15T07:00:00Z',
    imported_at: '2026-07-15T08:00:00Z',
    source_type: 'device_measurement',
    source_record_id: 'garmin_unofficial:daily:2026-07-15:weight_kg-' + seq,
    validity: 'valid',
    is_manual_override: false,
    provider_id: 'prov-1',
    device_id: 'dev-1',
    quality: null,
    confidence: null,
    override_reason: null,
    original_metric_id: null,
    created_at: '2026-07-15T08:00:00Z'
  }, over);
}

// ---------- normalizeEntry -----------------------------------------

t('normalizeEntry: snake_case -> camelCase mit Prioritätsrang', () => {
  const e = RES.normalizeEntry(row({ id: 'x1' }));
  assert.equal(e.metricType, 'weight_kg');
  assert.equal(e.valueNumeric, 80);
  assert.equal(e.sourceType, 'device_measurement');
  assert.equal(e.priority, 90);
  assert.equal(e.isManualOverride, false);
  assert.equal(e.sourceRecordId.startsWith('garmin_unofficial:daily:'), true);
});

t('normalizeEntry: idempotent (doppelt normalisiert strukturell identisch)', () => {
  const once = RES.normalizeEntry(row({}));
  const twice = RES.normalizeEntry(once);
  assert.deepStrictEqual(twice, once);
});

t('normalizeEntry: unbekannter source_type -> priority 0', () => {
  const e = RES.normalizeEntry(row({ source_type: 'totally_bogus' }));
  assert.equal(e.priority, 0);
});

t('normalizeEntry: fehlendes measured_at -> Fallback metric_date', () => {
  const e = RES.normalizeEntry(row({ measured_at: null, metric_date: '2026-07-10' }));
  assert.equal(e.measuredAt, '2026-07-10T00:00:00Z');
  assert.equal(e.metricDate, '2026-07-10');
});

t('normalizeEntry: null/korrupter Input -> null, kein Throw', () => {
  assert.equal(RES.normalizeEntry(null), null);
  assert.equal(RES.normalizeEntry(42), null);
  assert.equal(RES.normalizeEntry('kaputt'), null);
  assert.equal(RES.normalizeEntry([1, 2]), null);
  assert.ok(RES.normalizeEntry({}) !== undefined); // leeres Objekt -> Entry mit nulls
});

// ---------- Regel 1: validity --------------------------------------

t('invalid kandidiert nie (allein -> null)', () => {
  assert.equal(RES.resolveMetric('weight_kg', [row({ validity: 'invalid' })], OPTS), null);
});

t('suspect kandidiert nie; älterer valider Wert bleibt aktiv', () => {
  const r = RES.resolveMetric('weight_kg', [
    row({ validity: 'suspect', value_numeric: 60, measured_at: '2026-07-16T07:00:00Z', metric_date: '2026-07-16' }),
    row({ value_numeric: 81, measured_at: '2026-07-14T07:00:00Z', metric_date: '2026-07-14' })
  ], OPTS);
  assert.equal(r.value, 81);
  assert.equal(r.stale, false);
});

// ---------- Regel 2: manueller Override ----------------------------

const overrideRow = (over) => row(Object.assign({
  source_type: 'manual_override', is_manual_override: true,
  override_reason: 'garmin_value_wrong', value_numeric: 78.5,
  measured_at: '2026-07-16T09:00:00Z', metric_date: '2026-07-16',
  original_metric_id: 'id-orig'
}, over));

t('Override gewinnt gegen älteren Garmin-Wert (trotz Rang 70<90)', () => {
  const orig = row({ id: 'id-orig', value_numeric: 92, measured_at: '2026-07-15T07:00:00Z' });
  const r = RES.resolveMetric('weight_kg', [orig, overrideRow({})], OPTS);
  assert.equal(r.value, 78.5);
  assert.equal(r.isOverride, true);
  assert.equal(r.source, 'override');
  assert.equal(r.sourceType, 'manual_override');
  assert.ok(r.overriddenOriginal && r.overriddenOriginal.id === 'id-orig');
  assert.equal(r.overriddenOriginal.valueNumeric, 92);
});

t('neuere automatische Messung beendet den Override', () => {
  const r = RES.resolveMetric('weight_kg', [
    overrideRow({}),
    row({ value_numeric: 79.2, measured_at: '2026-07-16T10:00:00Z', metric_date: '2026-07-16' })
  ], OPTS);
  assert.equal(r.value, 79.2);
  assert.equal(r.isOverride, false);
  assert.equal(r.source, 'automatic');
});

t('neuere INVALIDE automatische Messung beendet den Override NICHT', () => {
  const r = RES.resolveMetric('weight_kg', [
    overrideRow({}),
    row({ validity: 'invalid', value_numeric: 300, measured_at: '2026-07-16T10:00:00Z', metric_date: '2026-07-16' })
  ], OPTS);
  assert.equal(r.value, 78.5);
  assert.equal(r.isOverride, true);
});

t('neuerer manual_entry (nicht automatisch) beendet den Override NICHT', () => {
  const r = RES.resolveMetric('weight_kg', [
    overrideRow({}),
    row({ source_type: 'manual_entry', value_numeric: 77, measured_at: '2026-07-16T12:00:00Z', metric_date: '2026-07-16' })
  ], OPTS);
  assert.equal(r.value, 78.5);
});

t('manualOverrideEnabled=false deaktiviert Overrides komplett', () => {
  const r = RES.resolveMetric('weight_kg', [
    row({ value_numeric: 92, measured_at: '2026-07-15T07:00:00Z' }),
    overrideRow({})
  ], { today: TODAY, settings: { manualOverrideEnabled: false } });
  assert.equal(r.value, 92);
  assert.equal(r.isOverride, false);
});

// ---------- Regel 3: Priorität + Frische ---------------------------

t('Prioritätsordnung: lab > device > provider_calc > manual_entry', () => {
  const entries = [
    row({ source_type: 'manual_entry', value_numeric: 1, measured_at: '2026-07-16T09:00:00Z', metric_date: '2026-07-16' }),
    row({ source_type: 'provider_calculation', value_numeric: 2, measured_at: '2026-07-15T09:00:00Z' }),
    row({ source_type: 'device_measurement', value_numeric: 3, measured_at: '2026-07-14T09:00:00Z', metric_date: '2026-07-14' }),
    row({ source_type: 'lab_test', value_numeric: 4, measured_at: '2026-07-13T09:00:00Z', metric_date: '2026-07-13' })
  ];
  assert.equal(RES.resolveMetric('weight_kg', entries, OPTS).value, 4);            // lab
  assert.equal(RES.resolveMetric('weight_kg', entries.slice(0, 3), OPTS).value, 3); // device
  assert.equal(RES.resolveMetric('weight_kg', entries.slice(0, 2), OPTS).value, 2); // provider_calc
  assert.equal(RES.resolveMetric('weight_kg', entries.slice(0, 1), OPTS).value, 1); // manual_entry
});

t('preferredSource hebt auf Rang 95 (schlägt device 90, verliert gegen lab 100)', () => {
  const entries = [
    row({ source_type: 'device_measurement', value_numeric: 3 }),
    row({ source_type: 'provider_calculation', value_numeric: 2 })
  ];
  const r = RES.resolveMetric('weight_kg', entries, { today: TODAY, settings: { preferredSource: 'provider_calculation' } });
  assert.equal(r.value, 2);
  const withLab = entries.concat([row({ source_type: 'lab_test', value_numeric: 4 })]);
  const r2 = RES.resolveMetric('weight_kg', withLab, { today: TODAY, settings: { preferredSource: 'provider_calculation' } });
  assert.equal(r2.value, 4);
});

t('frischer niedrigpriorisierter schlägt NICHT einen frischen höherpriorisierten', () => {
  const r = RES.resolveMetric('weight_kg', [
    row({ source_type: 'manual_entry', value_numeric: 70, measured_at: '2026-07-17T06:00:00Z', metric_date: '2026-07-17' }),
    row({ source_type: 'device_measurement', value_numeric: 80, measured_at: '2026-07-10T06:00:00Z', metric_date: '2026-07-10' })
  ], OPTS);
  assert.equal(r.value, 80);
  assert.equal(r.stale, false);
});

t('abgelaufener höherpriorisierter fällt aus der Frischemenge (weight staleDays=30)', () => {
  const r = RES.resolveMetric('weight_kg', [
    row({ source_type: 'device_measurement', value_numeric: 85, measured_at: '2026-06-01T06:00:00Z', metric_date: '2026-06-01' }), // 46 Tage alt
    row({ source_type: 'manual_entry', value_numeric: 79, measured_at: '2026-07-12T06:00:00Z', metric_date: '2026-07-12' })
  ], OPTS);
  assert.equal(r.value, 79);
  assert.equal(r.sourceType, 'manual_entry');
  assert.equal(r.stale, false);
});

t('Gleichstand im Rang -> jüngstes measured_at, dann jüngstes imported_at', () => {
  const r = RES.resolveMetric('weight_kg', [
    row({ value_numeric: 80, measured_at: '2026-07-15T06:00:00Z' }),
    row({ value_numeric: 81, measured_at: '2026-07-16T06:00:00Z', metric_date: '2026-07-16' })
  ], OPTS);
  assert.equal(r.value, 81);
  const r2 = RES.resolveMetric('weight_kg', [
    row({ value_numeric: 82, measured_at: '2026-07-16T06:00:00Z', metric_date: '2026-07-16', imported_at: '2026-07-16T07:00:00Z' }),
    row({ value_numeric: 83, measured_at: '2026-07-16T06:00:00Z', metric_date: '2026-07-16', imported_at: '2026-07-16T09:00:00Z' })
  ], OPTS);
  assert.equal(r2.value, 83);
});

// ---------- Regel 4/5: stale-Fallback und null ---------------------

t('keine frischen Kandidaten -> jüngster gültiger mit stale:true', () => {
  const r = RES.resolveMetric('weight_kg', [
    row({ value_numeric: 84, measured_at: '2026-05-01T06:00:00Z', metric_date: '2026-05-01' }),
    row({ value_numeric: 86, measured_at: '2026-06-01T06:00:00Z', metric_date: '2026-06-01' })
  ], OPTS);
  assert.equal(r.value, 86);
  assert.equal(r.stale, true);
});

t('gar kein Kandidat -> null', () => {
  assert.equal(RES.resolveMetric('weight_kg', [], OPTS), null);
  assert.equal(RES.resolveMetric('weight_kg', null, OPTS), null);
  assert.equal(RES.resolveMetric('unbekannte_metrik', [row({})], OPTS), null);
});

t('korrupte Einträge im Array crashen nicht', () => {
  const r = RES.resolveMetric('weight_kg', [null, {}, 42, 'x', row({ value_numeric: 88 })], OPTS);
  assert.equal(r.value, 88);
});

t('Ergebnis-Shape vollständig (editMode aus Registry, settings-Override)', () => {
  const r = RES.resolveMetric('weight_kg', [row({})], OPTS);
  for (const k of ['metricType', 'value', 'valueText', 'unit', 'source', 'sourceType',
    'measuredAt', 'metricDate', 'stale', 'isOverride', 'overriddenOriginal', 'editMode', 'entry']) {
    assert.ok(k in r, 'Feld fehlt: ' + k);
  }
  assert.equal(r.editMode, 'automatic_override_allowed'); // Registry-Default weight_kg
  const r2 = RES.resolveMetric('weight_kg', [row({})], { today: TODAY, settings: { editMode: 'automatic_locked' } });
  assert.equal(r2.editMode, 'automatic_locked');
});

// ---------- Determinismus & Non-Mutation ---------------------------

t('deterministisch: zweifacher Aufruf identisches Ergebnis', () => {
  const entries = [row({}), overrideRow({}), row({ validity: 'suspect' })];
  const a = RES.resolveMetric('weight_kg', entries, OPTS);
  const b = RES.resolveMetric('weight_kg', entries, OPTS);
  assert.deepStrictEqual(a, b);
});

t('non-mutating: Input-Array und Zeilen bleiben unverändert', () => {
  const entries = [row({}), overrideRow({}), null, {}];
  const snapshot = JSON.stringify(entries);
  RES.resolveMetric('weight_kg', entries, OPTS);
  RES.resolveAll(entries, OPTS);
  assert.equal(JSON.stringify(entries), snapshot);
});

t('opts.today ist Pflicht (kein Date.now()-Default im Kern)', () => {
  assert.throws(() => RES.resolveMetric('weight_kg', [row({})], {}), /today/);
  assert.throws(() => RES.resolveMetric('weight_kg', [row({})], { today: 'gestern' }), /today/);
});

// ---------- resolveAll ---------------------------------------------

t('resolveAll: gruppiert selbst, ignoriert unbekannte metric_types', () => {
  const entries = [
    row({}),
    row({ metric_type: 'resting_hr', value_numeric: 44, unit: 'bpm', metric_date: '2026-07-17', measured_at: '2026-07-17T05:00:00Z' }),
    row({ metric_type: 'voellig_unbekannt', value_numeric: 1 }),
    null, 'korrupt'
  ];
  const all = RES.resolveAll(entries, OPTS);
  assert.deepStrictEqual(Object.keys(all).sort(), ['resting_hr', 'weight_kg']);
  assert.equal(all.resting_hr.value, 44);
});

t('resolveAll: nur Metriken MIT Ergebnis; leerer/korrupter Input -> {}', () => {
  const all = RES.resolveAll([row({ validity: 'invalid' })], OPTS);
  assert.deepStrictEqual(all, {});
  assert.deepStrictEqual(RES.resolveAll(null, OPTS), {});
  assert.deepStrictEqual(RES.resolveAll('quatsch', OPTS), {});
});

// ---------- displayValue -------------------------------------------

t('displayValue: de-DE Komma nach decimals + Einheit', () => {
  const r = RES.resolveMetric('weight_kg', [row({ value_numeric: 72.5 })], OPTS);
  assert.equal(RES.displayValue(r, REG), '72,5 kg');
  const hr = RES.resolveMetric('resting_hr', [row({ metric_type: 'resting_hr', value_numeric: 44.4, unit: 'bpm' })], OPTS);
  assert.equal(RES.displayValue(hr, REG), '44 bpm'); // decimals 0
});

t("displayValue: Pace 282 s/km -> '4:42 min/km'", () => {
  const r = RES.resolveMetric('lactate_threshold_pace',
    [row({ metric_type: 'lactate_threshold_pace', value_numeric: 282, unit: 's/km' })], OPTS);
  assert.equal(RES.displayValue(r, REG), '4:42 min/km');
});

t("displayValue: Halbmarathon-Sekunden -> 'H:MM:SS'", () => {
  const r = RES.resolveMetric('race_prediction_half',
    [row({ metric_type: 'race_prediction_half', value_numeric: 5730, unit: 's' })], OPTS);
  assert.equal(RES.displayValue(r, REG), '1:35:30');
});

t('displayValue: text-Metrik nutzt value_text; null-Input -> leerer String', () => {
  const r = RES.resolveMetric('hrv_status',
    [row({ metric_type: 'hrv_status', value_numeric: null, value_text: 'Ausgeglichen', unit: null, metric_date: '2026-07-17', measured_at: '2026-07-17T05:00:00Z' })], OPTS);
  assert.equal(RES.displayValue(r, REG), 'Ausgeglichen');
  assert.equal(RES.displayValue(null, REG), '');
});

// ---------- shouldDisplay ------------------------------------------

t('shouldDisplay: false ohne jegliche Einträge', () => {
  assert.equal(RES.shouldDisplay('weight_kg', [], OPTS), false);
  assert.equal(RES.shouldDisplay('weight_kg', null, OPTS), false);
});

t('shouldDisplay: true bei aufgelöstem Wert und bei rein historischen (invaliden) Einträgen', () => {
  assert.equal(RES.shouldDisplay('weight_kg', [row({})], OPTS), true);
  assert.equal(RES.shouldDisplay('weight_kg', [row({ validity: 'invalid' })], OPTS), true);
});

t('shouldDisplay: settings.displayEnabled===false blendet immer aus', () => {
  assert.equal(RES.shouldDisplay('weight_kg', [row({})], { today: TODAY, settings: { displayEnabled: false } }), false);
});

console.log('OK ' + n + ' Tests');

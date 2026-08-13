/* ============================================================
   ORVIA · Phase 5 — profile-metric-resolver (Brücke user_metrics → Profil)
   Verträge (js/metrics/profile-metric-resolver.js, Header-Regeln 1-5):
   - buildCanonicalPatch ist pure und mutiert das Profil nicht.
   - Nur 'automatic'/'override' und nicht-stale Werte speisen die flachen
     kanonischen Felder; 'manual'/'estimate' u.a. nie.
   - Editor-Vorrang: jüngere Editor-Speicherung der Section 'body' blockiert
     ältere Provider-Werte; neuere Messungen gewinnen wieder.
   - Kopplungen: restingHr ⇒ restingHrMeasured+rhrBaseline,
     maxHr ⇒ hfMaxMeasured+hfMax (eine HFmax-Welt). Kein Feld wird genullt.
   - Idempotenz: nach Rundung identisch ⇒ leerer Patch, kein Save.
   - refresh() schreibt AUSSCHLIESSLICH über
     ORVIA.profile.updateSection('body', patch, ['body'], 'provider_sync').
   node supabase/tests/profile_metric_resolver_p5_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL(_APPREL + 'js/', import.meta.url);
const TODAY = '2026-07-17';

function makeSb() {
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = console; sb.Date = Date; sb.Math = Math; sb.JSON = JSON;
  sb.Array = Array; sb.Object = Object; sb.String = String; sb.Number = Number;
  sb.isNaN = isNaN; sb.isFinite = isFinite; sb.Promise = Promise; sb.Error = Error;
  sb.ORVIA = {};
  vm.createContext(sb);
  ['metrics/metric-registry.js', 'metrics/metric-resolver.js', 'metrics/profile-metric-resolver.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  return sb;
}

// user_metrics-Zeile (snake_case wie aus Supabase).
const row = (metricType, value, date, over) => Object.assign({
  id: 'id-' + metricType + '-' + date, metric_type: metricType, value_numeric: value,
  unit: null, metric_date: date, measured_at: date + 'T06:00:00Z',
  imported_at: date + 'T07:00:00Z', source_type: 'device_measurement',
  provider_id: 'prov-1', device_id: 'dev-1', validity: 'valid', is_manual_override: false
}, over || {});

// Hand-gebautes resolveMetric-Ergebnis (Kern liest nur source/stale/value/measuredAt).
const res = (value, over) => Object.assign({ source: 'automatic', stale: false, value, measuredAt: '2026-07-16T06:00:00Z' }, over || {});

const sb = makeSb();
const PMR = sb.ORVIA.profileMetricResolver;

/* ---------- 1) Entscheidungskern buildCanonicalPatch (pure) ---------- */
{
  const prof = { weightKg: 80, restingHrMeasured: 60, rhrBaseline: 60, hfMaxMeasured: 190, hfMax: 190 };
  const frozen = JSON.stringify(prof);
  const d = PMR.buildCanonicalPatch({ weight_kg: res(74.32), resting_hr: res(48), max_hr: res(196) }, prof);
  ok('P1 automatischer Gewichtswert ⇒ weightKg (gerundet auf 1 NK)', d.patch.weightKg === 74.3, JSON.stringify(d.patch));
  ok('P2 restingHr ⇒ restingHrMeasured UND rhrBaseline gekoppelt', d.patch.restingHrMeasured === 48 && d.patch.rhrBaseline === 48);
  ok('P3 maxHr ⇒ hfMaxMeasured UND hfMax (eine HFmax-Welt)', d.patch.hfMaxMeasured === 196 && d.patch.hfMax === 196);
  ok('P4 buildCanonicalPatch mutiert das Profil NICHT', JSON.stringify(prof) === frozen);
}
{
  const prof = { weightKg: 80 };
  ok('P5 stale ⇒ skip (anzeigen ja, kanonisch schreiben nein)',
    (() => { const d = PMR.buildCanonicalPatch({ weight_kg: res(74, { stale: true }) }, prof); return !('weightKg' in d.patch) && d.skipped.some(s => s.metricId === 'weight_kg' && s.reason === 'stale'); })());
  ok('P6 source manual ⇒ skip (Editor ist zuständig, nicht die Brücke)',
    (() => { const d = PMR.buildCanonicalPatch({ weight_kg: res(74, { source: 'manual' }) }, prof); return !('weightKg' in d.patch) && d.skipped[0].reason === 'source_manual'; })());
  ok('P7 source estimate ⇒ skip', !('weightKg' in PMR.buildCanonicalPatch({ weight_kg: res(74, { source: 'estimate' }) }, prof).patch));
  ok('P8 source override ⇒ WIRD geschrieben (bewusste Nutzerkorrektur)', PMR.buildCanonicalPatch({ weight_kg: res(74, { source: 'override' }) }, prof).patch.weightKg === 74);
  ok('P9 value null ⇒ skip (Provider löscht nie kanonische Felder)',
    (() => { const d = PMR.buildCanonicalPatch({ weight_kg: res(null) }, prof); return Object.keys(d.patch).length === 0 && d.skipped[0].reason === 'null_value'; })());
  ok('P10 keine Auflösung ⇒ no_value-Skip, leerer Patch',
    (() => { const d = PMR.buildCanonicalPatch({}, prof); return Object.keys(d.patch).length === 0 && d.skipped.length === 3; })());
}
{
  // Regel 3: Editor-Vorrang über _sectionMeta.body.
  const mkProf = (metaSource, metaAt) => ({ weightKg: 80, _sectionMeta: { body: { updatedAt: metaAt, source: metaSource, schemaVersion: 1 } } });
  const older = res(74, { measuredAt: '2026-07-14T06:00:00Z' });
  const newer = res(74, { measuredAt: '2026-07-16T06:00:00Z' });
  const dOld = PMR.buildCanonicalPatch({ weight_kg: older }, mkProf('editor', '2026-07-15T10:00:00Z'));
  ok('E1 Editor-Save NEUER als Messung ⇒ Nutzereingabe gewinnt (skip editor_newer)', !('weightKg' in dOld.patch) && dOld.skipped[0].reason === 'editor_newer');
  const dNew = PMR.buildCanonicalPatch({ weight_kg: newer }, mkProf('editor', '2026-07-15T10:00:00Z'));
  ok('E2 Messung NEUER als Editor-Save ⇒ Provider-Wert gewinnt wieder', dNew.patch.weightKg === 74);
  const dSync = PMR.buildCanonicalPatch({ weight_kg: older }, mkProf('provider_sync', '2026-07-15T10:00:00Z'));
  ok('E3 letzte Section-Quelle provider_sync ⇒ kein Editor-Guard', dSync.patch.weightKg === 74);
  const dNone = PMR.buildCanonicalPatch({ weight_kg: older }, { weightKg: 80 });
  ok('E4 nie editiert (kein _sectionMeta) ⇒ wird geschrieben', dNone.patch.weightKg === 74);
  const dNoTs = PMR.buildCanonicalPatch({ weight_kg: res(74, { measuredAt: null }) }, mkProf('editor', '2026-07-15T10:00:00Z'));
  ok('E5 Messzeitpunkt unbeweisbar (measuredAt null) + Editor-Meta ⇒ skip (konservativ)', !('weightKg' in dNoTs.patch));
}
{
  // Regel 5: Idempotenz + Kopplungs-Reparatur.
  const same = PMR.buildCanonicalPatch({ weight_kg: res(74.32) }, { weightKg: 74.3 });
  ok('I1 nach Rundung identisch ⇒ leerer Patch (kein Save-Loop)', Object.keys(same.patch).length === 0 && same.skipped[0].reason === 'unchanged');
  const drift = PMR.buildCanonicalPatch({ resting_hr: res(48) }, { restingHrMeasured: 48, rhrBaseline: 55 });
  ok('I2 Hauptfeld gleich, aber gekoppeltes Feld abweichend ⇒ Patch repariert Kopplung', drift.patch.restingHrMeasured === 48 && drift.patch.rhrBaseline === 48);
}

/* ---------- 2) settingsFor + resolveCurrent (Format-Kompatibilität) ---------- */
{
  const s = PMR.settingsFor([{ metric_type: 'weight_kg', edit_mode: 'automatic_locked', preferred_source: 'lab_test', manual_override_enabled: false, display_enabled: false }], 'weight_kg');
  ok('S1 snake_case-Settings → resolver-Keys', s.editMode === 'automatic_locked' && s.preferredSource === 'lab_test' && s.manualOverrideEnabled === false && s.displayEnabled === false);
  ok('S2 fehlende Zeile ⇒ {} (Registry-Defaults)', Object.keys(PMR.settingsFor([], 'weight_kg')).length === 0);

  const entries = [
    row('weight_kg', 74.3, '2026-07-16'),
    row('resting_hr', 48, '2026-07-16'),
    row('unbekannte_metrik', 1, '2026-07-16')
  ];
  const resolved = PMR.resolveCurrent(entries, [], TODAY);
  ok('R1 resolveCurrent löst bekannte Metriken auf, ignoriert unbekannte',
    resolved.weight_kg && resolved.weight_kg.value === 74.3 && resolved.resting_hr && !resolved.unbekannte_metrik);
  ok('R2 End-to-End: resolveCurrent-Format speist buildCanonicalPatch',
    (() => { const d = PMR.buildCanonicalPatch(resolved, { weightKg: 80 }); return d.patch.weightKg === 74.3 && d.patch.restingHrMeasured === 48; })());
  // Per-Metrik-Settings: Override nur für weight_kg deaktiviert.
  const ov = [
    row('weight_kg', 74.3, '2026-07-15'),
    row('weight_kg', 70, '2026-07-16', { source_type: 'manual_override', is_manual_override: true }),
    row('resting_hr', 48, '2026-07-15'),
    row('resting_hr', 40, '2026-07-16', { source_type: 'manual_override', is_manual_override: true })
  ];
  const rOv = PMR.resolveCurrent(ov, [{ metric_type: 'weight_kg', manual_override_enabled: false }], TODAY);
  ok('R3 per-Metrik-Settings greifen einzeln (Override nur bei weight_kg aus)',
    rOv.weight_kg.value === 74.3 && rOv.weight_kg.source === 'automatic' && rOv.resting_hr.value === 40 && rOv.resting_hr.source === 'override');
}

/* ---------- 3) refresh(): offizieller Schreibpfad, No-Ops, Fehler ---------- */
const mkRepo = (rows, over) => Object.assign({
  listRecent: async () => ({ success: true, data: rows, error: null }),
  getSettings: async () => ({ success: true, data: [], error: null }),
  listProviders: async () => ({ success: true, data: [{ provider_type: 'garmin_unofficial' }], error: null }),
  listDevices: async () => ({ success: true, data: [{ device_name: 'Forerunner' }], error: null })
}, over || {});

await (async () => {
  const s1 = makeSb();
  const calls = [];
  s1.ORVIA.repos = { metrics: mkRepo([row('weight_kg', 74.3, '2026-07-16'), row('resting_hr', 48, '2026-07-16')]) };
  s1.PROFILE = { weightKg: 80, restingHrMeasured: 60, rhrBaseline: 60 };
  s1.ORVIA.profile = { updateSection: (...a) => calls.push(a) };
  const r = await s1.ORVIA.profileMetricResolver.refresh({ today: TODAY });
  ok('F1 refresh erfolgreich, applied enthält beide Patches', r.success === true && r.data.applied.weightKg === 74.3 && r.data.applied.rhrBaseline === 48, JSON.stringify(r.data && r.data.applied));
  ok('F2 GENAU EIN Schreibaufruf über den offiziellen Pfad', calls.length === 1);
  ok('F3 Signatur exakt: updateSection(\'body\', patch, [\'body\'], \'provider_sync\')',
    calls[0] && calls[0][0] === 'body' && calls[0][1] === r.data.applied && JSON.stringify(calls[0][2]) === '["body"]' && calls[0][3] === 'provider_sync');
  ok('F4 Meta für UI-Karte vorhanden (providers/devices/entries/resolved)',
    r.data.providers.length === 1 && r.data.devices.length === 1 && r.data.entries.length === 2 && !!r.data.resolved.weight_kg);

  // Idempotenz über den vollen Pfad: Profil trägt die Werte bereits ⇒ kein Save.
  const s2 = makeSb();
  const calls2 = [];
  s2.ORVIA.repos = { metrics: mkRepo([row('weight_kg', 74.3, '2026-07-16')]) };
  s2.PROFILE = { weightKg: 74.3 };
  s2.ORVIA.profile = { updateSection: (...a) => calls2.push(a) };
  const r2 = await s2.ORVIA.profileMetricResolver.refresh({ today: TODAY });
  ok('F5 unveränderte Werte ⇒ success, aber NULL Schreibaufrufe (kein Save-Loop)', r2.success === true && calls2.length === 0 && Object.keys(r2.data.applied).length === 0);

  // Offline/Fehler aus dem Repo ⇒ strukturierter Fail, kein Schreiben.
  const s3 = makeSb();
  const calls3 = [];
  s3.ORVIA.repos = { metrics: mkRepo([], { listRecent: async () => ({ success: false, data: null, error: { code: 'offline', message: 'Offline' } }) }) };
  s3.PROFILE = { weightKg: 80 };
  s3.ORVIA.profile = { updateSection: (...a) => calls3.push(a) };
  const r3 = await s3.ORVIA.profileMetricResolver.refresh({ today: TODAY });
  ok('F6 Repo-Fehler ⇒ success:false durchgereicht, kein Schreibaufruf', r3.success === false && r3.error.code === 'offline' && calls3.length === 0);

  // PROFILE nicht hydriert ⇒ profile_not_ready, kein Crash.
  const s4 = makeSb();
  s4.ORVIA.repos = { metrics: mkRepo([row('weight_kg', 74.3, '2026-07-16')]) };
  const r4 = await s4.ORVIA.profileMetricResolver.refresh({ today: TODAY });
  ok('F7 PROFILE fehlt ⇒ profile_not_ready (resolved bleibt für Anzeige nutzbar)', r4.success === false && r4.error.code === 'profile_not_ready' && !!r4.data.resolved.weight_kg);

  // Stale-Wert: angezeigt (resolved), aber nicht geschrieben.
  const s5 = makeSb();
  const calls5 = [];
  s5.ORVIA.repos = { metrics: mkRepo([row('weight_kg', 74.3, '2026-05-01')]) }; // 77 Tage > staleDays 30
  s5.PROFILE = { weightKg: 80 };
  s5.ORVIA.profile = { updateSection: (...a) => calls5.push(a) };
  const r5 = await s5.ORVIA.profileMetricResolver.refresh({ today: TODAY });
  ok('F8 stale: resolved vorhanden (Anzeige), aber kein kanonischer Write', r5.success === true && r5.data.resolved.weight_kg.stale === true && calls5.length === 0 && r5.data.skipped.some(s => s.reason === 'stale'));
})();

/* ---------- 4) trendFor (pure) ---------- */
{
  const s = makeSb();
  const T = s.ORVIA.profileMetricResolver;
  const winner = { value: 74.3, entry: { id: 'w1', metricType: 'weight_kg', measuredAt: '2026-07-16T06:00:00Z', metricDate: '2026-07-16' } };
  const hist = [row('weight_kg', 75.0, '2026-07-10'), row('weight_kg', 76.2, '2026-07-01'), row('resting_hr', 48, '2026-07-12')];
  const tr = T.trendFor('weight_kg', hist, winner);
  ok('T1 Trend = Delta zum JÜNGSTEN älteren Vorwert (nicht zum ältesten)', tr && Math.abs(tr.delta - (-0.7)) < 1e-9 && tr.prevValue === 75.0, JSON.stringify(tr));
  ok('T2 kein Vorwert ⇒ null', T.trendFor('weight_kg', [], winner) === null);
  const withWinner = [row('weight_kg', 74.3, '2026-07-16', { id: 'w1' })];
  ok('T3 Gewinner-Eintrag selbst zählt nicht als Vorwert', T.trendFor('weight_kg', withWinner, winner) === null);
  const newerOnly = [row('weight_kg', 73, '2026-07-17')];
  ok('T4 neuere Nicht-Gewinner-Einträge zählen nicht (nur echte Vorwerte)', T.trendFor('weight_kg', newerOnly, winner) === null);
  const invalid = [row('weight_kg', 75, '2026-07-10', { validity: 'suspect' })];
  ok('T5 suspect/invalid-Einträge liefern keinen Trend', T.trendFor('weight_kg', invalid, winner) === null);
}

/* ---------- 5) UI-Karte (profile.js: _gwSyncCardHTML/_gwSyncLoad, Verhaltenstests) ---------- */
function makeApp() {
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object; sb.String = String; sb.Number = Number;
  sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN; sb.isFinite = isFinite; sb.Set = Set; sb.Intl = Intl;
  sb.Promise = Promise; sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout; sb.Error = Error;
  sb.navigator = { onLine: true };
  sb.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
  sb.addEventListener = () => {}; sb.removeEventListener = () => {}; sb.dispatchEvent = () => true;
  const store = {};
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const els = {};
  sb.document = {
    getElementById: id => { if (id === 'perfBody' || id === 'gwSync') { els[id] = els[id] || { innerHTML: '' }; return els[id]; } return null; },
    querySelector: () => null, querySelectorAll: () => [],
    createElement: () => ({ classList: { add() {}, remove() {} }, style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [] }),
    body: { appendChild() {} }, documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } }
  };
  sb.escH = s => String(s == null ? '' : s); sb.toast = () => {}; sb.renderProfileScreen = () => {}; sb.renderZones = () => {}; sb.maybePlanImpact = () => {};
  sb.ORVIA = {};
  vm.createContext(sb);
  ['metrics/metric-registry.js', 'metrics/metric-resolver.js', 'metrics/profile-metric-resolver.js',
   'profile-model.js', 'onboarding/onboarding-profile-logic.js', 'profile.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  sb.ensureProfile();
  return { sb, els };
}
{
  const h = makeApp();
  const s = h.sb;
  // Fixture: aufgelöstes Gewicht (override-fähig) + Ruhepuls (locked, stale).
  const resolvedFix = {
    weight_kg: { metricType: 'weight_kg', value: 74.3, valueText: null, unit: 'kg', source: 'automatic', sourceType: 'device_measurement', measuredAt: '2026-07-16T06:00:00Z', metricDate: '2026-07-16', stale: false, isOverride: false, editMode: 'automatic_override_allowed', entry: { id: 'e1', metricType: 'weight_kg', providerId: 'p1', deviceId: 'd1', measuredAt: '2026-07-16T06:00:00Z', metricDate: '2026-07-16' } },
    resting_hr: { metricType: 'resting_hr', value: 48, valueText: null, unit: 'bpm', source: 'automatic', sourceType: 'device_measurement', measuredAt: '2026-07-01T06:00:00Z', metricDate: '2026-07-01', stale: true, isOverride: false, editMode: 'automatic_locked', entry: { id: 'e2', metricType: 'resting_hr', providerId: 'p1', deviceId: 'd1', measuredAt: '2026-07-01T06:00:00Z', metricDate: '2026-07-01' } }
  };
  const dataFix = { resolved: resolvedFix, providers: [{ id: 'p1', provider_type: 'garmin_unofficial' }], devices: [{ id: 'd1', device_name: 'Forerunner 265' }], entries: [row('weight_kg', 75.0, '2026-07-10')], settingsRows: [] };

  s._gwSync = { state: 'loading', data: null, error: null };
  ok('U1 Ladezustand gerendert', /Wird geladen/.test(s._gwSyncCardHTML()));
  s._gwSync = { state: 'error', data: null, error: { code: 'offline' } };
  ok('U2 Offline-Fehlerzustand gerendert', /Offline/.test(s._gwSyncCardHTML()));
  s._gwSync = { state: 'ready', data: dataFix, error: null };
  const html = s._gwSyncCardHTML();
  ok('U3 Wert + Einheit (displayValue, de-Komma)', /74,3 kg/.test(html), html.slice(0, 0));
  ok('U4 Quelle (Garmin) + Gerät + Zeitpunkt in der Zeile', /Garmin · Forerunner 265 · 2026-07-16/.test(html));
  ok('U5 Trend gegen Vorwert (75,0 → 74,3 ⇒ ▼ 0,7 kg)', /▼ 0,7 kg/.test(html));
  ok('U6 stale-Wert als „veraltet" markiert', /veraltet/.test(html));
  ok('U7 editMode steuert Aktion: Korrigieren NUR beim override-fähigen Feld',
    /openMetricOverride\('weight_kg'\)/.test(html) && !/openMetricOverride\('resting_hr'\)/.test(html));
  ok('U8 Kategorie-Überschriften aus der Registry', /Körperdaten/.test(html) && /Herz-Kreislauf/.test(html));

  // §10-Leerzustände: ohne Provider keine Karte; mit Provider Hinweis.
  s._gwSync = { state: 'ready', data: { resolved: {}, providers: [], devices: [], entries: [], settingsRows: [] }, error: null };
  ok('U9 keine Daten + kein Provider ⇒ Karte komplett ausgeblendet', s._gwSyncCardHTML() === '');
  s._gwSync = { state: 'ready', data: { resolved: {}, providers: [{ id: 'p1', provider_type: 'garmin_unofficial' }], devices: [], entries: [], settingsRows: [] }, error: null };
  ok('U10 keine Daten + Provider verbunden ⇒ ehrlicher Leerzustand', /Noch keine synchronisierten Messwerte/.test(s._gwSyncCardHTML()));
  // display_enabled=false blendet die Metrik aus.
  s._gwSync = { state: 'ready', data: Object.assign({}, dataFix, { settingsRows: [{ metric_type: 'weight_kg', display_enabled: false }] }), error: null };
  ok('U11 display_enabled=false blendet Metrik aus', !/74,3 kg/.test(s._gwSyncCardHTML()) && /Ruhepuls/.test(s._gwSyncCardHTML()));
}
await (async () => {
  // Verhaltens-Test _gwSyncLoad: refresh() angewendet ⇒ Editor-Stand wird neu geseedet.
  const h = makeApp();
  const s = h.sb;
  Object.assign(s.PROFILE, { weightKg: 80 });
  const M = s.ORVIA.profileModel;
  const seeded = s._perfSeedFromCanonical(M.normalizePerformance(s.PROFILE.performance, s.PROFILE.body));
  s._perfEd = { orig: JSON.stringify(seeded), perf: seeded };
  s._perfMgr = true;
  s._gwSync = { state: 'idle', data: null, error: null };
  s.ORVIA.profileMetricResolver = {
    settingsFor: () => ({}), trendFor: () => null,
    refresh: async () => { s.PROFILE.weightKg = 74.3; return { success: true, error: null, data: { resolved: {}, applied: { weightKg: 74.3 }, skipped: [], providers: [], devices: [], entries: [], settingsRows: [] } }; }
  };
  s._gwSyncLoad();
  await new Promise(r => setTimeout(r, 20));
  ok('B1 refresh mit applied ⇒ Editor-Seed übernimmt den neuen kanonischen Wert', s._perfEd.perf.body.weight.value === 74.3, String(s._perfEd.perf.body.weight.value));
  ok('B2 Manager wurde neu gerendert (perfBody enthält gwSync-Container)', /id="gwSync"/.test(h.els.perfBody.innerHTML));

  // Ungespeicherte Editor-Änderung ⇒ KEIN Reseed (Nutzereingabe geht nie verloren).
  const h2 = makeApp();
  const s2 = h2.sb;
  Object.assign(s2.PROFILE, { weightKg: 80 });
  const M2 = s2.ORVIA.profileModel;
  const seeded2 = s2._perfSeedFromCanonical(M2.normalizePerformance(s2.PROFILE.performance, s2.PROFILE.body));
  s2._perfEd = { orig: JSON.stringify(seeded2), perf: seeded2 };
  s2._perfEd.perf.body.weight.value = 99; // Nutzer tippt gerade
  s2._perfMgr = true;
  s2._gwSync = { state: 'idle', data: null, error: null };
  s2.ORVIA.profileMetricResolver = {
    settingsFor: () => ({}), trendFor: () => null,
    refresh: async () => { s2.PROFILE.weightKg = 74.3; return { success: true, error: null, data: { resolved: {}, applied: { weightKg: 74.3 }, skipped: [], providers: [], devices: [], entries: [], settingsRows: [] } }; }
  };
  s2._gwSyncLoad();
  await new Promise(r => setTimeout(r, 20));
  ok('B3 ungespeicherte Editor-Eingabe ⇒ kein Reseed (99 bleibt stehen)', s2._perfEd.perf.body.weight.value === 99);
})();

/* ---------- 6) Verdrahtung: index.html + sw.js (Deploy-Vertrag) ---------- */
{
  const idx = readFileSync(new URL('../index.html', base), 'utf8');
  const NEEDED = ['js/metrics/metric-registry.js', 'js/metrics/metric-resolver.js', 'js/repos/metricsRepository.js', 'js/metrics/profile-metric-resolver.js'];
  ok('W1 alle vier Metrik-Module in index.html eingebunden', NEEDED.every(p => idx.includes('<script src="' + p + '"></script>')));
  const pos = p => idx.indexOf('<script src="' + p + '"></script>');
  ok('W2 Ladereihenfolge: Registry → Resolver → repoBase → metricsRepository → Brücke',
    pos('js/metrics/metric-registry.js') < pos('js/metrics/metric-resolver.js') &&
    pos('js/metrics/metric-resolver.js') < pos('js/repos/repoBase.js') &&
    pos('js/repos/repoBase.js') < pos('js/repos/metricsRepository.js') &&
    pos('js/repos/metricsRepository.js') < pos('js/metrics/profile-metric-resolver.js'));
  const sw = readFileSync(new URL('../sw.js', base), 'utf8');
  ok('W3 alle vier Module in sw-ASSETS (offline-fähig)', NEEDED.every(p => sw.includes("'./" + p + "'")));
  const v = (sw.match(/orvia-v8-(\d+)/) || [])[1];
  ok('W4 SW-Version ≥ v8-187 (Cache-Bump für das Phase-5-Paket)', Number(v) >= 187, 'v8-' + v);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

/* ============================================================
   ORVIA · Herkunft und Kontext in der Kennzahl-Freigabe (v8-447.3)

   H1  Unvollstaendige Herkunft sperrt nicht pauschal (Dauer, Distanz, HF, 5-km-Bestzeit des Laufs)
   H2  Kontext nur aus Garmins Typ, nur wenn der Name ihn nennt; generisch/fehlend = unbelegt
   H3  Laufband / virtuell: keine Strecken-Bestzeit; ohne Typ: keine Sperre, Kontext null
   H4  Kontextgebundene Auswertung (opts.environment) nur mit belegtem Kontext → unverified_context
   H5  Becken-Felder: ohne Typ missing_data, Freiwasser unsupported_source
   H6  Herkunftsstatus = Regel des Workers (complete / partial / unavailable / inconsistent)
   H7  Kein Raten: eine GPS-Strecke macht keinen Kontext; Titel ebenso nicht
   H8  Manuelle Korrektur bleibt wirksam, auch ohne Herkunft
   H9  Freigabe-Dokument: drei Staende, Kontext-Abschnitt, Protokoll mit dem Befund vom 15.10.
   node supabase/tests/provenance_context_v4473_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _ex } from 'node:fs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const J = v => JSON.stringify(v);

const GEN = await import(new URL(_APPREL + 'tools/gen-eligibility-doc.mjs', import.meta.url));
const ME = globalThis.ORVIA.metricEligibility;
const ref = GEN.referenceActivity;
const ev = (a, m, o) => ME.evaluate(a, m, o);
const withType = (sport, tk, variant) => { const a = ref(sport, variant || 'best'); if (tk) a.metrics.garmin.type_key = tk; else delete a.metrics.garmin.type_key; return a; };
const E = { evidence: { 'list.swim': { swimming: 'fixture' }, 'details.power': { cycling: 'fixture', running: 'fixture' }, 'details.time': { cycling: 'fixture' } } };

{
  const prod = ref('running', 'prod');
  ok('H1a Stand heute (ohne Typ/Zeit/Rohfelder): Herkunft partial', ME.provenanceStatus(prod) === 'partial', ME.provenanceStatus(prod));
  for (const [m, o] of [['duration'], ['distance'], ['pace'], ['heartRate'], ['maxHeartRate'], ['distanceBest', { targetM: 5000 }]]) {
    const r = ev(prod, m, o);
    ok('H1b ' + m + ' bleibt frei trotz fehlender Herkunft', r.eligible, J(r.reasons));
  }
  const cad = ev(prod, 'runningCadence');
  ok('H1c Oe-Laufkadenz braucht die Bestaetigung (Rohfelder + Neupruefung), nicht die Herkunft an sich', !cad.eligible && cad.reason === 'unverified_semantics', J(cad.reasons));
  ok('H1d nach Backfill und Neupruefung frei', ev(ref('running', 'best'), 'runningCadence').eligible);
}
{
  ok('H2a generischer Typ running → Kontext unbelegt', ME.contextOf(withType('running', 'running')).environment === null);
  ok('H2b fehlender Typ → Kontext unbelegt, Basis sagt es', ME.contextOf(withType('running', null)).environment === null && /kein Garmin-Typ/.test(ME.contextOf(withType('running', null)).basis));
  ok('H2c treadmill_running → indoor, virtual_ride → virtual, lap_swimming → pool, open_water_swimming → open_water',
    ME.contextOf(withType('running', 'treadmill_running')).environment === 'indoor' && ME.contextOf(withType('cycling', 'virtual_ride')).environment === 'virtual'
    && ME.contextOf(withType('swimming', 'lap_swimming')).environment === 'pool' && ME.contextOf(withType('swimming', 'open_water_swimming')).environment === 'open_water');
  ok('H2d virtual_ride ist NICHT outdoor (Rolle ≠ Strasse)', ME.contextOf(withType('cycling', 'virtual_ride')).environment !== 'outdoor');
  ok('H2e Kontext steht in jeder Antwort (provenance.context)', ev(withType('cycling', 'virtual_ride'), 'duration').provenance.context.typeKey === 'virtual_ride');
  ok('H2f nur Typnamen mit ausdruecklichem Kontext stehen in der Tabelle', Object.keys(ME.CONTEXT).every(k => /^(treadmill|indoor|virtual|lap|open_water|trail|street|road|gravel|mountain|cyclocross|downhill)/.test(k)));
}
{
  const tm = ev(withType('running', 'treadmill_running'), 'distanceBest', { targetM: 5000 });
  ok('H3a Laufband: keine Strecken-Bestzeit', !tm.eligible && tm.reason === 'unsupported_source', J(tm.reasons));
  const vr = ev(withType('running', 'virtual_run'), 'distanceBest', { targetM: 5000 });
  ok('H3b virtueller Lauf: keine Strecken-Bestzeit', !vr.eligible && vr.reason === 'unsupported_source');
  const no = ev(withType('running', null), 'distanceBest', { targetM: 5000 });
  ok('H3c ohne Garmin-Typ: 5-km-Bestzeit bleibt frei, Kontext null', no.eligible && no.provenance.context.environment === null, J(no.reasons));
  const tr = ev(withType('running', 'trail_running'), 'distanceBest', { targetM: 5000 });
  ok('H3d trail_running: frei', tr.eligible);
}
{
  const a = ev(withType('running', 'running'), 'distanceBest', { targetM: 5000, environment: 'outdoor' });
  ok('H4a „draussen" verlangt, Typ generisch → unverified_context', !a.eligible && a.reasons.includes('unverified_context'), J(a.reasons));
  const b = ev(withType('running', 'street_running'), 'distanceBest', { targetM: 5000, environment: 'outdoor' });
  ok('H4b „draussen" verlangt, street_running → frei', b.eligible, J(b.reasons));
  const c = ev(withType('cycling', 'virtual_ride'), 'powerBest', Object.assign({ windowS: 1200, environment: 'outdoor' }, E));
  ok('H4c Rolle zaehlt nicht als draussen', !c.eligible && c.reasons.includes('unverified_context'), J(c.reasons));
  const d = ev(withType('cycling', 'virtual_ride'), 'powerBest', Object.assign({ windowS: 1200, environment: 'virtual' }, E));
  ok('H4d virtuell verlangt, virtual_ride → frei (Beleg Leistung angenommen)', d.eligible, J(d.reasons));
  ok('H4e ohne Kontextwunsch: Rolle sperrt den Leistungs-Bestwert nicht', ev(withType('cycling', 'virtual_ride'), 'powerBest', Object.assign({ windowS: 1200 }, E)).eligible);
  ok('H4f neuer Grund ist aufgefuehrt', ME.REASONS.includes('unverified_context'));
}
{
  ok('H5a Becken ohne Typ → missing_data', ev(withType('swimming', null), 'swolf', E).reason === 'missing_data');
  ok('H5b Freiwasser → unsupported_source', ev(withType('swimming', 'open_water_swimming'), 'swolf', E).reason === 'unsupported_source');
  ok('H5c Becken → frei (mit angenommenem Beleg)', ev(withType('swimming', 'lap_swimming'), 'swolf', E).eligible);
}
{
  const g = x => ({ source: 'garmin', metrics: { garmin: x } });
  ok('H6a complete', ME.provenanceStatus(g({ type_key: 'running', start_gmt: 'a', start_local: 'b', utc_offset_s: 0 })) === 'complete');
  ok('H6b partial (nur Detail-Schluessel)', ME.provenanceStatus(g({ stream_rows: 10 })) === 'partial');
  ok('H6c unavailable (fehlend = nicht geliefert)', ME.provenanceStatus(g({ type_key: 'x', start_gmt: 'a', prov_unavailable: ['start_local', 'utc_offset_s'] })) === 'unavailable');
  ok('H6d inconsistent', ME.provenanceStatus(g({ type_key: 'x', start_gmt: 'a', start_local: 'b', utc_offset_s: 0, prov_conflicts: ['started_at'] })) === 'inconsistent');
  ok('H6e keine Garmin-Zeile → null', ME.provenanceStatus({ source: 'manual', metrics: {} }) === null);
  ok('H6f Pflichtschluessel wie im Worker', J(ME.PROVENANCE_REQUIRED) === J(['type_key', 'start_gmt', 'start_local', 'utc_offset_s']));
  const py = fs.readFileSync(new URL((_ex(new URL('../../garmin-worker/', import.meta.url)) ? '../../' : '../../../') + 'garmin-worker/orvia_worker/provenance.py', import.meta.url), 'utf8');
  ok('H6g Worker-Konstante identisch', py.includes('REQUIRED = ("type_key", "start_gmt", "start_local", "utc_offset_s")'));
}
{
  const a = withType('cycling', null); a.metrics.route = [[1, 2], [3, 4]]; a.name = 'Outdoor Ride im Park';
  ok('H7 GPS-Strecke und Titel machen keinen Kontext', ME.contextOf(a).environment === null);
}
{
  const a = ref('gym', 'prod');
  a.metrics.corrections = { duration: { manual: 4500, source: 20460, unit: 's', at: '2026-10-11T08:00:00.000Z', method: 'manual' } };
  a.durationSeconds = 4500;
  const r = ev(a, 'duration');
  ok('H8 korrigierte Kraftdauer (341 → 75 min) zaehlt mit wirksamem Wert, auch ohne Herkunft', r.eligible && r.provenance.manual === true, J(r));
}
{
  const doc = rd('docs/PERFORMANCE-DATA-ELIGIBILITY.md');
  ok('H9a Dokument = Generator', doc === GEN.render());
  ok('H9b drei Staende + Kontext + Protokoll', doc.includes('FREI NACH HERKUNFTS-BACKFILL') && doc.includes('## 10 · Kontext') && doc.includes('## 11 · Protokoll der Gates'));
  ok('H9c Befund 15.10. protokolliert', doc.includes('40 von 41 mit unvollstaendiger Herkunft'));
  ok('H9d Lauf: Max-HF heute frei, Oe-Kadenz erst nach Neupruefung', doc.includes('| running | Herzfrequenz (Max) | **FREI** |') && doc.includes('| running | Schrittfrequenz (Ø) | **FREI NACH NEUPRÜFUNG** |'));
}

console.log('\n' + (fail ? '❌' : '✅') + ' provenance_context_v4473: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

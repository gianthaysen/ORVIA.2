/* ============================================================
   ORVIA · metric_eligibility (v8-447.1) — je KENNZAHL: darf sie ins Leistungsregister?

   A  Grundregeln: vorhanden / normalisiert / belegt / gestuetzt — und immer ein Grund
   B  Lauf (einzige Sportart mit Mitschnitt): was heute zulaessig ist
   C  Alles ohne Beleg bleibt gesperrt — auch wenn der Wert da ist
   D  Aufloesung: Bestwerte nur aus „exact" / „measured"
   E  Manuelle Korrektur: wirksamer Wert, Markierung, Konflikt
   F  Belege lassen sich nicht herbeischreiben (kein „validated" ohne Nachweis)
   G  Dokument = Urteil des Moduls; Modul ist vorbereitet, nicht ausgeliefert
   node supabase/tests/metric_eligibility_v4471_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _ex } from 'node:fs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const _ROOT = _ex(new URL('../../garmin-worker/', import.meta.url)) ? '../../' : '../../../';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const J = v => JSON.stringify(v);

const GEN = await import(new URL(_APPREL + 'tools/gen-eligibility-doc.mjs', import.meta.url));
const ME = globalThis.ORVIA.metricEligibility;
const E = globalThis.ORVIA.activityEffective;
const ref = GEN.referenceActivity;
const ev = (a, m, o) => ME.evaluate(a, m, o);
const clone = o => JSON.parse(JSON.stringify(o));

sec('A · Grundregeln');
{
  for (const bad of [null, undefined, 7, 'x', [], {}, { metrics: null }]) {
    let r = null, threw = false; try { r = ev(bad, 'duration'); } catch (e) { threw = true; }
    ok('A  ' + J(bad) + ' → kein Absturz, nicht zulaessig, mit Grund', !threw && r && r.eligible === false && typeof r.reason === 'string' && r.reasons.length > 0, r && r.reason);
  }
  const u = ev(ref('running'), 'gibt_es_nicht');
  ok('A8 unbekannte Kennzahl', u.eligible === false && u.reason === 'unknown_metric');
  ok('A9 jede Antwort hat dieselbe Form', ME.METRICS.every(m => { const r = ev(ref('running'), m, { windowS: 300, targetM: 5000 }); return typeof r.eligible === 'boolean' && Array.isArray(r.reasons) && r.provenance && 'manual' in r.provenance && (r.eligible ? r.reason === null : ME.REASONS.includes(r.reason)); }));
  ok('A10 isMetricLedgerEligible = evaluate().eligible', ME.METRICS.every(m => ME.isMetricLedgerEligible(ref('running'), m, { windowS: 300, targetM: 5000 }) === ev(ref('running'), m, { windowS: 300, targetM: 5000 }).eligible));
  const a = ref('running'), before = J(a); ME.overview(a);
  ok('A11 liest nur: Eingang unveraendert', J(a) === before);
  ok('A12 nicht abgeschlossen: gesperrt', ev(Object.assign(ref('running'), { status: 'aborted' }), 'duration').reasons.includes('not_completed'));
  ok('A13 Kennzahl passt nicht zur Sportart', ev(ref('gym'), 'runningCadence').reason === 'unsupported_sport' && ev(ref('running'), 'swolf').reason === 'unsupported_sport' && ev(ref('cycling'), 'pace').reason === 'unsupported_sport');
  ok('A14 vereinbarte Kennzahlen und Gruende', ['duration', 'distance', 'pace', 'runningCadence', 'cyclingCadence', 'heartRate', 'power', 'swolf', 'strokeRate', 'ftp', 'trainingEffect'].every(m => ME.METRICS.includes(m))
    && ['missing_data', 'legacy_schema', 'unverified_semantics', 'insufficient_resolution', 'invalid_time_axis', 'unsupported_source', 'manual_override_conflict'].every(r => ME.REASONS.includes(r)));
}

sec('B · Lauf: belegt durch den Mitschnitt');
{
  const a = ref('running');
  const yes = ['duration', 'distance', 'pace', 'heartRate', 'maxHeartRate', 'runningCadence'];
  ok('B1 zulaessig: ' + yes.join(', '), yes.every(m => ev(a, m).eligible), J(yes.filter(m => !ev(a, m).eligible).map(m => [m, ev(a, m).reasons])));
  ok('B2 Strecken-Bestzeiten: alle Zieldistanzen', ME.DISTANCE_TARGETS.every(t => ev(a, 'distanceBest', { targetM: t }).eligible));
  ok('B3 Herkunft steht dabei', ev(a, 'runningCadence').provenance.basis.includes('bestaetigt gegen die vollstaendige Aufzeichnung') && ev(a, 'runningCadence').provenance.evidence['details.running_cadence'] === 'validated' && ev(a, 'runningCadence').provenance.quality === 'exact');
  /* v8-447.1 Gate-Abschluss: Ø-Schrittfrequenz erst nach Bestaetigung des Summenwerts gegen die vollstaendige Aufzeichnung */
  const noConf = ref('running'); delete noConf.metrics.garmin.semantics_ok;
  ok('B3a ohne Bestaetigung (vollstaendig geliefert, aber nicht geprueft / abweichend): unverified_semantics', ev(noConf, 'runningCadence').reason === 'unverified_semantics');
  const thinNoConf = ref('running', 'thinned');
  ok('B3b ausgeduennt und ohne Bestaetigung: insufficient_resolution (erst neu laden)', ev(thinNoConf, 'runningCadence').reason === 'insufficient_resolution');
  const badConf = ref('running'); badConf.metrics.garmin.semantics_ok = { averageRunningCadence: { reading: 'x', list: 'kaputt' } };
  ok('B3c kaputte Bestaetigung zaehlt nicht', ev(badConf, 'runningCadence').eligible === false);
  ok('B3d Herzfrequenz braucht keine solche Bestaetigung (keine Abweichung gemeldet)', ev(noConf, 'heartRate').eligible === true);
  const legacy = ref('running', 'legacy');
  ok('B4 Altzeile (Vertrag 2): Kadenz, Dauer, Distanz, Bestzeit gesperrt mit legacy_schema', ['runningCadence', 'duration', 'distance', 'heartRate'].every(m => ev(legacy, m).reason === 'legacy_schema') && ev(legacy, 'distanceBest', { targetM: 5000 }).reason === 'legacy_schema');
  const nd = ref('running'); delete nd.metrics.detailsVersion;
  ok('B5 Details nie geladen: missing_data', ev(nd, 'distance').reason === 'missing_data');

  /* gestuetzt: Liste und Aufzeichnung muessen uebereinstimmen */
  const d1 = ref('running'); d1.durationSeconds = 3700;                          // Liste sagt 3700, Aufzeichnung 3600
  ok('B6 Dauer: Liste ≠ Aufzeichnung → unverified_semantics', ev(d1, 'duration').reason === 'unverified_semantics');
  const d2 = ref('running'); d2.durationSeconds = 3603;
  ok('B7 Dauer: 3 s Abweichung ist Rundung, zulaessig', ev(d2, 'duration').eligible);
  const s1 = ref('running'); s1.summary.distanceM = 10600;
  ok('B8 Distanz: Liste ≠ Ende der Messreihe → unverified_semantics', ev(s1, 'distance').reason === 'unverified_semantics' && ev(s1, 'pace').reasons.includes('unverified_semantics'));
  const h1 = ref('running'); h1.summary.avgHr = 138;
  ok('B9 Ø-HF: Liste (138) ≠ Aufzeichnung (150) → unverified_semantics', ev(h1, 'heartRate').reason === 'unverified_semantics');
  const t1 = ref('running'); delete t1.metrics.garmin.timer_duration_s;
  ok('B10 ohne Timer-Dauer der Aufzeichnung: Dauer nicht gestuetzt → missing_data', ev(t1, 'duration').reason === 'missing_data');
  const thin = ref('running', 'thinned');
  ok('B11 ausgeduennt: Ø-Herzfrequenz zulaessig als Naeherung; Ø-Kadenz nicht (Bestaetigung fehlt)', ev(thin, 'heartRate').eligible && ev(thin, 'heartRate').provenance.quality === 'approx' && !ev(thin, 'runningCadence').eligible);
  ok('B12 ausgeduennt: Maximum ist eine Untergrenze → insufficient_resolution', ev(thin, 'maxHeartRate').reason === 'insufficient_resolution');
  const c1 = ref('running'); c1.metrics.stream_meta.cadence.kind = 'cycling_cadence_rpm';
  ok('B13 Kadenzreihe mit anderer Bedeutung: nicht als Schrittfrequenz', !ev(c1, 'runningCadence').eligible);
}

sec('C · ohne Beleg bleibt es gesperrt');
{
  const ride = ref('cycling');
  ok('C1 Rad, bester Fall: Trittfrequenz, Leistung, Bestwert → unverified_semantics (kein Rad-Mitschnitt)', ['cyclingCadence', 'power'].every(m => ev(ride, m).reason === 'unverified_semantics') && ev(ride, 'powerBest', { windowS: 300 }).reason === 'unverified_semantics');
  ok('C2 Rad: auch Dauer und Distanz — die Detailreihen sind nur fuer den Lauf belegt', ev(ride, 'duration').reason === 'unverified_semantics' && ev(ride, 'distance').reason === 'unverified_semantics');
  const withEv = { evidence: { 'details.power': { cycling: 'fixture' }, 'details.time': { cycling: 'fixture' }, 'details.cycling_cadence': { cycling: 'validated' }, 'details.durations': { cycling: 'fixture' }, 'details.distance': { cycling: 'fixture' } } };
  ok('C3 MIT Beleg wird derselbe Wert zulaessig (die Sperre haengt am Beleg, nicht am Wert)', ev(ride, 'power', withEv).eligible && ev(ride, 'cyclingCadence', withEv).eligible && ev(ride, 'powerBest', Object.assign({ windowS: 300 }, withEv)).eligible && ev(ride, 'duration', withEv).eligible);
  ok('C4 „observed" (im Zensus geliefert) reicht NICHT', ev(ride, 'power', { evidence: { 'details.power': { cycling: 'observed' } } }).reason === 'unverified_semantics' && ev(ride, 'power', { evidence: { 'details.power': { cycling: 'library' } } }).reason === 'unverified_semantics');
  const swim = ref('swimming');
  ok('C5 Schwimmen: SWOLF, Zugfrequenz, Distanz → unverified_semantics', ['swolf', 'strokeRate', 'distance'].every(m => ev(swim, m).reason === 'unverified_semantics'));
  const ow = ref('swimming'); ow.metrics.garmin.type_key = 'open_water_swimming';
  ok('C6 Freiwasser: SWOLF gibt es nicht → unsupported_source', ev(ow, 'swolf').reason === 'unsupported_source');
  const np = ref('swimming'); delete np.metrics.ext.fields.poolLength;
  ok('C7 Becken ohne Bahnlaenge: missing_data', ev(np, 'swolf').reason === 'missing_data');
  const noext = ref('swimming'); delete noext.metrics.ext;
  ok('C8 ohne Rohblock (lokaler Speicher): missing_data, kein Ersatz', ev(noext, 'swolf').reason === 'missing_data' && ev(noext, 'trainingEffect').reason === 'missing_data');
  ok('C9 Training Effect, Kalorien: nur Bibliothek → unverified_semantics', ev(ref('running'), 'trainingEffect').reason === 'unverified_semantics' && ev(ref('running'), 'calories').reason === 'unverified_semantics');
  ok('C10 FTP ist keine Aktivitaets-Kennzahl → unsupported_source', ev(ref('cycling'), 'ftp').reason === 'unsupported_source');
  ok('C11 Kraft von Garmin: Volumen-Einheit unbelegt', ev(ref('gym'), 'strengthVolume').reason === 'unverified_semantics');
}

sec('D · Aufloesung');
{
  const E2 = { evidence: { 'details.power': { cycling: 'fixture' }, 'details.time': { cycling: 'fixture' } } };
  const thin = ref('cycling', 'thinned');
  ok('D1 ausgeduennte Lieferung: KEIN Leistungs-Bestwert, auch mit Beleg', ME.POWER_WINDOWS.every(w => ev(thin, 'powerBest', Object.assign({ windowS: w }, E2)).reason === 'insufficient_resolution'));
  const full = ref('cycling');
  ok('D2 vollstaendige, sekuendliche Lieferung + Beleg: alle Fenster zulaessig', ME.POWER_WINDOWS.every(w => ev(full, 'powerBest', Object.assign({ windowS: w }, E2)).eligible));
  const ins = ref('cycling'); ins.metrics.best_efforts.power.windows['5'] = { q: 'insufficient' }; ins.metrics.best_efforts.power.windows['3600'] = { q: 'too_short' };
  ok('D3 Fenster ohne Zahl: insufficient → insufficient_resolution, too_short → missing_data', ev(ins, 'powerBest', Object.assign({ windowS: 5 }, E2)).reason === 'insufficient_resolution' && ev(ins, 'powerBest', Object.assign({ windowS: 3600 }, E2)).reason === 'missing_data');
  const miss = ref('cycling'); miss.metrics.best_efforts.power.windows['60'].miss_s = 4;
  ok('D4 Sensor-Aussetzer im Fenster: Untergrenze, kein Rekord → missing_data', ev(miss, 'powerBest', Object.assign({ windowS: 60 }, E2)).reason === 'missing_data');
  const gap = ref('cycling'); gap.metrics.best_efforts.power.windows['1200'].gap_s = 120;
  ok('D5 Pause im Fenster ist erlaubt (sie zaehlt als Zeit mit 0 W)', ev(gap, 'powerBest', Object.assign({ windowS: 1200 }, E2)).eligible);
  const mov = ref('cycling'); mov.metrics.best_efforts.power.basis = 'moving';
  ok('D6 Bestwert nicht auf verstrichener Zeit → invalid_time_axis', ev(mov, 'powerBest', Object.assign({ windowS: 300 }, E2)).reasons.includes('invalid_time_axis'));
  ok('D7 kein vereinbartes Fenster → unknown_metric', ev(full, 'powerBest', Object.assign({ windowS: 7 }, E2)).reason === 'unknown_metric' && ev(ref('running'), 'distanceBest', { targetM: 1234 }).reason === 'unknown_metric');
  const coarse = ref('running'); coarse.metrics.best_efforts.distance.targets['400'] = { s: 100, over_m: 100, at: 0, q: 'coarse' };
  ok('D8 Strecke: grober Ueberhang → insufficient_resolution; too_short → missing_data', ev(coarse, 'distanceBest', { targetM: 400 }).reason === 'insufficient_resolution' && (() => { const x = ref('running'); x.metrics.best_efforts.distance.targets['42195'] = { q: 'too_short' }; return ev(x, 'distanceBest', { targetM: 42195 }).reason === 'missing_data'; })());
  ok('D9 Fenster und Distanzen = die des Workers', J(ME.POWER_WINDOWS) === J([1, 5, 10, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600]) && J(ME.DISTANCE_TARGETS) === J([400, 1000, 5000, 10000, 21098, 42195]));
}

sec('E · Manuelle Korrektur');
{
  const SRC = 341 * 60, MAN = 75 * 60;
  const w = { id: 'w1', clientRecordId: 'c1', sportId: 'gym', source: 'orvia_workout', status: 'completed', durationSeconds: SRC, summary: { totalVolumeKg: 8400 }, metrics: {} };
  const r0 = ev(w, 'duration');
  ok('E1 ORVIA-Workout: Dauer zulaessig (eigene Daten), nicht manuell', r0.eligible && r0.provenance.manual === false && r0.provenance.evidence.own === 'own');
  const corr = E.setManual(w, 'duration', MAN, { at: '2026-10-06T10:00:00.000Z' }).activity;
  const r1 = ev(corr, 'duration');
  ok('E2 341 min → 75 min: wirksamer Wert zulaessig UND als manuell markiert', r1.eligible && r1.provenance.manual === true && corr.durationSeconds === MAN && /corrections/.test(r1.provenance.basis));
  ok('E3 die Quelle bleibt erhalten (341 min)', E.resolveMetric(corr, 'duration').sourceValue === SRC);
  ok('E4 Kraft-Volumen des ORVIA-Workouts: zulaessig', ev(w, 'strengthVolume').eligible && ev(Object.assign({}, w, { summary: {} }), 'strengthVolume').reason === 'missing_data');

  /* Garmin-Lauf mit korrigierter Dauer: kuerzer als die Bestzeit aus der Aufzeichnung → Konflikt */
  const run = ref('running');
  const short = E.setManual(run, 'duration', 600, { at: '2026-10-06T10:00:00.000Z' }).activity;       // 10 min
  const rb = ev(short, 'distanceBest', { targetM: 5000 });                                             // Bestzeit 1500 s > 600 s
  ok('E5 Bestzeit laenger als die korrigierte Dauer → manual_override_conflict', rb.eligible === false && rb.reasons.includes('manual_override_conflict') && rb.provenance.manual === true, J(rb.reasons));
  ok('E6 … kuerzere Bestzeit (400 m in 120 s) bleibt zulaessig', ev(short, 'distanceBest', { targetM: 400 }).eligible);
  ok('E7 korrigierte Dauer eines Garmin-Laufs: zulaessig, markiert, ohne Abgleich mit der Aufzeichnung', ev(short, 'duration').eligible && ev(short, 'duration').provenance.manual && ev(short, 'pace').provenance.manual === true);
  const man = ref('running', 'own');
  ok('E8 manuell eingegebene Einheit: Dauer/Distanz/Tempo zulaessig, Bestwerte nicht (keine Aufzeichnung)', ['duration', 'distance', 'pace'].every(m => ev(man, m).eligible) && ev(man, 'distanceBest', { targetM: 5000 }).reason === 'unsupported_source' && ev(man, 'runningCadence').reason === 'unsupported_source');
}

sec('F · Belege lassen sich nicht herbeischreiben');
{
  const trusted = new Set(ME.TRUSTED);
  ok('F1 zulaessig machen nur fixture / validated / own', J([...trusted].sort()) === J(['fixture', 'own', 'validated']));
  const claims = [];
  for (const [key, per] of Object.entries(ME.EVIDENCE)) for (const [sport, lvl] of Object.entries(per)) claims.push({ key, sport, lvl });
  const validated = claims.filter(c => c.lvl === 'validated');
  ok('F2 jedes „validated" hat einen Nachweis mit Datum (VALIDATIONS)', validated.every(c => { const v = ME.VALIDATIONS[c.key + '|' + c.sport]; return v && /^\d{4}-\d{2}-\d{2}$/.test(v.date || '') && typeof v.how === 'string' && v.how.length > 10; }), J(validated));
  /* „fixture" nur fuer Sportarten, zu denen ein Mitschnitt im Repo liegt */
  const capDir = new URL(_ROOT + 'garmin-worker/tests/fixtures/garmin/captures/', import.meta.url);
  const runFix = new URL(_ROOT + 'garmin-worker/tests/fixtures/garmin/activity_details.json', import.meta.url);
  if (_ex(runFix)) {
    const have = new Set(['running']);
    if (_ex(capDir)) for (const f of fs.readdirSync(capDir)) { const m = /^([a-z_]+)__.*\.json$/.exec(f); if (m) have.add(m[1]); }
    const fixtureClaims = claims.filter(c => c.lvl === 'fixture');
    ok('F3 jedes „fixture" gehoert zu einer Sportart mit Mitschnitt im Repo (' + [...have].join(', ') + ')', fixtureClaims.length >= 4 && fixtureClaims.every(c => have.has(c.sport)), J(fixtureClaims.filter(c => !have.has(c.sport))));
    const fix = JSON.parse(fs.readFileSync(runFix, 'utf8'));
    const keys = new Set(fix.metricDescriptors.map(m => m.key));
    ok('F4 der Lauf-Mitschnitt traegt genau die Reihen, auf die sich die Lauf-Belege stuetzen', ['directTimestamp', 'sumDistance', 'directHeartRate', 'directDoubleCadence', 'sumDuration', 'sumMovingDuration', 'sumElapsedDuration'].every(k => keys.has(k)) && !keys.has('directPower'));
  } else console.log('⏭️  F3/F4 uebersprungen — Worker-Fixtures liegen in dieser Umgebung nicht vor');
  ok('F5 „*": fixture / validated ist verboten (ein Beleg gilt je Sportart)', claims.every(c => c.sport !== '*' || !['fixture', 'validated'].includes(c.lvl)));
  const dsPath = new URL(_ROOT + 'garmin-worker/orvia_worker/detail_sync.py', import.meta.url);
  const bePath = new URL(_ROOT + 'garmin-worker/orvia_worker/best_efforts.py', import.meta.url);
  if (_ex(dsPath) && _ex(bePath)) {
    const ver = /DETAILS_CONTRACT_VERSION = (\d+)/.exec(fs.readFileSync(dsPath, 'utf8'));
    const be = fs.readFileSync(bePath, 'utf8');
    const win = /POWER_WINDOWS_S = \(([^)]*)\)/.exec(be)[1].split(',').map(s => Number(s.trim())).filter(n => n > 0);
    const tg = /DISTANCE_TARGETS_M = \(([^)]*)\)/.exec(be)[1].split(',').map(s => Math.round(Number(s.trim()))).filter(n => n > 0);
    ok('F6 Gleichstand mit dem Worker: Details-Vertrag, Fenster, Zieldistanzen', Number(ver[1]) === ME.DETAILS_VERSION_CURRENT && J(win) === J(ME.POWER_WINDOWS) && J(tg) === J(ME.DISTANCE_TARGETS), J({ win, tg }));
  }
}

sec('G · Dokument und Auslieferung');
{
  const doc = rd('docs/PERFORMANCE-DATA-ELIGIBILITY.md');
  ok('G1 PERFORMANCE-DATA-ELIGIBILITY.md = Ausgabe des Generators', doc === GEN.render());
  ok('G2 Spalten wie vereinbart', doc.includes('| sport | metric | source | observed? | normalized? | quality conditions | manual override behavior | ledger eligible? | reason | historical backfill safe? | notes |'));
  ok('G3 das Dokument behauptet keine Zulaessigkeit, die das Modul nicht gibt', (() => {
    const rows = doc.split('\n').filter(l => /^\| (running|cycling|swimming|gym|walking|hiking|rowing) \|/.test(l) && l.split('|').length > 11);
    return rows.length > 40 && rows.filter(l => l.includes('| **ja** |')).every(l => l.startsWith('| running |'));
  })());
  const html = rd('index.html'), sw = rd('sw.js');
  ok('G4 v8-448B: Modul ausgeliefert (index.html + Offline-Speicher) — genutzt nur vom Leistungsregister hinter dem Flag performance_ledger', html.includes('js/engine/metric-eligibility.js') && sw.includes('./js/engine/metric-eligibility.js'));
  const src = rd('js/engine/metric-eligibility.js').replace(/\/\*[\s\S]*?\*\//g, '');
  ok('G5 rein: kein DOM, kein Speicher, kein Netz', !/document\.|localStorage|fetch\(|XMLHttpRequest/.test(src));
  ok('G6 Build v8-448 (Leistungsregister eingebunden, Flag aus)', /const C = 'orvia-v8-448'/.test(sw));
}

console.log('\n' + (fail ? '❌' : '✅') + ' metric_eligibility_v4471: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

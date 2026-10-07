/* ============================================================
   ORVIA · activity_capabilities (v8-447, Commit C)
   Welche Daten eine Aktivitaet traegt — gelesen, nie erfunden.

   A  robust: leer, kaputt, fremde Formen
   B  je Sportart: Gruppen entstehen genau dann, wenn das Feld geliefert wurde
   C  ohne Rohblock (lokaler Speicher, kein Netz): was dann noch da ist
   D  Tor fuer festgeschriebene Auswertungen (Leistungsregister ab v8-448)
   E  Gleichstand mit dem Worker: Feldnamen, Reihennamen, Details-Version
   F  Verdrahtung
   node supabase/tests/activity_capabilities_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _exApp } from 'node:fs';
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const _ROOT = _exApp(new URL('../../garmin-worker/', import.meta.url)) ? '../../' : '../../../';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const J = v => JSON.stringify(v);
globalThis.window = globalThis; globalThis.ORVIA = {};
const imp = async f => (await import(new URL(_APPREL + f, import.meta.url))).default;
await imp('js/activity-streams.js');
const CAP = await imp('js/activity-capabilities.js');
const avail = c => Object.keys(c.groups).filter(k => c.groups[k].available).sort();

const T = [0, 60, 125, 190, 250, 320];
const run = (over) => Object.assign({ id: 'r1', sportId: 'running', source: 'garmin', status: 'completed', durationSeconds: 3475, metrics: {
  detailsVersion: 3, training_load: 148, route: [[0, 0], [1, 1], [2, 2]],
  streams: { time: T, distance: [0, 200, 420, 640, 850, 1100], heart_rate: [120, 140, 150, 152, 155, 158], speed: [3, 3, 3, 3, 3, 3], elevation: [10, 11, 12, 12, 11, 10], cadence: [160, 162, 163, 161, 164, 165] },
  stream_meta: { cadence: { kind: 'running_cadence_spm', unit: 'spm', source: 'directDoubleCadence' }, time: { kind: 'elapsed_s', unit: 's', source: 'directTimestamp' } },
  garmin: { v: 1, type_key: 'trail_running', start_local: '2026-07-12T08:30:00', moving_duration_s: 3301, elapsed_duration_s: 3620.5, stream_rows: 1855, stream_kept: 6 },
  ext: { v: 1, fields: { movingDuration: 3300.0, aerobicTrainingEffect: 3.4, anaerobicTrainingEffect: 0.8, trainingEffectLabel: 'TEMPO', hrTimeInZone_2: 900.5, hrTimeInZone_3: 1500,
      averageRunningCadenceInStepsPerMinute: 161.4, avgGroundContactTime: 248 },
    series: { directGroundContactTime: { values: [245, 246, 247, 248, 249, 250], garmin_unit: 'ms' } }, unrecognized: ['hasPolyline', 'pr'] } } }, over || {});

sec('A · robust');
{
  for (const bad of [null, undefined, 7, 'x', [], {}, { metrics: null }, { metrics: [] }, { metrics: { streams: 'x', ext: 7, garmin: [], splits: {} } }]) {
    let c = null, threw = false; try { c = CAP.of(bad); } catch (e) { threw = true; }
    ok('A  ' + J(bad) + ' → keine Ausnahme, nichts verfuegbar', !threw && c && avail(c).length === 0 && c.extLoaded === false && c.garminType === null, c ? J(avail(c)) : 'threw');
  }
  ok('A10 has() auf Unsinn ist false', CAP.has(null, 'power') === false && CAP.has({}, 'gibt_es_nicht') === false);
  const a = run(), before = J(a); CAP.of(a); CAP.ledgerEligible(a, ['cadence']);
  ok('A11 liest nur: das Eingangsobjekt bleibt unveraendert', J(a) === before);
}

sec('B · Gruppen entstehen nur aus gelieferten Feldern');
{
  const c = CAP.of(run());
  ok('B1 Lauf: Messreihen, Zeitachse, Strecke, Kadenz', ['cadence', 'distance_series', 'elevation', 'heart_rate', 'route', 'speed', 'time_axis'].every(k => c.groups[k].available), J(avail(c)));
  ok('B2 Kadenz traegt ihre Bedeutung', c.groups.cadence.kind === 'running_cadence_spm' && c.groups.cadence.unit === 'spm' && c.groups.cadence.status === 'ok');
  ok('B3 Bewegungszeit aus der Aufzeichnung hat Vorrang vor dem Listeneintrag', c.groups.moving_time.seconds === 3301 && c.groups.moving_time.source === 'garmin.moving_duration_s' && c.groups.elapsed_time.seconds === 3620.5);
  ok('B4 Trainingseffekt: Rohwerte unter Garmin-Namen', J(c.groups.training_effect.values) === J({ aerobicTrainingEffect: 3.4, anaerobicTrainingEffect: 0.8, trainingEffectLabel: 'TEMPO' }));
  ok('B5 HF-Zonen: nur die gelieferten Zonen, Rohwert ungerundet', J(c.groups.hr_zones.values) === J({ hrTimeInZone_2: 900.5, hrTimeInZone_3: 1500 }));
  ok('B6 Laufdynamik: Kennwerte + Reihen', c.groups.running_dynamics.available && c.groups.running_dynamics.values.avgGroundContactTime === 248 && J(c.groups.running_dynamics.series) === J(['directGroundContactTime']));
  ok('B7 nichts erfunden: keine Leistung, keine Runden, kein Schwimmen, keine Kraft', !c.groups.power.available && !c.groups.power_summary.available && !c.groups.laps.available && !c.groups.swim.available && !c.groups.strength.available && !c.groups.power_zones.available);
  ok('B8 Luecken-Liste nennt genau das fuer die Sportart Erwartbare, das fehlt', J(c.missing) === J(['laps']), J(c.missing));
  ok('B9 Garmin-Typ, Abtastung, Rohblock-Bericht', c.garminType === 'trail_running' && J(c.sampling) === J({ rows: 1855, kept: 6, total: null }) && c.raw.fields === 8 && c.raw.series === 1 && J(c.raw.unrecognized) === J(['hasPolyline', 'pr']));

  const ride = CAP.of({ sportId: 'cycling', source: 'garmin', metrics: { detailsVersion: 3,
    streams: { time: T, power: [200, 210, 220, 215, 205, 190], cadence: [90, 92, 93, 91, 92, 94] }, stream_meta: { cadence: { kind: 'cycling_cadence_rpm', unit: 'rpm' } },
    ext: { v: 1, fields: { avgPower: 212, normPower: 228, averageBikingCadenceInRevPerMinute: 92, powerTimeInZone_3: 1200 }, series: { directLeftBalance: { values: [49, 50, 51] } } } } });
  ok('B10 Rad: Leistung (Reihe + Kennwerte), Zonen, Trittfrequenz in rpm', ride.groups.power.available && ride.groups.power_summary.values.normPower === 228 && ride.groups.power_zones.available && ride.groups.cadence.kind === 'cycling_cadence_rpm' && ride.groups.cycling_summary.values.averageBikingCadenceInRevPerMinute === 92 && J(ride.groups.cycling_summary.series) === J(['directLeftBalance']));
  ok('B11 Rad: Laufdynamik entsteht nicht', !ride.groups.running_dynamics.available);

  const swim = CAP.of({ sportId: 'swimming', source: 'garmin', metrics: { detailsVersion: 3, garmin: { type_key: 'lap_swimming' },
    ext: { v: 1, fields: { poolLength: 25, unitOfPoolLength: 'meter', activeLengths: 40, averageSwolf: 38, averageSwimCadenceInStrokesPerMinute: 27 }, typed_splits: { splits: [{ distance: 100 }] } } } });
  ok('B12 Schwimmen: Bahn, Bahnen, SWOLF, Zugfrequenz — eigene Felder', swim.groups.swim.available && swim.groups.swim.values.poolLength === 25 && swim.groups.swim.values.unitOfPoolLength === 'meter' && swim.groups.swim.values.averageSwimCadenceInStrokesPerMinute === 27 && swim.garminType === 'lap_swimming');
  ok('B13 Schwimmen: keine Kadenz-Gruppe aus Zuegen, keine Strecke', !swim.groups.cadence.available && !swim.groups.route.available);

  const gym = CAP.of({ sportId: 'gym', source: 'garmin', metrics: { detailsVersion: 3, ext: { v: 1, fields: { totalSets: 18, activeSets: 15, totalReps: 142 },
    list: { summarizedExerciseSets: [{ category: 'BENCH_PRESS', reps: 24, sets: 3 }] }, extras: { exercise_sets: 'failed' } } } });
  ok('B14 Kraft: Saetze / Wiederholungen aus dem Listeneintrag', gym.groups.strength.available && gym.groups.strength.values.totalSets === 18 && gym.groups.strength.summarized === 1 && gym.groups.strength.sets === false && gym.raw.extras.exercise_sets === 'failed');

  const laps = CAP.of(run({ metrics: Object.assign({}, run().metrics, { splits: [{ distance: 1000, duration: 300 }, { distance: 1000, duration: 295 }] }) }));
  ok('B15 Runden: schlanke Form', laps.groups.laps.available && laps.groups.laps.count === 2 && laps.groups.laps.source === 'splits' && laps.missing.length === 0);
  const zeros = CAP.of({ sportId: 'running', metrics: { streams: { heart_rate: [null, null], power: [] }, ext: { v: 1, fields: { aerobicTrainingEffect: null, avgPower: '' } } } });
  ok('B16 leere Reihen und leere Felder zaehlen nicht', !zeros.groups.heart_rate.available && !zeros.groups.power.available && !zeros.groups.training_effect.available && !zeros.groups.power_summary.available);
  ok('B17 0 ist ein Messwert (z. B. anaerober Effekt 0.0)', CAP.of({ metrics: { ext: { fields: { anaerobicTrainingEffect: 0 } } } }).groups.training_effect.values.anaerobicTrainingEffect === 0);
}

sec('C · ohne Rohblock (lokaler Speicher)');
{
  const local = run(); delete local.metrics.ext;
  const c = CAP.of(local);
  ok('C1 extLoaded false, kein raw-Bericht', c.extLoaded === false && c.raw === null);
  ok('C2 Messreihen, Zeitachse, Bewegungszeit, Garmin-Typ bleiben (kleiner Herkunftsblock)', c.groups.time_axis.available && c.groups.cadence.available && c.groups.moving_time.seconds === 3301 && c.garminType === 'trail_running');
  ok('C3 Gruppen aus dem Rohblock fehlen — ohne erfundenen Ersatz', !c.groups.training_effect.available && !c.groups.hr_zones.available && !c.groups.running_dynamics.available);
  const listOnly = CAP.of({ sportId: 'running', source: 'garmin', metrics: { ext: { v: 1, fields: { movingDuration: 3300.0 } } } });
  ok('C4 ohne Details: Bewegungszeit aus dem Listeneintrag, mit ihrer Quelle', listOnly.groups.moving_time.seconds === 3300 && listOnly.groups.moving_time.source === 'ext.fields.movingDuration');
}

sec('D · Tor fuer festgeschriebene Auswertungen');
{
  ok('D1 Garmin, Details-Version 3, alles da → zulaessig', J(CAP.ledgerEligible(run(), ['time_axis', 'distance_series', 'cadence'])) === J({ eligible: true, reasons: [] }));
  const v2 = run(); v2.metrics.detailsVersion = 2; delete v2.metrics.stream_meta; delete v2.metrics.streams.time;
  const r2 = CAP.ledgerEligible(v2, ['time_axis', 'cadence']);
  ok('D2 Altzeile (Version 2): gesperrt — veraltet, Kadenz unbelegt, keine Zeitachse', !r2.eligible && r2.reasons.includes('details_outdated') && r2.reasons.includes('cadence_unverified') && r2.reasons.includes('missing:time_axis') && r2.reasons.includes('missing:cadence'), J(r2.reasons));
  const nd = run(); delete nd.metrics.detailsVersion;
  ok('D3 Garmin ohne geladene Details: gesperrt', CAP.ledgerEligible(nd, []).reasons[0] === 'details_not_loaded');
  ok('D4 fehlende Gruppe sperrt nur die Auswertung, die sie braucht', CAP.ledgerEligible(run(), ['power']).eligible === false && CAP.ledgerEligible(run(), []).eligible === true);
  ok('D5 nicht abgeschlossen: gesperrt', CAP.ledgerEligible(run({ status: 'aborted' }), []).reasons.includes('not_completed'));
  ok('D6 eigene Einheit (kein Garmin) ohne Bedarf: zulaessig — die Details-Version gilt nur fuer Garmin', CAP.ledgerEligible({ sportId: 'gym', source: 'orvia_workout', status: 'completed', metrics: {} }, []).eligible === true);
  const back = run(); back.metrics.streams.time = [0, 60, 50, 190, 250, 320];
  ok('D7 Zeitachse laeuft rueckwaerts: gesperrt', CAP.ledgerEligible(back, []).reasons.includes('time_axis_not_monotonic'));
  ok('D8 nie eine Ausnahme', J(CAP.ledgerEligible(null)) === J({ eligible: true, reasons: [] }) && Array.isArray(CAP.ledgerEligible(7, 'x').reasons));
}

sec('E · Gleichstand mit dem Worker');
{
  const gfPath = new URL(_ROOT + 'garmin-worker/orvia_worker/garmin_fields.py', import.meta.url);
  const dsPath = new URL(_ROOT + 'garmin-worker/orvia_worker/detail_sync.py', import.meta.url);
  if (!_exApp(gfPath)) { console.log('⏭️  E uebersprungen — Worker-Quelltext liegt in dieser Umgebung nicht vor'); }
  else {
    const gf = fs.readFileSync(gfPath, 'utf8');
    const iSeries = gf.indexOf('SERIES_KNOWN: list[dict]');
    const keysOf = txt => new Set([...txt.matchAll(/_f\("([A-Za-z0-9_]+)"/g)].map(m => m[1]));
    const known = keysOf(gf.slice(0, iSeries)), seriesKnown = keysOf(gf.slice(iSeries));
    const usedF = [].concat(...Object.values(CAP.FIELDS)), usedS = [].concat(...Object.values(CAP.SERIES));
    ok('E1 jeder hier benutzte Feldname steht in der Erlaubnisliste des Workers (' + usedF.length + ')', known.size > 50 && usedF.every(k => known.has(k)), J(usedF.filter(k => !known.has(k))));
    ok('E2 jeder hier benutzte Reihenname steht in SERIES_KNOWN (' + usedS.length + ')', seriesKnown.size >= 15 && usedS.every(k => seriesKnown.has(k)), J(usedS.filter(k => !seriesKnown.has(k))));
    const ver = /DETAILS_CONTRACT_VERSION = (\d+)/.exec(fs.readFileSync(dsPath, 'utf8'));
    ok('E3 Details-Version gleich der des Workers', ver && Number(ver[1]) === CAP.DETAILS_VERSION_CURRENT, ver && ver[1]);
  }
  {
    const npPath = new URL(_ROOT + 'garmin-worker/orvia_worker/normalize.py', import.meta.url);
    if (_exApp(npPath)) {
      const np = fs.readFileSync(npPath, 'utf8');
      const a = np.indexOf('SPORT_MAP: dict[str, str] = {'), b = np.indexOf('\n}\n', a);
      const pairs = [...np.slice(a, b).matchAll(/^\s*"([a-z0-9_]+)":\s*"([a-z_]+)",/gm)].map(m => [m[1], m[2]]);
      await imp('js/training-domain.js');
      const TD = globalThis.ORVIA.trainingDomain || (await imp('js/training-domain.js'));
      const cat = (TD.ACTIVITY_SPORTS || []).map(x => (x && x.id) || x);
      const targets = new Set(pairs.map(p => p[1]));
      const unreached = cat.filter(x => !targets.has(x)).sort();
      ok('E5 Garmin-Typen des Workers zeigen nur auf Katalog-Sportarten (' + pairs.length + ' Typen → ' + targets.size + ' Sportarten)', pairs.length >= 50 && cat.length === 24 && [...targets].every(t => cat.includes(t) && t !== 'other'), J([...targets].filter(t => !cat.includes(t))));
      ok('E6 ohne eigenen Garmin-Typ sind genau: athletics, other', J(unreached) === J(['athletics', 'other']), J(unreached));
    }
  }
  ok('E4 Erwartungsliste nur fuer Katalog-Sportarten und nur bekannte Gruppen', (() => {
    const T2 = fs.readFileSync(new URL(_APPREL + 'js/training-domain.js', import.meta.url), 'utf8');
    const g = Object.keys(CAP.of({}).groups);
    return Object.keys(CAP.EXPECT).every(s => T2.indexOf("'" + s + "'") >= 0) && Object.values(CAP.EXPECT).every(l => l.every(k => g.includes(k))) && CAP.BASE.every(k => g.includes(k));
  })());
}

sec('F · Verdrahtung');
{
  const html = rd('index.html'), sw = rd('sw.js');
  const iS = html.indexOf('js/activity-streams.js'), iC = html.indexOf('js/activity-capabilities.js');
  ok('F1 Skript eingebunden, genau einmal, nach activity-streams (wird erst zur Laufzeit gelesen)', iS > 0 && iC > iS && html.split('js/activity-capabilities.js').length === 2);
  ok('F2 im Offline-Zwischenspeicher', sw.indexOf("'./js/activity-capabilities.js'") > 0);
  const src = rd('js/activity-capabilities.js');
  ok('F3 rein: kein DOM, kein Speicher, kein Netz', !/document\.|localStorage|fetch\(|XMLHttpRequest/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')));
}

console.log('\n' + (fail ? '❌' : '✅') + ' activity_capabilities: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

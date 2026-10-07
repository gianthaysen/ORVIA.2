/* ============================================================
   ORVIA · data_integrity_v447 — Kadenz, Uhrzeit, Sportarten
   ------------------------------------------------------------
   Gians Auftrag 7.10. („Data Integrity & Garmin Foundation"): erst die Wahrheitsschicht,
   dann Rekorde. Drei Fehler, die sonst in jede spaetere Auswertung einfliessen:

     A  Kadenz    Laufkadenz wurde halbiert angezeigt (≈ 80 statt ≈ 161 spm), weil der Import
                  die Frequenz EINES Beins gelesen hat. Die Oberflaeche liest die Bedeutung
                  einer Messreihe jetzt an einer Stelle und rechnet nichts um.
     B  Sport     Acht der 24 Katalog-Sportarten fielen auf 'other'.
     C  Zeit      Uhrzeit und Datum wurden aus dem UTC-Text geschnitten.

   Der Worker-Teil (Python) hat eigene Tests: garmin-worker/tests/test_v447_integrity.py
   node supabase/tests/data_integrity_v447_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _exApp } from 'node:fs';
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
const rdRoot = f => fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const J = v => JSON.stringify(v);

globalThis.window = globalThis; globalThis.ORVIA = {};
const imp = async f => (await import(new URL(_APPREL + f, import.meta.url))).default;
await imp('js/training-domain.js'); const TD = globalThis.ORVIA.trainingDomain;
const SL = await imp('js/onboarding/onboarding-sports-logic.js'); globalThis.ORVIA.onboardingSportsLogic = SL;
const AN = await imp('js/activity-normalize.js');
const AC = await imp('js/activity-config.js');
const AS = await imp('js/activity-streams.js');
const AT = await imp('js/activity-time.js');
const CAT = SL.SPORT_CATALOG, IDS = CAT.map(s => s.id);

sec('A · Kadenz');
{
  const ser = (n, v) => Array.from({ length: n }, (_, i) => v + (i % 3) - 1);
  /* Einheit, wie der Worker sie seit Details-Version 3 schreibt */
  const runNew = { id: 'r1', sportId: 'running', source: 'garmin', metrics: { detailsVersion: 3, streams: { cadence: ser(60, 161), heart_rate: ser(60, 150) }, stream_units: { cadence: 'spm' },
    stream_meta: { cadence: { kind: 'running_cadence_spm', unit: 'spm', source: 'directDoubleCadence', garmin_unit: 'stepsPerMinute' } } } };
  const c1 = AS.cadence(runNew);
  ok('A1 Lauf mit beschriebener Messreihe: 161 spm bleibt 161 spm — keine Umrechnung', c1.status === 'ok' && c1.kind === 'running_cadence_spm' && c1.unit === 'spm' && c1.avg === 161 && c1.max === 162 && c1.source === 'directDoubleCadence' && c1.values === runNew.metrics.streams.cadence);
  /* Altimport: derselbe Lauf, wie er bis v8-446 gespeichert wurde (eine Bein-Frequenz, als spm beschriftet) */
  const runOld = { id: 'r0', sportId: 'running', source: 'garmin', metrics: { detailsVersion: 2, streams: { cadence: ser(60, 80) }, stream_units: { cadence: 'spm' } } };
  const c0 = AS.cadence(runOld);
  ok('A2 Altimport (Garmin, „spm", ohne Beschreibung): Bedeutung nicht gesichert ⇒ KEIN Wert — weder 80 noch ein verdoppelter', c0.status === 'unverified' && c0.avg === null && c0.values === null && c0.reason === 'legacy_garmin_import' && c0.legacy === true);
  ok('A3 der gespeicherte Altwert wird nicht veraendert', J(runOld.metrics.streams.cadence.slice(0, 3)) === J([79, 80, 81]));
  const rideNew = { id: 'b1', sportId: 'cycling', source: 'garmin', metrics: { streams: { cadence: ser(60, 92) }, stream_units: { cadence: 'rpm' }, stream_meta: { cadence: { kind: 'cycling_cadence_rpm', unit: 'rpm', source: 'directBikeCadence' } } } };
  const rideOld = { id: 'b0', sportId: 'cycling', source: 'garmin', metrics: { detailsVersion: 2, streams: { cadence: ser(60, 92) }, stream_units: { cadence: 'rpm' } } };
  ok('A4 Rad: 92 rpm bleibt 92 rpm — neu und im Altbestand (dort hatte der Import die Rad-Messreihe gewaehlt: Einheit rpm)', AS.cadence(rideNew).avg === 92 && AS.cadence(rideNew).kind === 'cycling_cadence_rpm' && AS.cadence(rideOld).status === 'ok' && AS.cadence(rideOld).avg === 92 && AS.cadence(rideOld).kind === 'cycling_cadence_rpm');
  const rideOdd = { id: 'b2', sportId: 'cycling', source: 'garmin', metrics: { streams: { cadence: ser(60, 80) }, stream_units: { cadence: 'spm' } } };
  ok('A5 keine Sportart-Vermutung bei Garmin-Altbestand: Rad-Einheit mit „spm"-Reihe gilt als ungesichert, nicht als Trittfrequenz', AS.cadence(rideOdd).status === 'unverified');
  const swim = { id: 's1', sportId: 'swimming', source: 'garmin', metrics: { streams: { cadence: ser(40, 28) }, stream_meta: { cadence: { kind: 'swim_stroke_rate', unit: 'spm', source: 'x' } } } };
  const row = { id: 'w1', sportId: 'rowing', source: 'garmin', metrics: { streams: { cadence: ser(40, 24) }, stream_meta: { cadence: { kind: 'rowing_stroke_rate', unit: 'spm', source: 'x' } } } };
  ok('A6 vier Bedeutungen sind benannt und bleiben getrennt (Schritte, Umdrehungen, Zuege, Schlaege)', J(AS.KINDS) === J(['running_cadence_spm', 'cycling_cadence_rpm', 'swim_stroke_rate', 'rowing_stroke_rate']) && AS.cadence(swim).kind === 'swim_stroke_rate' && AS.cadence(row).kind === 'rowing_stroke_rate');
  const fileRun = { id: 'f1', sportId: 'running', source: 'import', metrics: { streams: { cadence: ser(30, 170) } } };
  ok('A7 andere Quellen (Datei-Import) unveraendert wie bisher', AS.cadence(fileRun).status === 'ok' && AS.cadence(fileRun).avg === 170);
  ok('A8 ohne Messreihe / leer / kaputt: status none, keine Ausnahme', AS.cadence({ metrics: {} }).status === 'none' && AS.cadence(null).status === 'none' && AS.cadence({ metrics: { streams: { cadence: [null, null] } } }).status === 'none');
  const bogus = { id: 'x', sportId: 'running', source: 'garmin', metrics: { streams: { cadence: ser(10, 80) }, stream_meta: { cadence: { kind: 'irgendwas', unit: 'spm' } } } };
  ok('A9 unbekannte Bedeutung in der Beschreibung zaehlt nicht als gesichert', AS.cadence(bogus).status === 'unverified');

  /* Zeitachse */
  const withT = { id: 't1', sportId: 'cycling', source: 'garmin', metrics: { streams: { time: [0, 1, 4, 464, 470], power: [150, null, 160, 170, 180], heart_rate: [120, 121, 122, 123, 124] } } };
  ok('A10 Zeitachse: Messpunkte tragen Sekunden seit Beginn; Luecken bleiben Luecken (kein Gleichverteilen)', J(AS.points(withT, 'power')) === J([{ t: 0, v: 150 }, { t: 4, v: 160 }, { t: 464, v: 170 }, { t: 470, v: 180 }]) && AS.timeAxis(withT).length === 5);
  ok('A11 ohne Zeitachse kein Zeitbezug (null statt erfundener Abstaende); ungleiche Laengen werden abgelehnt', AS.points(runNew, 'heart_rate') === null && AS.timeAxis(runNew) === null && AS.points({ metrics: { streams: { time: [0, 1, 2], power: [1, 2] } } }, 'power') === null);
  const w = AS.qualityWarnings({ id: 'q', sportId: 'running', source: 'garmin', metrics: { streams: { cadence: ser(30, 78), time: [0, 5, 3] }, stream_meta: { cadence: { kind: 'running_cadence_spm', unit: 'spm' } } } });
  ok('A12 Auffaelligkeiten werden nur GEMELDET (Entwicklung), nie korrigiert: Laufkadenz 78, Zeitachse rueckwaerts', J(w.map(x => x.code)) === J(['running_cadence_low', 'time_axis_not_monotonic']) && J(AS.qualityWarnings(runOld).map(x => x.code)) === J(['cadence_unverified']) && AS.qualityWarnings(runNew).length === 0);

  /* Verdrahtung: EINE Quelle fuer Kennzahl, Kurve und Highlights */
  const ui = rd('js/ui.js'), act = rd('js/activity.js');
  ok('A13 Seite, Kurve und Highlights lesen dieselbe Kadenz (vm.cadence); kein eigener Mittelwert ueber streams.cadence mehr',
    /vm\.cadence = _AS\.cadence\(vm\.streamOwner \|\| a\)/.test(act) && /var _cadAvg=\(_cad&&_cad\.status==='ok'&&_cad\.kind==='running_cadence_spm'\)\?_cad\.avg:null;/.test(ui)
    && /gmActStreamDefs\(vm\.sportId,vm\.cadence\|\|null\)/.test(ui) && /var cad=\(vm\.cadence&&vm\.cadence\.status==='ok'&&vm\.cadence\.kind==='running_cadence_spm'\)\?vm\.cadence\.avg:null;/.test(ui)
    && !/canonicalStreams\.cadence/.test(ui.replace(/\/\*[\s\S]*?\*\//g, '')) && !/st&&st\.cadence/.test(ui));
  ok('A14 gekoppelte Uhr-Aufzeichnung: die Bedeutung haengt am Datensatz, der die Messreihen traegt', /vm\.streamOwner = rec;/.test(act));
  ok('A15 Altimport bekommt einen Hinweis statt einer Zahl', /vm\.cadence&&vm\.cadence\.status==='unverified'/.test(ui) && /'ui\.kadenz_altimport':/.test(rd('locales/de.js')));
  ok('A16 nirgends eine pauschale Verdopplung im Client', !/cadence[^;\n]{0,40}\*\s*2|2\s*\*[^;\n]{0,40}cadence/i.test(rd('js/activity-streams.js').replace(/\/\*[\s\S]*?\*\//g, '')) && !/_cadAvg\s*\*\s*2|cad\s*\*\s*2/.test(ui));
}

sec('B · Sportarten');
{
  ok('B1 Katalog hat 24 Sportarten; ACTIVITY_SPORTS ist dieselbe Menge', IDS.length === 24 && TD.ACTIVITY_SPORTS.length === 24 && J(IDS.slice().sort()) === J(TD.ACTIVITY_SPORTS.slice().sort()));
  const self = IDS.filter(id => TD.normSport(id) !== id || TD.normSportStrict(id) !== id);
  ok('B2 jede Katalog-ID normalisiert zu sich selbst (neue Katalog-Sportart ohne Normalisierung ⇒ dieser Test schlaegt an)', self.length === 0, self.join(','));
  const lab = CAT.filter(s => TD.normSport(s.label) !== s.id).map(s => s.label + '→' + TD.normSport(s.label));
  ok('B3 jeder Anzeigename fuehrt zu seiner Sportart (auch gross/klein, mit Leerzeichen)', lab.length === 0 && CAT.every(s => TD.normSport('  ' + s.label.toUpperCase() + ' ') === s.id), lab.join(', '));
  const fell = ['volleyball', 'hockey', 'rugby', 'badminton', 'golf', 'climbing', 'yoga', 'hyrox'];
  ok('B4 die acht, die bis v8-446 auf „other" fielen: jetzt sie selbst', fell.every(id => TD.normSport(id) === id) && IDS.filter(id => id !== 'other' && TD.normSport(id) === 'other').length === 0);
  const only = IDS.filter(id => TD.normSport(id) === 'other');
  ok('B5 „other" ist nur noch der Rueckfall: genau eine Katalog-Sportart heisst so; Unbekanntes und Leeres landen dort, null bleibt null', J(only) === J(['other']) && TD.normSport('Quidditch') === 'other' && TD.normSport('ice_hockey') === 'other' && TD.normSport('') === 'other' && TD.normSport(null) === null && TD.normSportStrict('Quidditch') === null);
  const want = { Krafttraining: 'gym', Kraft: 'gym', 'strength training': 'gym', Laufen: 'running', run: 'running', Rad: 'cycling', Radfahren: 'cycling', ride: 'cycling', Schwimmen: 'swimming', 'Fußball': 'football', Fussball: 'football', soccer: 'football',
    Paddel: 'padel', Leichtathletik: 'athletics', Korbball: 'basketball', Rudern: 'rowing', Wandern: 'hiking', Gehen: 'walking', Spazieren: 'walking', 'Mobilität': 'mobility', Mobilitaet: 'mobility',
    Klettern: 'climbing', Bouldern: 'climbing', rock_climbing: 'climbing', indoor_climbing: 'climbing', Beachvolleyball: 'volleyball', Feldhockey: 'hockey', Federball: 'badminton', HYROX: 'hyrox', Yoga: 'yoga', Golf: 'golf', Rugby: 'rugby',
    Andere: 'other', Sonstiges: 'other' };
  const badA = Object.keys(want).filter(k => TD.normSport(k) !== want[k]);
  ok('B6 ' + Object.keys(want).length + ' Schreibweisen fuehren zur erwarteten Sportart', badA.length === 0, badA.map(k => k + '→' + TD.normSport(k)).join(', '));
  ok('B7 jedes Alias-Ziel ist eine Katalog-Sportart (keine erfundenen IDs)', Object.values(want).every(v => IDS.indexOf(v) >= 0) && ['Gym', 'Laufen', 'Yoga', 'Hyrox', 'Volleyball', 'Quidditch'].every(v => TD.ACTIVITY_SPORTS.indexOf(TD.normSport(v)) >= 0));

  /* Altzeilen: 'other' + erhaltener Rohtyp */
  const up = (sport, metrics) => AN.normalizeActivityRecord({ id: 'x', sport_id: sport, source: 'orvia_workout', started_at: '2026-10-01T10:00:00Z', duration_seconds: 3600, summary: {}, metrics }).sportId;
  ok('B8 Altzeile „other" mit erhaltenem Rohtyp wird beim Lesen zur richtigen Sportart (Yoga, Hyrox, Volleyball) — gespeichert bleibt sie unveraendert', up('other', { source_sport_raw: 'Yoga' }) === 'yoga' && up('other', { source_sport_raw: 'hyrox' }) === 'hyrox' && up('other', { source_sport_raw: 'volleyball' }) === 'volleyball');
  ok('B9 Garmin-Typ aus der Herkunft zaehlt genauso; wirklich Unbekanntes und bewusst gewaehltes „Andere" bleiben „other"', up('other', { garmin: { type_key: 'yoga' } }) === 'yoga' && up('other', { source_sport_raw: 'ice_hockey' }) === 'other' && up('other', {}) === 'other' && up('other', null) === 'other');
  ok('B10 eine bekannte Sportart wird nie umgedeutet', up('running', { source_sport_raw: 'yoga' }) === 'running' && up('gym', { garmin: { type_key: 'indoor_cardio' } }) === 'gym');
  const srv = AC.normalizeServerActivity({ id: 's', sport_id: 'other', source: 'garmin', source_record_id: 'g1', started_at: '2026-10-01T10:00:00Z', duration_seconds: 1800, summary: {}, metrics: { source_sport_raw: 'yoga' } });
  ok('B11 beide Serverwege tun dasselbe (Liste und Abgleich)', srv.sportId === 'yoga' && /AN\(\)\.upgradeSport\(sportId, r\.metrics\)/.test(rd('js/activity-config.js')));
  const wk = AC.weeklyActivityTotals([srv], {}, { weekRef: '2026-10-01', timezone: 'Europe/Berlin' });
  ok('B12 Wochensumme fuehrt die Yoga-Einheit unter „yoga", nicht unter „other"', wk && wk.bySport && !!wk.bySport.yoga && !wk.bySport.other, J(wk && Object.keys(wk.bySport || {})));
  ok('B13 Anzeigename der acht kommt aus dem Katalog', fell.every(id => AC.sportLabel(id) === SL.CATALOG_BY_ID[id].label));

  /* Server-Funktion (optionale Migration 0049) ist deckungsgleich mit dem Client */
  const sql = rdRoot('supabase/migrations/0049_norm_sport_catalog.sql');
  const pairs = [...sql.slice(sql.indexOf('select case')).matchAll(/when '((?:[^']|'')+)' then '([a-z_]+)'/g)].map(m => [m[1].replace(/''/g, "'"), m[2]]);
  const sqlBad = pairs.filter(([a, c]) => TD.normSport(a) !== c);
  const sqlIds = new Set(pairs.map(p => p[1]));
  ok('B14 Migration 0049: ' + pairs.length + ' Zuordnungen, jede gleich dem Client; alle 24 Sportarten sind Ziel und bilden auf sich selbst ab; sonst „other"', pairs.length >= 60 && sqlBad.length === 0 && IDS.every(id => sqlIds.has(id) && pairs.some(p => p[0] === id && p[1] === id)) && /else 'other'/.test(sql), J(sqlBad.slice(0, 4)));
  ok('B15 die Migration aendert nur die Funktion — der Datenabgleich steht auskommentiert darunter (umkehrbar, Entscheidung beim Nutzer)', /create or replace function public\.orvia_norm_sport/.test(sql) && !/^\s*update public\.activities/m.test(sql) && /^--\s+update public\.activities/m.test(sql));
}

sec('C · Zeit');
{
  const g = (iso, extra) => Object.assign({ id: 'g', source: 'garmin', sportId: 'running', startedAt: iso, metrics: {} }, extra || {});
  const P = (a, tz) => { const p = AT.localParts(a, tz); return p.date + ' ' + p.time + ' ' + p.basis; };
  ok('C1 Sommer: 10:00 UTC ist in Berlin 12:00 (UTC+2)', P(g('2026-07-16T10:00:00.000Z'), 'Europe/Berlin') === '2026-07-16 12:00 timezone');
  ok('C2 Winter: 10:00 UTC ist in Berlin 11:00 (UTC+1)', P(g('2026-01-16T10:00:00.000Z'), 'Europe/Berlin') === '2026-01-16 11:00 timezone');
  ok('C3 Umstellung Sommerzeit 29.03.2026: 00:30 UTC = 01:30, 01:30 UTC = 03:30 (die Stunde 2 gibt es nicht)', P(g('2026-03-29T00:30:00.000Z'), 'Europe/Berlin') === '2026-03-29 01:30 timezone' && P(g('2026-03-29T01:30:00.000Z'), 'Europe/Berlin') === '2026-03-29 03:30 timezone');
  ok('C4 Umstellung Winterzeit 25.10.2026: 00:30 UTC = 02:30 (Sommer), 01:30 UTC = 02:30 (Winter)', P(g('2026-10-25T00:30:00.000Z'), 'Europe/Berlin') === '2026-10-25 02:30 timezone' && P(g('2026-10-25T01:30:00.000Z'), 'Europe/Berlin') === '2026-10-25 02:30 timezone');
  ok('C5 nach Mitternacht: 22:30 UTC im Sommer ist der FOLGETAG 00:30 — bis v8-446 stand der Vortag da', P(g('2026-07-16T22:30:00.000Z'), 'Europe/Berlin') === '2026-07-17 00:30 timezone');
  ok('C6 keine fest eingetragene Zone: New York (UTC−4 / −5) und Tokio (UTC+9) stimmen ebenso', P(g('2026-07-16T10:00:00.000Z'), 'America/New_York') === '2026-07-16 06:00 timezone' && P(g('2026-01-16T10:00:00.000Z'), 'America/New_York') === '2026-01-16 05:00 timezone' && P(g('2026-07-16T20:00:00.000Z'), 'Asia/Tokyo') === '2026-07-17 05:00 timezone');
  ok('C7 liefert Garmin die Ortszeit der Aktivitaet mit, gilt sie — auch wenn der Nutzer gerade woanders ist (Lauf auf Teneriffa, App in Berlin)',
    P(g('2026-07-16T07:03:00.000Z', { metrics: { garmin: { start_local: '2026-07-16 08:03:00', utc_offset_s: 3600 } } }), 'Europe/Berlin') === '2026-07-16 08:03 activity_local');
  ok('C8 eingegebene Einheiten (manuell, Import, Altbestand): die eingegebene Uhrzeit bleibt, wie sie eingegeben wurde', P({ source: 'manual', startedAt: '2026-10-05T18:00:00.000Z' }, 'Europe/Berlin') === '2026-10-05 18:00 wall_clock' && P({ source: 'manual', startedAt: '2026-10-05T18:00:00' }, 'Europe/Berlin') === '2026-10-05 18:00 wall_clock'
    && P({ source: 'import', startedAt: '2026-10-05T07:15:00.000Z' }, 'Asia/Tokyo') === '2026-10-05 07:15 wall_clock' && P({ source: 'legacy_local', _legacy: { date: '2026-09-01' }, startedAt: '2026-09-01T00:00:00.000Z' }, 'America/New_York') === '2026-09-01 00:00 wall_clock');
  ok('C9 ORVIA-Workouts sind Zeitpunkte: 16:00 UTC im Sommer = 18:00', P({ source: 'orvia_workout', startedAt: '2026-08-05T16:00:00.000Z' }, 'Europe/Berlin') === '2026-08-05 18:00 timezone' && AT.kind({ source: 'orvia_workout', startedAt: '2026-08-05T16:00:00.000Z' }) === 'instant' && AT.kind({ source: 'manual' }) === 'wall');
  ok('C10 ohne Zone oder mit ungueltiger Zone: dokumentierter Rueckfall auf den UTC-Text statt Absturz', P(g('2026-07-16T10:00:00.000Z'), null) === '2026-07-16 10:00 utc_fallback' && P(g('2026-07-16T10:00:00.000Z'), 'Nicht/Vorhanden') === '2026-07-16 10:00 utc_fallback');
  ok('C11 fehlende / kaputte Eingaben werfen nicht', AT.localParts(null).date === null && AT.localParts({}).time === null && AT.localParts({ source: 'garmin', startedAt: 'kaputt' }, 'Europe/Berlin').basis === null && AT.localParts({ source: 'garmin', startedAt: 'kaputt' }, 'Europe/Berlin').date === null);
  const src = rd('js/activity-time.js').replace(/\/\*[\s\S]*?\*\//g, '');
  ok('C12 keine feste Verschiebung und keine fest eingetragene Zone im Modul', !/Europe\/|\+\s*2\s*\*\s*36|7200|3600|getTimezoneOffset/.test(src) && /Intl\.DateTimeFormat/.test(src));
  const act = rd('js/activity.js');
  ok('C13 die Aktivitaetsansicht schneidet Datum und Uhrzeit nicht mehr aus dem UTC-Text, sondern fragt das Zeitmodul (Einheit und gekoppelte Aufzeichnung)', /var _lp = _AT \? _AT\.localParts\(a\) : null;/.test(act) && /_AT\.localParts\(rec\)/.test(act) && !/var time = \(startedAt && startedAt\.length >= 16\) \? startedAt\.slice\(11, 16\)/.test(act));
  ok('C14 Module sind geladen und im Vorrat des Service Workers', ['activity-time.js', 'activity-streams.js'].every(f => rd('index.html').indexOf('js/' + f) > 0 && rd('sw.js').indexOf("'./js/" + f + "'") > 0));
}

console.log('\n' + (fail ? '❌' : '✅') + ' data_integrity_v447: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

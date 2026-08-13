/* ORVIA · Leistungszonen (2026-08-06)

   Dieses Modul schliesst den Engpass „Ebene 2": Ohne Referenzleistung stand im
   Plan ueberall „—" — bei Intensitaet, Wochenkilometern, Tageszielen und
   Zielprognose. Alle diese Anzeigen sind Ableitungen aus EINER Groesse.

   Der wichtigste Test ist NICHT, dass die Rechnung stimmt, sondern dass das
   Modul SCHWEIGT, wenn es nichts weiss. Ein erfundener Zonenbereich sieht aus
   wie ein gemessener und waere gefaehrlicher als das „—", das er ersetzt.

   node supabase/tests/performance_zones_test.mjs [appRoot-absolut] */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
/* ROBUSTE APP-AUFLOESUNG: Das Repo existiert in zwei Layouts — kanonisch
   (app/supabase/tests, App-Wurzel = HERE/../..) und umstrukturiert
   (supabase/tests neben app/, App-Wurzel = HERE/../../app). Eine starre
   Aufloesung fand im jeweils anderen Layout den falschen Ordner und liess
   die GANZE Suite scheinbar fehlschlagen (0/46 statt gruen). Gesucht wird
   deshalb der erste Kandidat mit index.html UND js/engine. */
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const PZ = require(join(APP, 'js/engine/performance-zones.js'));
const TODAY = '2026-08-06';
const race = (km, min, date) => ({ distanceKm: km, durationMin: min, date: date, kind: 'race' });

sec('1 · Ohne Beleg wird geschwiegen, nicht geschätzt');
{
  const r = PZ.resolve({ today: TODAY });
  ok('keine Referenz ⇒ ok=false, confidence unknown', r.ok === false && r.confidence === 'unknown');
  ok('… und KEINE Zonen (nicht etwa vorsichtige Schätzwerte)', !r.zones);
  const p = PZ.paceForUnit({ t: 'Laufen', l: 'Z2 Dauerlauf' }, r);
  ok('… und keine Pace-Vorgabe', p.ok === false && p.reason === 'no_performance_data');
  ok('… aber der Grund wird mitgeliefert (nicht nur „—")', typeof p.hint === 'string' && p.hint.length > 10);
  ok('… und keine Zielprognose', PZ.forecast(r, 21.0975).ok === false);
}
{
  /* Ein lockerer Dauerlauf sagt nichts über die Leistungsfähigkeit. */
  const r = PZ.resolve({ today: TODAY, workouts: [{ distanceKm: 10, durationMin: 62, date: '2026-08-01', type: 'easy' }] });
  ok('lockere Dauerläufe zählen NICHT als Referenz', r.ok === false, r.confidence);
}

sec('2 · Konfidenz spiegelt die Herkunft');
{
  const m = PZ.resolve({ today: TODAY, races: [race(10, 48.5, '2026-07-16')] });
  ok('Wettkampf ⇒ strong', m.confidence === 'strong');
  const d = PZ.resolve({ today: TODAY, workouts: [{ distanceKm: 5, durationMin: 23, date: '2026-07-20', type: 'tempo' }] });
  ok('harter Trainingslauf ⇒ moderate', d.confidence === 'moderate');
  const e = PZ.resolve({ today: TODAY, goalTarget: { distanceKm: 21.0975, targetMin: 110 } });
  ok('nur Zielzeit im Profil ⇒ weak (Startpunkt, keine Messung)', e.confidence === 'weak');
  ok('ein Wettkampf schlägt einen schnelleren Trainingslauf',
     PZ.resolve({ today: TODAY, races: [race(10, 50, '2026-07-16')],
       workouts: [{ distanceKm: 10, durationMin: 47, date: '2026-07-20', type: 'tempo' }] }).reference.source === 'race');
}

sec('3 · Alterung wird mitgeführt, nicht weggerundet');
{
  const fresh = PZ.resolve({ today: TODAY, races: [race(10, 48.5, '2026-07-16')] });
  const old = PZ.resolve({ today: TODAY, races: [race(10, 48.5, '2024-01-10')] });
  /* 0b: Alter wird gegen die quellenspezifische Grenze gemessen (Wettkampf: 180
     Tage), nicht in festen Tagesschwellen. Die Feinheit steckt in ageRatio. */
  ok('frische Referenz ⇒ fresh', fresh.freshness === 'fresh', fresh.ageDays + ' Tage');
  ok('sehr alte Referenz ⇒ stale', old.freshness === 'stale', old.ageDays + ' Tage');
  ok('… und deutlich über der Grenze', old.ageRatio > 2, 'ageRatio ' + old.ageRatio);
  ok('der Beleg bleibt trotz Alter strong (getrennte Achsen)', old.confidence === 'strong', old.confidence);
  ok('gleiche Zahl, andere Aussagekraft — die Zonen sind identisch',
     JSON.stringify(fresh.zones) === JSON.stringify(old.zones));
  ok('… aber der Prognosekorridor ist breiter',
     PZ.forecast(old, 21.0975).bandPct > PZ.forecast(fresh, 21.0975).bandPct,
     PZ.forecast(fresh, 21.0975).bandPct + '% → ' + PZ.forecast(old, 21.0975).bandPct + '%');
}

sec('4 · Die Rechnung selbst');
{
  const p = PZ.resolve({ today: TODAY, races: [race(10, 48.5, '2026-07-16')] });
  ok('HM-Äquivalent liegt plausibel bei ~107 min',
     p.halfMarathonEquivalentMin > 104 && p.halfMarathonEquivalentMin < 110, p.halfMarathonEquivalentMin + ' min');
  ok('Schwellenpace liegt zwischen 10-km- und HM-Pace',
     p.thresholdPaceSecPerKm > 285 && p.thresholdPaceSecPerKm < 305, PZ.fmtPace(p.thresholdPaceSecPerKm));
  ok('Zonen sind aufsteigend geordnet (VO2 schneller als Easy)',
     p.zones.vo2.hiSecPerKm < p.zones.easy.loSecPerKm);
  ok('jede Zone hat lo < hi', Object.keys(p.zones).every(k => p.zones[k].loSecPerKm <= p.zones[k].hiSecPerKm));
  ok('Prognose ist ein Korridor, keine einzelne Zahl',
     (() => { const f = PZ.forecast(p, 21.0975); return f.optimisticMin < f.realisticMin && f.realisticMin < f.cautiousMin; })());
  ok('fmtPace formatiert korrekt', PZ.fmtPace(360) === '6:00' && PZ.fmtPace(305) === '5:05');
}

sec('5 · Plan-Vorgaben statt „—"');
{
  const p = PZ.resolve({ today: TODAY, races: [race(10, 48.5, '2026-07-16')] });
  [['Z2 Dauerlauf', 'easy'], ['Long Run', 'long'], ['Intervalle', 'vo2'], ['Tempo', 'threshold']].forEach(([l, z]) => {
    const r = PZ.paceForUnit({ t: 'Laufen', l: l }, p);
    ok('„' + l + '" bekommt die Zone ' + z, r.ok === true && r.zone === z, r.text);
  });
  ok('die Vorgabe trägt ihre Konfidenz mit',
     PZ.paceForUnit({ t: 'Laufen', l: 'Long Run' }, p).confidence === 'strong');
  ok('Nicht-Laufeinheiten bekommen keine Laufpace',
     PZ.paceForUnit({ t: 'Gym', l: 'Ganzkörper' }, p) === null);
  ok('unbekannter Einheitstyp ⇒ ehrliches ok=false',
     PZ.paceForUnit({ t: 'Laufen', l: 'Waldlauf rückwärts' }, p).ok === false);
}

sec('6 · Reinheit und Einbindung');
{
  const src = readFileSync(join(APP, 'js/engine/performance-zones.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
  ok('kein Zufall, kein DOM, kein Storage', !/Math\.random|document\.|localStorage/.test(src));
  ok('das Bezugsdatum kommt herein (keine eigene Uhr für die Alterung)', !/new Date\(\)|Date\.now\(/.test(src));
  const a = JSON.stringify(PZ.resolve({ today: TODAY, races: [race(10, 48.5, '2026-07-16')] }));
  const b = JSON.stringify(PZ.resolve({ today: TODAY, races: [race(10, 48.5, '2026-07-16')] }));
  ok('deterministisch', a === b);
  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  ok('index.html lädt das Modul', html.indexOf('js/engine/performance-zones.js') > 0);
  ok('sw.js cacht das Modul', sw.indexOf('./js/engine/performance-zones.js') > 0);
}


sec('7 · Sportartübergreifend — Rad und Schwimmen, nicht nur Laufen');
{
  const c = PZ.resolveFor('cycling', { today: TODAY, test: { id: 'ftp20', avgWatts: 263, date: '2026-08-01' } });
  ok('20-min-Test ⇒ FTP = 95 % der Leistung', c.ok === true && c.ftpWatts === 250, c.ftpWatts + ' W');
  ok('Rad-Zonen kommen in WATT, nicht in Pace', c.zones.threshold.loWatts > 0 && c.zones.threshold.unit === 'W');
  ok('Schwellenzone umschließt die FTP',
     c.zones.threshold.loWatts <= 250 && c.zones.threshold.hiWatts >= 250);
  const h = PZ.resolveFor('cycling', { today: TODAY, test: { id: 'hr_threshold', avgHr: 168, date: '2026-08-01' } });
  ok('ohne Powermeter geht es über die Schwellen-HF', h.ok === true && h.hrZones.easy.loBpm > 0);
  ok('… aber mit NIEDRIGERER Konfidenz als eine Leistungsmessung',
     PZ.CONFIDENCE_ORDER.indexOf(h.confidence) < PZ.CONFIDENCE_ORDER.indexOf(c.confidence),
     h.confidence + ' < ' + c.confidence);
}
{
  const s = PZ.resolveFor('swimming', { today: TODAY, test: { id: 'css400_200', t400Sec: 480, t200Sec: 225, date: '2026-08-02' } });
  ok('CSS-Test liefert eine Schwellengeschwindigkeit', s.ok === true && s.cssSecPer100 > 0, PZ.fmtPace(s.cssSecPer100) + '/100m');
  ok('CSS-Rechnung stimmt: (400−200)/(t400−t200)',
     Math.abs(s.cssSecPer100 - 127.5) < 1, s.cssSecPer100 + ' sec/100m');
  ok('Schwimm-Zonen kommen in sec/100m', s.zones.threshold.unit === 'sec/100m');
  ok('lockere Zone ist LANGSAMER als die Schwelle (höhere Sekundenzahl)',
     s.zones.easy.loSecPer100 > s.zones.threshold.hiSecPer100);
  ok('ungültiger Test (400er schneller als 200er) ⇒ kein Ergebnis',
     PZ.resolveFor('swimming', { today: TODAY, test: { id: 'css400_200', t400Sec: 200, t200Sec: 225 } }).ok === false);
}

sec('8 · Der Anfänger-Fall — ohne Wettkampf zu Zonen kommen');
{
  const none = PZ.resolveFor('cycling', { today: TODAY });
  ok('ohne Wert: kein Ergebnis, aber Testvorschläge statt Sackgasse',
     none.ok === false && Array.isArray(none.availableTests) && none.availableTests.length > 0);
  const beginner = PZ.testsFor('cycling', 'anfaenger');
  ok('für Anfänger stehen anfängertaugliche Tests VORN',
     beginner[0].level === 'anfaenger', beginner[0].label);
  ok('jeder Test hat eine Anleitung, nicht nur einen Namen',
     ['running','cycling','swimming'].every(sp =>
       PZ.TEST_PROTOCOLS[sp].every(t => typeof t.howto === 'string' && t.howto.length > 30)));
  ok('jede der drei Sportarten hat mindestens einen Anfängertest',
     ['running','cycling','swimming'].every(sp => PZ.TEST_PROTOCOLS[sp].some(t => t.level === 'anfaenger')));
  const cooper = PZ.resolveFor('running', { today: TODAY,
    races: [{ distanceKm: 2.6, durationMin: 12, date: '2026-08-03', kind: 'test' }] });
  ok('ein 12-Minuten-Test reicht als Einstieg fürs Laufen',
     cooper.ok === true && cooper.confidence === 'strong', PZ.fmtPace(cooper.zones.easy.loSecPer100 || cooper.zones.easy.loSecPerKm) + '/km');
}

sec('9 · Eine Vorgabe je Sportart — dieselbe Schnittstelle');
{
  const perf = {
    running: PZ.resolve({ today: TODAY, races: [race(10, 48.5, '2026-07-16')] }),
    cycling: PZ.resolveFor('cycling', { today: TODAY, test: { id: 'ftp20', avgWatts: 263, date: '2026-08-01' } }),
    swimming: PZ.resolveFor('swimming', { today: TODAY, test: { id: 'css400_200', t400Sec: 480, t200Sec: 225, date: '2026-08-02' } })
  };
  const run = PZ.targetForUnit({ t: 'Laufen', l: 'Z2 Dauerlauf' }, perf);
  const bike = PZ.targetForUnit({ t: 'Rad', l: 'Easy Z2' }, perf);
  const swim = PZ.targetForUnit({ t: 'Schwimmen', l: 'Technik' }, perf);
  ok('Laufen bekommt eine Pace', run.ok === true && /\/km/.test(run.text), run.text);
  ok('Rad bekommt Watt', bike.ok === true && /W$/.test(bike.text), bike.text);
  ok('Schwimmen bekommt sec/100m', swim.ok === true && /100m/.test(swim.text), swim.text);
  ok('Krafttraining bekommt keine Ausdauervorgabe',
     PZ.targetForUnit({ t: 'Gym', l: 'Ganzkörper' }, perf) === null);
  ok('fehlt die Referenz EINER Sportart, bleiben die anderen unberührt',
     PZ.targetForUnit({ t: 'Rad', l: 'Easy Z2' }, { running: perf.running }).ok === false &&
     PZ.targetForUnit({ t: 'Laufen', l: 'Z2 Dauerlauf' }, { running: perf.running }).ok === true);
}


sec('10 · Der Leistungsstand steuert den Weg — pro Sportart');
{
  const prof = { sports: [
    { sportId: 'running', fields: { level: 'ambitioniert' } },
    { sportId: 'cycling', fields: { level: 'fortgeschritten' } },
    { sportId: 'swimming', fields: { level: 'Anfänger' } } ] };
  ok('Laufen „ambitioniert" ⇒ competitive', PZ.levelForSport(prof, 'running') === 'competitive');
  ok('Rad „fortgeschritten" ⇒ intermediate', PZ.levelForSport(prof, 'cycling') === 'intermediate');
  ok('Schwimmen „Anfänger" ⇒ beginner', PZ.levelForSport(prof, 'swimming') === 'beginner');
  ok('das Level ist PRO SPORTART, nicht global — drei verschiedene Werte im selben Profil',
     new Set(['running','cycling','swimming'].map(s => PZ.levelForSport(prof, s))).size === 3);

  const comp = PZ.diagnosticPathFor('running', 'competitive');
  ok('Wettkampforientiert ⇒ Wettkampfergebnis statt Test',
     comp.primary === 'race_result', comp.primary);
  ok('… Tests bleiben möglich, sind aber nachrangig',
     comp.tests.length > 0 && /bessere Referenz/.test(comp.note));

  const beg = PZ.diagnosticPathFor('cycling', 'beginner');
  ok('Anfänger ⇒ Test, und der ANFÄNGERTEST steht vorn',
     beg.primary === 'test' && beg.tests[0].level === 'anfaenger', beg.tests[0].label);
  const int = PZ.diagnosticPathFor('cycling', 'intermediate');
  ok('Fortgeschritten ⇒ das genauere Protokoll steht vorn',
     int.tests[0].level === 'fortgeschritten', int.tests[0].label);
  ok('… es ist ein ANDERER Test als beim Anfänger', int.tests[0].id !== beg.tests[0].id,
     beg.tests[0].id + ' ≠ ' + int.tests[0].id);
  ok('kein Test geht verloren, nur die Reihenfolge ändert sich',
     beg.tests.length === int.tests.length && beg.tests.length === PZ.TEST_PROTOCOLS.cycling.length);
}
{
  ok('unbekannte Levelbezeichnung wird NICHT geraten', PZ.normalizeLevel('semi-pro') === null);
  ok('ohne Angabe gilt die vorsichtige Annahme (beginner)',
     PZ.levelForSport({ sports: [{ sportId: 'rowing' }] }, 'rowing') === 'beginner');
  ok('alle Profil-Bezeichnungen sind abgedeckt',
     ['Einsteiger','fortgeschritten','ambitioniert','Wettkampf','Anfänger','erfahren']
       .every(x => PZ.normalizeLevel(x) !== null));
  const r = PZ.resolveFor('cycling', { today: TODAY, level: 'beginner' });
  ok('fehlt der Wert, liefert resolveFor den passenden Weg gleich mit',
     r.ok === false && r.path && r.path.tests[0].level === 'anfaenger', r.path && r.path.prompt);
}

console.log('\nperformance_zones: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);

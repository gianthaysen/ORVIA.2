/* ORVIA · Profil → Leistungszonen (2026-08-06)

   Nutzervorgabe: „Bezieh dich immer auf das komplette Benutzerprofil, was so
   eingeht, was man eingibt." Dieses Modul ist die Verbindung zwischen dem, was
   der Nutzer eintraegt, und dem, was auf den Plan-Karten steht.

   Der wichtigste Test ist wieder der Ausfall: Fehlt fuer EINE Sportart die
   Referenz, muessen die anderen trotzdem echte Vorgaben liefern. Alles-oder-
   nichts waere hier die falsche Antwort — beim Laufen konkrete Pace und beim
   Schwimmen „—" ist der Normalfall, nicht ein Fehler.

   node supabase/tests/performance_resolver_test.mjs [appRoot-absolut] */
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
const PR = require(join(APP, 'js/engine/performance-resolver.js'));
const T = '2026-08-07';

const VOLL = {
  performance: {
    personalBests: [{ sportId: 'running', distance: '10 km', timeSeconds: 2910, context: 'Wettkampf', measuredAt: '2026-07-16' }],
    tests: [{ sportId: 'cycling', id: 'ftp20', avgWatts: 263, date: '2026-08-01' },
            { sportId: 'swimming', id: 'css400_200', t400Sec: 480, t200Sec: 225, date: '2026-08-02' }] },
  sports: [{ sportId: 'running', fields: { level: 'ambitioniert', distance: 'Halbmarathon', targetTime: '1:50' } },
           { sportId: 'cycling', fields: { level: 'fortgeschritten' } },
           { sportId: 'swimming', fields: { level: 'Anfänger' } }] };

sec('1 · Das komplette Profil wird gelesen');
{
  const all = PR.resolveAll(VOLL, { today: T });
  ok('alle drei Sportarten liefern Zonen',
     ['running','cycling','swimming'].every(s => all.sports[s].ok === true));
  ok('die Bestzeit im Wettkampfkontext zählt als Wettkampf',
     all.sports.running.reference.source === 'race', all.sports.running.reference.source);
  ok('der Rad-Test wird in FTP umgerechnet', all.sports.cycling.ftpWatts === 250);
  ok('der Schwimm-Test wird in CSS umgerechnet', all.sports.swimming.cssSecPer100 > 0);
  ok('die Übersicht benennt Konfidenz je Sportart',
     all.summary.every(x => x.ok && x.confidence === 'strong'), JSON.stringify(all.summary.map(x=>x.sportId+':'+x.confidence)));
}

sec('2 · Freitext-Felder werden einmal zentral gedeutet');
[['10 km', 10], ['5k', 5], ['Halbmarathon', 21.0975], ['400m', 0.4], ['21.1', 21.1], ['Quatsch', null]]
  .forEach(([raw, exp]) => ok('Distanz „' + raw + '" → ' + exp, PR.distanceKmOf(raw) === exp, String(PR.distanceKmOf(raw))));
/* Die Zweideutigkeit von „1:50" ist der interessante Fall: Halbmarathon meint
   1 h 50, 10 km meint 48 min 30 bei „48:30". Ohne Distanz entscheidet die
   konservative Regel. */
[['1:50', 21.0975, 110], ['48:30', 10, 48.5], ['1:50:00', 21.0975, 110],
 ['5:30', 1, 5.5], ['1:50', null, 110], ['45', null, 45]]
  .forEach(([raw, km, exp]) => ok('Zeit „' + raw + '"' + (km ? ' auf ' + km + ' km' : ' ohne Distanz') + ' → ' + exp + ' min',
    Math.abs(PR.minutesOf(raw, km) - exp) < 0.01, String(PR.minutesOf(raw, km))));
{
  /* Regression: ohne diese Unterscheidung wurde aus einer HM-Zielzeit von 1:50
     eine Zeit von 1,8 Minuten — und daraus brav ein Zonenmodell. */
  const p = { sports: [{ sportId: 'running', fields: { distance: 'Halbmarathon', targetTime: '1:50' } }] };
  const r = PR.runningInput(p, { today: T });
  ok('HM-Zielzeit „1:50" wird als 110 Minuten gelesen, nicht als 1,8',
     r.goalTarget && Math.abs(r.goalTarget.targetMin - 110) < 0.01, r.goalTarget && r.goalTarget.targetMin);
}

sec('3 · Fehlt eine Sportart, bleiben die anderen intakt');
{
  const nurLauf = { performance: { personalBests: VOLL.performance.personalBests },
    sports: [{ sportId: 'running', fields: { level: 'ambitioniert' } },
             { sportId: 'swimming', fields: { level: 'Anfänger' } }] };
  const all = PR.resolveAll(nurLauf, { today: T });
  ok('Laufen liefert Zonen', all.sports.running.ok === true);
  ok('Schwimmen liefert KEINE erfundenen Zonen', all.sports.swimming.ok === false);
  ok('… sondern den passenden Testvorschlag',
     all.sports.swimming.path && all.sports.swimming.path.tests[0].level === 'anfaenger',
     all.sports.swimming.path && all.sports.swimming.path.tests[0].label);
  ok('anyOk meldet, dass überhaupt etwas da ist', all.anyOk === true);
  const t = PZ.targetForUnit({ t: 'Laufen', l: 'Long Run' }, all.sports);
  ok('die Plan-Karte für Laufen bekommt trotzdem eine Pace', t.ok === true, t.text);
}
{
  const leer = PR.resolveAll({}, { today: T });
  ok('leeres Profil ⇒ keine Sportart ok, kein Absturz',
     leer.ok === true && leer.anyOk === false && leer.sports.running.ok === false);
  ok('… und jede Sportart nennt, was fehlt',
     leer.summary.every(x => typeof x.missing === 'string' && x.missing.length > 10));
}

sec('4 · Nur belastbare Quellen werden hochgestuft');
{
  const nurZiel = { sports: [{ sportId: 'running', fields: { distance: 'Halbmarathon', targetTime: '1:50' } }] };
  const r = PR.resolveAll(nurZiel, { today: T }).sports.running;
  ok('eine bloße Zielzeit ergibt höchstens „weak"', r.ok === true && r.confidence === 'weak', r.confidence);
}
{
  const mitLauf = { sports: [{ sportId: 'running', fields: {} }] };
  const r = PR.resolveAll(mitLauf, { today: T, activities: [
    { sportId: 'running', distanceKm: 12, durationMin: 70, date: '2026-08-01', subType: 'Easy' } ] }).sports.running;
  ok('ein lockerer Dauerlauf aus den Aktivitäten zählt NICHT als Referenz', r.ok === false, r.confidence);
}
{
  const mitTempo = { sports: [{ sportId: 'running', fields: {} }] };
  const r = PR.resolveAll(mitTempo, { today: T, activities: [
    { sportId: 'running', distanceKm: 8, durationMin: 36, date: '2026-08-01', subType: 'Tempo' } ] }).sports.running;
  ok('ein Tempolauf zählt als abgeleitete Referenz', r.ok === true && r.confidence === 'moderate', r.confidence);
}

sec('5 · Reinheit und Einbindung');
{
  const snap = JSON.stringify(VOLL);
  PR.resolveAll(VOLL, { today: T });
  ok('das Profil wird nicht verändert', JSON.stringify(VOLL) === snap);
  ok('deterministisch',
     JSON.stringify(PR.resolveAll(VOLL, { today: T })) === JSON.stringify(PR.resolveAll(VOLL, { today: T })));
  const src = readFileSync(join(APP, 'js/engine/performance-resolver.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
  ok('kein Zufall, kein DOM, kein Storage, keine eigene Uhr',
     !/Math\.random|document\.|localStorage|new Date\(\)|Date\.now\(/.test(src));
  const ui = readFileSync(join(APP, 'js/ui.js'), 'utf8');
  ok('renderGMPlan löst die Zonen aus dem Profil auf', /performanceResolver[\s\S]{0,300}resolveAll/.test(ui));
  ok('… und zeigt die Vorgabe auf der Karte', /targetForUnit/.test(ui));
  ok('die Auflösung passiert EINMAL je Render, nicht je Karte',
     (ui.match(/performanceResolver\.resolveAll/g) || []).length === 1);
  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  ok('index.html lädt den Resolver NACH performance-zones',
     html.indexOf('js/engine/performance-resolver.js') > html.indexOf('js/engine/performance-zones.js'));
  ok('sw.js cacht den Resolver', sw.indexOf('./js/engine/performance-resolver.js') > 0);
}

console.log('\nperformance_resolver: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);

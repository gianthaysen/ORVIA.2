/* ORVIA · Wochenaufbau (2026-08-06)

   ZWEITER NUTZERBEFUND, nachdem das erste Regelwerk (week-plan-policy) live war:
   „Montag, Dienstag, Sonntag laufen direkt hintereinander. Und dann Tempo und
   Intervalle. Und Sonntag Long Run."

   Beide Vorwürfe waren berechtigt, und beide konnte das erste Regelwerk gar nicht
   finden: Es prüft einzelne TAGE („sind an diesem Tag zwei harte Einheiten?"),
   nicht den RHYTHMUS der Woche. So/Mo/Di ist tageweise unauffällig — und in
   Summe eine Dreierkette über den Wochenwechsel.

   Dieser Test prüft daher Eigenschaften der WOCHE, nicht der Tage:

     A  zwischen zwei Kernreizen mindestens 48 h (zyklisch gerechnet!)
     B  nie drei Lauftage in Folge (zyklisch!)
     C  Polarisierung — der Anteil harter Reize wächst mit dem Umfang, nicht
        mit dem Wunsch
     D  anteilige Kürzung — keine Sportart verschwindet still komplett
     E  beinlastige Kraft nicht am Kernreiztag und nicht am Tag davor
     F  Ruhetag wird VOR der Platzierung reserviert, nicht hinterher freigeräumt

   Der Ring ist der Kern: Fast jeder dieser Tests wäre grün, wenn man die Woche
   als Linie Mo→So läse. Genau deshalb sind sie hier zyklisch formuliert.

   node supabase/tests/week_plan_designer_test.mjs [appRoot-absolut] */
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

const D = require(join(APP, 'js/engine/week-plan-designer.js'));

const R = (l) => ({ t: 'Laufen', l: l, d: l === 'Long Run' ? 'lr' : l === 'Intervalle' ? 'iv' : l === 'Tempo' ? 'tempo' : 'ez' });
const G = (l) => ({ t: 'Gym', l: l, d: '45 min' });
const B = () => ({ t: 'Rad', l: 'Easy Z2', d: '60 min' });
const S = () => ({ t: 'Schwimmen', l: 'Technik', d: '~900 m' });
const DN = ['Mo','Di','Mi','Do','Fr','Sa','So'];
const show = w => w.map((d, i) => DN[i] + ':' + (d.map(x => x.t[0] + '·' + x.l).join('+') || '—')).join('  ');
const count = w => w.reduce((n, d) => n + d.length, 0);

/* Prüffunktionen — bewusst hier NEU implementiert und nicht aus dem Modul
   importiert. Ein Test, der die Rechnung des Prüflings übernimmt, prüft nichts. */
function hardDaysOf(w) { const o = []; w.forEach((d, i) => { if (d.some(D.isHard)) o.push(i); }); return o; }
function minGapCyclic(days) {
  if (days.length < 2) return 7;
  const s = days.slice().sort((a, b) => a - b);
  let m = 99;
  for (let i = 0; i < s.length; i++) {
    const nx = s[(i + 1) % s.length];
    let g = (nx - s[i] + 7) % 7; if (g === 0) g = 7;
    m = Math.min(m, g);
  }
  return m;
}
function maxRunStreakCyclic(w) {
  const run = w.map(d => d.some(x => x.t === 'Laufen') ? 1 : 0);
  if (run.every(x => x)) return 7;
  let best = 0, cur = 0;
  for (let i = 0; i < 14; i++) { if (run[i % 7]) { cur++; best = Math.max(best, cur); } else cur = 0; }
  return best;
}

/* ============ A) Der gemeldete Fall ============ */
sec('A · Der gemeldete Fall — Mo/Di/So laufen, Tempo neben Intervallen');

const wunsch = [
  R('Long Run'), R('Intervalle'), R('Tempo'),
  R('Z2 Dauerlauf'), R('Z2 Dauerlauf'), R('Z2 Dauerlauf'),
  G('Ganzkörper'), G('Oberkörper'), G('Ganzkörper'), G('Oberkörper'),
  B(), B(), S()
];
const cfg = { availableDayIdx: [0,1,2,3,4,5], restDayIdx: [6], preferredRestDayIdx: [6],
  doubleAllowedDayIdx: [1,5], minRestDays: 1 };
const r = D.designWeek(wunsch, cfg);
console.log('   → ' + show(r.days));

ok('der harte Ruhetag bleibt leer', r.days[6].length === 0);
ok('mindestens ein Ruhetag', r.days.filter(d => !d.length).length >= 1);
ok('KEINE drei Lauftage in Folge (zyklisch)', maxRunStreakCyclic(r.days) <= 2,
   'längste Kette: ' + maxRunStreakCyclic(r.days));
ok('zwischen Kernreizen mindestens 48 h (zyklisch)', minGapCyclic(hardDaysOf(r.days)) >= 2,
   'Kernreiztage ' + JSON.stringify(hardDaysOf(r.days)) + ', kleinster Abstand ' + minGapCyclic(hardDaysOf(r.days)));
ok('Doppeleinheiten nur an freigegebenen Tagen',
   r.days.every((d, i) => d.length < 2 || [1,5].indexOf(i) >= 0));
ok('kein Tag mit zwei Kernreizen', r.days.every(d => d.filter(D.isHard).length <= 1));
ok('nie zweimal dieselbe Sportart am selben Tag',
   r.days.every(d => new Set(d.map(x => x.t)).size === d.length));

/* ============ B) Polarisierung ============ */
sec('B · Polarisierung — harte Reize wachsen mit dem Umfang, nicht mit dem Wunsch');
ok('bei 7 geplanten Einheiten höchstens 2 Kernreize',
   hardDaysOf(r.days).length <= 2, hardDaysOf(r.days).length + ' Kernreize bei ' + count(r.days) + ' Einheiten');
ok('die Herabstufung wird begründet, nicht still vollzogen',
   r.report.notes.some(n => n.code === 'polarisierung'),
   JSON.stringify(r.report.notes.map(n => n.code)));
{
  /* Grosse Woche: mehr Kapazität ⇒ mehr Kernreize erlaubt. */
  const gross = [R('Long Run'), R('Intervalle'), R('Tempo'), R('Z2 Dauerlauf'), R('Z2 Dauerlauf'),
    G('Ganzkörper'), G('Oberkörper'), B(), S()];
  const rg = D.designWeek(gross, { availableDayIdx: [0,1,2,3,4,5,6], restDayIdx: [],
    preferredRestDayIdx: [6], doubleAllowedDayIdx: [0,1,2,3,4,5], minRestDays: 1 });
  console.log('   → ' + show(rg.days));
  ok('bei größerem Umfang sind 3 Kernreize zulässig',
     hardDaysOf(rg.days).length >= 3, hardDaysOf(rg.days).length + ' Kernreize bei ' + count(rg.days) + ' Einheiten');
  ok('… und sie liegen trotzdem mindestens 48 h auseinander',
     minGapCyclic(hardDaysOf(rg.days)) >= 2, 'Abstand ' + minGapCyclic(hardDaysOf(rg.days)));
  ok('… und es entsteht keine Laufkette', maxRunStreakCyclic(rg.days) <= 2,
     'längste Kette ' + maxRunStreakCyclic(rg.days));
}

/* ============ C) Anteilige Kürzung ============ */
sec('C · Keine Sportart verschwindet still');
{
  const sportsIn = new Set(wunsch.map(u => u.t));
  const sportsOut = new Set(r.days.flat().map(u => u.t));
  ok('jede gewünschte Sportart kommt im Plan vor',
     [...sportsIn].every(s => sportsOut.has(s)),
     'rein: ' + [...sportsIn].join(',') + ' — raus: ' + [...sportsOut].join(','));
  ok('die Kürzung ist als Rechnung dokumentiert',
     !!r.report.demand && r.report.demand.wanted === 13 && r.report.demand.planned <= r.report.demand.capacity,
     JSON.stringify(r.report.demand));
  ok('Krafttraining überlebt (war zuvor komplett verschwunden)',
     r.days.flat().filter(u => u.t === 'Gym').length >= 2,
     r.days.flat().filter(u => u.t === 'Gym').length + ' Gym-Einheiten');
}

/* ============ D) Beinkraft mit Sicherheitsabstand ============ */
sec('D · Beinlastige Kraft nicht am Kernreiztag und nicht am Tag davor');
{
  const bad = [];
  r.days.forEach((d, i) => {
    if (!d.some(D.isLegHeavy)) return;
    if (d.some(D.isHard)) bad.push(DN[i] + ' (Kernreiz am selben Tag)');
    if (r.days[(i + 1) % 7].some(D.isHard)) bad.push(DN[i] + ' (Kernreiz am Folgetag)');
  });
  ok('kein Verstoß im gemeldeten Fall', bad.length === 0, bad.join(', ') || show(r.days));
}
{
  /* Enger Fall: nur wenige Tage — statt zu streichen wird auf Oberkörper gewechselt. */
  const eng = [R('Long Run'), R('Intervalle'), G('Ganzkörper'), G('Ganzkörper')];
  const re = D.designWeek(eng, { availableDayIdx: [0,1,2,3], restDayIdx: [4,5,6], minRestDays: 1 });
  console.log('   → ' + show(re.days));
  const verstoss = re.days.some((d, i) => d.some(D.isLegHeavy) && (d.some(D.isHard) || re.days[(i + 1) % 7].some(D.isHard)));
  ok('auch im engen Fall kein Beinkraft-Konflikt', !verstoss, show(re.days));
  ok('… und die Einheit wird umgestellt statt gestrichen',
     count(re.days) === 4 || re.report.notes.some(n => n.code === 'bein_zu_oberkoerper'),
     count(re.days) + ' von 4 · ' + JSON.stringify(re.report.notes.map(n => n.code)));
}

/* ============ E) Der Ring — Sonntag grenzt an Montag ============ */
sec('E · Die Woche ist ein Ring, keine Linie');
{
  /* Wäre der Sonntag der letzte Tag einer Linie, wären Sa+So+Mo unauffällig. */
  const u = [R('Long Run'), R('Z2 Dauerlauf'), R('Z2 Dauerlauf'), R('Intervalle'), G('Oberkörper')];
  const rr = D.designWeek(u, { availableDayIdx: [0,1,2,3,4,5,6], minRestDays: 1,
    doubleAllowedDayIdx: [0,1,2,3,4,5,6] });
  console.log('   → ' + show(rr.days));
  ok('keine Laufkette über den Wochenwechsel', maxRunStreakCyclic(rr.days) <= 2,
     'längste Kette ' + maxRunStreakCyclic(rr.days));
  ok('Kernreize auch über den Wochenwechsel mit Abstand',
     minGapCyclic(hardDaysOf(rr.days)) >= 2,
     'Tage ' + JSON.stringify(hardDaysOf(rr.days)) + ' Abstand ' + minGapCyclic(hardDaysOf(rr.days)));
  ok('cycDist rechnet So↔Mo als 1, nicht als 6', D.cycDist(6, 0) === 1);
  ok('cycDist rechnet Sa↔Mo als 2', D.cycDist(5, 0) === 2);
}

/* ============ F) Ruhetag wird reserviert, nicht freigeräumt ============ */
sec('F · Der Ruhetag ist gesetzt, bevor platziert wird');
{
  const viel = Array.from({ length: 12 }, (_, i) => i % 2 ? R('Z2 Dauerlauf') : G('Oberkörper'));
  const rv = D.designWeek(viel, { availableDayIdx: [0,1,2,3,4,5,6], minRestDays: 1, doubleAllowedDayIdx: [] });
  console.log('   → ' + show(rv.days));
  ok('auch bei starker Übernachfrage bleibt ein Ruhetag',
     rv.days.filter(d => !d.length).length >= 1, rv.days.filter(d => !d.length).length + ' Ruhetage');
  /* Ohne Doppel-Angabe entstehen nur so viele Doppeltage, wie die ausdrücklich
     gewünschte Einheitenzahl erfordert — nicht „überall, weil es ginge". */
  ok('… und es entstehen nicht mehr Doppeltage als die Wunschzahl erzwingt',
     rv.days.filter(d => d.length >= 2).length <= Math.max(2, 12 - 6),
     rv.days.filter(d => d.length >= 2).length + ' Doppeltage, ' + count(rv.days) + ' Einheiten');
  /* Bei 12 Einheiten auf 6 Trainingstagen sind sechs Doppeltage rechnerisch
     zwingend — hier ist nicht die Zahl der Doppeltage der Prüfstein, sondern
     dass der Ruhetag trotzdem steht (oben geprüft). */
}
{
  const rp = D.designWeek([R('Long Run'), R('Z2 Dauerlauf'), G('Oberkörper')],
    { availableDayIdx: [0,1,2,3,4,5,6], preferredRestDayIdx: [2], minRestDays: 1, doubleAllowedDayIdx: [] });
  ok('ein bevorzugter Ruhetag bleibt frei, wenn genug Platz ist',
     rp.days[2].length === 0, show(rp.days));
}

/* ============ G) Reinheit ============ */
sec('G · Reinheit und Determinismus');
{
  const snap = JSON.stringify(wunsch);
  const a = D.designWeek(wunsch, cfg);
  ok('die Eingabe wird nicht mutiert', JSON.stringify(wunsch) === snap);
  const b = D.designWeek(wunsch, cfg);
  ok('gleiche Eingabe ⇒ byte-gleiche Woche', JSON.stringify(a.days) === JSON.stringify(b.days));
  const src = readFileSync(join(APP, 'js/engine/week-plan-designer.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
  ok('kein Zufall, keine Uhr, kein DOM, kein Storage',
     !/Math\.random|new Date\(|Date\.now\(|document\.|localStorage/.test(src));
}
{
  ok('leere Eingabe stürzt nicht ab',
     D.designWeek([], {}).report.placed === 0);
  ok('ohne verfügbaren Tag wird ehrlich abgelehnt',
     D.designWeek([R('Long Run')], { availableDayIdx: [], restDayIdx: [0,1,2,3,4,5,6] }).report.ok === false);
}

/* ============ H) Einbindung ============ */
sec('H · Einbindung in den Generator');
{
  const ui = readFileSync(join(APP, 'js/ui.js'), 'utf8');
  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  ok('generateWeekPlan ruft den Designer auf', /weekPlanDesigner[\s\S]{0,200}designWeek/.test(ui));
  ok('der Designer läuft VOR dem Sicherheitsnetz',
     ui.indexOf('.designWeek(') < ui.indexOf('.applyPolicy('),
     'designWeek@' + ui.indexOf('.designWeek(') + ' applyPolicy@' + ui.indexOf('.applyPolicy('));
  ok('index.html lädt das Modul', html.indexOf('js/engine/week-plan-designer.js') > 0);
  ok('sw.js cacht das Modul', sw.indexOf('./js/engine/week-plan-designer.js') > 0);
}

console.log('\nweek_plan_designer: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);

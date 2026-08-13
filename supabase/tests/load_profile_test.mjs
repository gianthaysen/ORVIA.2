/* ORVIA · Lastprofil auf Muskelebene (2026-08-06)

   NUTZERBEFUND, wörtlich:
     „Wenn man Rudern macht, kann man am selben Tag nicht Rücken trainieren.
      Oder Fußball und Beintraining. Oder Laufen und Beintraining. Oder
      Ganzkörper, Ganzkörper, Ganzkörper dreimal — das geht auch nicht.
      Da muss eine richtige, tiefe Logik hinter, die immer greift,
      sportartenübergreifend."

   Die vier Beispiele sind Block A dieses Tests — wörtlich übernommen. Sie sind
   der Maßstab: Wenn eines davon durchrutscht, greift die Logik nicht.

   ENTSCHEIDEND IST ABER BLOCK B: die Gegenproben. Eine Regel, die ALLES als
   Konflikt meldet, bestünde Block A mühelos und wäre trotzdem wertlos — sie
   würde jeden sinnvollen Kombinationstag verhindern (Laufen + Oberkörper ist
   gute Planung, kein Fehler). Erst beide Blöcke zusammen zeigen, ob das Modell
   trennscharf ist.

   Und Block C prüft die eigentliche Zusage: dass keine SPORTART-NAMEN im Spiel
   sind. Eine Sportart, die das Modul gar nicht kennt, darf nicht konfliktfrei
   neben allem stehen — „unbekannt" muss vorsichtig machen, nicht sorglos.

   node supabase/tests/load_profile_test.mjs [appRoot-absolut] */
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

const LP = require(join(APP, 'js/engine/load-profile.js'));
const GV = require(join(APP, 'js/gym-volume.js'));
const D = require(join(APP, 'js/engine/week-plan-designer.js'));

const U = (t, l) => ({ t: t, l: l });
const hit = (a, b, gap) => LP.conflictBetween(a, b, gap || 0);
const names = c => c.muscles.map(m => m.muscle).join(', ');

/* ============ A) Die vier Beispiele aus dem Befund ============ */
sec('A · Die vier gemeldeten Fälle');
{
  const c = hit(U('Rudern', 'Easy Z2'), U('Gym', 'Rücken'));
  ok('Rudern + Rückentraining am selben Tag kollidiert', c.conflict, names(c));
  ok('… und zwar erkennbar über Lat und oberen Rücken',
     c.muscles.some(m => m.muscle === 'lats') && c.muscles.some(m => m.muscle === 'upper_back'), names(c));
}
{
  const c = hit(U('Fußball', 'Training'), U('Gym', 'Beine'));
  ok('Fußball + Beintraining kollidiert', c.conflict, names(c));
  ok('… über die Streckerkette', c.muscles.some(m => ['quads','hamstrings','glutes'].indexOf(m.muscle) >= 0));
}
{
  const c = hit(U('Laufen', 'Intervalle'), U('Gym', 'Beine'));
  ok('Laufen + Beintraining kollidiert', c.conflict, names(c));
}
{
  const same = hit(U('Gym', 'Ganzkörper'), U('Gym', 'Ganzkörper'));
  const next = hit(U('Gym', 'Ganzkörper'), U('Gym', 'Ganzkörper'), 24);
  const after = hit(U('Gym', 'Ganzkörper'), U('Gym', 'Ganzkörper'), 48);
  ok('Ganzkörper + Ganzkörper am selben Tag kollidiert', same.conflict);
  ok('… und auch am Folgetag (24 h reichen den großen Gruppen nicht)', next.conflict, names(next));
  ok('… nach 48 h ist es zulässig — Erholung ist der Maßstab, nicht ein Verbot',
     !after.conflict, names(after));
}

/* ============ B) Gegenproben — trennscharf, nicht pauschal ============ */
sec('B · Gegenproben: sinnvolle Kombinationen bleiben erlaubt');
[
  [U('Laufen', 'Z2 Dauerlauf'), U('Gym', 'Oberkörper'), 0, 'Laufen + Oberkörper am selben Tag'],
  [U('Schwimmen', 'Technik'), U('Gym', 'Beine'), 0, 'Schwimmen + Beintraining'],
  [U('Gym', 'Push'), U('Gym', 'Pull'), 24, 'Push heute, Pull morgen'],
  [U('Laufen', 'Z2 Dauerlauf'), U('Gym', 'Brust'), 0, 'lockerer Lauf + Brust'],
  [U('Rad', 'Easy Z2'), U('Gym', 'Oberkörper'), 0, 'lockeres Rad + Oberkörper']
].forEach(([a, b, gap, label]) => {
  const c = hit(a, b, gap);
  ok(label + ' ist KEIN Konflikt', !c.conflict, names(c));
});
{
  const c = hit(U('Laufen', 'Intervalle'), U('Rad', 'Intervalle'));
  ok('zwei systemisch harte Einheiten kollidieren auch bei anderen Muskeln (zentrale Ermüdung)',
     c.conflict && c.systemic === true);
}
{
  const c = hit(U('Laufen', 'Z2 Dauerlauf'), U('Rad', 'Easy Z2'));
  ok('zwei LOCKERE Ausdauereinheiten kollidieren systemisch NICHT',
     !c.systemic, 'systemisch=' + c.systemic);
}

/* ============ C) Sportartenübergreifend, nicht namensbasiert ============ */
sec('C · Die Logik kennt Muskeln, keine Sportart-Sonderfälle');
{
  const src = readFileSync(join(APP, 'js/engine/week-plan-designer.js'), 'utf8');
  ok('der Planer enthält keine Sportart-Sonderregeln wie „Fußball" oder „Rudern"',
     !/fussball|fußball|rudern|rowing|football/i.test(src.replace(/\/\*[\s\S]*?\*\//g, '')));
  ok('er fragt stattdessen das Lastprofil', /conflictBetween/.test(src));
}
{
  const c = hit(U('Unterwasserrugby', 'Training'), U('Gym', 'Ganzkörper'));
  ok('eine UNBEKANNTE Sportart steht nicht konfliktfrei neben allem', c.conflict, names(c));
  ok('… und der Fall wird ausgewiesen, nicht verschwiegen',
     LP.profileOf(U('Unterwasserrugby', 'Training')).unknownSport === true);
}
{
  ok('die Muskelschlüssel sind identisch mit gym-volume.js (eine Sprache, keine zwei)',
     JSON.stringify(LP.MUSCLES.slice().sort()) === JSON.stringify(GV.MUSCLES.slice().sort()),
     'load-profile ' + LP.MUSCLES.length + ' · gym-volume ' + GV.MUSCLES.length);
  ok('jede Muskelgruppe hat eine hinterlegte Erholungszeit',
     LP.MUSCLES.every(m => typeof LP.RECOVERY_H[m] === 'number' && LP.RECOVERY_H[m] > 0));
  ok('jede Sportart im Lastprofil nutzt nur bekannte Muskelschlüssel',
     Object.keys(LP.SPORT_LOAD).every(s => Object.keys(LP.SPORT_LOAD[s]).every(m => LP.MUSCLES.indexOf(m) >= 0)));
  ok('dasselbe gilt für die Gym-Splits',
     Object.keys(LP.GYM_LOAD).every(s => Object.keys(LP.GYM_LOAD[s]).every(m => LP.MUSCLES.indexOf(m) >= 0)));
}

/* ============ D) Intensität skaliert die Last ============ */
sec('D · Intensität wirkt auf die Beanspruchung');
{
  const easy = LP.profileOf(U('Laufen', 'Z2 Dauerlauf'));
  const hard = LP.profileOf(U('Laufen', 'Intervalle'));
  ok('ein Intervalltraining belastet die Waden stärker als ein lockerer Lauf',
     hard.muscles.calves > easy.muscles.calves, easy.muscles.calves + ' → ' + hard.muscles.calves);
  ok('… und systemisch deutlich mehr', hard.systemic > easy.systemic,
     easy.systemic + ' → ' + hard.systemic);
  ok('ein Long Run gilt systemisch als harte Einheit', LP.profileOf(U('Laufen', 'Long Run')).systemic >= .7);
}

/* ============ E) Der Planer nutzt es wirklich ============ */
sec('E · Der konstruierte Wochenplan ist konfliktfrei');
{
  const units = [U('Laufen', 'Long Run'), U('Laufen', 'Intervalle'), U('Laufen', 'Z2 Dauerlauf'),
    U('Gym', 'Beine'), U('Gym', 'Oberkörper'), U('Rad', 'Easy Z2'), U('Schwimmen', 'Technik')];
  const r = D.designWeek(units, { availableDayIdx: [0,1,2,3,4,5,6], preferredRestDayIdx: [6],
    doubleAllowedDayIdx: [0,1,2,3,4], minRestDays: 1 });
  const DN = ['Mo','Di','Mi','Do','Fr','Sa','So'];
  console.log('   → ' + r.days.map((d, i) => DN[i] + ':' + (d.map(x => x.t[0] + '·' + x.l).join('+') || '—')).join('  '));
  const conflicts = LP.weekConflicts(r.days);
  ok('die gebaute Woche enthält keine Muskel- oder Systemkollision',
     conflicts.length === 0,
     conflicts.map(c => DN[c.dayA] + '/' + DN[c.dayB] + ' ' + c.a.l + '×' + c.b.l).join(' | '));
}
{
  /* Eine bewusst schlechte Woche muss als schlecht erkannt werden — sonst
     wäre der Prüfer selbst blind. */
  const boese = [[U('Laufen', 'Long Run'), U('Gym', 'Beine')], [U('Gym', 'Ganzkörper')],
    [U('Gym', 'Ganzkörper')], [], [], [], []];
  ok('eine schlechte Woche wird als solche erkannt', LP.weekConflicts(boese).length >= 2,
     LP.weekConflicts(boese).length + ' Kollisionen');
}

/* ============ F) Wochenbilanz im Hintergrund ============ */
sec('F · Belastung wird berechnet, nicht behauptet');
{
  const wk = [[U('Laufen', 'Long Run')], [U('Gym', 'Beine')], [], [U('Laufen', 'Intervalle')], [], [], []];
  const l = LP.weekLoad(wk);
  ok('die Wochenlast wird zusammengefasst', l.sessions === 3 && l.systemic > 0, JSON.stringify(l.systemic));
  ok('die am stärksten belasteten Gruppen sind benennbar',
     l.mostLoaded.length > 0 && l.mostLoaded.every(m => LP.MUSCLES.indexOf(m) >= 0), l.mostLoaded.join(', '));
  ok('bei laufbetonter Woche stehen die Beinmuskeln oben',
     ['quads','hamstrings','glutes','calves'].some(m => l.mostLoaded.indexOf(m) >= 0), l.mostLoaded.join(', '));
}

/* ============ G) Reinheit ============ */
sec('G · Reinheit');
{
  const src = readFileSync(join(APP, 'js/engine/load-profile.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
  ok('kein Zufall, keine Uhr, kein DOM, kein Storage',
     !/Math\.random|new Date\(|Date\.now\(|document\.|localStorage/.test(src));
  const a = JSON.stringify(LP.profileOf(U('Laufen', 'Long Run')));
  const b = JSON.stringify(LP.profileOf(U('Laufen', 'Long Run')));
  ok('deterministisch', a === b);
  const u = U('Laufen', 'Long Run'); const snap = JSON.stringify(u);
  LP.profileOf(u); LP.heavyMuscles(u);
  ok('die Eingabe wird nicht mutiert', JSON.stringify(u) === snap);
}
{
  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  ok('index.html lädt load-profile VOR dem Designer',
     html.indexOf('js/engine/load-profile.js') > 0 &&
     html.indexOf('js/engine/load-profile.js') < html.indexOf('js/engine/week-plan-designer.js'));
  ok('sw.js cacht das Modul', sw.indexOf('./js/engine/load-profile.js') > 0);
}

console.log('\nload_profile: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);

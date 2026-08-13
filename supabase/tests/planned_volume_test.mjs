/* ============================================================
   ORVIA · planned-volume@1 — Saetze je Muskelgruppe in einer GEPLANTEN
   Einheit (v8-351)

   WOZU DIESES MODUL EXISTIERT: GYM-HYP-002 nennt „fuenf bis sechs Saetze pro
   Muskelgruppe und Einheit, verteilt ueber alle Uebungen, die diese
   Muskelgruppe belasten". Bis v8-350 konnte niemand das nachrechnen —
   `gym-volume` zaehlt ABSOLVIERTE Saetze aus Workout-Snapshots, geplante
   Saetze zaehlte gar nichts. Die Zahl war deshalb die letzte Quittung in
   `_ziele-ohne-leser.json`.

   DIE GEFAEHRLICHEN STELLEN, die dieser Test bewacht:

     1. SUMME, NICHT MAXIMUM. Kniebeuge 4 + Beinpresse 3 sind 7 Saetze
        Quadrizeps. Wer das Maximum nimmt, meldet 4 — und die Pruefung
        schlaegt nie an. Das ist der ganze Punkt der Regel.
     2. KEIN GERATENER STANDARDWERT. `strength-plan@1` sagt woertlich:
        „Satzanzahl ist Pflicht. Kein Default — 3 waere geraten." Eine Uebung
        ohne Satzzahl darf die Summe nicht auffuellen.
     3. NICHTS VERSCHWINDET STILL. Was nicht zuordenbar ist, steht in
        `unclassified` mit Grund. Eine Summe ueber die Haelfte der Uebungen
        ist keine Summe — und saehe von aussen aus wie eine.
     4. NUR DIREKTE SAETZE ZAEHLEN FUER DIE PRUEFUNG. Bankdruecken belastet
        den Trizeps mit halbem Gewicht; daraus „Trizeps-Saetze" zu machen,
        die niemand geplant hat, waere eine erfundene Vorgabe.

   node supabase/tests/planned_volume_test.mjs
   ============================================================ */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = [_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
  .find(p => existsSync(join(p, 'js/engine/prescription-factory.js'))) || _flat;

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

globalThis.ORVIA = globalThis.ORVIA || {};
const GV = require(join(APP, 'js/gym-volume.js'));
const PV = require(join(APP, 'js/engine/planned-volume.js'));

const ue = (id, sets, extra) => Object.assign({ exerciseId: id, sets: sets }, extra || {});

sec('A · Zaehlen');
{
  const r = PV.plannedMuscleSets([ue('squat', 4)]);
  ok('eine Uebung mit 4 Saetzen auf Quadrizeps ergibt 4 direkte Saetze',
    r.byMuscle.quads && r.byMuscle.quads.directSets === 4,
    JSON.stringify(r.byMuscle.quads));
  ok('  … und wird als gezaehlt gefuehrt', r.gezaehlteUebungen === 1, String(r.gezaehlteUebungen));

  /* DER KERNFALL. Zwei Uebungen auf dieselbe Muskelgruppe. */
  const s = PV.plannedMuscleSets([ue('squat', 4), ue('leg_press', 3)]);
  ok('zwei Uebungen auf denselben Muskel werden SUMMIERT, nicht maximiert',
    s.byMuscle.quads.directSets === 7,
    'erwartet 7, bekommen ' + s.byMuscle.quads.directSets);

  ok('indirekte Beteiligung zaehlt mit Koeffizient, nicht voll',
    s.byMuscle.glutes && s.byMuscle.glutes.directSets === 0
      && s.byMuscle.glutes.indirectSetEquivalents === 3.5,
    JSON.stringify(s.byMuscle.glutes));

  /* Rundung: 0.5er-Koeffizienten summieren sich sonst zu 4.499999999999999
     und stehen so auf der Karte. */
  const r3 = PV.plannedMuscleSets([ue('squat', 3), ue('leg_press', 3), ue('hip_thrust', 3)]);
  ok('Bruchteile werden gerundet, nicht als Gleitkommarest gezeigt',
    String(r3.byMuscle.glutes.indirectSetEquivalents).length <= 5,
    String(r3.byMuscle.glutes.indirectSetEquivalents));

  ok('jede Muskelgruppe fuehrt ihre Beitraege zurueck',
    s.byMuscle.quads.contributions.length === 2
      && s.byMuscle.quads.contributions.every(c => c.exerciseId && c.sets > 0),
    JSON.stringify(s.byMuscle.quads.contributions.map(c => c.exerciseId + ':' + c.sets)));
}

sec('B · Was NICHT gezaehlt wird — und trotzdem sichtbar bleibt');
{
  const r = PV.plannedMuscleSets([ue('squat', 4), ue('gibtsnicht_xy', 3)]);
  ok('eine unbekannte Uebung erscheint in unclassified',
    r.unclassified.length === 1 && r.unclassified[0].reason === 'nicht_zuordenbar',
    JSON.stringify(r.unclassified));
  ok('  … und faelscht die Summe nicht', r.byMuscle.quads.directSets === 4);

  /* Der Fall, in dem ein geratener Standardwert am verlockendsten waere. */
  const o = PV.plannedMuscleSets([ue('squat', null), ue('leg_press', 3)]);
  ok('eine Uebung OHNE Satzzahl wird nicht mit 3 aufgefuellt',
    o.byMuscle.quads.directSets === 3 && o.unclassified.length === 1
      && o.unclassified[0].reason === 'ohne_satzzahl',
    JSON.stringify({ quads: o.byMuscle.quads.directSets, un: o.unclassified }));

  const k = PV.plannedMuscleSets([ue('squat', 2.5), ue('leg_press', -1), ue('leg_curl', '3')]);
  ok('halbe, negative und als Text geschriebene Satzzahlen zaehlen nicht',
    Object.keys(k.byMuscle).length === 0 && k.unclassified.length === 3,
    JSON.stringify(k.unclassified.map(u => u.exerciseId + ':' + u.reason)));

  ok('ein Nicht-Objekt in der Liste bringt nichts zum Absturz',
    PV.plannedMuscleSets([null, 'squat', ue('squat', 3)]).byMuscle.quads.directSets === 3);
}

sec('C · Fail-closed');
{
  ok('leere Liste ergibt ein leeres Ergebnis, keinen Fehler',
    PV.plannedMuscleSets([]).gezaehlteUebungen === 0 && PV.plannedMuscleSets(null).gezaehlteUebungen === 0);

  /* OHNE Zuordnungsmodul darf NICHT „keine Muskelgruppe belastet"
     herauskommen — das ist etwas anderes als „ich kann es nicht sagen". */
  const ohne = PV.plannedMuscleSets([ue('squat', 4)], { gymVolume: {} });
  ok('ohne Zuordnungsmodul wird nicht gezaehlt, sondern der Grund genannt',
    ohne.grund === 'zuordnung_fehlt' && Object.keys(ohne.byMuscle).length === 0,
    JSON.stringify(ohne.grund));

  ok('das Modul ist eingefroren', Object.isFrozen(PV));
  ok('es nennt seine Version', PV.VERSION === 'planned-volume@1', PV.VERSION);

  /* Rein: zweimal derselbe Aufruf, zeichengleiches Ergebnis. */
  const a = JSON.stringify(PV.plannedMuscleSets([ue('squat', 4), ue('leg_curl', 3)]));
  const b = JSON.stringify(PV.plannedMuscleSets([ue('squat', 4), ue('leg_curl', 3)]));
  ok('gleicher Input ergibt zeichengleiches Ergebnis', a === b);

  /* KEINE zweite Zuordnungstabelle: das Modul muss die aus gym-volume
     benutzen. Wird dort etwas geaendert, muss es hier durchschlagen. */
  const eigen = PV.plannedMuscleSets([ue('was_auch_immer', 3)], {
    gymVolume: { musclesFor: () => ({ chest: 'direct' }), coeffOf: GV.coeffOf, roleOf: GV.roleOf }
  });
  ok('die Zuordnung kommt von aussen, nicht aus einer eigenen Tabelle',
    eigen.byMuscle.chest && eigen.byMuscle.chest.directSets === 3,
    JSON.stringify(Object.keys(eigen.byMuscle)));
}

sec('D · ausserhalb() — die Auswertung gegen einen Bereich');
{
  const r = PV.plannedMuscleSets([ue('squat', 4), ue('leg_press', 3), ue('leg_curl', 3)]);
  const raus = PV.ausserhalb(r.byMuscle, 5, 6);
  ok('zu viel und zu wenig werden beide gemeldet',
    raus.length === 2 && raus.some(x => x.muscle === 'quads' && x.lage === 'ueber')
      && raus.some(x => x.muscle === 'hamstrings' && x.lage === 'unter'),
    JSON.stringify(raus));

  ok('  … in stabiler Reihenfolge (gleiche Einheit, gleiche Ausgabe)',
    JSON.stringify(raus) === JSON.stringify(PV.ausserhalb(r.byMuscle, 5, 6)));

  const drin = PV.ausserhalb(PV.plannedMuscleSets([ue('squat', 5)]).byMuscle, 5, 6);
  ok('was im Bereich liegt, wird NICHT gemeldet', drin.length === 0, JSON.stringify(drin));

  /* Die Stelle, an der eine erfundene Vorgabe entstuende: Kniebeuge belastet
     die Gesaessmuskulatur mit 0.5. Daraus „2,5 Saetze zu wenig" zu machen,
     hiesse eine Zahl zu melden, die niemand geplant hat. */
  const nurIndirekt = PV.plannedMuscleSets([ue('squat', 5)]).byMuscle;
  ok('rein indirekt beteiligte Muskeln loesen keinen Befund aus',
    !PV.ausserhalb(nurIndirekt, 5, 6).some(x => x.muscle === 'glutes'),
    JSON.stringify(Object.keys(nurIndirekt)) + ' → ' + JSON.stringify(PV.ausserhalb(nurIndirekt, 5, 6)));

  ok('ohne Bereich gibt es keinen Befund',
    PV.ausserhalb(r.byMuscle, null, 6).length === 0 && PV.ausserhalb(null, 5, 6).length === 0);
}

console.log('\n' + '═'.repeat(62));
console.log('Ergebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

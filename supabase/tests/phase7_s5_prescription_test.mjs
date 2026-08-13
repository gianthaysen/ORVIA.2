/* ORVIA · Phase 7 S5 (2026-08-05) — Session Prescription im neutralen Vertrag-4-Schema.
   Kernbeweise: Schema-Selbstvalidierung, RUN-INT-001-Konformitaet (ohne Pace-Evidenz
   NIE ein Pace-Ziel — RPE-Fallback + Flag), Dauer-Bilanz der Bloecke, Determinismus,
   fail-closed bei unbekanntem Typ/fehlender Dauer.
   node supabase/tests/phase7_s5_prescription_test.mjs [appRoot-absolut] */
import { readFileSync, existsSync } from 'node:fs';
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
const PF = require(join(APP, 'js/engine/prescription-factory.js'));
const R = f => readFileSync(join(APP, f), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

function collectTargets(blocks, out) { out = out || []; blocks.forEach(b => { if (b.target) out.push(b.target); if (b.blocks) collectTargets(b.blocks, out); }); return out; }
function totalSeconds(blocks) { return blocks.reduce((s, b) => b.type === 'repeat' ? s + b.iterations * totalSeconds(b.blocks) : s + ((b.completion && b.completion.type === 'duration') ? b.completion.value : 0), 0); }

const EV = { thresholdPaceSecPerKm: 300, confidence: 'medium' };   // 5:00/km Schwelle, echte Evidenz

/* ============ Intervalle MIT Evidenz ============ */
{
  const r = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_intervals', durationMin: 50, priority: 'key' }, EV);
  ok('Intervalle · ok + Schema selbstvalidiert + Provenienz', r.ok === true && r.provenance.paceEvidenceUsed === true
     && PF.validateWorkout(r.workout).length === 0);
  const rep = r.workout.blocks.find(b => b.type === 'repeat');
  ok('Intervalle · verschachteltes repeat mit work(pace-Bereich um Schwelle)+recovery(open)',
     !!rep && rep.blocks[0].target.type === 'pace' && rep.blocks[0].target.min === Math.round(300 * 0.92)
     && rep.blocks[0].target.max === Math.round(300 * 0.98) && rep.blocks[1].target.type === 'open',
     JSON.stringify(rep && rep.blocks[0].target));
  ok('Intervalle · Dauer-Bilanz: Blocksumme ≈ geplante Dauer (±10 %)',
     Math.abs(totalSeconds(r.workout.blocks) - 50 * 60) <= 50 * 60 * 0.10, totalSeconds(r.workout.blocks) + 's');
  ok('DETERMINISMUS · identischer Input ⇒ byte-identisch',
     JSON.stringify(r) === JSON.stringify(PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_intervals', durationMin: 50, priority: 'key' }, EV)));
}

/* ============ RUN-INT-001: OHNE Pace-Evidenz NIE ein Pace-Ziel ============ */
{
  const noEv = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_intervals', durationMin: 50 }, null);
  const targets = collectTargets(noEv.workout.blocks);
  ok('RUN-INT-001 · ohne Evidenz: KEIN pace-Ziel irgendwo, RPE-Fallback + Flag',
     targets.every(t => t.type !== 'pace') && targets.some(t => t.type === 'rpe' && t.value === 8)
     && noEv.flags.indexOf('no_pace_evidence_rpe_fallback') >= 0 && noEv.provenance.paceEvidenceUsed === false);
  const lowEv = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_tempo', durationMin: 45 }, { thresholdPaceSecPerKm: 300, confidence: 'low' });
  ok('RUN-INT-001 · low-confidence-Evidenz zählt NICHT als Evidenz (kein Pace-Ziel)',
     collectTargets(lowEv.workout.blocks).every(t => t.type !== 'pace'));
  const absurd = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_easy', durationMin: 40 }, { thresholdPaceSecPerKm: 30, confidence: 'high' });
  ok('RUN-INT-001 · unplausible Pace (30 s/km) wird als Evidenz verworfen',
     collectTargets(absurd.workout.blocks).every(t => t.type !== 'pace'));
}

/* ============ Easy/Long/Tempo + Kraft ============ */
{
  const easy = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_easy', durationMin: 40 }, EV);
  ok('Easy · ein work-Block, Pace-Bereich DEUTLICH über Schwelle (1.25–1.40×)',
     easy.workout.blocks.length === 1 && easy.workout.blocks[0].target.min === Math.round(300 * 1.25)
     && easy.workout.blocks[0].target.max === Math.round(300 * 1.40));
  /* Lücken aus dem Probenlauf v8-331 ───────────────────────────────────
     F1: Geprüft war nur das Easy-Pace-Fenster. Das Tempo-Fenster (1.02–1.08)
     und das VO2-Fenster (0.92–0.98) waren ungeprüft — eine Verschiebung auf
     0.80–0.85 blieb grün. Genau diese Zahlen entscheiden aber, ob „5 km
     Tempolauf" ein Schwellenreiz oder ein Wettkampf wird. */
  {
    const SCHWELLE = 300;
    const tempo = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_tempo', durationMin: 60 },
      { thresholdPaceSecPerKm: SCHWELLE, confidence: 'high' });
    const arbeit = tempo.ok && tempo.workout.blocks.filter(b => b.type === 'work' && b.target && b.target.type === 'pace');
    ok('Tempo · das Arbeitsfenster liegt bei 1.02–1.08 × Schwelle (knapp darüber, nicht Wettkampf)',
       tempo.ok === true && arbeit.length >= 1 &&
       arbeit.every(b => b.target.min === Math.round(SCHWELLE * 1.02) && b.target.max === Math.round(SCHWELLE * 1.08)),
       JSON.stringify(arbeit && arbeit.map(b => [b.target.min, b.target.max])));
    ok('  … und liegt damit LANGSAMER als die Schwelle, nie schneller',
       arbeit.every(b => b.target.min >= SCHWELLE && b.target.max >= SCHWELLE));

    const vo2 = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_intervals', durationMin: 60 },
      { thresholdPaceSecPerKm: SCHWELLE, confidence: 'high' });
    const iv = [];
    (function sammle(bs) {
      (bs || []).forEach(b => {
        if (b.type === 'repeat') return sammle(b.blocks);
        if (b.type === 'work' && b.target && b.target.type === 'pace') iv.push(b);
      });
    })(vo2.ok ? vo2.workout.blocks : []);
    ok('Intervall · das Arbeitsfenster liegt bei 0.92–0.98 × Schwelle (schneller als Schwelle)',
       iv.length >= 1 && iv.every(b => b.target.min === Math.round(SCHWELLE * 0.92) &&
         b.target.max === Math.round(SCHWELLE * 0.98)),
       JSON.stringify(iv.map(b => [b.target.min, b.target.max])));
    ok('  … Tempo und Intervall überschneiden sich nicht (sonst wären es dieselbe Einheit)',
       arbeit[0].target.min > iv[0].target.max);
  }

  /* F6: `iterations >= 1` im Validator war ungeprüft — eine
     Wiederholungsgruppe mit 0 oder -1 Durchgängen wäre durchgelaufen und auf
     der Uhr als leere Gruppe erschienen. */
  ok('Validator · repeat mit 0, -1 oder gebrochenen Durchgängen wird abgewiesen',
     [0, -1, 0.5, null, undefined].every(n => {
       const errs = PF.validateWorkout({ sport_id: 'running', session_type: 'x', goal: 'g',
         blocks: [{ type: 'repeat', iterations: n, blocks: [
           { type: 'work', completion: { type: 'duration', value: 60, unit: 's' }, target: { type: 'open' } }] }] });
       return errs.some(e => /repeat_iterations/.test(String(e)));
     }));
  ok('  … eine gültige Wiederholungsgruppe (4 Durchgänge) bleibt zulässig',
     PF.validateWorkout({ sport_id: 'running', session_type: 'x', goal: 'g',
       blocks: [{ type: 'repeat', iterations: 4, blocks: [
         { type: 'work', completion: { type: 'duration', value: 60, unit: 's' }, target: { type: 'open' } }] }] })
       .every(e => !/repeat_iterations/.test(String(e))));

/* ══ Befund v8-336: die Factory riet Zahlen, die ihr eigener Datenvertrag verbietet ══
   Hier stand `sets: e.sets >= 1 ? e.sets : 3` und `rest_seconds: … : 120`.
   `strength-plan@1` verbietet genau das wörtlich: „Satzanzahl ist Pflicht.
   Kein Default — 3 wäre geraten." Zwei Module desselben Projekts
   widersprachen sich, und die Factory gewann still. */
console.log('\n── Befund v8-336 · keine geratenen Zahlen mehr ───────────────');
{
  const ohneAngabe = PF.buildPrescription({ sportId: 'strength', sessionType: 'strength_general',
    exercises: [{ exerciseId: 'back_squat' }] }, null);
  ok('eine Übung OHNE Satzangabe erzeugt keine erfundene 3, sondern blockiert mit Grund',
    ohneAngabe.ok === false && ohneAngabe.blocked === 'schema_invalid' &&
    (ohneAngabe.errors || []).some(e => /sets/.test(e)),
    JSON.stringify(ohneAngabe.errors));
  ok('  … und es entsteht nirgends eine Verordnung mit geratenen Werten',
    ohneAngabe.workout === null);

  const eigene = PF.buildPrescription({ sportId: 'strength', sessionType: 'strength_general',
    exercises: [{ exerciseId: 'x', sets: 4, restSeconds: 90 }] }, null);
  ok('mitgebrachte Werte gewinnen unverändert (Rangfolge 1)',
    eigene.ok === true && eigene.workout.blocks[0].sets === 4 &&
    eigene.workout.blocks[0].rest_seconds === 90 &&
    !eigene.flags.some(f => /_aus_wissen/.test(f)),
    JSON.stringify(eigene.flags));
  /* v8-337: Produktwerte sind ab hier BENANNT statt unsichtbar. Der Test
     verlangte vorher `flags.length === 0` — das ging nur, solange die Zahlen
     stumm im Code standen. */
  ok('  … und der verbliebene Produktwert (RPE-Ziel) wird als solcher ausgewiesen',
    eigene.flags.indexOf('produktwert:rpeKraft') >= 0, JSON.stringify(eigene.flags));

  /* Rangfolge 2: aus eingespeistem Wissen — mit Herkunft im Flag. */
  const wissen = { vorgaben: [
    { ziel: 'session.sets', art: 'zahl', wert: { min: 3, max: 3 }, regelId: 'GYM-S-001' },
    { ziel: 'session.rest_seconds', art: 'zahl', wert: { min: 150, max: 180 }, regelId: 'GYM-P-001' }] };
  const ausWissen = PF.buildPrescription({ sportId: 'strength', sessionType: 'strength_general',
    exercises: [{ exerciseId: 'back_squat' }], knowledge: wissen }, null);
  ok('fehlt die Angabe, springt eingespeistes WISSEN ein (Rangfolge 2)',
    ausWissen.ok === true && ausWissen.workout.blocks[0].sets === 3 &&
    ausWissen.workout.blocks[0].rest_seconds === 150);
  ok('  … und die Herkunft steht im Flag, nicht nur im Wert',
    ausWissen.flags.indexOf('sets_aus_wissen:GYM-S-001') >= 0 &&
    ausWissen.flags.indexOf('rest_aus_wissen:GYM-P-001') >= 0,
    JSON.stringify(ausWissen.flags));
  ok('  … eigene Angaben schlagen das Wissen trotzdem (Rangfolge bleibt)',
    PF.buildPrescription({ sportId: 'strength', sessionType: 'strength_general',
      exercises: [{ exerciseId: 'x', sets: 5 }], knowledge: wissen }, null)
      .workout.blocks[0].sets === 5);
  ok('  … eine qualitative Vorgabe ohne Zahl springt NICHT ein',
    PF.buildPrescription({ sportId: 'strength', sessionType: 'strength_general',
      exercises: [{ exerciseId: 'x' }],
      knowledge: { vorgaben: [{ ziel: 'session.sets', art: 'empfehlung', wert: null, regelId: 'Q' }] } }, null)
      .ok === false);
  /* Fail-closed gegen einen fehlerhaften Aufrufer: `art` ist maßgeblich, nicht
     nur das Vorhandensein eines Werts. Ohne diesen Fall wäre die Prüfung auf
     `art === 'zahl'` redundant zur Wertprüfung und damit ungeprüft — genau das
     zeigte Probe F10. */
  ok('  … und eine als „Empfehlung" markierte Vorgabe wird auch dann nicht als Zahl benutzt, wenn ein Wert danebensteht',
    PF.buildPrescription({ sportId: 'strength', sessionType: 'strength_general',
      exercises: [{ exerciseId: 'x' }],
      knowledge: { vorgaben: [{ ziel: 'session.sets', art: 'empfehlung',
        wert: { min: 9, max: 9 }, regelId: 'Q' }] } }, null).ok === false);
}

  const gym = PF.buildPrescription({ sportId: 'strength', sessionType: 'strength_general',
    exercises: [{ exerciseId: 'back_squat', sets: 4, reps: 5, rir: 2, restSeconds: 180 }, { exerciseId: 'bench_press', sets: 3, reps: 8, rir: 2 }] }, null);
  ok('Kraft · exercise-Blöcke mit sets/reps/rir/rest im Vertrag-4-Schema',
     gym.ok === true && gym.workout.blocks.length === 2 && gym.workout.blocks[0].exercise_id === 'back_squat'
     && gym.workout.blocks[0].target.type === 'rir' && PF.validateWorkout(gym.workout).length === 0);
  const gymNoList = PF.buildPrescription({ sportId: 'strength', sessionType: 'strength_general' }, null);
  ok('Kraft · ohne Übungsliste: generische Session + ehrliches Flag (keine erfundene Übungsauswahl)',
     gymNoList.ok === true && gymNoList.flags.indexOf('no_exercise_list_generic_session') >= 0);
}

/* ============ Fail-closed ============ */
{
  ok('unbekannter sessionType ⇒ blocked', PF.buildPrescription({ sportId: 'running', sessionType: 'xyz', durationMin: 40 }, null).blocked === 'unknown_session_type');
  ok('fehlende/zu kurze Dauer ⇒ blocked', PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_easy', durationMin: 5 }, null).blocked === 'duration_missing_or_too_short');
  ok('fehlende sport_id ⇒ blocked', PF.buildPrescription({ sessionType: 'endurance_easy', durationMin: 40 }, null).blocked === 'sport_id_missing');
  ok('Validator-Negativkontrolle: value UND min/max ⇒ Fehler',
     PF.validateWorkout({ sport_id: 'running', blocks: [{ type: 'work', completion: { type: 'duration', value: 600 }, target: { type: 'pace', value: 300, min: 290, max: 310 } }] }).length > 0);
}

/* ============ Reinheit + Einbindung ============ */
const src = R('js/engine/prescription-factory.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
ok('Factory pure (Code): kein Date.now/Math.random/DOM/Storage/PROFILE/Garmin-Format',
   !/Date\.now|Math\.random|document\.|localStorage|\bPROFILE\b|garmin/i.test(src));
const idx = R('index.html'), sw = R('sw.js');
ok('index.html lädt prescription-factory', idx.indexOf('js/engine/prescription-factory.js') >= 0);
ok('sw.js precacht prescription-factory', sw.indexOf("'./js/engine/prescription-factory.js'") >= 0);
const swv = (sw.match(/orvia-v8-(\d+)/) || [])[1];
ok('SW-Version >= 238, genau einmal', swv != null && Number(swv) >= 238 && (sw.match(/orvia-v8-\d+/g) || []).length === 1, 'orvia-v8-' + swv);


/* ══ Befund v8-337: Produktzahlen waren unsichtbar im Code verstreut ══
   `_rpeTarget(7)` mitten in einem ternären Ausdruck, `0.25`/`0.15` als nackte
   Faktoren, `repMin = 4`. Sie sahen aus wie Fachwissen, waren aber
   ORVIA-Entscheidungen ohne Quelle — und niemand konnte sie finden. */
console.log('\n── Befund v8-337 · Produktzahlen sind benannt und ersetzbar ──');
{
  const src = R('js/engine/prescription-factory.js');
  const ohneKommentare = src.replace(/\/\*[\s\S]*?\*\//g, '');
  ok('keine nackten RPE-Zahlen mehr im Code (alle über die Tabelle)',
    !/_rpeTarget\(\s*[0-9]/.test(ohneKommentare));
  ok('keine nackten Aufwärm-/Auslauf-Faktoren mehr',
    !/durMin \* 0\.[0-9]/.test(ohneKommentare));
  ok('die Tabelle nennt jede Zahl beim Namen und kennzeichnet sie mit [A]',
    /var DEFAULTS = \{/.test(src) && (src.match(/\[A\]/g) || []).length >= 4);

  const r = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_tempo', durationMin: 60 }, null);
  ok('jede benutzte Produktzahl steht als Flag in der Verordnung',
    ['produktwert:warmupAnteil', 'produktwert:cooldownAnteil', 'produktwert:rpeTempo',
      'produktwert:rpeWarmup'].every(f => r.flags.indexOf(f) >= 0),
    JSON.stringify(r.flags));
  ok('  … damit ist an jeder Verordnung ablesbar, welche Zahl KEINE Quelle hat',
    r.flags.filter(f => /^produktwert:/.test(f)).length >= 4);

  /* Wissen schlägt den Produktwert — und sagt woher. */
  const wissen = { vorgaben: [
    { ziel: 'session.warmup_anteil', art: 'zahl', wert: { min: 0.10, max: 0.10 }, regelId: 'RUN-WU-001' },
    { ziel: 'session.rpe_tempo', art: 'zahl', wert: { min: 6, max: 6 }, regelId: 'RUN-RPE-001' }] };
  const mitWissen = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_tempo',
    durationMin: 60, knowledge: wissen }, null);
  ok('eingespeistes Wissen ersetzt den Produktwert und nennt die Regel',
    mitWissen.flags.indexOf('warmupAnteil_aus_wissen:RUN-WU-001') >= 0 &&
    mitWissen.flags.indexOf('rpeTempo_aus_wissen:RUN-RPE-001') >= 0 &&
    mitWissen.flags.indexOf('produktwert:warmupAnteil') < 0,
    JSON.stringify(mitWissen.flags));
  ok('  … und die Ersetzung wirkt sich messbar auf die Verordnung aus',
    (() => {
      const wuOhne = r.workout.blocks.find(b => b.type === 'warmup').completion.value;
      const wuMit = mitWissen.workout.blocks.find(b => b.type === 'warmup').completion.value;
      const rpeMit = mitWissen.workout.blocks.find(b => b.type === 'work').target;
      return wuMit < wuOhne && rpeMit.type === 'rpe' && rpeMit.value === 6;
    })());
  ok('  … Determinismus bleibt: gleiche Eingabe, gleiches Ergebnis',
    JSON.stringify(mitWissen) === JSON.stringify(PF.buildPrescription(
      { sportId: 'running', sessionType: 'endurance_tempo', durationMin: 60, knowledge: wissen }, null)));
}

/* ══ Übung ohne Kennung — gefunden im ersten echten Durchlauf (v8-338) ══
   `String(e.exerciseId || e.id)` machte aus einer Übung ohne Kennung eine
   Übung NAMENS "undefined". Auf der Wochenkarte stand wörtlich:
       undefined — 4 × 5 · RPE 7 · 3 min Pause
   Kein Fehler, kein Flag, keine Sperre. Jetzt fail-closed. */
console.log('\n── Befund v8-338 · Übung ohne Kennung ───────────────────────');
{
  const ohneId = PF.buildPrescription({ sportId: 'strength', sessionType: 'strength_general',
    durationMin: 60, exercises: [{ name: 'Kniebeuge', sets: 4, reps: 5, restSeconds: 180 }] }, null);
  ok('die Verordnung wird gesperrt statt ausgeliefert', ohneId.ok === false);
  ok('  … mit dem Grund am richtigen Feld',
    ohneId.blocked === 'schema_invalid' && (ohneId.errors || []).some(e => /exercise_id/.test(e)),
    JSON.stringify(ohneId.errors));
  ok('  … und nirgends steht die Zeichenkette "undefined"',
    !/undefined/.test(JSON.stringify(ohneId)), JSON.stringify(ohneId).slice(0, 160));

  /* Gegenprobe: mit Kennung muss derselbe Aufruf durchlaufen — sonst hätte
     ich statt eines Fail-Open ein Fail-Closed-Nichts gebaut. */
  const mitId = PF.buildPrescription({ sportId: 'strength', sessionType: 'strength_general',
    durationMin: 60, exercises: [{ exerciseId: 'back_squat', sets: 4, reps: 5, restSeconds: 180 }] }, null);
  ok('  … mit Kennung läuft derselbe Aufruf durch', mitId.ok === true);
  ok('  … und die Kennung erreicht unverändert den Block',
    mitId.ok && mitId.workout.blocks[0].exercise_id === 'back_squat');

  /* Leerer String ist kein Name. Ohne diese Prüfung würde `|| e.id` ihn
     stillschweigend weiterreichen. */
  const leer = PF.buildPrescription({ sportId: 'strength', sessionType: 'strength_general',
    durationMin: 60, exercises: [{ exerciseId: '', sets: 4, reps: 5, restSeconds: 180 }] }, null);
  ok('  … ein leerer Kennungsstring zählt als keine Kennung', leer.ok === false);
}

console.log('\nphase7_s5_prescription: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);

/* ORVIA · Goal Feasibility (Bauplan Stufe 5)

   Geprüfte Invarianten — eins zu eins die neun aus Abschnitt 7 des Bauplans:
     F1 Ohne belastbare aktuelle Leistung: insufficient_data
     F2 Zieländerungen verändern C2s allowableRange niemals (Eigenschaft)
     F3 requiredTrajectory bleibt im Leistungsraum, nie in Lastprozent
     F4 achievableTrajectory ist ein Band mit Evidence, keine Punktprognose
     F5 Evidence nie stärker als der schwächste entscheidende Eingang
     F6 targetLoad:null / autoApplicable:false verhindert eine positive Aussage
     F7 Fixes Datum und flexibles Ziel werden unterschiedlich behandelt
     F8 Der Status heißt nie „machbar" oder „unmöglich"
     F9 Cache-Invalidierung umfasst Ziel, Datum, Leistung, Verfügbarkeit,
        C2-Ergebnis UND sämtliche Policy- und Modulversionen
   sowie zwei Eigenschaften, die erst beim Bau aufgefallen sind:
     F10 Die Richtung der Metrik wird nie geraten
     F11 Purität: kein Eingang wird verändert, gleiche Eingabe → gleiche Ausgabe
     F12 Der Cache-Schlüssel hängt NUR an Entscheidungsabhängigkeiten; der breite
         Runtime-Zustand steckt im getrennten Audit-Hash
     F13 Das erreichbare Band trägt seinen Modellstatus (Gruppenprior, nicht
         individualisiert), das Zeitfenster heißt, was es enthält

   node supabase/tests/goal_feasibility_test.mjs [appRoot-absolut] */
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

const E = require(join(APP, 'js/engine/evidence.js'));
const P = require(join(APP, 'js/engine/progression.js'));
const G = require(join(APP, 'js/engine/goal-feasibility.js'));

/* Ein belastbarer Leistungswert: gemessen, frisch, entscheidungsfähig.
   ageRatio 0.2 heißt „ein Fünftel der Haltbarkeit alt". */
const PERF = (o = {}) => Object.assign({
  metric: 'thresholdPaceSecPerKm', value: 300, evidence: 'strong', ageRatio: 0.2,
  measuredAt: '2026-07-01'
}, o);

/* Ein freigegebenes C2-Ergebnis: Korridor bis +8 %, handlungsfähig. */
const PROG = (o = {}) => Object.assign({
  allowableRange: { min: 0, max: 8 }, selectedDelta: 3, targetLoad: 41.2,
  provisionalTargetLoad: 41.2, actionable: true, autoApplicable: true,
  evidence: 'moderate', version: P.VERSION, policyVersion: P.POLICY_VERSION
}, o);

const IN = (o = {}) => Object.assign({
  goal: { targetValue: 285 }, level: 'intermediate',
  currentPerformance: PERF(), allowableProgression: PROG(),
  today: '2026-08-07', targetDate: '2026-11-06'   /* ≈ 13 Wochen */
}, o);

/* ══════════════════════════════════════════════════════════════ */
sec('F1 · Ohne belastbare aktuelle Leistung: insufficient_data');
{
  const faelle = [
    ['gar kein Wert', IN({ currentPerformance: null })],
    ['Wert ohne Evidenz', IN({ currentPerformance: PERF({ evidence: 'unknown' }) })],
    ['Evidenz unlesbar', IN({ currentPerformance: PERF({ evidence: 'ziemlich sicher' }) })],
    ['Wert 0', IN({ currentPerformance: PERF({ value: 0 }) })],
    ['Wert negativ', IN({ currentPerformance: PERF({ value: -3 }) })]
  ];
  faelle.forEach(([n, inp]) => {
    const r = G.feasibility(inp);
    ok(n + ' ⇒ insufficient_data', r.status === 'insufficient_data', r.status);
  });
  ok('… und der limitierende Faktor benennt die Leistung',
    faelle.every(([, inp]) => G.feasibility(inp).limitingFactors.indexOf('current_performance') >= 0));

  /* „Hat Beleg" ist nicht „darf steuern". Ein alter Wert wird nicht dadurch
     brauchbar, dass er einmal stark war. Ohne Datum gilt dasselbe: Der
     Evidenzvertrag stuft ihn auf `informational`, und eine Ausnahme hier wäre
     die Hintertür für einen undatierten Altwert. */
  const alt = G.feasibility(IN({ currentPerformance: PERF({ ageRatio: 9 }) }));
  ok('veralteter Wert steuert nicht', alt.status === 'insufficient_data' &&
    alt.limitingFactors.indexOf('current_performance_not_decision_eligible') >= 0, alt.limitingFactors.join(','));
  const ohneDatum = G.feasibility(IN({ currentPerformance: PERF({ ageRatio: null }) }));
  ok('Wert ohne Datum steuert nicht', ohneDatum.status === 'insufficient_data',
    ohneDatum.limitingFactors.join(','));
  /* Gegenprobe: Genau an der Toleranzgrenze (3×) ist er noch entscheidungsfähig —
     sonst prüfte der Test nur, dass irgendetwas ablehnt. */
  ok('an der Toleranzgrenze noch entscheidungsfähig',
    G.feasibility(IN({ currentPerformance: PERF({ ageRatio: 3 }) })).status !== 'insufficient_data');

  /* Ohne beziffertes Ziel gibt es ebenfalls keine Lücke, sondern eine Frage. */
  ok('kein Zielwert ⇒ insufficient_data',
    G.feasibility(IN({ goal: {} })).status === 'insufficient_data');
  /* Ohne Leistungsniveau wird keine Änderungsrate ANGENOMMEN. */
  const ohneLevel = G.feasibility(IN({ level: null, goal: { targetValue: 285 } }));
  ok('kein Leistungsniveau ⇒ insufficient_data, keine geratene Rate',
    ohneLevel.status === 'insufficient_data' &&
    ohneLevel.limitingFactors.indexOf('level_unknown') >= 0 &&
    ohneLevel.achievableTrajectory === null);
}

/* ══════════════════════════════════════════════════════════════ */
sec('F2 · Zieländerungen verändern C2s Korridor niemals');
{
  /* Als EIGENSCHAFT geprüft, nicht als Beispiel: über alle Zielbedarfe von
     0 bis 30 % je Woche muss der Korridor identisch bleiben. Das ist die
     Umkehrung der Abhängigkeit — sie wäre sonst nur eine Behauptung. */
  const hist = {
    rolling: { 7: { systemicPerKnownDay: 40, completeness: 1 },
      28: { systemicPerKnownDay: 40, completeness: 1 } },
    muscleReadiness: { quads: 0.9 },
    acuteChronic: { ratio: 1.0, band: 'ok', advisory: true },
    trainingState: { loadTrend: 'stable', consistency: 0.9, completeness: 1,
      evidence: 'moderate', actionable: true, monotony: 1.4, strain: 300 }
  };
  const ref = JSON.stringify(P.progressionDecision({ loadHistory: hist }).allowableRange);
  let gleich = 0, gesamt = 0, ueber = 0;
  for (let d = 0; d <= 30; d += 0.5) {
    const r = P.progressionDecision({ loadHistory: hist, goalDemand: { requiredPctPerWeek: d } });
    gesamt++;
    if (JSON.stringify(r.allowableRange) === ref) gleich++;
    if (r.selectedDelta > r.allowableRange.max) ueber++;
  }
  ok('Korridor über 61 Zielbedarfe identisch', gleich === gesamt, gleich + '/' + gesamt);
  ok('… und keine Auswahl verlässt ihn je nach oben', ueber === 0);

  /* Und andersherum: Stufe 5 fasst das C2-Ergebnis nicht an. Eingefroren
     übergeben — eine Mutation würde in strict mode werfen, eine stille
     Ersetzung fiele beim Vergleich auf. */
  const p = Object.freeze(PROG({ allowableRange: Object.freeze({ min: 0, max: 8 }) }));
  const vorher = JSON.stringify(p);
  const r = G.feasibility(IN({ allowableProgression: p }));
  ok('das C2-Ergebnis bleibt unverändert', JSON.stringify(p) === vorher);
  ok('… und Stufe 5 gibt keinen eigenen Lastwert aus',
    r.targetLoad === undefined && r.selectedDelta === undefined && r.delta === undefined);
}

/* ══════════════════════════════════════════════════════════════ */
sec('F3 · requiredTrajectory bleibt im Leistungsraum');
{
  const r = G.feasibility(IN());
  const t = r.requiredTrajectory;
  ok('Bedarf ist beschrieben', !!t);
  ok('… mit Metrik, Ausgangs- und Zielwert',
    t.metric === 'thresholdPaceSecPerKm' && t.from === 300 && t.to === 285);
  /* 300 → 285 s/km sind 5 % schneller. */
  ok('… und totalPct rechnet in Leistungsprozent', Math.abs(t.totalPct - 5) < 0.01, String(t.totalPct));
  ok('… je 12-Wochen-Block statt je Woche', t.blockWeeks === 12 && t.pctPerBlock != null);
  const keys = Object.keys(t).join(' ');
  ok('kein Lastfeld im Bedarf', !/load|volume|km|minutes/i.test(keys), keys);

  /* Die Richtung entscheidet über das Vorzeichen — beide Richtungen müssen
     dasselbe Vorzeichen für „Verbesserung nötig" liefern. */
  const schneller = G.feasibility(IN({ currentPerformance: PERF({ metric: 'thresholdPaceSecPerKm', value: 300 }), goal: { targetValue: 285 } }));
  const staerker = G.feasibility(IN({ currentPerformance: PERF({ metric: 'ftpWatts', value: 250 }), goal: { targetValue: 262.5 } }));
  ok('kleiner-ist-besser: Bedarf positiv', schneller.requiredTrajectory.totalPct > 0, String(schneller.requiredTrajectory.totalPct));
  ok('größer-ist-besser: Bedarf ebenfalls positiv', staerker.requiredTrajectory.totalPct > 0, String(staerker.requiredTrajectory.totalPct));
  ok('… und beide beziffern dieselben 5 %',
    Math.abs(schneller.requiredTrajectory.totalPct - staerker.requiredTrajectory.totalPct) < 0.01);

  /* Ziel bereits erfüllt: keine Lücke, kein Bedarf, kein Alarm. */
  const erfuellt = G.feasibility(IN({ goal: { targetValue: 320 } }));
  ok('bereits erfülltes Ziel ⇒ within_modeled_corridor',
    erfuellt.status === 'within_modeled_corridor' && erfuellt.gap.value === 0, erfuellt.status);
}

/* ══════════════════════════════════════════════════════════════ */
sec('F4 · achievableTrajectory ist ein Band, keine Punktprognose');
{
  const r = G.feasibility(IN());
  const a = r.achievableTrajectory;
  ok('Band vorhanden', !!a && a.range && a.range.min != null && a.range.max != null);
  ok('… mit echter Breite', a.range.max > a.range.min, a.range.min + '–' + a.range.max);
  ok('… mit Einheit und Blocklänge', a.range.unit === 'pct_per_block' && a.blockWeeks === 12);
  ok('… ohne Punktwert daneben', a.value === undefined && a.expected === undefined && a.point === undefined);
  ok('… und die Kurzformen widersprechen dem Band nie',
    a.min === a.range.min && a.max === a.range.max);

  /* Die Niveaus sind geordnet: Anfänger > Fortgeschrittene > Wettkampf. */
  const b = G.IMPROVEMENT_PER_BLOCK;
  ok('Niveaus sind absteigend geordnet',
    b.beginner.max > b.intermediate.max && b.intermediate.max > b.competitive.max);
  ok('jedes Niveau ist selbst ein Band',
    ['beginner', 'intermediate', 'competitive'].every(k => b[k].max > b[k].min));

  /* DIE SKALIERUNG AM KORRIDOR IST DER PUNKT, AN DEM C2 HIERHER WIRKT.
     Verbietet der Korridor jeden Aufbau, darf keine Entwicklung modelliert
     werden — sonst behauptete die Engine Fortschritt aus einem Plan, der
     keinen enthält. Als Eigenschaft über den ganzen Korridorbereich. */
  let monoton = true, prev = -1;
  for (let m = 0; m <= 8; m += 0.5) {
    const x = G.feasibility(IN({ allowableProgression: PROG({ allowableRange: { min: 0, max: m } }) }));
    const val = x.achievableTrajectory ? x.achievableTrajectory.range.max : 0;
    if (val < prev - 1e-9) monoton = false;
    prev = val;
  }
  ok('erreichbare Rate steigt monoton mit dem zulässigen Korridor', monoton);
  const gesperrt = G.feasibility(IN({ allowableProgression: PROG({ allowableRange: { min: 0, max: 0 } }) }));
  ok('Korridor 0 ⇒ keine modellierte Entwicklung',
    gesperrt.achievableTrajectory.range.max === 0 &&
    gesperrt.limitingFactors.indexOf('progression_blocked') >= 0);
  ok('… und daraus folgt keine Erreichbarkeit', gesperrt.status !== 'within_modeled_corridor', gesperrt.status);
  const voll = G.feasibility(IN());
  ok('voller Korridor ⇒ ungekürztes Band',
    voll.achievableTrajectory.range.max === G.IMPROVEMENT_PER_BLOCK.intermediate.max,
    String(voll.achievableTrajectory.range.max));

  /* Auch die Unsicherheit der Lücke ist ein Band, keine Zahl. */
  ok('die Lücke trägt eine Spanne, keine Punktzahl',
    r.gap && r.gap.uncertainty && r.gap.uncertainty.lower !== r.gap.uncertainty.upper);
  ok('… und die Spanne ist richtig herum orientiert',
    r.gap.uncertainty.upper > r.gap.uncertainty.lower);
}

/* ══════════════════════════════════════════════════════════════ */
sec('F5 · Evidence nie stärker als der schwächste Eingang');
{
  /* Als Eigenschaft über alle Kombinationen aus Leistungs-, Progressions- und
     Historienevidenz. Erwartung unabhängig nachgerechnet: das Minimum aller
     Eingänge, gedeckelt durch die Schätzung der Änderungsraten selbst. */
  const stufen = ['weak', 'moderate', 'strong'];
  const rang = x => ['unknown', 'weak', 'moderate', 'strong'].indexOf(x);
  let treffer = 0, gesamt = 0, nieStaerker = true;
  for (const p of stufen) for (const q of stufen) for (const h of stufen) {
    const r = G.feasibility(IN({
      currentPerformance: PERF({ evidence: p }),
      allowableProgression: PROG({ evidence: q }),
      historyEvidence: h
    }));
    gesamt++;
    const erwartet = Math.min(rang(p), rang(q), rang(h), rang('weak'));
    if (rang(r.evidence) === erwartet) treffer++;
    if (rang(r.evidence) > Math.min(rang(p), rang(q), rang(h))) nieStaerker = false;
  }
  ok('27 Kombinationen ergeben das Minimum', treffer === gesamt, treffer + '/' + gesamt);
  ok('… und nie mehr als der schwächste Eingang', nieStaerker);
  /* Die Deckelung auf `weak` ist keine Nachlässigkeit, sondern die Aussage
     über die Änderungsraten: Sie sind Erfahrungswerte. */
  ok('auch bei drei starken Eingängen bleibt es bei weak',
    G.feasibility(IN({ currentPerformance: PERF({ evidence: 'strong' }),
      allowableProgression: PROG({ evidence: 'strong' }), historyEvidence: 'strong' })).evidence === 'weak');
}

/* ══════════════════════════════════════════════════════════════ */
sec('F6 · Ohne Freigabe der Progression keine positive Aussage');
{
  /* Ein Bedarf, der bequem im Band läge (2 % je Block bei 2–5 %). */
  const leicht = { goal: { targetValue: 294 }, targetDate: '2026-11-06' };

  const frei = G.feasibility(IN(leicht));
  ok('freigegeben ⇒ within_modeled_corridor', frei.status === 'within_modeled_corridor', frei.status);

  /* Alle vier Sperrformen aus C2 — jede einzeln muss die positive Aussage
     verhindern. Als Tabelle, damit keine Form vergessen wird. */
  const sperren = [
    ['targetLoad null', PROG({ targetLoad: null, autoApplicable: false, actionable: false })],
    ['autoApplicable false', PROG({ autoApplicable: false, actionable: false })],
    ['actionable false', PROG({ actionable: false, autoApplicable: false, targetLoad: null })],
    ['nur provisorischer Wert', PROG({ targetLoad: null, provisionalTargetLoad: 41.2, autoApplicable: false, actionable: false })],
    ['gar kein C2-Ergebnis', null]
  ];
  sperren.forEach(([n, p]) => {
    const r = G.feasibility(IN(Object.assign({}, leicht, { allowableProgression: p })));
    ok(n + ' ⇒ keine Erreichbarkeit',
      r.status === 'insufficient_data' && r.actionable === false, r.status + '/' + r.actionable);
  });
  ok('… und der Grund wird benannt',
    G.feasibility(IN(Object.assign({}, leicht, { allowableProgression: sperren[0][1] })))
      .limitingFactors.indexOf('progression_not_actionable') >= 0);

  /* `actionable: true` allein genügt — eine handlungsfähige Entscheidung, die
     nur wegen einer Absenkung kein targetLoad trägt, ist keine Sperre. */
  ok('actionable:true ohne autoApplicable genügt',
    G.feasibility(IN(Object.assign({}, leicht, {
      allowableProgression: PROG({ actionable: true, autoApplicable: false })
    }))).status === 'within_modeled_corridor');

  /* GEGENPROBE: Die Sperre darf keine NEGATIVE Aussage unterdrücken. Ein Ziel
     weit außerhalb bleibt außerhalb — sonst würde die Sperre eine Warnung
     verschlucken, und das wäre die gefährlichere Richtung. */
  const wild = G.feasibility(IN({ goal: { targetValue: 200 }, targetDate: '2026-09-04',
    allowableProgression: PROG({ targetLoad: null, autoApplicable: false, actionable: false }) }));
  ok('eine unrealistische Forderung bleibt sichtbar',
    wild.status === 'outside_modeled_corridor', wild.status);
}

/* ══════════════════════════════════════════════════════════════ */
sec('F7 · Fixes Datum und flexibles Ziel unterscheiden sich');
{
  const ziel = { targetValue: 240 };   /* 20 % — je nach Zeitraum viel oder wenig */

  const fix = G.feasibility(IN({ goal: ziel, targetDate: '2026-10-02' }));   /* ≈ 8 Wochen */
  ok('fixes Datum: Zeit ist die harte Grenze', fix.goalMode === 'fixed_date');
  ok('… 20 % in 8 Wochen liegen außerhalb', fix.status === 'outside_modeled_corridor', fix.status);
  ok('… und die Antwort nennt beide Wege',
    fix.rationale.join(' ').indexOf('verschieben') >= 0);

  const flex = G.feasibility(IN({ goal: ziel, targetDate: null }));
  ok('flexibles Ziel: die Frage lautet „wann"', flex.goalMode === 'flexible');
  ok('… und die Antwort ist ein Zeitraum, keine Absage',
    flex.status === 'within_modeled_corridor' && flex.estimatedWeeksRange != null, flex.status);
  ok('… selbst der Zeitraum ist ein Band',
    flex.estimatedWeeksRange.min != null && flex.estimatedWeeksRange.max != null &&
    flex.estimatedWeeksRange.max > flex.estimatedWeeksRange.min,
    JSON.stringify(flex.estimatedWeeksRange));
  /* Nachgerechnet: 20 % bei 2–5 % je 12 Wochen ⇒ 48 bis 120 Wochen. */
  ok('… und der Zeitraum ist rechnerisch richtig',
    Math.abs(flex.estimatedWeeksRange.min - 48) < 0.6 && Math.abs(flex.estimatedWeeksRange.max - 120) < 1.5,
    flex.estimatedWeeksRange.min + '/' + flex.estimatedWeeksRange.max);
  ok('… und das alte, widersprüchliche Feld ist weg', flex.earliestWeeks === undefined);

  /* Dasselbe Ziel, dieselbe Leistung — nur der Modus unterscheidet sich. Wäre
     das Ergebnis identisch, gäbe es die Unterscheidung nur auf dem Papier. */
  ok('derselbe Bedarf führt zu unterschiedlichen Aussagen', fix.status !== flex.status);

  /* Ein Datum in der Vergangenheit ist keine Machbarkeitsfrage. */
  const vorbei = G.feasibility(IN({ goal: ziel, targetDate: '2026-07-01' }));
  ok('Datum in der Vergangenheit ⇒ insufficient_data',
    vorbei.status === 'insufficient_data' && vorbei.limitingFactors.indexOf('time') >= 0);
  ok('unlesbares Datum ⇒ insufficient_data',
    G.feasibility(IN({ goal: ziel, targetDate: 'demnächst' })).status === 'insufficient_data');

  /* Je knapper die Zeit, desto höher der Bedarf je Block — monoton. */
  let monoton = true, prev = 0;
  for (const w of [52, 40, 30, 24, 16, 12, 8, 6, 4]) {
    const r = G.feasibility(IN({ goal: ziel, targetDate: null, weeksLeft: w }));
    const v = r.requiredTrajectory.pctPerBlock;
    if (v < prev) monoton = false;
    prev = v;
  }
  ok('kürzere Frist ⇒ höherer Bedarf je Block', monoton);
}

/* ══════════════════════════════════════════════════════════════ */
sec('F8 · Der Status heißt nie „machbar" oder „unmöglich"');
{
  ok('drei Zustände, exakt benannt',
    JSON.stringify(G.STATUS) === JSON.stringify(['within_modeled_corridor', 'outside_modeled_corridor', 'insufficient_data']));

  /* Über einen breiten Eingaberaum darf NIE ein anderer Status entstehen und
     nie ein Wort der Gewissheit auftauchen. */
  const proben = [];
  for (const ziel of [200, 240, 285, 294, 299, 300, 320]) {
    for (const lvl of ['beginner', 'intermediate', 'competitive', null]) {
      for (const d of ['2026-09-04', '2026-11-06', '2027-06-04', null]) {
        proben.push(G.feasibility(IN({ goal: { targetValue: ziel }, level: lvl, targetDate: d })));
      }
    }
  }
  ok(proben.length + ' Proben: nur die drei Zustände',
    proben.every(r => G.STATUS.indexOf(r.status) >= 0));
  const woerter = /\b(machbar|unmöglich|unmoeglich|sicher erreichbar|garantiert|feasible|impossible)\b/i;
  ok('… und kein Wort der Gewissheit in Status oder Begründung',
    proben.every(r => !woerter.test(r.status + ' ' + r.rationale.join(' ') + ' ' + (r.modelNote || ''))));
  ok('jede Antwort trägt den Modellvorbehalt',
    proben.every(r => typeof r.modelNote === 'string' && r.modelNote.length > 20));
  ok('jede Antwort trägt eine Begründung',
    proben.every(r => Array.isArray(r.rationale) && r.rationale.length > 0));
  ok('jede Antwort trägt Version und Policy-Version',
    proben.every(r => r.version === 'goal-feasibility@4' && r.policyVersion === 'gf-policy@2'));
  /* „außerhalb des Korridors" ist eine Modellaussage — sie darf nie mit
     `actionable: true` als Handlungsgrundlage auftreten. */
  ok('außerhalb des Korridors ist nie handlungsfähig',
    proben.every(r => r.status !== 'outside_modeled_corridor' || r.actionable === false));
}

/* ══════════════════════════════════════════════════════════════ */
sec('F9 · Cache-Schlüssel: nur Entscheidungsabhängigkeiten');
{
  const basis = IN();
  const k = i => G.cacheKey(i).key;
  const ref = k(basis);
  ok('gleicher Eingang ⇒ gleicher Schlüssel', k(IN()) === ref);

  const aenderungen = [
    ['Zielwert', IN({ goal: { targetValue: 280 } })],
    ['Zieldatum', IN({ targetDate: '2026-12-04' })],
    ['heutiges Datum', IN({ today: '2026-08-14' })],
    ['Leistungsniveau', IN({ level: 'beginner' })],
    ['Leistungswert', IN({ currentPerformance: PERF({ value: 298 }) })],
    ['Leistungsevidenz', IN({ currentPerformance: PERF({ evidence: 'moderate' }) })],
    ['Messdatum', IN({ currentPerformance: PERF({ measuredAt: '2026-05-01' }) })],
    ['Alter des Werts', IN({ currentPerformance: PERF({ ageRatio: 1.5 }) })],
    ['Metrik', IN({ currentPerformance: PERF({ metric: 'ftpWatts' }) })],
    ['Historienevidenz', IN({ historyEvidence: 'weak' })],
    ['Verfügbarkeit', IN({ availability: { days: 4 } })],
    ['verbleibende Wochen', IN({ weeksLeft: 20 })],
    ['C2-Korridor', IN({ allowableProgression: PROG({ allowableRange: { min: 0, max: 5 } }) })],
    ['C2-Auswahl', IN({ allowableProgression: PROG({ selectedDelta: 5 }) })],
    ['C2-Handlungsfähigkeit', IN({ allowableProgression: PROG({ actionable: false }) })],
    ['C2-Autoanwendung', IN({ allowableProgression: PROG({ autoApplicable: false }) })],
    ['C2-Ziellast', IN({ allowableProgression: PROG({ targetLoad: null }) })],
    ['C2-Evidenz', IN({ allowableProgression: PROG({ evidence: 'weak' }) })],
    ['C2-Modulversion', IN({ allowableProgression: PROG({ version: 'progression@99' }) })],
    ['C2-Policy-Version', IN({ allowableProgression: PROG({ policyVersion: 'prog-policy@99' }) })],
    ['Version des Leistungsmodells', IN({ currentPerformance: PERF({ modelVersion: 'zones@9' }) })],
    ['Evidenz-Vertragsversion', IN({ evidenceVersion: 'evidence@99' })]
  ];
  aenderungen.forEach(([n, i]) => ok(n + ' ändert den Schlüssel', k(i) !== ref));

  /* DER SCHLÜSSEL TRÄGT GENAU DIE SECHS VEREINBARTEN FELDER — nicht mehr.
     Eines zu viel bedeutet unnötige Cache-Misses, eines zu wenig ein
     wiederverwendetes Urteil aus alter Politik. */
  const felder = Object.keys(G.cacheKey(basis).parts).sort();
  ok('genau die sechs vereinbarten Felder',
    JSON.stringify(felder) === JSON.stringify(['evidenceVersion', 'feasibilityPolicyVersion',
      'goalFeasibilityVersion', 'inputHash', 'performanceModelVersion', 'progressionContractVersion']),
    felder.join(','));
  ok('… mit den eigenen Versionen darin',
    G.cacheKey(basis).parts.goalFeasibilityVersion === 'goal-feasibility@4' &&
    G.cacheKey(basis).parts.feasibilityPolicyVersion === 'gf-policy@2');
  ok('… und der C2-Vertrag steht als Modul/Policy-Paar darin',
    G.cacheKey(basis).parts.progressionContractVersion === P.VERSION + '/' + P.POLICY_VERSION);
  ok('… ein fehlender C2-Vertrag ist ein eigener Zustand, nicht „egal"',
    G.cacheKey(IN({ allowableProgression: null })).parts.progressionContractVersion === 'absent/absent');

  /* DER KERNPUNKT DIESER ÜBERARBEITUNG: Der Schlüssel darf NICHT davon abhängen,
     was sonst gerade geladen ist. Geprüft, indem Module mit abweichenden
     Versionen in die globale Registry gehängt werden — Module, deren Verhalten
     dieses Ergebnis nicht beeinflussen kann. Vorher hätte allein das Nachladen
     von session-debrief den Schlüssel verändert. */
  const OR = globalThis.ORVIA;
  const sicher = { debrief: OR.sessionDebrief, zones: OR.performanceZones,
    profile: OR.loadProfile, history: OR.loadHistory };
  OR.sessionDebrief = { VERSION: 'session-debrief@99' };
  OR.performanceZones = { VERSION: 'performance-zones@99' };
  OR.loadProfile = { VERSION: 'load-profile@99' };
  OR.loadHistory = { VERSION: 'load-history@99', POLICY_VERSION: 'lh-policy@99' };
  const nachher = k(basis);
  const urteilNachher = JSON.stringify(G.feasibility(basis));
  const auditMit = G.auditHash(basis).key;
  Object.assign(OR, { sessionDebrief: sicher.debrief, performanceZones: sicher.zones,
    loadProfile: sicher.profile, loadHistory: sicher.history });
  const auditOhne = G.auditHash(basis).key;

  ok('unbeteiligte Module ändern den Schlüssel NICHT', nachher === ref, ref + ' vs ' + nachher);
  ok('… und das Urteil selbst bleibt identisch', urteilNachher === JSON.stringify(G.feasibility(basis)));

  /* Der AUDIT-Hash dagegen SOLL sie sehen — dafür ist er da. */
  ok('der Audit-Hash unterscheidet die beiden Zustände sehr wohl', auditMit !== auditOhne);
  ok('… und ist nicht derselbe Wert wie der Cache-Schlüssel', auditOhne !== ref);
  ok('… er enthält Cache-Schlüssel und Eingabe-Hash',
    G.auditHash(basis).parts.cacheKey === ref && typeof G.auditHash(basis).parts.inputHash === 'string');
  ok('… und führt jedes Modul, auch ein fehlendes, ausdrücklich als „absent"',
    G.auditHash(basis, {}).parts.versions.progression === 'absent' &&
    Object.keys(G.auditHash(basis, {}).parts.versions).length >= G.AUDIT_MODULES.length);
  ok('… ein fehlendes Modul ergibt einen anderen Audit-Hash',
    G.auditHash(basis, {}).key !== G.auditHash(basis).key);
  ok('… und der Cache-Schlüssel bleibt davon unberührt',
    G.cacheKey(basis).key === ref);

  /* Der Eingabe-Hash ist die gemeinsame Grundlage beider: reagiert auf Inhalte,
     nie auf Versionen. */
  ok('der Eingabe-Hash ignoriert Versionsangaben',
    G.inputHash(basis) === G.inputHash(IN({ evidenceVersion: 'evidence@77' })));
  ok('… reagiert aber auf jede inhaltliche Änderung',
    G.inputHash(basis) !== G.inputHash(IN({ goal: { targetValue: 280 } })));
  /* Eine für uns folgenlose Änderung am C2-Ergebnis erzwingt KEINE
     Neuberechnung — sonst wäre der Cache in der Praxis wertlos. */
  ok('ein umformulierter C2-Begründungstext ändert nichts',
    k(IN({ allowableProgression: PROG({ rationale: 'anders formuliert' }) })) === ref);

  ok('das Ergebnis trägt seinen Schlüssel', G.feasibility(basis).cacheKey === ref);
  ok('auch abgebrochene Bewertungen tragen einen Schlüssel',
    [IN({ currentPerformance: null }), IN({ goal: {} }), IN({ level: null }),
      IN({ currentPerformance: PERF({ metric: 'irgendwas' }) })]
      .every(x => typeof G.feasibility(x).cacheKey === 'string' && G.feasibility(x).cacheKey.length === 8));
}

/* ══════════════════════════════════════════════════════════════ */
sec('F13 · Modellstatus des Bandes, Benennung des Zeitfensters');
{
  const a = G.feasibility(IN()).achievableTrajectory;
  /* OHNE DIESE KENNZEICHNUNG könnte `within_modeled_corridor` sauber aussehen
     und intern doch auf einer Last-zu-Leistung-Abbildung beruhen. */
  ok('das Band nennt sein Modell', a.model === 'population_prior', String(a.model));
  ok('… und weist aus, dass es NICHT individualisiert ist', a.individualized === false);
  ok('… und trägt eine eigene Evidenzangabe', a.evidence === 'weak', String(a.evidence));
  ok('die Änderungsraten sind als Erfahrungswert [S] ausgewiesen',
    a.provenance.rates.grade === 'S' && a.provenance.rates.source === 'documented_change_rates');
  ok('die Korridor-Skalierung ist als Modellannahme [A] ausgewiesen',
    a.provenance.corridorScaling.grade === 'A' &&
    a.provenance.corridorScaling.source === 'model_assumption');
  ok('… mit Faktor und Bezugsgröße, nachvollziehbar',
    a.provenance.corridorScaling.factor === 1 &&
    a.provenance.corridorScaling.referenceBuildPct === G.REFERENCE_BUILD_PCT);
  ok('… und der Text behauptet keine individuelle Vorhersage',
    /keine individuelle Vorhersage|kein individuelles Response Model/i.test(
      a.note + ' ' + a.provenance.corridorScaling.detail));
  /* Als Eigenschaft: KEIN Ergebnis darf sich je als individualisiert ausgeben,
     solange es kein Response Model gibt. */
  let alleMarkiert = true;
  for (let m = 0; m <= 8; m += 0.5) {
    for (const lvl of ['beginner', 'intermediate', 'competitive']) {
      const x = G.feasibility(IN({ level: lvl,
        allowableProgression: PROG({ allowableRange: { min: 0, max: m } }) })).achievableTrajectory;
      if (!x || x.model !== 'population_prior' || x.individualized !== false) alleMarkiert = false;
    }
  }
  ok('51 Kombinationen: durchgehend Gruppenprior, nie individualisiert', alleMarkiert);

  /* DAS ZEITFENSTER HEISST, WAS ES ENTHÄLT. */
  const flex = G.feasibility(IN({ goal: { targetValue: 240 }, targetDate: null }));
  ok('das Feld heißt estimatedWeeksRange',
    flex.estimatedWeeksRange != null && flex.earliestWeeks === undefined);
  ok('… mit min/max statt fastest/slowest',
    flex.estimatedWeeksRange.min != null && flex.estimatedWeeksRange.max != null &&
    flex.estimatedWeeksRange.fastest === undefined);
  ok('… und ebenfalls als Gruppenprior gekennzeichnet',
    flex.estimatedWeeksRange.model === 'population_prior' &&
    flex.estimatedWeeksRange.individualized === false);

  /* KEINE ERZWUNGENE DIVISION. */
  const keinAufbau = G.feasibility(IN({ goal: { targetValue: 240 }, targetDate: null,
    allowableProgression: PROG({ allowableRange: { min: 0, max: 0 } }) }));
  ok('Rate 0 ⇒ gar kein Zeitfenster, kein „unendlich"',
    keinAufbau.estimatedWeeksRange === null, JSON.stringify(keinAufbau.estimatedWeeksRange));
  ok('… und nirgends Infinity im Ergebnis',
    JSON.stringify(keinAufbau).indexOf('Infinity') < 0 && JSON.stringify(keinAufbau).indexOf('e+') < 0);
  ok('… stattdessen eine Aussage statt einer Lücke',
    keinAufbau.rationale.join(' ').indexOf('kein Zeitfenster') >= 0);

  /* Untere Kante 0 bei positiver oberer Kante ⇒ nach oben offen, keine Zahl
     erfunden. Über den ganzen Korridorbereich als Eigenschaft. */
  let konsistent = true, offenGesehen = false;
  for (let m = 0; m <= 8; m += 0.25) {
    const x = G.feasibility(IN({ goal: { targetValue: 240 }, targetDate: null, level: 'competitive',
      allowableProgression: PROG({ allowableRange: { min: 0, max: m } }) })).estimatedWeeksRange;
    if (!x) continue;
    if ((x.max === null) !== (x.open === true)) konsistent = false;
    if (x.max != null && !(x.max > x.min)) konsistent = false;
    if (x.open === true) offenGesehen = true;
  }
  ok('„offen" und „keine obere Grenze" sagen immer dasselbe', konsistent);
  ok('… und der offene Fall kommt im Korridorbereich tatsächlich vor', offenGesehen);
}

/* ══════════════════════════════════════════════════════════════ */
sec('F10 · Die Richtung der Metrik wird nie geraten');
{
  /* DER TEUERSTE DENKBARE FEHLER: Ein falsch geratenes Vorzeichen macht aus
     „10 % Verbesserung nötig" ein „Ziel bereits erreicht" — und sieht dabei
     nicht wie ein Fehler aus. Deshalb: eintragen oder ablehnen. */
  const unbekannt = G.feasibility(IN({ currentPerformance: PERF({ metric: 'irgendwas' }) }));
  ok('unbekannte Metrik ⇒ insufficient_data',
    unbekannt.status === 'insufficient_data' &&
    unbekannt.limitingFactors.indexOf('metric_direction_unknown') >= 0, unbekannt.limitingFactors.join(','));
  ok('fehlende Metrik ⇒ insufficient_data',
    G.feasibility(IN({ currentPerformance: PERF({ metric: null }), goal: { targetValue: 285 } })).status === 'insufficient_data');

  /* Die Metriken, die in dieser App tatsächlich vorkommen, sind eingetragen. */
  ['thresholdPaceSecPerKm', 'cssSecPer100', 'ftpWatts', 'vo2max'].forEach(m => {
    ok(m + ' ist eingetragen', G.directionOf(null, { metric: m }) != null, String(G.directionOf(null, { metric: m })));
  });
  ok('Zeitziele aus goal-portfolio (metricType „time") sind eingetragen',
    G.directionOf({ metricType: 'time' }, {}) === 'lower');
  /* Genau die beiden Fälle, an denen eine Teilzeichenketten-Heuristik
     gescheitert wäre — hier als Regressionsschutz festgenagelt. */
  ok('cssSecPer100 ist „kleiner ist besser", nicht umgekehrt',
    G.directionOf(null, { metric: 'cssSecPer100' }) === 'lower');
  ok('metricType „time" ist „kleiner ist besser", nicht umgekehrt',
    G.directionOf({ metricType: 'time' }, { metric: null }) === 'lower');
  ok('ftpWatts ist „größer ist besser"', G.directionOf(null, { metric: 'ftpWatts' }) === 'higher');

  /* Eine ausdrückliche Angabe schlägt die Tabelle — sie ist die Notausgangstür
     für Metriken, die hier noch nicht stehen. */
  ok('ausdrückliche Richtung schlägt die Tabelle',
    G.directionOf(null, { metric: 'ftpWatts', direction: 'lower_is_better' }) === 'lower');
  const explizit = G.feasibility(IN({ currentPerformance: PERF({ metric: 'neuerIndex', direction: 'higher_is_better', value: 100 }), goal: { targetValue: 105 } }));
  ok('… und macht eine unbekannte Metrik bewertbar',
    explizit.status !== 'insufficient_data' && Math.abs(explizit.requiredTrajectory.totalPct - 5) < 0.01, explizit.status);

  /* Die Richtung steht im Ergebnis — sonst wäre sie eine unsichtbare Annahme. */
  ok('die verwendete Richtung ist ausgewiesen',
    G.feasibility(IN()).requiredTrajectory.direction === 'lower');
}

/* ══════════════════════════════════════════════════════════════ */
sec('F11 · Purität, Robustheit, Einhängung');
{
  const src = readFileSync(join(APP, 'js/engine/goal-feasibility.js'), 'utf8');
  ok('kein DOM-Zugriff', !/document\.|window\.|localStorage/.test(src));
  ok('keine eigene Uhr', !/Date\.now|new Date\(\s*\)/.test(src));
  ok('kein Zufall', !/Math\.random/.test(src));
  ok('kein Netzwerk', !/fetch\(|XMLHttpRequest|supabase/.test(src));

  const a = JSON.stringify(G.feasibility(IN()));
  const b = JSON.stringify(G.feasibility(IN()));
  ok('gleiche Eingabe ⇒ gleiche Ausgabe', a === b);

  /* Der Eingang wird nicht verändert — auch nicht beiläufig. */
  const inp = IN();
  const vorher = JSON.stringify(inp);
  G.feasibility(inp);
  ok('der Eingang bleibt unberührt', JSON.stringify(inp) === vorher);

  /* Kein Eingang darf werfen — fail-closed heißt „insufficient_data", nicht
     „Ausnahme im Planlauf". */
  const kaputt = [undefined, null, {}, { goal: null }, { goal: { targetValue: NaN } },
    { currentPerformance: {} }, { currentPerformance: PERF(), goal: { targetValue: 285 } },
    { goal: { targetValue: 'schnell' }, currentPerformance: PERF() },
    IN({ allowableProgression: {} }), IN({ allowableProgression: { allowableRange: {} } }),
    IN({ weeksLeft: 0 }), IN({ weeksLeft: -5 }), IN({ level: 'Halbgott' })];
  let geworfen = null, alleGueltig = true;
  kaputt.forEach((x, n) => {
    try {
      const r = G.feasibility(x);
      if (G.STATUS.indexOf(r.status) < 0) alleGueltig = false;
    } catch (e) { geworfen = n + ': ' + e.message; }
  });
  ok('kein Eingang wirft', geworfen === null, geworfen || '');
  ok('… und jeder ergibt einen gültigen Zustand', alleGueltig);

  /* NaN darf sich nicht als Zahl durch das Ergebnis ziehen. */
  const nan = G.feasibility({ currentPerformance: PERF(), goal: { targetValue: NaN }, level: 'intermediate', weeksLeft: 12 });
  ok('NaN-Ziel ⇒ insufficient_data statt NaN-Rechnung', nan.status === 'insufficient_data', nan.status);
  ok('kein NaN im Ergebnis', JSON.stringify(G.feasibility(IN())).indexOf('null,null,null') < 0 &&
    !/NaN/.test(JSON.stringify(G.feasibility(IN()))));

  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  ok('Modul ist eingehängt', /js\/engine\/goal-feasibility\.js/.test(html));
  ok('… nach progression (es liest dessen Ergebnis)',
    html.indexOf('js/engine/progression.js') < html.indexOf('js/engine/goal-feasibility.js'));
  ok('… und nach evidence', html.indexOf('js/engine/evidence.js') < html.indexOf('js/engine/goal-feasibility.js'));
  ok('Modul ist im Cache-Manifest', /engine\/goal-feasibility\.js/.test(readFileSync(join(APP, 'sw.js'), 'utf8')));
  ok('Modul ist in der Versionsdrift-Bewachung',
    /goal-feasibility\.js/.test(readFileSync(join(HERE, 'module_version_drift_test.mjs'), 'utf8')));
}

console.log('\n' + '═'.repeat(62));
console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);

/* ORVIA · Adaptive Progression (Bauplan Stufe 4 / C2)

   Geprüfte Invarianten:
     P1  delta darf positiv, null oder negativ sein
     P2  +8 % begrenzt AUSSCHLIESSLICH positive Progression
     P3  Unvollständige Historie darf keine Steigerung begründen
     P4  ratio, Monotony und Strain lösen NIE allein eine Entscheidung aus
     P5  poor + actionable:false wird beobachtet, bremst aber nicht
     P6  Deload und Taper sind geplante Absenkungen, keine Fehlleistungen
     P7  Fehlende Daten ⇒ Halten oder manuell, nie aggressivere Heuristik
     P8  Ein Guardrail darf senken, nie erhöhen
     P9  returnRecommendation hat drei getrennte Pfade
     P10 Die Entscheidungsreihenfolge ist hierarchisch und nachweisbar
     P11 Purität und Robustheit

   node supabase/tests/progression_test.mjs [appRoot-absolut] */
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

/* Solide Ausgangslage: vollständige Historie, keine Signale, kein Zielbedarf. */
const HIST = (o = {}) => ({
  rolling: { 7: { systemicPerKnownDay: 40, completeness: 1 },
    28: { systemicPerKnownDay: o.base != null ? o.base : 40, completeness: 1 } },
  muscleReadiness: Object.assign({ quads: 0.9, hamstrings: 0.9, calves: 0.9 }, o.readiness || {}),
  acuteChronic: { ratio: o.ratio != null ? o.ratio : 1.0, band: o.band || 'ok', advisory: true },
  trainingState: { loadTrend: o.trend || 'stable', consistency: o.cons != null ? o.cons : 0.9,
    completeness: o.completeness != null ? o.completeness : 1,
    evidence: o.evidence || 'moderate', actionable: o.actionable !== false,
    monotony: o.monotony != null ? o.monotony : 1.4, strain: o.strain != null ? o.strain : 300 }
});
const TOL = (cells = []) => ({ cells, systemic: { status: 'unknown', actionable: false } });
const cell = (status, actionable, o = {}) => Object.assign({
  domain: 'highIntensity', sport: 'running', status, actionable,
  evidence: actionable ? 'moderate' : 'weak', n: 5
}, o);

/* ══════════════════════════════════════════════════════════════ */
sec('P1 · delta darf positiv, null und negativ sein');
{
  const werte = [
    P.progressionDecision({ loadHistory: HIST(), goalDemand: { requiredPctPerWeek: 3 } }).delta,
    P.progressionDecision({ loadHistory: HIST() }).delta,
    P.progressionDecision({ loadHistory: HIST(), toleranceState: TOL([cell('poor', true)]) }).delta
  ];
  ok('positiv möglich', werte[0] > 0, String(werte[0]));
  ok('null möglich', P.progressionDecision({ loadHistory: HIST({ cons: 0.3 }) }).delta === 0);
  ok('negativ möglich', werte[2] < 0, String(werte[2]));
  ok('alle drei Vorzeichen kommen vor',
    new Set([werte[0], P.progressionDecision({ loadHistory: HIST({ cons: 0.3 }) }).delta, werte[2]].map(Math.sign)).size === 3);
  ok('die Richtung wird benannt',
    P.progressionDecision({ loadHistory: HIST({ cons: 0.3 }) }).direction === 'hold');
}

/* ══════════════════════════════════════════════════════════════ */
sec('P2 · +8 % begrenzt ausschließlich POSITIVE Progression');
{
  const gierig = P.progressionDecision({ loadHistory: HIST(), goalDemand: { requiredPctPerWeek: 25 } });
  ok('ein hoher Zielbedarf wird gedeckelt', gierig.delta <= P.CAPS.runVolumePct, String(gierig.delta));
  ok('… genau auf die Decke', gierig.delta === P.CAPS.runVolumePct, String(gierig.delta));
  ok('… und die Deckelung wird ausgewiesen',
    gierig.guardrails.some(g => g.guardrail === 'goal_beyond_corridor'), JSON.stringify(gierig.guardrails));
  ok('… mit Vorher/Nachher', gierig.guardrails[0].from === 25 && gierig.guardrails[0].to === 8);

  /* Ein Bedarf INNERHALB des Korridors wird uebernommen — solange er ueber der
     adaptiven Empfehlung liegt. Darunter gewinnt die adaptive Empfehlung: Ein
     kleines Ziel ist kein Grund, den Aufbau zu drosseln. */
  const bescheiden = P.progressionDecision({ loadHistory: HIST(), goalDemand: { requiredPctPerWeek: 5 } });
  ok('ein Bedarf innerhalb des Korridors wird übernommen', bescheiden.delta === 5, String(bescheiden.delta));
  ok('… ohne Guardrail-Eintrag', bescheiden.guardrails.length === 0);
  ok('… und liegt innerhalb des zulässigen Korridors',
    bescheiden.goalWithinCorridor === true && bescheiden.delta <= bescheiden.allowableRange.max);

  /* Die Decke darf eine REDUKTION nicht beschneiden. */
  const runter = P.progressionDecision({ loadHistory: HIST(), toleranceState: TOL([cell('poor', true)]) });
  ok('eine Reduktion wird NICHT von der +8-%-Decke berührt',
    runter.delta < -P.CAPS.runVolumePct, String(runter.delta));
  const taper = P.progressionDecision({ loadHistory: HIST(), phase: 'taper' });
  ok('der Taper geht weit unter die Decke hinaus', taper.delta <= -40, String(taper.delta));
}

/* ══════════════════════════════════════════════════════════════ */
sec('P3 · Unvollständige Historie begründet keine Steigerung');
{
  const duenn = P.progressionDecision({
    loadHistory: HIST({ completeness: 0.4, evidence: 'weak', actionable: false }),
    goalDemand: { requiredPctPerWeek: 6 }
  });
  ok('trotz Zielbedarf keine Steigerung', duenn.delta <= 0, String(duenn.delta));
  ok('… Status ist hold', duenn.status === 'hold', duenn.status);
  ok('… limitierender Faktor ist die Datenlage', duenn.limitingFactor === 'data', duenn.limitingFactor);
  ok('… und die Begründung nennt die Vollständigkeit', /bekannte Tage/.test(duenn.rationale), duenn.rationale);
  ok('… die Entscheidung ist nicht handlungsfähig', duenn.actionable === false);

  const gar = P.progressionDecision({ goalDemand: { requiredPctPerWeek: 6 } });
  ok('ohne Historie: insufficient_data', gar.status === 'insufficient_data', gar.status);
  ok('… und delta bleibt null, nicht 0', gar.delta === null, String(gar.delta));
  ok('… es wird ausdrücklich nichts geschätzt', /nichts geschätzt/.test(gar.rationale), gar.rationale);
}

/* ══════════════════════════════════════════════════════════════ */
sec('P4 · Ratio, Monotony und Strain lösen nie allein aus');
{
  const basis = P.progressionDecision({ loadHistory: HIST(), goalDemand: { requiredPctPerWeek: 4 } });
  const spike = P.progressionDecision({
    loadHistory: HIST({ ratio: 1.9, band: 'spike' }), goalDemand: { requiredPctPerWeek: 4 } });
  ok('ein Ratio-Spike ändert die Entscheidung NICHT allein',
    spike.delta === basis.delta, `${basis.delta} vs ${spike.delta}`);
  ok('… und taucht nicht als limitierender Faktor auf',
    spike.limitingFactor !== 'ratio' && spike.limitingFactor !== 'acuteChronic', spike.limitingFactor);

  const monoton = P.progressionDecision({
    loadHistory: HIST({ monotony: 4.5, strain: 3000 }), goalDemand: { requiredPctPerWeek: 4 } });
  ok('hohe Monotony ändert die Entscheidung nicht allein',
    monoton.delta === basis.delta, `${basis.delta} vs ${monoton.delta}`);

  const src = readFileSync(join(APP, 'js/engine/progression.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  ok('acuteChronic wird im Code nicht als Entscheider gelesen', !/acuteChronic/.test(src));
  /* Wortgrenzen sind hier nicht kosmetisch: „constraint" enthaelt „strain" —
     ohne \b haette der Test das Beschwerdemodell faelschlich als Strain-Nutzung
     gemeldet und waere rot geblieben, obwohl der Code korrekt ist. */
  ok('monotony wird im Code nicht als Entscheider gelesen', !/\bmonotony\b/i.test(src));
  ok('strain wird im Code nicht als Entscheider gelesen', !/\bstrain\b/i.test(src),
    (src.match(/\bstrain\b/i) || []).join(','));
}

/* ══════════════════════════════════════════════════════════════ */
sec('P5 · Beobachtung ohne Handlungsfähigkeit bremst nicht');
{
  const beobachtet = P.progressionDecision({
    loadHistory: HIST(), toleranceState: TOL([cell('poor', false)]),
    goalDemand: { requiredPctPerWeek: 4 }
  });
  const ohne = P.progressionDecision({ loadHistory: HIST(), goalDemand: { requiredPctPerWeek: 4 } });
  ok('poor mit actionable:false bremst NICHT',
    beobachtet.delta === ohne.delta, `${ohne.delta} vs ${beobachtet.delta}`);
  ok('… wird aber sichtbar ausgewiesen',
    beobachtet.observedOnly && beobachtet.observedOnly.status === 'poor',
    JSON.stringify(beobachtet.observedOnly || null));

  const handlungsfaehig = P.progressionDecision({
    loadHistory: HIST(), toleranceState: TOL([cell('poor', true)]),
    goalDemand: { requiredPctPerWeek: 4 }
  });
  ok('poor mit actionable:true bremst sehr wohl', handlungsfaehig.delta < 0, String(handlungsfaehig.delta));
  ok('… und benennt die Zelle', /highIntensity\/running/.test(handlungsfaehig.rationale), handlungsfaehig.rationale);
  ok('… limitierender Faktor ist die Toleranz', handlungsfaehig.limitingFactor === 'tolerance');

  const grenz = P.progressionDecision({
    loadHistory: HIST(), toleranceState: TOL([cell('borderline', true)]),
    goalDemand: { requiredPctPerWeek: 6 }
  });
  ok('borderline dämpft, kehrt aber nicht um', grenz.delta > 0 && grenz.delta < 6, String(grenz.delta));
}

/* ══════════════════════════════════════════════════════════════ */
sec('P6 · Deload und Taper sind geplante Absenkungen');
{
  const taper = P.progressionDecision({ loadHistory: HIST(), phase: 'taper' });
  const deload = P.progressionDecision({ loadHistory: HIST(), phase: 'deload' });
  const erzwungen = P.progressionDecision({ loadHistory: HIST(), toleranceState: TOL([cell('poor', true)]) });

  ok('Taper senkt', taper.delta < 0 && deload.delta < 0);
  ok('Taper ist als GEPLANT gekennzeichnet', taper.direction === 'reduce_planned', taper.direction);
  ok('Deload ebenfalls', deload.direction === 'reduce_planned', deload.direction);
  ok('eine erzwungene Reduktion ist unterscheidbar',
    erzwungen.direction === 'reduce_forced', erzwungen.direction);
  ok('geplant und erzwungen sind verschiedene Richtungen',
    taper.direction !== erzwungen.direction);
  ok('der Taper nennt Intensität und Frequenz als erhalten',
    /Intensität und Frequenz bleiben/.test(taper.rationale), taper.rationale);
  ok('Taper-Volumenreduktion liegt im belegten Fenster (−40 bis −60 %)',
    taper.delta <= -40 && taper.delta >= -60, String(taper.delta));
}

/* ══════════════════════════════════════════════════════════════ */
sec('P7 · Fehlende Daten führen zu Halten, nicht zu mehr Heuristik');
{
  /* RICHTUNGSUMKEHR: Ohne Ziel liefert C2 KEINE Null, sondern eine adaptive
     Empfehlung aus Historie, Toleranz und Phase. Was ohne Feasibility fehlt,
     ist die Aussage, ob das rechtzeitig zum Ziel fuehrt — nicht die Empfehlung. */
  const ohneZiel = P.progressionDecision({ loadHistory: HIST() });
  ok('ohne Zielbedarf gibt es trotzdem eine adaptive Empfehlung',
    ohneZiel.delta > 0, String(ohneZiel.delta));
  ok('… aus dem Training selbst begründet', ohneZiel.limitingFactor === 'adaptive', ohneZiel.limitingFactor);
  ok('… und der Korridor wird ausgewiesen',
    ohneZiel.allowableRange && ohneZiel.allowableRange.max === P.CAPS.runVolumePct,
    JSON.stringify(ohneZiel.allowableRange));
  ok('… die adaptive Empfehlung liegt unter der Decke',
    ohneZiel.adaptiveDelta < ohneZiel.allowableRange.max);
  ok('bei schwacher Konsistenz wird gehalten',
    P.progressionDecision({ loadHistory: HIST({ cons: 0.3 }) }).delta === 0);

  /* Weniger Daten dürfen nie zu einem GRÖSSEREN delta führen. */
  const stufen = [1, 0.8, 0.6, 0.4, 0.2].map(c =>
    P.progressionDecision({ loadHistory: HIST({ completeness: c, actionable: c >= 0.9 }),
      goalDemand: { requiredPctPerWeek: 6 } }).delta);
  ok('mit sinkender Datenlage steigt delta nie',
    stufen.every((v, idx) => idx === 0 || (v == null ? true : v <= stufen[idx - 1])),
    stufen.join(' → '));
}

/* ══════════════════════════════════════════════════════════════ */
sec('P8 · Ein Guardrail darf senken, nie erhöhen');
{
  /* EIGENSCHAFTSPRUEFUNG ueber den ganzen Eingaberaum statt Stichprobe. */
  let verletzt = [];
  for (const demand of [0, 1, 2, 4, 6, 8, 10, 20, 50, 200]) {
    for (const readiness of [0.9, 0.3]) {
      for (const tol of [null, cell('borderline', true), cell('poor', false)]) {
        const r = P.progressionDecision({
          loadHistory: HIST({ readiness: { quads: readiness } }),
          toleranceState: tol ? TOL([tol]) : null,
          goalDemand: { requiredPctPerWeek: demand }
        });
        /* Die richtige Eigenschaft ist NICHT „delta <= demand" — die adaptive
           Empfehlung darf ein kleines Ziel uebertreffen. Ein Guardrail darf nur
           den KORRIDOR nicht anheben und nie ein `to > from` erzeugen. */
        if (r.delta != null && r.allowableRange && r.delta > r.allowableRange.max + 0.001) {
          verletzt.push(`demand ${demand} → delta ${r.delta} > max ${r.allowableRange.max}`);
        }
        if (r.allowableRange && r.allowableRange.max > P.CAPS.runVolumePct + 0.001) {
          verletzt.push(`Korridor angehoben: ${r.allowableRange.max}`);
        }
        (r.guardrails || []).forEach(g => {
          if (g.to > g.from) verletzt.push(`guardrail ${g.guardrail}: ${g.from} → ${g.to}`);
        });
      }
    }
  }
  ok('kein Guardrail hebt jemals an (60 Kombinationen)', verletzt.length === 0, verletzt.slice(0, 3).join(' · '));

  const müde = P.progressionDecision({
    loadHistory: HIST({ readiness: { quads: 0.2 } }), goalDemand: { requiredPctPerWeek: 6 } });
  ok('niedrige Muskelerholung deckelt auf 0', müde.delta === 0, String(müde.delta));
  ok('… und zwar den KORRIDOR, nicht nur die Empfehlung', müde.allowableRange.max === 0);
  ok('… und wird als Guardrail ausgewiesen',
    müde.guardrails.some(g => g.guardrail === 'muscle_readiness'), JSON.stringify(müde.guardrails));
}

/* ══════════════════════════════════════════════════════════════ */
sec('P9 · Wiedereinstieg hat drei getrennte Pfade');
{
  const pause = P.returnRecommendation({ reason: 'break', days: 20 });
  ok('normale Pause ⇒ Bereich', pause.path === 'range', pause.path);
  ok('… mit Korridor statt Festwert', pause.range.min < pause.range.max,
    `${pause.range.min}–${pause.range.max}`);
  ok('… und der Planwert ist der konservative Rand',
    pause.recommended === pause.range.min, String(pause.recommended));
  ok('… die Annahme wird benannt', /Annahmen, keine Messgrößen/.test(pause.rationale));

  const cross = P.returnRecommendation({ reason: 'break', days: 20, crossTrainingLoad: 300 });
  ok('Crosstraining hebt den Korridor an',
    cross.range.min > pause.range.min, `${pause.range.min} → ${cross.range.min}`);
  ok('kurze Pause unter einer Woche ist keine Unterbrechung',
    P.returnRecommendation({ reason: 'break', days: 3 }) === null);

  const krankAkut = P.returnRecommendation({ reason: 'illness', symptomFreeDays: 0 });
  ok('Krankheit ohne Symptomfreiheit ⇒ kein Prozentwert',
    krankAkut.path === 'criteria' && krankAkut.recommended === null, krankAkut.path);
  ok('… und blockiert ausdrücklich', krankAkut.blocked === true);
  ok('… mit dem ehrlichen Grund: Mechanismus belegt, Zahl nicht',
    /Mechanismus, nicht eine Prozentzahl/.test(krankAkut.rationale), krankAkut.rationale);
  const krankFrei = P.returnRecommendation({ reason: 'illness', symptomFreeDays: 3 });
  ok('nach Symptomfreiheit ⇒ konservativer Bereich', krankFrei.path === 'range' && krankFrei.recommended === krankFrei.range.min);

  const verletzt = P.returnRecommendation({ reason: 'injury' });
  ok('Verletzung ⇒ KEIN Prozentwert', verletzt.recommended === null && verletzt.range === null);
  ok('… sondern ein Kriterienpfad', verletzt.path === 'criteria' && Array.isArray(verletzt.criteriaPath));
  ok('… und die fehlende Kriterienführung wird gekennzeichnet', verletzt.pending === true);
  const mitKriterien = P.returnRecommendation({ reason: 'injury',
    returnCriteria: [{ criterion: 'pain_free_5k', over: '2 Einheiten' }] });
  ok('mit Kriterien aus D1 entfällt der Hinweis', mitKriterien.pending === false);

  /* Die drei Pfade sind wirklich getrennt. */
  ok('drei verschiedene Ergebnisformen',
    new Set([pause.path, krankAkut.path, verletzt.path]).size === 2 &&
    pause.recommended !== null && krankAkut.recommended === null && verletzt.range === null);
}

/* ══════════════════════════════════════════════════════════════ */
sec('P10 · Die Reihenfolge ist hierarchisch und nachweisbar');
{
  /* Sicherheit ueberstimmt alles — auch einen hohen Zielbedarf und gute Daten. */
  const constraint = P.progressionDecision({
    loadHistory: HIST(), goalDemand: { requiredPctPerWeek: 8 },
    constraints: [{ region: 'knee', severity: 2, blocks: ['impact'] }]
  });
  ok('eine aktive Einschränkung überstimmt den Zielbedarf',
    constraint.status === 'blocked' && constraint.delta === null, constraint.status);
  ok('… und die Stufen zeigen, dass danach nichts mehr lief',
    constraint.steps.join(',') === '1_safety', constraint.steps.join(','));

  const rueckkehr = P.progressionDecision({
    loadHistory: HIST(), goalDemand: { requiredPctPerWeek: 8 },
    interruption: { reason: 'break', days: 30 }
  });
  ok('eine Unterbrechung überstimmt den Zielbedarf ebenfalls',
    rueckkehr.limitingFactor === 'return', rueckkehr.limitingFactor);
  ok('… und ist eine geplante Absenkung', rueckkehr.direction === 'reduce_planned', rueckkehr.direction);

  const voll = P.progressionDecision({ loadHistory: HIST(), goalDemand: { requiredPctPerWeek: 4 } });
  ok('ohne Sonderfall werden alle Stufen durchlaufen',
    voll.steps.length === 8, voll.steps.join(','));
  ok('… in genau dieser Reihenfolge',
    voll.steps.join(',') === '1_safety,2_data,2b_rebound,3_tolerance,4_phase_goal,5_adaptive,6_guardrails,7_recommend',
    voll.steps.join(','));

  /* Datenprüfung liegt VOR der Toleranzprüfung: Ohne Daten wird die Toleranz
     gar nicht erst befragt. */
  const ohneDaten = P.progressionDecision({
    loadHistory: HIST({ actionable: false, completeness: 0.3 }),
    toleranceState: TOL([cell('poor', true)])
  });
  ok('ohne Datenlage entscheidet die Datenlage, nicht die Toleranz',
    ohneDaten.limitingFactor === 'data', ohneDaten.limitingFactor);
  ok('… und Stufe 3 wurde nicht mehr erreicht',
    ohneDaten.steps.indexOf('3_tolerance') < 0, ohneDaten.steps.join(','));
}

/* ══════════════════════════════════════════════════════════════ */
sec('P12 · Das Ziel treibt die Progression NICHT');
{
  /* Die wichtigste Invariante dieser Fassung. Waere es andersherum, erzeugte
     ein unrealistisches Ziel dauerhaft Druck bis an die Decke — Woche fuer
     Woche, ohne dass irgendwo „das geht nicht" staende. */
  const ohne = P.progressionDecision({ loadHistory: HIST() });
  const mitViel = P.progressionDecision({ loadHistory: HIST(), goalDemand: { requiredPctPerWeek: 200 } });
  ok('der Korridor ist ohne und mit Ziel identisch',
    JSON.stringify(ohne.allowableRange) === JSON.stringify(mitViel.allowableRange),
    `${JSON.stringify(ohne.allowableRange)} vs ${JSON.stringify(mitViel.allowableRange)}`);
  ok('ein Ziel kann den Korridor nicht verschieben',
    mitViel.allowableRange.max === P.CAPS.runVolumePct);
  ok('… und wird als außerhalb gekennzeichnet', mitViel.goalWithinCorridor === false);
  ok('… die Begründung verweist auf die Machbarkeitsprüfung',
    /Machbarkeitsprüfung/.test(mitViel.rationale), mitViel.rationale);

  /* Korridorgrenzen sind KEINE Vorlieben: Ein Ziel darf sie nicht überstimmen. */
  const steigtSchon = P.progressionDecision({ loadHistory: HIST({ trend: 'rising' }), goalDemand: { requiredPctPerWeek: 8 } });
  ok('ein bereits steigender Verlauf begrenzt den Korridor',
    steigtSchon.allowableRange.max < P.CAPS.runVolumePct, String(steigtSchon.allowableRange.max));
  ok('… und das Ziel kann das nicht aushebeln',
    steigtSchon.delta <= steigtSchon.allowableRange.max, String(steigtSchon.delta));
  ok('… mit benanntem Guardrail',
    steigtSchon.limitingFactors.indexOf('already_rising') >= 0, steigtSchon.limitingFactors.join(','));

  const wackelig = P.progressionDecision({ loadHistory: HIST({ cons: 0.3 }), goalDemand: { requiredPctPerWeek: 8 } });
  ok('schwache Konsistenz deckelt den Korridor auf 0',
    wackelig.allowableRange.max === 0 && wackelig.delta === 0);
  ok('… auch gegen ein ehrgeiziges Ziel',
    wackelig.limitingFactors.indexOf('low_consistency') >= 0, wackelig.limitingFactors.join(','));

  /* Das Ziel darf innerhalb des Korridors sehr wohl auswaehlen. */
  const drin = P.progressionDecision({ loadHistory: HIST(), goalDemand: { requiredPctPerWeek: 6 } });
  ok('ein Ziel innerhalb des Korridors hebt die Empfehlung an',
    drin.delta === 6 && drin.delta > ohne.adaptiveDelta, `${ohne.adaptiveDelta} → ${drin.delta}`);
  ok('… und wird als innerhalb gekennzeichnet', drin.goalWithinCorridor === true);
  ok('ein Ziel UNTER der adaptiven Empfehlung senkt sie nicht',
    P.progressionDecision({ loadHistory: HIST(), goalDemand: { requiredPctPerWeek: 1 } }).delta === ohne.adaptiveDelta);

  /* Eigenschaftspruefung: delta ueberschreitet nie den Korridor. */
  let raus = [];
  for (const demand of [0, 1, 3, 5, 8, 12, 30, 100, 500]) {
    for (const trend of ['stable', 'rising', 'falling']) {
      for (const cons of [0.9, 0.5]) {
        const r = P.progressionDecision({ loadHistory: HIST({ trend, cons }), goalDemand: { requiredPctPerWeek: demand } });
        if (r.delta != null && r.allowableRange && r.delta > r.allowableRange.max + 0.001) {
          raus.push(`${demand}/${trend}/${cons} → ${r.delta} > ${r.allowableRange.max}`);
        }
      }
    }
  }
  ok('delta verlässt den Korridor nie (54 Kombinationen)', raus.length === 0, raus.slice(0, 3).join(' · '));
}

/* ══════════════════════════════════════════════════════════════ */
sec('P13 · Die Bezugsbasis steht im Ergebnis');
{
  /* `delta: +3` beantwortet fuer sich genommen nicht, worauf sich die 3 %
     beziehen — und die Antwort ist nicht trivial. */
  const H2 = (w7, w28) => ({
    rolling: { 7: { systemicPerKnownDay: w7, completeness: 1 }, 28: { systemicPerKnownDay: w28, completeness: 1 } },
    muscleReadiness: { quads: 0.9 },
    trainingState: { loadTrend: 'stable', consistency: 0.9, completeness: 1, evidence: 'moderate', actionable: true }
  });

  const r = P.progressionDecision({ loadHistory: H2(40, 40), goalDemand: { requiredPctPerWeek: 8 } });
  ok('die Bezugsgröße ist benannt', r.reference && r.reference.basis === 'mean28', r.reference && r.reference.basis);
  ok('… mit Fenstergröße', r.reference.windowDays === 28);
  ok('… und dem ausdrücklichen Hinweis, dass es NICHT die letzte Woche ist',
    /NICHT auf die letzte Woche/.test(r.reference.note));
  ['referenceLoad', 'targetLoad', 'absoluteCeiling', 'lastWeekLoad',
    'deltaFromReference', 'deltaFromLastWeek'].forEach(k => ok('Ergebnis enthält ' + k, k in r));
  ok('targetLoad folgt aus Referenz und delta',
    Math.abs(r.targetLoad - r.referenceLoad * (1 + r.deltaFromReference / 100)) < 0.01,
    `${r.referenceLoad} × (1+${r.deltaFromReference}%) = ${r.targetLoad}`);

  /* DER FALL, DER OHNE DIESE FELDER FALSCH GELESEN WUERDE: Die Vorwoche lag
     25 % ueber dem Mittel. `delta: +8` gegenueber dem Mittel ist in Wahrheit
     eine SENKUNG gegenueber der Vorwoche. */
  const hoch = P.progressionDecision({ loadHistory: H2(50, 40), goalDemand: { requiredPctPerWeek: 8 } });
  ok('bei überhöhter Vorwoche zeigt delta gegenüber der Referenz weiterhin +8 %',
    hoch.deltaFromReference === 8, String(hoch.deltaFromReference));
  ok('… der Woche-zu-Woche-Wert ist aber NEGATIV',
    hoch.deltaFromLastWeek < 0, String(hoch.deltaFromLastWeek));
  ok('… die beiden Vorzeichen widersprechen sich sichtbar',
    Math.sign(hoch.deltaFromReference) !== Math.sign(hoch.deltaFromLastWeek));
  ok('… und die überhöhte Vorwoche wird als solche gemeldet',
    hoch.recentWeekAboveCeiling === true);
  ok('… die Ziellast bleibt unter der absoluten Decke',
    hoch.targetLoad <= hoch.absoluteCeiling, `${hoch.targetLoad} ≤ ${hoch.absoluteCeiling}`);
  ok('… eine Ausreißerwoche wird NICHT zum Sprungbrett',
    hoch.targetLoad < hoch.lastWeekLoad, `${hoch.targetLoad} < ${hoch.lastWeekLoad}`);

  /* Der umgekehrte Fall: Nach einer Entlastungswoche ist die Rueckkehr auf das
     Mittel ein grosser Woche-zu-Woche-Sprung — und trotzdem harmlos, weil die
     absolute Last unter dem liegt, was seit vier Wochen getragen wird. */
  /* ERKLAERT als Entlastungswoche — sonst greift die Rebound-Konditionierung
     aus P14 und die Bezugsgroesse faellt bewusst auf die letzte Woche zurueck. */
  const tief = P.progressionDecision({ loadHistory: H2(30, 40), lowWeekReason: 'planned_rest',
    goalDemand: { requiredPctPerWeek: 8 } });
  ok('nach einer Entlastungswoche ist der Woche-zu-Woche-Sprung groß',
    tief.deltaFromLastWeek > 30, String(tief.deltaFromLastWeek));
  ok('… wird aber nicht blockiert, weil die chronische Basis trägt',
    tief.targetLoad <= tief.absoluteCeiling && tief.deltaFromReference === 8);
  ok('… und der Sprung ist sichtbar statt versteckt', tief.deltaFromLastWeek != null);

  /* Nur eine Woche bekannt: schwaechere Basis, wird ausgewiesen. */
  const einzeln = P.progressionDecision({
    loadHistory: { rolling: { 7: { systemicPerKnownDay: 40 }, 28: {} }, muscleReadiness: { quads: 0.9 },
      trainingState: { loadTrend: 'stable', consistency: 0.9, completeness: 1, evidence: 'moderate', actionable: true } } });
  ok('nur eine bekannte Woche wird als schwächere Basis ausgewiesen',
    einzeln.reference.basis === 'week7_only', einzeln.reference.basis);

  /* EIGENSCHAFT: Die absolute Ziellast überschreitet NIE die Decke — auch nicht
     bei einer bereits überhöhten Vorwoche und einem ehrgeizigen Ziel. Das ist
     ein Rückhalt: Mit den heutigen Decken (8 % ≤ 15 %) kann er nicht greifen;
     er sichert gegen eine spätere Änderung der Politik. */
  let ueber = [];
  for (const w7 of [10, 25, 40, 55, 80, 200]) {
    for (const demand of [0, 3, 8, 25, 100]) {
      for (const trend of ['stable', 'rising']) {
        const x = P.progressionDecision({ loadHistory: H2(w7, 40), goalDemand: { requiredPctPerWeek: demand } });
        if (x.targetLoad != null && x.absoluteCeiling != null && x.targetLoad > x.absoluteCeiling + 0.01) {
          ueber.push(`w7 ${w7}, demand ${demand} → ${x.targetLoad} > ${x.absoluteCeiling}`);
        }
      }
    }
  }
  ok('die Ziellast verletzt die absolute Decke nie (60 Kombinationen)',
    ueber.length === 0, ueber.slice(0, 3).join(' · '));

  /* Und die Decke haengt am stabilen Mittel, nicht an der Vorwoche. */
  /* Solange die chronische Basis in Gebrauch ist, haengt die Decke an ihr —
     unabhaengig davon, wie hoch oder niedrig die letzte Woche lag. */
  const hochWoche = P.progressionDecision({ loadHistory: H2(200, 40) });
  const tiefWoche = P.progressionDecision({ loadHistory: H2(10, 40), lowWeekReason: 'planned_rest' });
  ok('die absolute Decke ist an das stabile Mittel gebunden',
    hochWoche.absoluteCeiling === tiefWoche.absoluteCeiling,
    `${hochWoche.absoluteCeiling} vs ${tiefWoche.absoluteCeiling}`);
  ok('… und beide nutzen dieselbe Bezugsbasis',
    hochWoche.reference.basis === 'mean28' && tiefWoche.reference.basis === 'mean28');
}

/* ══════════════════════════════════════════════════════════════ */
sec('P14 · deload rebound ≠ unexplained low-load rebound');
{
  /* „25 % unter dem Mittel" BEWEIST keine verkraftete Entlastungswoche.
     Dieselbe Zahl entsteht bei Krankheit, Verletzung, unvollstaendiger
     Aufzeichnung oder schlechter Vertraeglichkeit. Ein unkonditionierter
     Ruecksprung wuerde ausgerechnet dort am staerksten steigern, wo die
     Ursache unbekannt ist. */
  const H3 = (w7, w28, c7 = 1) => ({
    rolling: { 7: { systemicPerKnownDay: w7, completeness: c7 }, 28: { systemicPerKnownDay: w28, completeness: 1 } },
    muscleReadiness: { quads: 0.9 },
    trainingState: { loadTrend: 'stable', consistency: 0.9, completeness: 1, evidence: 'moderate', actionable: true }
  });

  const normal = P.progressionDecision({ loadHistory: H3(40, 40) });
  ok('eine normale Woche löst nichts aus', normal.rebound.isLowWeek === false, String(normal.rebound.isLowWeek));
  ok('… und bleibt auf der chronischen Basis', normal.reference.basis === 'mean28');

  /* ERKLAERT: Rueckkehr auf die chronische Basis ist zulaessig. */
  const erklaert = P.progressionDecision({ loadHistory: H3(30, 40), lowWeekReason: 'planned_rest' });
  ok('eine erklärte Entlastungswoche wird erkannt', erklaert.rebound.isLowWeek === true);
  ok('… und als erklärt geführt', erklaert.rebound.explained === true, erklaert.rebound.reason);
  ok('… die Rückkehr auf die chronische Basis ist zulässig',
    erklaert.reference.basis === 'mean28' && erklaert.deltaFromLastWeek > 30,
    `${erklaert.reference.basis} · WoW ${erklaert.deltaFromLastWeek}%`);
  ok('… Status bleibt ok', erklaert.status === 'ok', erklaert.status);

  /* UNERKLAERT: kein Sprung. */
  const unerklaert = P.progressionDecision({ loadHistory: H3(30, 40) });
  ok('eine unerklärte niedrige Woche wird NICHT zurückgesprungen',
    unerklaert.targetLoad < erklaert.targetLoad,
    `${unerklaert.targetLoad} statt ${erklaert.targetLoad}`);
  ok('… die Bezugsgröße fällt auf die letzte Woche zurück',
    unerklaert.reference.basis === 'last_week_fallback', unerklaert.reference.basis);
  ok('… der Woche-zu-Woche-Sprung bleibt klein',
    unerklaert.deltaFromLastWeek <= P.CAPS.runVolumePct, String(unerklaert.deltaFromLastWeek));
  ok('… Status ist review, nicht ok', unerklaert.status === 'review', unerklaert.status);
  ok('… und nicht handlungsfähig ohne Rückfrage', unerklaert.actionable === false);
  ok('… die Rückfrage ist konkret',
    /geplante Entlastung.*Krankheit.*Einträge/.test(unerklaert.rationale), unerklaert.rationale);
  ok('… mit benanntem Guardrail',
    unerklaert.limitingFactors.indexOf('unexplained_low_week') >= 0, unerklaert.limitingFactors.join(','));
  ok('… und der Grund ist maschinenlesbar',
    unerklaert.rebound.reason === 'no_declared_reason', unerklaert.rebound.reason);

  /* UNVOLLSTAENDIGE DATEN: Wir wissen nicht einmal, DASS die Woche niedrig war —
     der Wert koennte ein Artefakt fehlender Eintraege sein. Konservativ. */
  const luecken = P.progressionDecision({ loadHistory: H3(30, 40, 0.3) });
  ok('bei unvollständiger Wochendaten wird ebenfalls nicht zurückgesprungen',
    luecken.reference.basis === 'last_week_fallback', luecken.reference.basis);
  ok('… mit eigenem Grund', luecken.rebound.reason === 'incomplete_week_data', luecken.rebound.reason);
  ok('… und ausgewiesener Vollständigkeit', luecken.rebound.weekCompleteness === 0.3);

  /* Der Deload-Pfad selbst senkt weiter — er soll nicht ploetzlich steigern. */
  const deload = P.progressionDecision({ loadHistory: H3(30, 40), phase: 'deload' });
  ok('die Deload-Phase senkt weiter, statt zurückzuspringen', deload.delta < 0, String(deload.delta));
  ok('… und führt den Rebound-Kontext mit', deload.rebound && deload.rebound.explained === true);

  /* Die Schwelle ist offengelegt und wirkt an der richtigen Stelle. */
  ok('die Schwelle ist offengelegt', P.REBOUND.lowWeekBelowPct === 15);
  ok('knapp unter der Schwelle löst nichts aus',
    P.progressionDecision({ loadHistory: H3(35, 40) }).rebound.isLowWeek === false,
    String(P.progressionDecision({ loadHistory: H3(35, 40) }).rebound.dropPct));
  ok('knapp über der Schwelle löst aus',
    P.progressionDecision({ loadHistory: H3(33, 40) }).rebound.isLowWeek === true,
    String(P.progressionDecision({ loadHistory: H3(33, 40) }).rebound.dropPct));

  /* Eine geschlossene Gruende-Liste: Ein unbekannter Grund ist kein Grund. */
  ok('ein erfundener Grund erklärt nichts',
    P.progressionDecision({ loadHistory: H3(30, 40), lowWeekReason: 'hatte_keine_lust' }).rebound.explained === false);
  ok('die zulässigen Gründe sind offengelegt',
    Array.isArray(P.PLANNED_LOW) && P.PLANNED_LOW.indexOf('deload') >= 0);

  /* EIGENSCHAFT: Ohne erklaerten Grund uebersteigt die Ziellast nie die letzte
     Woche plus die normale Decke — egal wie tief die Woche war. */
  let sprung = [];
  for (const w7 of [5, 12, 20, 28, 33]) {
    for (const demand of [0, 8, 50]) {
      const r = P.progressionDecision({ loadHistory: H3(w7, 40), goalDemand: { requiredPctPerWeek: demand } });
      const maxOk = w7 * 7 * (1 + P.CAPS.runVolumePct / 100);
      if (r.targetLoad > maxOk + 0.01) sprung.push(`w7 ${w7}, demand ${demand} → ${r.targetLoad} > ${maxOk.toFixed(1)}`);
    }
  }
  ok('ohne erklärten Grund gibt es nie einen Sprung (15 Kombinationen)',
    sprung.length === 0, sprung.slice(0, 3).join(' · '));
}

/* ══════════════════════════════════════════════════════════════ */
sec('P15 · Jeder Grund hat eine festgelegte Folgewirkung');
{
  /* Eine reine Werteliste wuerde nur validieren. Entscheidend ist, dass jeder
     Wert genau EINEN Pfad ausloest — „krank" ist ein bekannter Grund und
     trotzdem das Gegenteil einer Freigabe. */
  const H4 = (w7, w28) => ({
    rolling: { 7: { systemicPerKnownDay: w7, completeness: 1 }, 28: { systemicPerKnownDay: w28, completeness: 1 } },
    muscleReadiness: { quads: 0.9 },
    trainingState: { loadTrend: 'stable', consistency: 0.9, completeness: 1, evidence: 'moderate', actionable: true }
  });

  ok('die Gründe-Tabelle ordnet jedem Wert eine Folgewirkung zu',
    Object.keys(P.LOW_WEEK_REASONS).every(k => typeof P.LOW_WEEK_REASONS[k].consequence === 'string'));
  ok('… mit genau vier Folgewirkungen',
    new Set(Object.values(P.LOW_WEEK_REASONS).map(r => r.consequence)).size === 4,
    [...new Set(Object.values(P.LOW_WEEK_REASONS).map(r => r.consequence))].join(','));

  const rest = P.progressionDecision({ loadHistory: H4(30, 40), lowWeekReason: 'planned_rest' });
  ok('planned_rest führt zur chronischen Basis zurück',
    rest.status === 'ok' && rest.reference.basis === 'mean28', `${rest.status}/${rest.reference.basis}`);

  /* KRANKHEIT gehoert in den Krankheitspfad, nicht in ein allgemeines Review. */
  const krank = P.progressionDecision({ loadHistory: H4(30, 40), lowWeekReason: 'illness' });
  ok('illness landet im Krankheitspfad, nicht im Review',
    krank.status === 'manual' && krank.returnRecommendation != null, krank.status);
  ok('… und die Symptomfreiheit wird abgefragt',
    krank.returnRecommendation.path === 'criteria' && krank.returnRecommendation.blocked === true);
  ok('… ohne Prozentwert vor Symptomfreiheit', krank.returnRecommendation.recommended === null);
  const krankFrei = P.progressionDecision({ loadHistory: H4(30, 40), lowWeekReason: 'illness', symptomFreeDays: 3 });
  ok('nach Symptomfreiheit greift der konservative Bereich',
    krankFrei.returnRecommendation.path === 'range' && krankFrei.delta < 0, String(krankFrei.delta));

  /* VERLETZUNG gehoert in den Kriterienpfad. */
  const verletzt = P.progressionDecision({ loadHistory: H4(30, 40), lowWeekReason: 'injury' });
  ok('injury landet im Kriterienpfad',
    verletzt.returnRecommendation && verletzt.returnRecommendation.path === 'criteria', verletzt.status);
  ok('… ohne jeden Prozentwert',
    verletzt.returnRecommendation.recommended === null && verletzt.returnRecommendation.range === null);
  ok('… und die Herkunft der Erklärung ist nachvollziehbar',
    krank.returnRecommendation != null && verletzt.returnRecommendation != null);

  /* FEHLENDE DATEN gehoeren in Review. */
  const fehlt = P.progressionDecision({ loadHistory: H4(30, 40), lowWeekReason: 'missing_data' });
  ok('missing_data führt zu review', fehlt.status === 'review', fehlt.status);
  ok('… und NICHT zur chronischen Basis', fehlt.reference.basis === 'last_week_fallback');

  ok('ein unbekannter Grund führt ebenfalls zu review',
    P.progressionDecision({ loadHistory: H4(30, 40), lowWeekReason: 'hatte_keine_lust' }).status === 'review');

  /* Kein bekannter Grund darf still zur Freigabe werden. */
  const freigaben = Object.keys(P.LOW_WEEK_REASONS).filter(k => {
    const r = P.progressionDecision({ loadHistory: H4(30, 40), lowWeekReason: k });
    return r.reference && r.reference.basis === 'mean28' && r.status === 'ok';
  });
  ok('nur die als rebound_allowed markierten Gründe erlauben den Rücksprung',
    freigaben.sort().join(',') === P.PLANNED_LOW.slice().sort().join(','),
    `${freigaben.sort().join(',')} vs ${P.PLANNED_LOW.slice().sort().join(',')}`);
}

/* ══════════════════════════════════════════════════════════════ */
sec('P16 · Keine automatische Steigerung ohne Handlungsfähigkeit');
{
  const H5 = (o = {}) => ({
    rolling: { 7: { systemicPerKnownDay: o.w7 != null ? o.w7 : 40, completeness: 1 },
      28: { systemicPerKnownDay: 40, completeness: 1 } },
    muscleReadiness: { quads: o.readiness != null ? o.readiness : 0.9 },
    trainingState: { loadTrend: 'stable', consistency: 0.9,
      completeness: o.completeness != null ? o.completeness : 1,
      evidence: 'moderate', actionable: o.actionable !== false }
  });

  /* EIGENSCHAFT ueber alle Ausgaenge: Eine STEIGERUNG ohne Handlungsfaehigkeit
     darf nie in `targetLoad` stehen — sonst koennte ein Konsument sie blind
     anwenden. */
  const faelle = [
    { loadHistory: H5() },
    { loadHistory: H5({ w7: 30 }) },
    { loadHistory: H5({ w7: 30 }), lowWeekReason: 'planned_rest' },
    { loadHistory: H5({ w7: 30 }), lowWeekReason: 'missing_data' },
    { loadHistory: H5({ completeness: 0.4, actionable: false }) },
    { loadHistory: H5({ readiness: 0.2 }) },
    { loadHistory: H5(), phase: 'taper' },
    { loadHistory: H5(), phase: 'deload' },
    { loadHistory: H5(), interruption: { reason: 'break', days: 30 } },
    { loadHistory: H5(), interruption: { reason: 'injury' } },
    { loadHistory: H5(), constraints: [{ region: 'knee', severity: 2 }] },
    {},
    { loadHistory: H5(), goalDemand: { requiredPctPerWeek: 50 } },
    { loadHistory: H5({ w7: 30 }), goalDemand: { requiredPctPerWeek: 50 } }
  ];
  let verletzt = [];
  faelle.forEach((f, idx) => {
    const r = P.progressionDecision(f);
    const steigerung = r.delta != null && r.delta > 0;
    if (steigerung && !r.actionable && r.targetLoad != null) {
      verletzt.push(`#${idx}: Steigerung ${r.delta} nicht handlungsfähig, aber targetLoad ${r.targetLoad}`);
    }
    if (r.targetLoad != null && r.provisionalTargetLoad != null) {
      verletzt.push(`#${idx}: beide Felder gleichzeitig gesetzt`);
    }
    if (r.autoApplicable !== (r.targetLoad != null || r.delta == null)) {
      /* autoApplicable und ein vorhandener targetLoad muessen zusammenpassen. */
      if (r.delta != null) verletzt.push(`#${idx}: autoApplicable ${r.autoApplicable} vs targetLoad ${r.targetLoad}`);
    }
  });
  ok('keine automatisch anwendbare Steigerung ohne Handlungsfähigkeit (14 Ausgänge)',
    verletzt.length === 0, verletzt.slice(0, 3).join(' · '));

  const unerklaert = P.progressionDecision({ loadHistory: H5({ w7: 30 }) });
  ok('unerklärte Steigerung: targetLoad ist null', unerklaert.targetLoad === null);
  ok('… der Wert bleibt als provisionalTargetLoad erhalten',
    unerklaert.provisionalTargetLoad > 0, String(unerklaert.provisionalTargetLoad));
  ok('… und ist als vorläufig markiert', unerklaert.provisional === true);
  ok('… nicht automatisch anwendbar', unerklaert.autoApplicable === false);

  /* ASYMMETRIE: Eine ABSENKUNG ist immer anwendbar — sie zu blockieren waere
     das Gegenteil von Sicherheit. */
  const krank = P.progressionDecision({ loadHistory: H5({ w7: 30 }), lowWeekReason: 'illness', symptomFreeDays: 3 });
  ok('eine Absenkung nach Krankheit ist automatisch anwendbar',
    krank.delta < 0 && krank.targetLoad != null && krank.autoApplicable === true,
    `${krank.delta} → ${krank.targetLoad}`);
  const taper = P.progressionDecision({ loadHistory: H5(), phase: 'taper' });
  ok('der Taper ebenfalls', taper.targetLoad != null && taper.autoApplicable === true);
  const halten = P.progressionDecision({ loadHistory: H5({ completeness: 0.4, actionable: false }) });
  ok('Halten ebenfalls', halten.delta === 0 && halten.targetLoad != null && halten.autoApplicable === true);
  ok('… obwohl die Entscheidung nicht handlungsfähig ist', halten.actionable === false);
}

/* ══════════════════════════════════════════════════════════════ */
sec('P17 · Jede Zahl ist eine Auswahl aus einem Korridor');
{
  /* Auch eine ABSENKUNG ist eine Auswahl. „−40 %" als einzelne Zahl wuerde eine
     physiologische Genauigkeit behaupten, die aus einem Bereich von −40 bis −30
     stammt. Der Bereich existierte in returnRecommendation, ging aber im
     Ergebnis von progressionDecision verloren. */
  const H6 = () => ({
    rolling: { 7: { systemicPerKnownDay: 40, completeness: 1 }, 28: { systemicPerKnownDay: 40, completeness: 1 } },
    muscleReadiness: { quads: 0.9 },
    trainingState: { loadTrend: 'stable', consistency: 0.9, completeness: 1, evidence: 'moderate', actionable: true }
  });
  const TOLP = { cells: [{ domain: 'highIntensity', sport: 'running', status: 'poor', actionable: true, evidence: 'moderate' }] };

  const faelle = [
    ['Krankheit', { loadHistory: H6(), interruption: { reason: 'illness', symptomFreeDays: 3 } }],
    ['Pause', { loadHistory: H6(), interruption: { reason: 'break', days: 30 } }],
    ['Taper', { loadHistory: H6(), phase: 'taper' }],
    ['Deload', { loadHistory: H6(), phase: 'deload' }],
    ['Toleranz', { loadHistory: H6(), toleranceState: TOLP }],
    ['Normalfall', { loadHistory: H6() }],
    ['Ziel im Korridor', { loadHistory: H6(), goalDemand: { requiredPctPerWeek: 6 } }]
  ];

  let ohneKorridor = [], ausserhalb = [], ohneGrund = [];
  faelle.forEach(([name, input]) => {
    const r = P.progressionDecision(input);
    if (!r.allowableRange) { ohneKorridor.push(name); return; }
    if (r.selectedDelta < r.allowableRange.min - 0.01 || r.selectedDelta > r.allowableRange.max + 0.01) {
      ausserhalb.push(`${name}: ${r.selectedDelta} ∉ [${r.allowableRange.min}, ${r.allowableRange.max}]`);
    }
    if (!r.selectionReason) ohneGrund.push(name);
  });
  ok('jede Empfehlung trägt einen Korridor', ohneKorridor.length === 0, ohneKorridor.join(','));
  ok('die gewählte Zahl liegt immer im Korridor', ausserhalb.length === 0, ausserhalb.join(' · '));
  ok('jede Auswahl nennt ihren Grund', ohneGrund.length === 0, ohneGrund.join(','));

  const krank = P.progressionDecision({ loadHistory: H6(), interruption: { reason: 'illness', symptomFreeDays: 3 } });
  ok('Krankheit: Korridor statt Festwert',
    krank.allowableRange.min !== krank.allowableRange.max,
    `${krank.allowableRange.min} bis ${krank.allowableRange.max}`);
  ok('… und der konservative Rand wird gewählt',
    krank.selectedDelta === krank.allowableRange.min, String(krank.selectedDelta));
  ok('… mit benanntem Grund', krank.selectionReason === 'policy_conservative_edge', krank.selectionReason);

  const taper = P.progressionDecision({ loadHistory: H6(), phase: 'taper' });
  ok('Taper: Korridor entspricht der Evidenz (−60 bis −40 %)',
    taper.allowableRange.min === -60 && taper.allowableRange.max === -40,
    JSON.stringify(taper.allowableRange));
  /* Belegt ist der KORRIDOR, nicht die Auswahl darin — der Name muss das sagen. */
  ok('… und die Auswahl ist als POLITIK innerhalb des Evidenzkorridors gekennzeichnet',
    taper.selectionReason === 'policy_midpoint_of_evidence_range', taper.selectionReason);

  const deload = P.progressionDecision({ loadHistory: H6(), phase: 'deload' });
  ok('Deload ist als Konvention gekennzeichnet, nicht als Messgröße',
    deload.selectionReason === 'policy_midpoint_of_convention_range', deload.selectionReason);
  ok('jeder Auswahlgrund weist die Politik aus oder ist adaptiv/zielgetrieben',
    faelle.every(([, input]) => {
      const r = P.progressionDecision(input);
      return /^policy_/.test(r.selectionReason) ||
        ['adaptive_default', 'goal_within_corridor'].indexOf(r.selectionReason) >= 0;
    }));
  /* „Konservativ" ist eine RICHTUNG, kein Superlativ — ausser dort, wo der Name
     ausdruecklich den aeussersten Rand behauptet. */
  const tolp = P.progressionDecision({ loadHistory: H6(), toleranceState: TOLP });
  ok('policy_conservative_edge wählt tatsächlich den äußersten Rand',
    krank.selectedDelta === krank.allowableRange.min);
  ok('… und wo die Mitte gewählt wird, heißt es auch so',
    tolp.selectionReason === 'policy_midpoint_of_range' &&
    tolp.selectedDelta > tolp.allowableRange.min, `${tolp.selectedDelta} in [${tolp.allowableRange.min},${tolp.allowableRange.max}]`);

  ok('die Phasenkorridore sind offengelegt',
    P.PHASE_RANGES.taper.min === -60 && P.PHASE_RANGES.deload.max === -20);
  ok('selectedDelta und delta sind derselbe Wert',
    faelle.every(([, input]) => {
      const r = P.progressionDecision(input);
      return r.selectedDelta === r.delta;
    }));
}

/* ══════════════════════════════════════════════════════════════ */
sec('P18 · Ein Prozentwert beschreibt Volumen, nicht alle Dimensionen');
{
  /* „Taper −50 %" ist eine VOLUMENREDUKTION bei erhaltener Intensitaet und
     Frequenz — genau daran haengt die Wirkung. Wuerde ein Planer daraus „alles
     halbieren" machen, waere die evidenzgestuetzte Empfehlung beim Uebersetzen
     in Einheiten fachlich verfaelscht. */
  const H7 = () => ({
    rolling: { 7: { systemicPerKnownDay: 40, completeness: 1 }, 28: { systemicPerKnownDay: 40, completeness: 1 } },
    muscleReadiness: { quads: 0.9 },
    trainingState: { loadTrend: 'stable', consistency: 0.9, completeness: 1, evidence: 'moderate', actionable: true }
  });
  const TOL7 = { cells: [{ domain: 'highIntensity', sport: 'running', status: 'poor', actionable: true, evidence: 'moderate' }] };

  const alle = [
    ['Krankheit', { loadHistory: H7(), interruption: { reason: 'illness', symptomFreeDays: 3 } }],
    ['Pause', { loadHistory: H7(), interruption: { reason: 'break', days: 30 } }],
    ['Taper', { loadHistory: H7(), phase: 'taper' }],
    ['Deload', { loadHistory: H7(), phase: 'deload' }],
    ['Toleranz', { loadHistory: H7(), toleranceState: TOL7 }],
    ['Aufbau', { loadHistory: H7() }],
    ['Halten', { loadHistory: H7({}) }]
  ];
  let ohne = [];
  alle.forEach(([name, input]) => {
    const d = P.progressionDecision(input).dimensionPolicy;
    if (!d || d.volumeDelta == null || !d.intensityPolicy || !d.frequencyPolicy) ohne.push(name);
  });
  ok('jede Empfehlung trägt einen Ausführungsvertrag', ohne.length === 0, ohne.join(','));

  const taper = P.progressionDecision({ loadHistory: H7(), phase: 'taper' });
  ok('Taper: der Prozentwert gilt dem Volumen',
    taper.dimensionPolicy.volumeDelta === taper.selectedDelta, String(taper.dimensionPolicy.volumeDelta));
  ok('… die Intensität bleibt ERHALTEN',
    taper.dimensionPolicy.intensityPolicy === 'maintain', taper.dimensionPolicy.intensityPolicy);
  ok('… die Frequenz ebenfalls weitgehend',
    /maintain/.test(taper.dimensionPolicy.frequencyPolicy), taper.dimensionPolicy.frequencyPolicy);
  /* WORTLAUT UND VERTRAG MUESSEN DIESELBE SEMANTIK HABEN. Eine Notiz, die
     „Intensitaet und Frequenz erhalten" sagt, waehrend der Vertrag
     `maintain_or_slightly_reduce` fuehrt, laedt zu genau der Fehluebersetzung
     ein, die dieser Block verhindern soll. */
  ok('… und die Notiz nennt die Intensität als erhalten',
    /ERHALTENER Intensität/.test(taper.dimensionPolicy.note), taper.dimensionPolicy.note);
  ok('… die Frequenzsemantik in Notiz und Vertrag stimmt überein',
    /erhalten oder sinkt nur leicht/.test(taper.dimensionPolicy.note) &&
    taper.dimensionPolicy.frequencyPolicy === 'maintain_or_slightly_reduce',
    taper.dimensionPolicy.frequencyPolicy);
  ok('… die Notiz behauptet NICHT „Frequenz erhalten" ohne Einschränkung',
    !/Intensität und Frequenz\.?$/.test(taper.dimensionPolicy.note));

  /* Der entscheidende Gegenbeweis: Eine Reduktion heisst NICHT ueberall dasselbe. */
  const krank = P.progressionDecision({ loadHistory: H7(), interruption: { reason: 'illness', symptomFreeDays: 3 } });
  ok('nach Krankheit wird auch die Intensität zurückgenommen',
    krank.dimensionPolicy.intensityPolicy === 'reduce', krank.dimensionPolicy.intensityPolicy);
  ok('… im Gegensatz zum Taper',
    krank.dimensionPolicy.intensityPolicy !== taper.dimensionPolicy.intensityPolicy,
    `${taper.dimensionPolicy.intensityPolicy} vs ${krank.dimensionPolicy.intensityPolicy}`);
  ok('… obwohl beide das Volumen senken',
    krank.selectedDelta < 0 && taper.selectedDelta < 0);

  const tol = P.progressionDecision({ loadHistory: H7(), toleranceState: TOL7 });
  ok('bei einem Intensitätssignal wird die Intensität zurückgenommen',
    tol.dimensionPolicy.intensityPolicy === 'reduce');
  ok('… und die betroffene Domäne ist benannt',
    /highIntensity\/running/.test(tol.rationale), tol.rationale);

  const auf = P.progressionDecision({ loadHistory: H7() });
  ok('der Aufbau läuft über das Volumen, nicht über zusätzliche Härte',
    auf.dimensionPolicy.intensityPolicy === 'maintain' && auf.selectedDelta > 0);

  ok('die Ausführungsverträge sind offengelegt',
    P.DIMENSION_POLICY.taper.intensityPolicy === 'maintain' &&
    P.DIMENSION_POLICY.illness.intensityPolicy === 'reduce');
  ok('kein Vertrag behauptet eine pauschale Skalierung aller Dimensionen',
    Object.values(P.DIMENSION_POLICY).every(d =>
      d.intensityPolicy !== d.volumeDelta && typeof d.intensityPolicy === 'string'));
}

/* ══════════════════════════════════════════════════════════════ */
sec('P19 · Die Intensitätsvorgabe hat einen Geltungsbereich');
{
  /* Ein Signal aus `highIntensity/running` rechtfertigt, die harten LAUFEINHEITEN
     zurueckzunehmen — nicht die lockeren Laeufe und schon gar nicht Rad oder
     Schwimmen. Ohne Scope wuerde ein Planer `reduce` pauschal anwenden und ein
     eng umrissenes Problem in eine allgemeine Drosselung uebersetzen. */
  const H8 = () => ({
    rolling: { 7: { systemicPerKnownDay: 40, completeness: 1 }, 28: { systemicPerKnownDay: 40, completeness: 1 } },
    muscleReadiness: { quads: 0.9 },
    trainingState: { loadTrend: 'stable', consistency: 0.9, completeness: 1, evidence: 'moderate', actionable: true }
  });
  const T = (domain, sport) => ({ cells: [{ domain, sport, status: 'poor', actionable: true, evidence: 'moderate' }] });

  const lauf = P.progressionDecision({ loadHistory: H8(), toleranceState: T('highIntensity', 'running') });
  const rad = P.progressionDecision({ loadHistory: H8(), toleranceState: T('highIntensity', 'cycling') });
  /* STRUKTURIERT, nicht nur ein Schluessel: Ein blanker String laedt dazu ein,
     an mehreren Stellen mit split('/') zerlegt zu werden — und beim vierten
     Aufruf steht dann ein Sportname mit Schraegstrich darin. */
  ok('der Scope benennt Domäne UND Sportart ausbuchstabiert',
    lauf.dimensionPolicy.scope.domain === 'highIntensity' &&
    lauf.dimensionPolicy.scope.sport === 'running',
    JSON.stringify(lauf.dimensionPolicy.scope));
  ok('… mit einem Schlüssel für den Vergleich',
    lauf.dimensionPolicy.scope.key === 'highIntensity/running', lauf.dimensionPolicy.scope.key);
  ok('… und unterscheidet die Sportarten',
    lauf.dimensionPolicy.scope.key !== rad.dimensionPolicy.scope.key,
    `${lauf.dimensionPolicy.scope.key} vs ${rad.dimensionPolicy.scope.key}`);
  ok('… obwohl die Intensitätspolitik dieselbe ist',
    lauf.dimensionPolicy.intensityPolicy === rad.dimensionPolicy.intensityPolicy);
  ok('der Scope trifft NICHT pauschal alles',
    lauf.dimensionPolicy.scope.all === false, String(lauf.dimensionPolicy.scope.all));
  ok('die Form ist IMMER dieselbe — auch bei „all"',
    ['key', 'domain', 'sport', 'all'].every(k => k in lauf.dimensionPolicy.scope) &&
    ['key', 'domain', 'sport', 'all'].every(k => k in P.SCOPE_ALL));
  ok('kein Konsument muss den Schlüssel zerlegen',
    lauf.dimensionPolicy.scope.domain != null && lauf.dimensionPolicy.scope.sport != null);

  /* Wo die Massnahme wirklich den ganzen Plan betrifft, steht das ausdruecklich. */
  const taper = P.progressionDecision({ loadHistory: H8(), phase: 'taper' });
  const krank = P.progressionDecision({ loadHistory: H8(), interruption: { reason: 'illness', symptomFreeDays: 3 } });
  ok('Taper gilt für den ganzen Plan', taper.dimensionPolicy.scope.all === true);
  ok('Krankheit ebenfalls', krank.dimensionPolicy.scope.all === true);
  ok('… und „all" trägt keine erfundene Domäne',
    taper.dimensionPolicy.scope.domain === null && taper.dimensionPolicy.scope.sport === null);

  /* Jeder Ausfuehrungsvertrag traegt einen Scope — null waere zulaessig, aber
     dann muss der Planer nachfragen statt pauschal zu drosseln. */
  const alleFaelle = [
    { loadHistory: H8() },
    { loadHistory: H8(), phase: 'taper' },
    { loadHistory: H8(), phase: 'deload' },
    { loadHistory: H8(), toleranceState: T('volume', 'running') },
    { loadHistory: H8(), interruption: { reason: 'break', days: 30 } },
    { loadHistory: H8(), interruption: { reason: 'illness', symptomFreeDays: 2 } }
  ];
  let ohneScope = [];
  alleFaelle.forEach((f, i) => {
    const d = P.progressionDecision(f).dimensionPolicy;
    if (d && !('scope' in d)) ohneScope.push('#' + i);
  });
  ok('jeder Ausführungsvertrag führt das Feld', ohneScope.length === 0, ohneScope.join(','));
  ok('ein Volumensignal erzeugt einen anderen Scope als ein Intensitätssignal',
    P.progressionDecision({ loadHistory: H8(), toleranceState: T('volume', 'running') }).dimensionPolicy.scope.key
    !== lauf.dimensionPolicy.scope.key);
  ok('scopeOf ist die EINZIGE Stelle, die den Schlüssel baut',
    P.scopeOf('highIntensity', 'running').key === 'highIntensity/running' &&
    P.scopeOf(null, null).all === true);
  /* Der Schluessel darf nirgends im Modul zerlegt werden — sonst waere die
     Struktur nur Dekoration. */
  const psrc = readFileSync(join(APP, 'js/engine/progression.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  ok('das Modul zerlegt den Schlüssel nirgends per split',
    !/split\(['"]\/['"]\)/.test(psrc));
  ok('die Vorlage für tolerance hat bewusst KEINEN festen Scope',
    P.DIMENSION_POLICY.tolerance.scope === null);
  ok('… und ihre Notiz warnt ausdrücklich vor pauschaler Anwendung',
    /NUR dort zurücknehmen, nicht pauschal/.test(P.DIMENSION_POLICY.tolerance.note));
}

/* ══════════════════════════════════════════════════════════════ */
sec('P11 · Purität, Politik und Robustheit');
{
  const src = readFileSync(join(APP, 'js/engine/progression.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  ok('kein DOM-Zugriff', !/\bdocument\.|\bwindow\.(?!ORVIA)/.test(src));
  ok('keine Systemuhr', !/Date\.now\(|new Date\(/.test(src));
  ok('kein Zufall', !/Math\.random/.test(src));
  ok('kein Storage', !/localStorage|sessionStorage/.test(src));

  ok('die Politik ist getrennt versioniert',
    typeof P.POLICY_VERSION === 'string' && P.POLICY_VERSION !== P.VERSION, P.POLICY_VERSION);
  ok('jede Entscheidung führt die Politik mit',
    P.progressionDecision({ loadHistory: HIST() }).policyVersion === P.POLICY_VERSION);
  ok('die Decken sind offengelegt', P.CAPS.runVolumePct === 8);

  let threw = null;
  [undefined, null, {}, { loadHistory: null }, { loadHistory: {} },
    { loadHistory: HIST(), toleranceState: {} }, { loadHistory: HIST(), constraints: 'nope' },
    { loadHistory: HIST(), goalDemand: { requiredPctPerWeek: 'viel' } },
    { interruption: { reason: 'unbekannt' } }]
    .forEach((x, i) => { try { P.progressionDecision(x); } catch (e) { threw = i + ': ' + e.message; } });
  [undefined, null, {}, { reason: 'x' }].forEach((x, i) => {
    try { P.returnRecommendation(x); } catch (e) { threw = 'ret' + i + ': ' + e.message; }
  });
  ok('keine Eingabe wirft', threw === null, threw || '');

  const a = JSON.stringify(P.progressionDecision({ loadHistory: HIST(), goalDemand: { requiredPctPerWeek: 4 } }));
  const b = JSON.stringify(P.progressionDecision({ loadHistory: HIST(), goalDemand: { requiredPctPerWeek: 4 } }));
  ok('deterministisch', a === b);

  ok('jede Entscheidung trägt eine Begründung',
    [{ loadHistory: HIST() }, { loadHistory: HIST(), phase: 'taper' }, {},
      { loadHistory: HIST(), interruption: { reason: 'injury' } }]
      .every(x => typeof P.progressionDecision(x).rationale === 'string' && P.progressionDecision(x).rationale.length > 10));
  ok('jede Entscheidung trägt einen limitierenden Faktor',
    [{ loadHistory: HIST() }, { loadHistory: HIST(), phase: 'taper' }, {}]
      .every(x => !!P.progressionDecision(x).limitingFactor));

  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  ok('Modul ist eingehängt', /js\/engine\/progression\.js/.test(html));
  ok('… nach load-history', html.indexOf('js/engine/load-history.js') < html.indexOf('js/engine/progression.js'));
  ok('Modul ist im Cache-Manifest', /engine\/progression\.js/.test(readFileSync(join(APP, 'sw.js'), 'utf8')));
}

console.log('\n' + '═'.repeat(62));
console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);

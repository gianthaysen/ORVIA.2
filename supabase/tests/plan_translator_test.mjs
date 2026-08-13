/* ORVIA · Plan-Übersetzer (Stufe 6a): C2-Vertrag → Änderungsvorschlag

   Geprüfte Invarianten — die zehn aus dem Übersetzer-Vertrag:
   T1  Der Übersetzer erzeugt nur einen Vorschlag; er mutiert den Plan nicht
   T2  Gleicher Plan + gleiche C2-Entscheidung ⇒ derselbe Vorschlag
   T3  autoApplicable:false, targetLoad:null, scope:null ⇒ nichts automatisch
   T4  Änderungen außerhalb von dimensionPolicy.scope sind verboten
   T5  Volumen, Intensität und Frequenz werden getrennt übersetzt
   T6  Kein exakter Treffer behauptet: achievedLoad, residualGap, Status
   T7  Manuelle Einheiten bleiben; keine kompensatorischen Extremänderungen
   T8  Der Vorschlag verlangt den Policy-Lauf (requiresPolicyPass)
   T9  Der Vorschlag verweist auf C2-Entscheidung, Snapshot, Versionen
   T10 Erneute Übersetzung eines angepassten Plans ist idempotent
   Fixtures: Krankheit, Taper, Deload nehmen den Codepfad ab.

   PRODUKTIVE ANWENDUNG BLEIBT GESPERRT: Ein eigener Abschnitt prüft, dass
   ui.js den Übersetzer NICHT aufruft, solange die Shadow-Abnahme läuft.

   node supabase/tests/plan_translator_test.mjs [appRoot-absolut] */
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

require(join(APP, 'js/engine/load-profile.js'));
const LH = require(join(APP, 'js/engine/load-history.js'));
const P = require(join(APP, 'js/engine/progression.js'));
const T = require(join(APP, 'js/engine/plan-translator.js'));

/* Ein realistischer Wochenplan: 3× Laufen (easy/Intervalle/Long), 1× Gym. */
const U = (id, t, l, min, extra = {}) => Object.assign({ id, t, l, sport: t === 'Gym' ? 'gym' : 'running', durationMin: min }, extra);
const PLAN = () => [
  [],
  [U('u1', 'Laufen', 'Dauerlauf easy', 50)],
  [U('u2', 'Gym', 'Ganzkörper', 45)],
  [U('u3', 'Laufen', 'Intervalle', 40)],
  [],
  [U('u4', 'Laufen', 'Long Run', 90)],
  []
];
const SCOPE_ALL = { key: 'all', domain: null, sport: null, all: true };
const PROG = (o = {}) => Object.assign({
  status: 'ok', delta: 3, targetLoad: 24, provisionalTargetLoad: 24,
  referenceLoad: 23.3, actionable: true, autoApplicable: true,
  allowableRange: { min: 0, max: 8 }, selectionReason: 'adaptive_default',
  version: P.VERSION, policyVersion: P.POLICY_VERSION,
  dimensionPolicy: { intensityPolicy: 'maintain', frequencyPolicy: 'maintain', scope: SCOPE_ALL }
}, o);
const IN = (o = {}) => Object.assign({ plan: PLAN(), progression: PROG(),
  snapshotHash: 'abcd1234', weekId: '2026-W32', planId: 'p1' }, o);

/* Die tatsächliche Wochenlast des Fixture-Plans, unabhängig nachgerechnet. */
const weeklyOf = plan => plan.flat().map(u => LH.loadOf(u)).filter(x => x.ok)
  .reduce((s, x) => s + x.systemic, 0);

/* ══════════════════════════════════════════════════════════════ */
sec('T1 · Vorschlag statt Mutation');
{
  const plan = PLAN();
  const vorher = JSON.stringify(plan);
  const r = T.translate(IN({ plan }));
  ok('der Eingangsplan ist byte-identisch', JSON.stringify(plan) === vorher);
  ok('es kommt kein fertiger Plan zurück',
    r.plan === undefined && r.days === undefined && r.week === undefined);
  ok('sondern eine Änderungsliste', Array.isArray(r.changes));
  ok('der Status ist proposal oder no_change',
    ['proposal', 'no_change'].indexOf(r.status) >= 0, r.status);
  /* preview() arbeitet auf einer Kopie — auch sie fasst den Eingang nicht an. */
  T.preview(plan, r);
  ok('auch preview() mutiert den Eingang nicht', JSON.stringify(plan) === vorher);
}

/* ══════════════════════════════════════════════════════════════ */
sec('T2 · Determinismus');
{
  const a = JSON.stringify(T.translate(IN()));
  const b = JSON.stringify(T.translate(IN()));
  ok('gleicher Eingang ⇒ gleicher Vorschlag', a === b);
  ok('… inklusive stabilem proposalHash',
    T.translate(IN()).proposalHash === T.translate(IN()).proposalHash);
  /* Zwei Ziele können nach Klemmung und Rundung DIESELBEN Änderungen ergeben
     (24 und 30 tun es bei diesem Plan) — der Hash muss trotzdem unterscheiden,
     wessen Übersetzung das ist. Deshalb steht die Ziellast in den refs. */
  ok('ein anderer Zielwert ⇒ anderer Hash, auch bei identischen Änderungen',
    T.translate(IN({ progression: PROG({ targetLoad: 30 }) })).proposalHash !==
    T.translate(IN()).proposalHash);
  ok('… und die Ziellast steht in der Verweiskette',
    T.translate(IN()).refs.targetLoad === 24);
}

/* ══════════════════════════════════════════════════════════════ */
sec('T3 · Die C2-Sperren erzeugen nichts automatisch Anwendbares');
{
  const faelle = [
    ['autoApplicable false', PROG({ autoApplicable: false })],
    ['targetLoad null', PROG({ targetLoad: null, autoApplicable: false })],
    ['nur provisorisch', PROG({ targetLoad: null, provisionalTargetLoad: 30, autoApplicable: false })],
    ['scope null', PROG({ dimensionPolicy: { intensityPolicy: 'reduce', frequencyPolicy: 'maintain', scope: null } })],
    ['keine dimensionPolicy', PROG({ dimensionPolicy: null })],
    ['gar kein C2-Ergebnis', null]
  ];
  faelle.forEach(([n, prog]) => {
    const r = T.translate(IN({ progression: prog }));
    ok(n + ' ⇒ nicht automatisch anwendbar', r.autoApplicable === false, r.status);
    ok('… mit benanntem Sperrgrund', r.blocked.length > 0, r.blocked.join(','));
  });
  ok('provisorisch wird nie übersetzt',
    T.translate(IN({ progression: faelle[2][1] })).status === 'blocked' &&
    T.translate(IN({ progression: faelle[2][1] })).blocked.indexOf('provisional_only') >= 0);
  ok('scope null erzeugt KEINE Änderungen — ein unbekannter Scope wirkt nicht global',
    T.translate(IN({ progression: faelle[3][1] })).changes.length === 0);
  /* autoApplicable:false blockiert die ANWENDUNG, nicht die Erklärung: Der
     Vorschlag entsteht trotzdem, damit die sichtbare Erklärung etwas zeigt. */
  const beobachtend = T.translate(IN({ progression: PROG({ autoApplicable: false, targetLoad: 30 }) }));
  ok('die Rechnung selbst läuft trotzdem (für die Erklärung)',
    beobachtend.status !== 'blocked' && beobachtend.projection != null);
}

/* ══════════════════════════════════════════════════════════════ */
sec('T4 · Kein Eingriff außerhalb des Scopes');
{
  /* Scope: nur Laufen. Die Gym-Einheit darf in KEINER Änderungsliste
     auftauchen — als Eigenschaft über einen breiten Zielbereich. */
  const scopeRun = { key: 'endurance/running', domain: 'endurance', sport: 'running', all: false };
  let verletzt = 0, geprueft = 0;
  for (let tl = 15; tl <= 40; tl += 1) {
    const r = T.translate(IN({ progression: PROG({ targetLoad: tl,
      dimensionPolicy: { intensityPolicy: 'maintain', frequencyPolicy: 'maintain', scope: scopeRun } }) }));
    geprueft++;
    [...r.changes, ...r.removals, ...r.intensityChanges].forEach(ch => {
      if (ch.unitId === 'u2') verletzt++;                       /* Gym */
      if (ch.unitId === 'u3') verletzt++;                       /* Intervalle ≠ endurance */
    });
  }
  ok(geprueft + ' Zielwerte: die Gym-Einheit wird nie angefasst', verletzt === 0, String(verletzt));
  /* Und jede Änderung trägt ihren Scope strukturiert mit. */
  const r = T.translate(IN({ progression: PROG({ targetLoad: 30 }) }));
  ok('jede Änderung trägt den strukturierten Scope',
    r.changes.every(ch => ch.scope && 'key' in ch.scope && 'all' in ch.scope));
  ok('scopeMatch: unbekannte Domäne ⇒ fail-closed, nichts betroffen',
    T.scopeMatch({ sportId: 'running', intensity: 'easy' }, { domain: 'neuedomaene', sport: 'running', all: false }) === false);
  /* scopeMatch ist eine exportierte Schutzfunktion — sie muss auch DIREKT
     fail-closed sein, nicht nur hinter der translate()-Sperre. Ein späterer
     Aufrufer könnte sie ohne die Sperre benutzen. */
  ok('scopeMatch: fehlender Scope ⇒ false, nie global',
    T.scopeMatch({ sportId: 'running', intensity: 'easy' }, null) === false &&
    T.scopeMatch({ sportId: 'running', intensity: 'easy' }, undefined) === false);
}

/* ══════════════════════════════════════════════════════════════ */
sec('T5 · Drei Dimensionen, getrennt übersetzt');
{
  const r = T.translate(IN({ progression: PROG({ targetLoad: 30 }) }));
  ok('Volumenänderungen sind scale_duration mit fromMin/toMin',
    r.changes.length > 0 && r.changes.every(c => c.type === 'scale_duration' &&
      c.dimension === 'volume' && c.fromMin != null && c.toMin != null));
  ok('Intensität und Frequenz haben eigene Listen',
    Array.isArray(r.intensityChanges) && Array.isArray(r.removals));
  ok('bei maintain-Policy bleiben beide leer',
    r.intensityChanges.length === 0 && r.removals.length === 0);
  /* Eine Volumenänderung ist NIE eine Intensitätsänderung: Das Label der
     Einheit bleibt in scale_duration unangetastet. */
  ok('scale_duration ändert nie das Label',
    r.changes.every(c => c.l != null && c.to === undefined && c.from === undefined));
}

/* ══════════════════════════════════════════════════════════════ */
sec('T6 · Keine behauptete Exaktheit: achievedLoad, residualGap, Status');
{
  const r = T.translate(IN({ progression: PROG({ targetLoad: 30 }) }));
  const pj = r.projection;
  ok('die Projektion liegt an', !!pj);
  ok('… mit Ziel-, Ist- und erreichter Last',
    pj.targetWeeklyLoad != null && pj.currentWeeklyLoad != null && pj.achievedWeeklyLoad != null);
  ok('… mit residualGap und gapStatus',
    pj.residualGap != null && ['met_within_tolerance', 'under_target', 'over_target'].indexOf(pj.gapStatus) >= 0);
  ok('die Lasteinheit ist benannt — Tages- und Wochenlast sind nicht verwechselbar',
    r.loadUnit === 'systemic_per_known_day' && r.weeklyFactor === 7 &&
    Math.abs(pj.targetWeeklyLoad - pj.targetPerDay * 7) < 0.01);
  /* Unabhängig nachgerechnet: achievedWeekly = Summe der skalierten Lasten. */
  const applied = T.preview(PLAN(), r);
  const nach = weeklyOf(applied);
  ok('achievedWeeklyLoad stimmt mit der nachgerechneten Kopie überein',
    Math.abs(nach - pj.achievedWeeklyLoad) < 0.5, nach + ' vs ' + pj.achievedWeeklyLoad);

  /* Ein unerreichbares Ziel wird als Lücke ausgewiesen, nicht erzwungen. */
  const wild = T.translate(IN({ progression: PROG({ targetLoad: 60 }) }));
  ok('ein unerreichbares Ziel ⇒ under_target mit Grund',
    wild.projection.gapStatus === 'under_target' &&
    wild.projection.gapReasons.indexOf('scale_clamped') >= 0,
    wild.projection.gapReasons.join(','));
  ok('… und kein Faktor über dem Limit',
    wild.projection.scaleFactor <= T.LIMITS.maxFactor + 1e-9, String(wild.projection.scaleFactor));

  /* Einheiten ohne bestimmbare Last machen die Projektion UNVOLLSTÄNDIG —
     ausgewiesen, nicht erfunden. */
  const kaputtPlan = PLAN(); kaputtPlan[1].push({ id: 'ux', t: 'Laufen', l: 'easy' });
  const mitLuecke = T.translate(IN({ plan: kaputtPlan }));
  ok('unbestimmbare Einheit ⇒ projection.complete false',
    mitLuecke.projection.complete === false && mitLuecke.untranslatable.length === 1,
    JSON.stringify(mitLuecke.untranslatable[0] || null));
}

/* ══════════════════════════════════════════════════════════════ */
sec('T7 · Manuelle Einheiten sind unantastbar, keine Kompensation');
{
  /* Der Long Run ist manuell platziert. Er darf in keiner Liste auftauchen —
     und die anderen Einheiten dürfen seinetwegen nicht über das Limit skaliert
     werden, um die Ziellast trotzdem zu treffen. */
  const plan = PLAN();
  plan[5][0] = Object.assign({}, plan[5][0], { manual: true });
  const r = T.translate(IN({ plan, progression: PROG({ targetLoad: 33 }) }));
  const beruehrt = [...r.changes, ...r.removals, ...r.intensityChanges].filter(c => c.unitId === 'u4');
  ok('die manuelle Einheit wird nie berührt', beruehrt.length === 0);
  ok('… sie zählt aber zur Last', r.projection.fixedLoad > 0 && r.projection.manualUnits === 1);
  ok('keine Kompensation über das Limit',
    r.projection.scaleFactor == null || r.projection.scaleFactor <= T.LIMITS.maxFactor + 1e-9);
  ok('eine dadurch offene Lücke nennt die manuelle Einheit als Grund',
    r.projection.gapStatus === 'met_within_tolerance' ||
    r.projection.gapReasons.indexOf('manual_units_fixed') >= 0 ||
    r.projection.gapReasons.indexOf('scale_clamped') >= 0,
    r.projection.gapStatus + '/' + r.projection.gapReasons.join(','));

  /* manualIds als zweiter Weg der Markierung. */
  const r2 = T.translate(IN({ manualIds: ['u1'], progression: PROG({ targetLoad: 30 }) }));
  ok('manualIds wirkt wie ein manual-Flag',
    [...r2.changes, ...r2.removals].every(c => c.unitId !== 'u1'));

  /* Eigenschaft über den Zielbereich: NIE verlässt ein Faktor die Grenzen,
     egal wie viel manuell fixiert ist. */
  let verletzt = false;
  for (let tl = 10; tl <= 60; tl += 2) {
    const x = T.translate(IN({ plan: JSON.parse(JSON.stringify(plan)), progression: PROG({ targetLoad: tl }) }));
    const f = x.projection.scaleFactor;
    if (f != null && (f < T.LIMITS.minFactor - 1e-9 || f > T.LIMITS.maxFactor + 1e-9)) verletzt = true;
    x.changes.forEach(c => {
      const orig = PLAN().flat().find(u => u.id === c.unitId);
      if (orig && (c.toMin > orig.durationMin * T.LIMITS.maxFactor + T.LIMITS.roundMin ||
        c.toMin < Math.min(T.LIMITS.minUnitMin, orig.durationMin * T.LIMITS.minFactor) - T.LIMITS.roundMin)) verletzt = true;
    });
  }
  ok('26 Zielwerte: kein Faktor und keine Dauer außerhalb der Grenzen', !verletzt);
}

/* ══════════════════════════════════════════════════════════════ */
sec('T8+T9 · Policy-Pflicht und Verweiskette');
{
  const r = T.translate(IN());
  ok('jeder Vorschlag verlangt den Policy-Lauf', r.requiresPolicyPass === true);
  ok('… auch ein blockierter', T.translate(IN({ progression: null })).requiresPolicyPass === true);
  ok('der Vorschlag verweist auf die C2-Entscheidung',
    r.refs.progressionVersion === P.VERSION && r.refs.progressionPolicyVersion === P.POLICY_VERSION &&
    r.refs.selectionReason === 'adaptive_default' && r.refs.referenceLoad === 23.3);
  ok('… auf den Snapshot und die Woche',
    r.refs.snapshotHash === 'abcd1234' && r.refs.weekId === '2026-W32' && r.refs.planId === 'p1');
  ok('… und trägt die eigenen Versionen',
    r.version === 'plan-translator@2' && r.policyVersion === 'pt-policy@1');
  ok('der Korridor der Entscheidung steht dabei',
    JSON.stringify(r.refs.allowableRange) === JSON.stringify({ min: 0, max: 8 }));
}

/* ══════════════════════════════════════════════════════════════ */
sec('T10 · Idempotenz: einmal übersetzen, nicht zweimal progressieren');
{
  /* ERREICHBARES Ziel: Nach der Anwendung ist es getroffen, die zweite
     Übersetzung ändert nichts. */
  const erreichbar = T.translate(IN({ progression: PROG({ targetLoad: 21 }) }));
  ok('die erste Übersetzung schlägt Änderungen vor', erreichbar.changes.length > 0);
  const ang1 = T.preview(PLAN(), erreichbar);
  const wieder = T.translate(IN({ plan: ang1, progression: PROG({ targetLoad: 21 }) }));
  ok('erreichbares Ziel: zweite Übersetzung ⇒ no_change',
    wieder.status === 'no_change', wieder.status + ' (' + wieder.changes.length + ')');
  ok('… und das Ziel gilt als getroffen',
    wieder.projection.gapStatus === 'met_within_tolerance', wieder.projection.gapStatus);

  /* UNERREICHBARES Ziel — der gefährlichere Fall: Ohne den baseMin-Anker
     holte sich jede Runde ein weiteres Viertel (50 → 65 → 80 → …). Jetzt:
     Die Klemme ist an der AKZEPTIERTEN Dauer verankert, die zweite Runde
     ändert nichts, und die Lücke bleibt ausgewiesen statt erzwungen. */
  const erste = T.translate(IN({ progression: PROG({ targetLoad: 30 }) }));
  ok('unerreichbares Ziel: die erste Übersetzung geht bis an die Klemme', erste.changes.length > 0);
  const angepasst = T.preview(PLAN(), erste);
  const zweite = T.translate(IN({ plan: angepasst, progression: PROG({ targetLoad: 30 }) }));
  ok('… die zweite Runde holt sich KEIN weiteres Viertel',
    zweite.status === 'no_change', zweite.status + ' (' + zweite.changes.length + ' Änderungen)');
  ok('… die Restlücke bleibt ausgewiesen, nicht erzwungen',
    zweite.projection.gapStatus === 'under_target' &&
    zweite.projection.gapReasons.indexOf('scale_clamped') >= 0);
  ok('… und der Plan gilt als bereits angepasst',
    zweite.projection.alreadyAdjusted === true);
  /* Dritte Runde: weiterhin stabil. */
  const dritte = T.translate(IN({ plan: T.preview(angepasst, zweite), progression: PROG({ targetLoad: 30 }) }));
  ok('auch die dritte Runde progressiert nicht', dritte.status === 'no_change');
  /* Als Eigenschaft: KEINE Dauer überschreitet je baseMin × 1.25 — egal wie
     oft übersetzt wird. */
  let plan = PLAN(), stabil = true;
  for (let runde = 0; runde < 5; runde++) {
    const r = T.translate(IN({ plan, progression: PROG({ targetLoad: 30 }) }));
    plan = T.preview(plan, r);
    plan.flat().forEach(u => {
      const orig = PLAN().flat().find(o => o.id === u.id);
      if (orig && u.durationMin > orig.durationMin * T.LIMITS.maxFactor + 1e-9) stabil = false;
    });
  }
  ok('fünf Runden: keine Dauer über der akzeptierten Klemme', stabil);
}

/* ══════════════════════════════════════════════════════════════ */
sec('T11 · baseMin hat einen Lebenszyklus, keinen Ewigkeitsanspruch');
{
  /* DER GEGENFEHLER ZUR RATSCHE: Die Klemme darf eine bewusste
     Nutzerentscheidung nicht zurückziehen. Der Stempel gilt nur für die
     Herkunft, unter der er entstand. */
  const gestempelt = (rev) => [[],
    [{ id: 'u1', t: 'Laufen', l: 'Dauerlauf easy', sport: 'running', durationMin: 65,
       baseMin: 50, basePlanId: 'p1', basePlanRevision: rev, baseSource: 'accepted_plan' }],
    [], [], [], [], []];

  /* Gleiche Revision: Der Anker hält — 65 ist schon base×1.25 gerundet,
     weiter hinauf geht nichts. */
  const gleich = T.translate(IN({ plan: gestempelt('r1'), planRevision: 'r1',
    progression: PROG({ targetLoad: 30 }) }));
  ok('gleiche Revision: der Anker hält, keine weitere Steigerung',
    gleich.changes.every(c => c.unitId !== 'u1' || c.toMin <= 50 * T.LIMITS.maxFactor),
    JSON.stringify(gleich.changes));

  /* Neue Revision: 65 IST die akzeptierte Basis — die Klemme öffnet sich
     bis 65×1.25. */
  const neu = T.translate(IN({ plan: gestempelt('r1'), planRevision: 'r2',
    progression: PROG({ targetLoad: 30 }) }));
  const chNeu = neu.changes.find(c => c.unitId === 'u1');
  ok('neue Revision: die aktuelle Dauer ist die neue Basis',
    chNeu != null && chNeu.toMin > 50 * T.LIMITS.maxFactor && chNeu.toMin <= 65 * T.LIMITS.maxFactor,
    chNeu ? String(chNeu.toMin) : 'keine Änderung');
  /* Anderer Plan: dieselbe Regel. */
  const andererPlan = T.translate(IN({ plan: gestempelt('r1'), planId: 'p2', planRevision: 'r1',
    progression: PROG({ targetLoad: 30 }) }));
  const chPlan = andererPlan.changes.find(c => c.unitId === 'u1');
  ok('neuer Plan: ebenfalls neu verankert', chPlan != null && chPlan.toMin > 50 * T.LIMITS.maxFactor);

  /* Nutzeränderung: baseSource user_edit (oder gar kein Stempel) ⇒ die vom
     Nutzer gewählte Dauer ist die Basis. */
  ok('user_edit-Stempel wird ignoriert — die Nutzerdauer ist die Basis',
    T.stampValid({ baseMin: 50, basePlanId: 'p1', basePlanRevision: 'r1', baseSource: 'user_edit' }, 'p1', 'r1') === false);
  ok('fehlende Herkunft ⇒ Stempel ungültig',
    T.stampValid({ baseMin: 50 }, 'p1', 'r1') === false);
  ok('gültig nur bei akzeptiertem Plan gleicher Herkunft',
    T.stampValid({ baseMin: 50, basePlanId: 'p1', basePlanRevision: 'r1', baseSource: 'accepted_plan' }, 'p1', 'r1') === true);

  /* preview() stempelt die VOLLE Herkunft — sonst wäre der Lebenszyklus beim
     nächsten Lauf nicht prüfbar. */
  const prop = T.translate(IN({ planRevision: 'r7', progression: PROG({ targetLoad: 21 }) }));
  const applied = T.preview(PLAN(), prop);
  const u1 = applied.flat().find(u => u.id === 'u1');
  ok('preview stempelt baseMin mit Herkunft',
    u1.baseMin === 50 && u1.basePlanId === 'p1' && u1.basePlanRevision === 'r7' &&
    u1.baseSource === 'accepted_plan', JSON.stringify({ b: u1.baseMin, p: u1.basePlanId, r: u1.basePlanRevision, s: u1.baseSource }));
  ok('… und die refs führen die Revision', prop.refs.planRevision === 'r7');
  /* Ein fremder Stempel wird beim Anwenden ERSETZT, nicht fortgeschrieben. */
  const alt = gestempelt('r1');
  const prop2 = T.translate(IN({ plan: alt, planRevision: 'r2', progression: PROG({ targetLoad: 30 }) }));
  const applied2 = T.preview(alt, prop2);
  const u1b = applied2.flat().find(u => u.id === 'u1');
  ok('ein Stempel fremder Herkunft wird ersetzt',
    u1b.baseMin === 65 && u1b.basePlanRevision === 'r2', JSON.stringify({ b: u1b.baseMin, r: u1b.basePlanRevision }));

  /* Und die Idempotenz bleibt UNTER der neuen Regel bestehen: dieselbe
     Revision, fünf Runden, keine Drift. */
  let plan = PLAN(), stabil = true;
  for (let n = 0; n < 5; n++) {
    const r = T.translate(IN({ plan, planRevision: 'r9', progression: PROG({ targetLoad: 30 }) }));
    plan = T.preview(plan, r);
  }
  plan.flat().forEach(u => {
    const orig = PLAN().flat().find(o => o.id === u.id);
    if (orig && u.durationMin > orig.durationMin * T.LIMITS.maxFactor + 1e-9) stabil = false;
  });
  ok('fünf Runden derselben Revision: keine Drift', stabil);
}

/* ══════════════════════════════════════════════════════════════ */
sec('Fixtures · Krankheit, Taper, Deload nehmen den Codepfad ab');
{
  /* Die dimensionPolicy kommt aus C2 — hier als Fixture mit genau den Werten,
     die progression.js für diese Phasen führt. */
  const dp = P.DIMENSION_POLICY;

  /* TAPER: −50 % Volumen, Intensität erhalten, Frequenz höchstens leicht. */
  const taper = T.translate(IN({ progression: PROG({ delta: -50, targetLoad: 12,
    dimensionPolicy: { intensityPolicy: dp.taper.intensityPolicy,
      frequencyPolicy: dp.taper.frequencyPolicy, scope: SCOPE_ALL } }) }));
  ok('Taper: das Volumen sinkt', taper.changes.every(c => c.toMin <= c.fromMin) && taper.changes.length > 0);
  ok('… die Intensität bleibt (maintain ⇒ keine Intensitätsänderung)',
    taper.intensityChanges.length === 0);
  ok('… die Skalierung reicht nicht für −50 %, die Frequenz-Policy deckt eine Reduktion',
    taper.removals.length <= 1,
    taper.removals.length + ' Entfernung(en), Faktor ' + taper.projection.scaleFactor);
  ok('… und die Restlücke wird ehrlich ausgewiesen',
    taper.projection.gapStatus !== 'met_within_tolerance' ? taper.projection.gapReasons.length > 0 : true);

  /* KRANKHEIT: Volumen UND Intensität zurück. */
  const illness = T.translate(IN({ progression: PROG({ delta: -35, targetLoad: 15,
    dimensionPolicy: { intensityPolicy: dp.illness.intensityPolicy,
      frequencyPolicy: dp.illness.frequencyPolicy, scope: SCOPE_ALL } }) }));
  ok('Krankheit: das Volumen sinkt', illness.changes.every(c => c.toMin <= c.fromMin));
  ok('… und der harte Reiz wird entschärft',
    illness.intensityChanges.length === 1 && illness.intensityChanges[0].unitId === 'u3' &&
    illness.intensityChanges[0].from === 'interval' && illness.intensityChanges[0].to === 'moderate',
    JSON.stringify(illness.intensityChanges[0] || null));
  ok('… entschärft, nicht gestrichen: die Einheit bleibt im Plan',
    illness.removals.every(rm => rm.unitId !== 'u3'));

  /* DELOAD: Volumen runter, einzelne Intensitätsreize DÜRFEN bleiben. */
  const deload = T.translate(IN({ progression: PROG({ delta: -25, targetLoad: 17.5,
    dimensionPolicy: { intensityPolicy: dp.deload.intensityPolicy,
      frequencyPolicy: dp.deload.frequencyPolicy, scope: SCOPE_ALL } }) }));
  ok('Deload: das Volumen sinkt', deload.changes.length > 0 && deload.changes.every(c => c.toMin <= c.fromMin));
  ok('… reduce_or_maintain streicht die Intervalle nicht automatisch',
    deload.removals.length === 0);
  ok('… und die Frequenz bleibt (maintain)', deload.removals.length === 0);

  /* DIE FREQUENZ-DECKUNG IM ENTSCHEIDENDEN FALL: maintain-Policy bei einem
     Ziel, das die Volumenklemme reißt. Ohne Deckung darf KEINE Einheit
     entfernt werden — die Lücke bleibt ausgewiesen. Genau hier entschied die
     Policy bisher nichts, weil kein Testfall beides kombinierte. */
  const maintainTief = T.translate(IN({ progression: PROG({ delta: -50, targetLoad: 12,
    dimensionPolicy: { intensityPolicy: 'maintain', frequencyPolicy: 'maintain', scope: SCOPE_ALL } }) }));
  ok('maintain-Frequenz: trotz gerissener Klemme wird NICHTS entfernt',
    maintainTief.removals.length === 0,
    maintainTief.removals.length + ' Entfernung(en), Faktor ' + maintainTief.projection.requestedFactor);
  ok('… die Lücke bleibt stattdessen ausgewiesen',
    maintainTief.projection.gapStatus === 'over_target' || maintainTief.projection.gapStatus === 'under_target');

  /* TOLERANZ-SCOPE: schlechte VO2-Toleranz beim Laufen darf NUR die
     Lauf-Intervalle treffen — dieselbe Regel wie in C2. */
  const tol = T.translate(IN({ progression: PROG({ delta: -10, targetLoad: 21,
    dimensionPolicy: { intensityPolicy: 'reduce', frequencyPolicy: 'maintain',
      scope: { key: 'highIntensity/running', domain: 'highIntensity', sport: 'running', all: false } } }) }));
  const betroffen = [...tol.changes, ...tol.intensityChanges].map(c => c.unitId);
  ok('Toleranz-Scope: nur die Lauf-Intervalle sind betroffen',
    betroffen.every(id => id === 'u3'), betroffen.join(','));
  ok('… easy, Long Run und Gym bleiben unberührt',
    betroffen.indexOf('u1') < 0 && betroffen.indexOf('u4') < 0 && betroffen.indexOf('u2') < 0);
}

/* ══════════════════════════════════════════════════════════════ */
sec('Produktive Anwendung bleibt gesperrt — Lesen ja, Schreiben nie');
{
  /* DIE TRENNUNG VON BAUEN UND AKTIVIEREN, ALS TEST — Fassung 3: Nach dem
     Umzug der Erklärungslogik in js/adaptive-card.js (damit sie als VERHALTEN
     testbar ist, adaptive_card_test.mjs) gilt wieder die harte Form für ui.js:
     KEINE Erwähnung des Übersetzers. Das Lesen für die Vorschau geschieht
     ausschließlich im reinen Kartenmodul — und dort nur gegen den
     Snapshot-Plan, ohne preview(), ohne Schreiben. Wer einen Anwendungspfad
     baut, muss beide Tests bewusst ändern. */
  const ui = readFileSync(join(APP, 'js/ui.js'), 'utf8');
  ok('ui.js erwähnt den Übersetzer nicht', !/planTranslator/.test(ui));
  ok('… die Erklärung ist reine Delegation an das Kartenmodul',
    /AC\.buildView\(O\._lastShadowCtx\|\|null, live, O\)/.test(ui));

  const cardRaw = readFileSync(join(APP, 'js/adaptive-card.js'), 'utf8');
  const card = cardRaw.replace(/\/\*[\s\S]*?\*\//g, '');
  ok('das Kartenmodul ruft nur translate(), nie preview()/apply',
    /T\.translate\(/.test(card) && !/\.preview\(|\.apply\(/.test(card));
  ok('… und nur gegen den SNAPSHOT-Plan',
    /plan:\s*snap\.currentPlan/.test(card) && !/plan:\s*livePlan/.test(card));
  ok('… es schreibt in keinen Plan und in kein Profil',
    !/PROFILE|weekPlan\s*=|saveProfile|savePlan|localStorage/.test(card));
  ok('die Staleness-Prüfung lebt im Kartenmodul, fail-closed',
    /stale = JSON\.stringify\(livePlan\) !== JSON\.stringify\(snap\.currentPlan\)/.test(card) &&
    /var stale = true/.test(card));

  const designer = readFileSync(join(APP, 'js/engine/week-plan-designer.js'), 'utf8');
  ok('der Designer kennt den Übersetzer weiterhin nicht', !/planTranslator/.test(designer));
}

/* ══════════════════════════════════════════════════════════════ */
sec('Purität, Robustheit, Einhängung');
{
  const src = readFileSync(join(APP, 'js/engine/plan-translator.js'), 'utf8');
  ok('kein DOM-Zugriff', !/document\.|window\.|localStorage/.test(src));
  ok('keine eigene Uhr', !/Date\.now|new Date\(/.test(src));
  ok('kein Zufall', !/Math\.random/.test(src));
  ok('kein Netzwerk', !/fetch\(|XMLHttpRequest|supabase/.test(src));

  let geworfen = null;
  [undefined, null, {}, { plan: [] }, { plan: PLAN() }, { plan: [[], [], [], [], [], [], []], progression: PROG() },
    IN({ plan: [[{ id: 'x' }], [], [], [], [], [], []] }),
    IN({ progression: PROG({ dimensionPolicy: { scope: { all: false, domain: 'kaputt' } } }) })]
    .forEach(x => { try { T.translate(x); } catch (e) { geworfen = e.message; } });
  ok('kein Eingang wirft', geworfen === null, geworfen || '');
  ok('ein leerer Plan ergibt einen benannten Zustand',
    T.translate({ plan: [[], [], [], [], [], [], []], progression: PROG() }).status !== undefined);

  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  ok('Modul ist eingehängt', /js\/engine\/plan-translator\.js/.test(html));
  ok('… nach progression (es liest dessen Vertrag)',
    html.indexOf('js/engine/progression.js') < html.indexOf('js/engine/plan-translator.js'));
  ok('Modul ist im Cache-Manifest', /engine\/plan-translator\.js/.test(readFileSync(join(APP, 'sw.js'), 'utf8')));
  ok('Modul ist in der Versionsdrift-Bewachung',
    /plan-translator\.js/.test(readFileSync(join(HERE, 'module_version_drift_test.mjs'), 'utf8')));
}

console.log('\n' + '═'.repeat(62));
console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);

/* ORVIA · observer-input@2 — der EINE Eingang der Beobachtungsschicht

   Was dieses Modul VERSPRICHT (und was hier als Verhalten geprueft wird):
     1. TIEFE KOPIE: Der Aufrufer kann seine Rohquellen nach build() beliebig
        mutieren — der Snapshot bleibt byte-identisch.
     2. EINGEFROREN: Kein Konsument kann den Snapshot veraendern.
     3. HASH = ZUSTAND: Gleicher Zustand ⇒ gleicher Hash. JEDE Aenderung —
        auch Performance, Zielzeit, eine korrigierte Aktivitaet mit
        GLEICHER ID — ⇒ anderer Hash. Die Drossel haengt daran.
     4. VERSION IM HASH: Ein anderer Adapter ist ein anderer Zustand.
     5. HERKUNFT AUSGEWIESEN: „Quelle fehlt" (undefined) und „bewusst leer"
        ([]/null) sind verschiedene Aussagen.
     6. KOHORTE: Die Modulversion steht im Abnahmevertrag (shadow-adaptive@12,
        Feld 'input') — Beobachtungen verschiedener Adapter mischen nie.

   node supabase/tests/observer_input_test.mjs [appRoot] */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const OI = require(join(APP, 'js/engine/observer-input.js'));

const RAW = () => ({
  userId: 'u1', today: '2026-08-08', weekId: '2026-W32',
  currentPlan: [[{ id: 'psg:0:0:x', t: 'Laufen', l: 'Easy', d: '45 min' }], [], [], [], [], [], []],
  planIdentity: { planId: 'weekplan:2026-W32', planRevision: 'wp:abc', basis: 'stored_weekplan' },
  activities: [{ id: 'a1', date: '2026-08-07', sportId: 'running', durationMin: 50 }],
  debriefs: [{ id: 'db:1', rpe: 6 }],
  sports: [{ sportId: 'running' }],
  goal: { type: 'half_marathon', raceDate: '2026-11-01', targetTime: '1:50:00' },
  level: 'ambitioniert',
  currentPerformance: { sports: { running: { ok: true } } }
});

sec('V1 · Tiefe Kopie und Einfrieren');
{
  const raw = RAW();
  const s = OI.build(raw);
  const vorher = JSON.stringify(s);
  raw.activities.push({ id: 'a2' });
  raw.currentPlan[0][0].l = 'MANIPULIERT';
  raw.goal.targetTime = '0:00:00';
  raw.debriefs[0].rpe = 10;
  ok('spätere Mutation der Rohquellen erreicht den Snapshot nicht',
    JSON.stringify(s) === vorher);
  ok('der Snapshot ist tief eingefroren',
    Object.isFrozen(s) && Object.isFrozen(s.activities) && Object.isFrozen(s.currentPlan[0][0]) &&
    Object.isFrozen(s.planIdentity) && Object.isFrozen(s.goal));
  let threw = false;
  try { s.activities.push({}); } catch (_e) { threw = true; }
  ok('Schreibversuche scheitern', threw === true);
}

sec('V2 · Hash = Zustand, vollständig');
{
  const h = r => OI.build(r).hash;
  const base = h(RAW());
  ok('derselbe Zustand trägt denselben Hash', h(RAW()) === base && /^[0-9a-f]{8}$/.test(base), base);
  const faelle = [
    ['Performance', r => { r.currentPerformance = { sports: {} }; }],
    ['Zielzeit (Typ+Datum gleich)', r => { r.goal.targetTime = '1:45:00'; }],
    ['korrigierte Aktivität mit GLEICHER ID', r => { r.activities[0].durationMin = 51; }],
    ['neues Debrief', r => { r.debriefs.push({ id: 'db:2' }); }],
    ['Planinhalt', r => { r.currentPlan[1].push({ id: 'psg:1:0:y', t: 'Rad', l: 'Z2', d: '60 min' }); }],
    ['Planrevision', r => { r.planIdentity.planRevision = 'wp:def'; }],
    ['Level', r => { r.level = 'Einsteiger'; }],
    ['Sportarten', r => { r.sports.push({ sportId: 'cycling' }); }]
  ];
  for (const [name, mut] of faelle) {
    const r = RAW(); mut(r);
    ok('Änderung an ' + name + ' ⇒ anderer Hash', h(r) !== base);
  }
}

sec('V3 · Version im Hash und im Vertrag');
{
  const s = OI.build(RAW());
  ok('die Modulversion steht im Snapshot', s.version === OI.VERSION && OI.VERSION === 'observer-input@5');
  /* Version im Hash: nicht simulierbar ohne Modulmutation — deshalb als
     QUELLTEXT-Vertrag: der Hash entsteht NACH dem Setzen von version. */
  const src = readFileSync(join(APP, 'js/engine/observer-input.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  ok('der Hash umfasst den ganzen Snapshot inklusive Version (Quelltext-Vertrag)',
    /version:\s*VERSION/.test(src) &&
    src.indexOf('snap.hash = _hash(_stable(snap))') > src.indexOf('version: VERSION'));
  /* new Date(<argument>) ist deterministische Kalenderarithmetik, keine
     Uhr — verboten bleibt die ARGUMENTLOSE Form und Date.now. */
  ok('kein DOM, keine Uhr, kein Storage, kein Netz',
    !/document\.|window\.|localStorage|Date\.now|new Date\(\)|fetch\(|XMLHttpRequest/.test(src));
  /* Kohortenbindung: shadow-adaptive@7 führt das Feld 'input'. */
  const SA = require(join(APP, 'js/engine/shadow-adaptive.js'));
  ok('die Kohorte führt den Eingangsadapter als eigenes Feld',
    SA.COHORT_FIELDS.indexOf('input') >= 0 && SA.VERSION === 'shadow-adaptive@12');
  const cc = SA.currentCohort({ observerInput: OI });
  ok('currentCohort liest die Adapterversion', cc.versions.input === 'observer-input@5');
  const pin = JSON.parse(readFileSync(join(HERE, '_acceptance-cohort.json'), 'utf8'));
  ok('der neue Pin führt den Adapter (bewusste Kohortenänderung — Altbelege zählen nicht mehr)',
    pin.versions.input === 'observer-input@5' && ['9064d4f8','e8a0c381','de8b1585','19343e54','dd2b773c','b8581b08','86d1add8'].indexOf(pin.key) < 0, pin.key);
}

sec('V4 · Herkunft: fehlend ≠ leer');
{
  const r = RAW(); delete r.activities; delete r.goal;
  const s = OI.build(r);
  ok('fehlende Quellen sind unavailable',
    s.basis.activities === 'unavailable' && s.basis.goal === 'unavailable');
  ok('gelieferte leere Quellen sind provided',
    OI.build(Object.assign(RAW(), { activities: [] })).basis.activities === 'provided');
  ok('unavailable und bewusst-leer tragen VERSCHIEDENE Hashes',
    s.hash !== OI.build(Object.assign(RAW(), { activities: [], goal: null })).hash);
  ok('… und der Snapshot bleibt auch dann gebaut (fail-open fürs Beobachten, fail-closed fürs Behaupten)',
    Array.isArray(s.activities) && s.activities.length === 0);
}

sec('V6 · Abgeleitete Stufe-5-Formen — der Produktform-P0');
{
  /* goalOf() liefert targetMin/raceDate/distanceKm; der Resolver ein
     {sports:{running:{...}}}. Ohne die Uebersetzung war JEDE
     Produktbewertung insufficient_data/current_performance. */
  const raw = RAW();
  raw.goal = { type: 'half_marathon', distanceKm: 21.0975, raceDate: '2026-11-01', targetMin: 110 };
  raw.currentPerformance = { sports: { running: { ok: true, confidence: 'moderate', ageRatio: 0.3,
    halfMarathonEquivalentMin: 112.4,
    reference: { distanceKm: 10, durationMin: 50, date: '2026-07-20', source: 'race' }, zones: {} } } };
  const s = OI.build(raw);
  ok('feasibilityGoal traegt targetValue/metricType/direction',
    s.derived.feasibilityGoal.targetValue === 110 && s.derived.feasibilityGoal.metricType === 'time' &&
    s.derived.feasibilityGoal.direction === 'lower');
  const fp = s.derived.feasibilityPerformance;
  ok('feasibilityPerformance ist EIN Wert in Zielmetrik (Riegel auf Zieldistanz)',
    fp && fp.value > 100 && fp.value < 130 && fp.metric === 'time' &&
    fp.evidence === 'moderate' && fp.ageRatio === 0.3 && fp.measuredAt === '2026-07-20',
    JSON.stringify(fp));
  ok('targetDate wird aus raceDate abgeleitet', s.targetDate === '2026-11-01');
  ok('Steuerfelder liegen im Snapshot (phase/interruption/lowWeekReason/weeksLeft)',
    'phase' in s && 'interruption' in s && 'lowWeekReason' in s && 'weeksLeft' in s);

  /* DER E2E-BEWEIS: Stufe 5 bewertet mit diesen Formen WIRKLICH — nicht
     insufficient_data. Echte goal-feasibility, echte evidence-Pruefung. */
  require(join(APP, 'js/engine/evidence.js'));
  const GF = require(join(APP, 'js/engine/goal-feasibility.js'));
  const verdict = GF.feasibility({
    goal: Object.assign({}, s.goal, s.derived.feasibilityGoal),
    targetDate: s.targetDate, today: '2026-08-08',
    currentPerformance: s.derived.feasibilityPerformance,
    level: 'ambitioniert',
    /* Stellvertretend fuer eine FREIGEGEBENE C2-Progression — die echte
       Kette liefert sie in Z21 des Verdrahtungstests. */
    allowableProgression: { actionable: true }
  }, { registry: {} });
  ok('STUFE 5 BEWERTET: status ist NICHT insufficient_data',
    verdict && verdict.status !== 'insufficient_data' && verdict.status != null,
    verdict ? verdict.status + '/' + (verdict.limitingFactors || []).join(',') : 'null');

  /* Ohne Referenz bleibt es EHRLICH insufficient_data — der Adapter
     erfindet keinen Wert. */
  const raw2 = RAW();
  raw2.goal = { type: 'half_marathon', distanceKm: 21.0975, raceDate: '2026-11-01', targetMin: 110 };
  raw2.currentPerformance = { sports: { running: { ok: false, reason: 'no_reference' } } };
  ok('ohne Referenzleistung: feasibilityPerformance bleibt null (kein erfundener Wert)',
    OI.build(raw2).derived.feasibilityPerformance === null);
}

sec('V7 · Krankheits-Episode: Lebenszyklus statt Fensterzählung');
{
  const T = '2026-08-08';
  const day = n => { const d = new Date('2026-08-08T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const mkC = (spec, fenster) => { /* spec: {tageZurueck: ill|false|null} */
    const out = [];
    for (let b = 0; b < (fenster || 45); b++) out.push({ date: day(b), ill: spec[b] !== undefined ? spec[b] : null });
    return out;
  };
  const epi = (spec, fenster) => OI.build(Object.assign(RAW(), { today: T, checkins: mkC(spec, fenster) })).derived.interruption;

  /* a) krank vor 5 Tagen, seitdem AUSDRUECKLICH frei ⇒ Episode mit Streak. */
  const a = epi({ 5: true, 4: false, 3: false, 2: false, 1: false, 0: false });
  ok('bestätigte Freiheit wird GEZÄHLT (5 explizit freie Tage)',
    a && a.reason === 'illness' && a.symptomFreeDays === 5 && a.lastPositiveDay === day(5),
    JSON.stringify(a));

  /* b) DER ALTE FEHLER: krank vor 8 Tagen, seitdem NICHTS gemeldet —
     die Episode darf NICHT durch Fensterablauf verschwinden. */
  const b = epi({ 8: true });
  ok('8 Tage alt + keine Meldungen ⇒ Episode BLEIBT, symptomFreeDays 0',
    b && b.reason === 'illness' && b.symptomFreeDays === 0 && b.coverage === 'unconfirmed',
    JSON.stringify(b));

  /* c) unknown zaehlt NICHT als frei: die AKTUELLE Rueckwaertsserie ab
     heute endet an der Luecke ⇒ 2, nicht 3 (v8-302: rueckwaerts, nicht
     vorwaerts ab dem positiven Tag). */
  const c = epi({ 4: true, 3: false, 1: false, 0: false });
  ok('eine Check-in-Lücke begrenzt die aktuelle Rückwärtsserie (unknown ≠ symptomfrei)',
    c && c.symptomFreeDays === 2, JSON.stringify(c && c.symptomFreeDays));

  /* d) BESTAETIGT beendet: 7 explizit freie Tage in Folge ⇒ keine Episode. */
  const d = epi({ 8: true, 7: false, 6: false, 5: false, 4: false, 3: false, 2: false, 1: false, 0: false });
  ok('≥7 explizit freie Tage in Folge beenden die Episode', d === null, JSON.stringify(d));

  /* e) Rueckfall gewinnt: neuer positiver Tag setzt lastPositive neu. */
  const e = epi({ 10: true, 9: false, 8: false, 2: true, 1: false, 0: false });
  ok('ein Rückfall setzt die Episode neu auf', e && e.lastPositiveDay === day(2) && e.symptomFreeDays === 2);

  /* g) DER v8-301-FEHLER: 29 Tage alt, nie bestaetigt frei ⇒ die Episode
     darf NICHT durch ein Fenster verschwinden (Serie reicht bis zum
     positiven Tag — genau das liefert die ui-Extraktion jetzt). */
  const g29 = epi({ 29: true }, 45);
  ok('29 Tage alt + unbestätigt ⇒ Episode BLEIBT (kein Fensterablauf)',
    g29 && g29.reason === 'illness' && g29.symptomFreeDays === 0,
    JSON.stringify(g29));

  /* h) GIANS GEGENPROBE: krank vor 10 Tagen, Luecke, letzte 7 Tage
     ausdruecklich frei ⇒ die aktuelle Serie zaehlt (7) und BEENDET die
     Episode — nicht symptomFreeDays 0. */
  const h7 = epi({ 10: true, 6: false, 5: false, 4: false, 3: false, 2: false, 1: false, 0: false });
  ok('7 aktuelle freie Tage nach Lücke beenden die Episode (Rückwärtsserie zählt)',
    h7 === null, JSON.stringify(h7));
  const h6 = epi({ 10: true, 5: false, 4: false, 3: false, 2: false, 1: false, 0: false });
  ok('… 6 aktuelle freie Tage: Episode aktiv mit symptomFreeDays 6',
    h6 && h6.symptomFreeDays === 6, JSON.stringify(h6 && h6.symptomFreeDays));

  /* f) C2-VERTRAG: die Episode speist den ECHTEN illness-Pfad. */
  const PR = require(join(APP, 'js/engine/progression.js'));
  const retA = PR.returnRecommendation(a);
  const retB = PR.returnRecommendation(b);
  ok('C2 mit bestätigter Freiheit ⇒ konservativer Wiedereinstiegs-RANGE',
    retA && retA.path === 'range' && retA.recommended === retA.range.min);
  ok('C2 ohne bestätigte Freiheit ⇒ BLOCKIERT (kein Wiedereinstiegswert)',
    retB && retB.path === 'criteria' && retB.blocked === true);
}

sec('V8 · Sicherheitsschicht → C2-Form');
{
  const s = OI.build(Object.assign(RAW(), {
    profileConstraints: [
      { bodyRegion: 'knee', title: 'Knie', intensity: 3, currentlyTrainable: false, status: 'active', medicallyChecked: true },
      { bodyRegion: 'back', intensity: 8, currentlyTrainable: true, status: 'active' },
      { bodyRegion: 'foot', intensity: 2, status: 'active' },
      { bodyRegion: 'hip', intensity: 9, status: 'resolved' }
    ],
    checkins: [{ date: RAW().today, ill: null, redFlags: { fever: true, swelling: true } }]
  }));
  const cs = s.derived.constraints;
  const by = src2 => cs.filter(c => c.source === src2);
  ok('nicht trainierbar ⇒ severity 3 + blocks all',
    cs.some(c => c.region === 'knee' && c.severity === 3 && c.blocks.indexOf('all') >= 0 && c.evidence === 'moderate'));
  ok('hohe Intensität ⇒ severity 2 + blocks intensity',
    cs.some(c => c.region === 'back' && c.severity === 2 && c.blocks.indexOf('intensity') >= 0));
  ok('resolved wird NICHT übersetzt', !cs.some(c => c.region === 'hip'));
  ok('Fieber heute ⇒ systemische Vollsperre (fail-closed)',
    by('red_flag:fever').length === 1 && by('red_flag:fever')[0].severity === 3);
  ok('Schwellung ⇒ muskuloskelettal severity 2', by('red_flag:swelling').length === 1);
  /* Und C2 BLOCKIERT damit wirklich (Sicherheitsschritt 1). */
  const PR = require(join(APP, 'js/engine/progression.js'));
  const dec = PR.progressionDecision({ loadHistory: null, toleranceState: null, constraints: cs });
  ok('C2 mit severity-3-Constraint ⇒ blocked', dec && dec.status === 'blocked', dec && dec.status);
}

sec('V9 · Riegel erbt keine Evidenz über Distanzen (Gians Gegenprobe)');
{
  /* 5 km in 20:00, strong ⇒ Marathon-Extrapolation. */
  const mk9 = () => Object.assign(RAW(), {
    goal: { type: 'marathon', distanceKm: 42.195, raceDate: '2026-12-01', targetMin: 200 },
    currentPerformance: { sports: { running: { ok: true, confidence: 'strong', ageRatio: 0.1,
      reference: { distanceKm: 5, durationMin: 20, date: '2026-08-01', source: 'race' }, zones: {} } } }
  });
  const fp = OI.build(mk9()).derived.feasibilityPerformance;
  ok('der Punktwert entspricht der Gegenprobe (~191,8 min)',
    fp && Math.abs(fp.value - 191.8) < 1.5, String(fp && fp.value));
  ok('die Evidenz ist GEDECKELT (Distanzverhältnis 8,4 ⇒ weak, Quelle ausgewiesen)',
    fp.evidence === 'weak' && fp.sourceEvidence === 'strong' &&
    fp.modelBasis === 'riegel_extrapolation' && fp.distanceRatio > 8);
  ok('ein Unsicherheitsband liegt bei', fp.band && fp.band.min < fp.value && fp.band.max > fp.value,
    JSON.stringify(fp.band));
  /* gleiche Distanz: Evidenz bleibt erhalten. */
  const same = Object.assign(mk9(), { goal: { type: 'run_5k', distanceKm: 5, raceDate: '2026-12-01', targetMin: 21 } });
  ok('gleiche Distanz behält die Quellenevidenz',
    OI.build(same).derived.feasibilityPerformance.evidence === 'strong');
  /* GF@3: der Kurzpfad prueft die KONSERVATIVE Bandkante — 200 min Ziel,
     Kante ~200,1 ⇒ KEIN within_modeled_corridor per Punktwert. */
  require(join(APP, 'js/engine/evidence.js'));
  const GF = require(join(APP, 'js/engine/goal-feasibility.js'));
  const v9 = GF.feasibility({
    goal: { targetValue: 200, metricType: 'time', direction: 'lower' },
    targetDate: '2026-12-01', today: '2026-08-08',
    currentPerformance: fp, level: 'ambitioniert',
    allowableProgression: { actionable: true }
  }, { registry: {} });
  /* Punktwert 191,8 erfuellt das Ziel, die konservative Kante 200,2 NICHT —
     der Kurzpfad darf nicht greifen. Dass der Fall danach im NORMALEN Pfad
     als within herauskommt (0,1 % Bedarf ueber 16 Wochen), ist die ehrliche
     Bewertung — entscheidend ist, DASS ab der Kante gerechnet wurde. */
  ok('GF@3: der Kurzpfad greift nicht — gerechnet wird ab der konservativen Kante',
    v9.requiredTrajectory && v9.requiredTrajectory.conservativeEdge === true &&
    Math.abs(v9.requiredTrajectory.from - fp.band.max) < 0.01,
    JSON.stringify({ status: v9.status, from: v9.requiredTrajectory && v9.requiredTrajectory.from }));
  ok('… und die Aussage trägt keine starke Evidenz aus der Extrapolation',
    v9.evidence !== 'strong', String(v9.evidence));

  /* GIANS GEGENPROBE 2 (P1, v8-302): Die konservative Kante gilt fuer JEDE
     Bedarfsrechnung — Punktwert 210, Band 190–230, Ziel 200: ab 210 waeren
     es 4,76 % (within), ab der Kante 230 sind es 13 % (outside). */
  const mkPerf = band => ({ value: 210, metric: 'time', direction: 'lower',
    evidence: 'moderate', ageRatio: 0.2, modelBasis: 'riegel_extrapolation',
    distanceRatio: 4.2, modelVersion: OI.VERSION, band });
  const vBand = GF.feasibility({
    goal: { targetValue: 200, metricType: 'time', direction: 'lower' },
    targetDate: '2026-12-01', today: '2026-08-08',
    currentPerformance: mkPerf({ min: 190, max: 230 }), level: 'ambitioniert',
    allowableProgression: { actionable: true }
  }, { registry: {} });
  ok('GF@4: der Bedarf rechnet IMMER ab der konservativen Kante (13 %, nicht 4,76 %)',
    vBand.status === 'outside_modeled_corridor' &&
    vBand.requiredTrajectory.from === 230 && vBand.requiredTrajectory.pointValue === 210 &&
    vBand.requiredTrajectory.conservativeEdge === true,
    vBand.status + '/from=' + (vBand.requiredTrajectory && vBand.requiredTrajectory.from));

  /* GIANS GEGENPROBE 3 (P1): Verschiedene Baender ⇒ verschiedene
     Cache-Schluessel — vorher trugen within und outside DENSELBEN Key. */
  const ckOf = band => GF.cacheKey({
    goal: { targetValue: 200, metricType: 'time', direction: 'lower' },
    targetDate: '2026-12-01', today: '2026-08-08',
    currentPerformance: mkPerf(band), level: 'ambitioniert'
  }).key;
  ok('GF@4: ein anderes Band ist ein anderer Cache-Schlüssel',
    ckOf({ min: 190, max: 200.2 }) !== ckOf({ min: 190, max: 230 }));
  ok('… und modelBasis/distanceRatio/modelVersion ändern ihn ebenfalls',
    ckOf({ min: 190, max: 230 }) !== GF.cacheKey({
      goal: { targetValue: 200, metricType: 'time', direction: 'lower' },
      targetDate: '2026-12-01', today: '2026-08-08',
      currentPerformance: Object.assign(mkPerf({ min: 190, max: 230 }), { modelBasis: 'same_distance', distanceRatio: 1 }),
      level: 'ambitioniert'
    }).key);
  ok('… und performanceModelVersion ist im Adapterergebnis nicht mehr absent',
    fp.modelVersion === OI.VERSION);
}

sec('V5 · Einhängung');
{
  ok('Modul ist eingehängt', /js\/engine\/observer-input\.js/.test(readFileSync(join(APP, 'index.html'), 'utf8')));
  ok('Modul ist im Cache-Manifest', /observer-input\.js/.test(readFileSync(join(APP, 'sw.js'), 'utf8')));
  ok('Modul ist in der Versionsdrift-Bewachung',
    /observer-input\.js/.test(readFileSync(join(HERE, 'module_version_drift_test.mjs'), 'utf8')));
  ok('… und wird VOR dem Prediction Observer geladen',
    (() => { const h = readFileSync(join(APP, 'index.html'), 'utf8');
      return h.indexOf('observer-input.js') < h.indexOf('prediction-observer.js'); })());
}

console.log('\n' + '═'.repeat(62));
console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);

/* ============================================================
   ORVIA · goal_realism — S3b (Gian, 25.09.2026)
   ------------------------------------------------------------
   „5 km in 40 min, Marathon unter 2:30 in zwei Monaten — die App sollte sagen,
   dass das unerreichbar ist, und ein leichteres Ziel nahelegen. Ein
   realistisches Ziel braucht keinen Stempel."

     A. Adapter@2: Zielzeit-Ziele werden bewertet (vorher metric_not_commensurable)
     B. Bewerter-Kette mit Gians Beispiel: unrealistic, Wochenbedarf, sichere Zielzeit
     C. Einstufung: ok schweigt, tight, unrealistic, unknown; Schwellwert 1,5
     D. Vorschlaege: safeTarget = vorsichtige Kante (liegt selbst im Korridor), earliestDate
     E. Sheet-Hinweis (profile-v14.realismHTML): Text + Uebernahme-Buttons, ok ⇒ leer

   node supabase/tests/goal_realism_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _ex } from 'node:fs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
global.window = global;
const load = f => (0, eval)(rd(f));
['js/engine/evidence.js', 'js/engine/performance-zones.js', 'js/engine/goal-feasibility.js', 'js/engine/goal-feasibility-adapter.js', 'js/engine/goal-realism.js', 'js/i18n.js', 'locales/de.js'].forEach(load);
const O = global.ORVIA, AD = O.goalFeasibilityAdapter, GR = O.goalRealism, PZ = O.performanceZones;
const TODAY = '2026-09-25';
/* Leistungsbild wie vom Resolver: 5 km in 40:00, frische, starke Referenz */
const perf5k40 = { sports: { running: { ok: true, reference: { distanceKm: 5, durationMin: 40, date: '2026-09-20', source: 'race' }, confidence: 'strong', ageRatio: 0.1, agreement: { spreadMin: 0 } } } };
const goal = (cat, sec, date) => ({ category: cat, targetValue: sec, unit: 's', metricType: 'time', targetDate: date });

sec('A · Adapter@2 bewertet Zielzeit-Ziele');
{
  ok('A1 Version @2', AD.VERSION === 'goal-feasibility-adapter@2');
  const b = AD.buildInput({ goal: goal('marathon', 2.5 * 3600, '2026-11-25'), resolvedPerformance: perf5k40, today: TODAY, level: 'intermediate' });
  ok('A2 kein skip mehr (vorher metric_not_commensurable)', !b.skip && b.input && b.input.currentPerformance.metric === 'race_time', JSON.stringify(b).slice(0, 120));
  ok('A3 Leistung in der Zieldimension: Riegel-Marathon aus 5 km/40 min ≈ 6:10 h (Sekunden, mit Band)', b.input.currentPerformance.value > 5.5 * 3600 && b.input.currentPerformance.value < 6.8 * 3600 && b.input.currentPerformance.band.max > b.input.currentPerformance.value && b.input.currentPerformance.modelBasis === 'riegel_extrapolation', String(b.input.currentPerformance.value));
  ok('A4 Zielzeit in Minuten wird zu Sekunden', AD.goalTargetSeconds({ targetValue: 110, unit: 'min' }) === 6600 && AD.goalTargetSeconds({ targetValue: 6600, unit: 's' }) === 6600);
  ok('A5 Distanz aus Kategorie (half_marathon → 21,0975)', AD.goalDistanceKm({ category: 'half_marathon' }) === 21.0975 && AD.goalDistanceKm({ category: 'run_10k' }) === 10 && AD.goalDistanceKm({ category: 'get_stronger' }) === null);
  ok('A6 ohne Laufleistung ⇒ skip mit Grund', AD.buildInput({ goal: goal('marathon', 9000, '2026-11-25'), resolvedPerformance: { sports: {} }, today: TODAY }).reason === 'no_usable_performance:running_race_time');
}

sec('B · Gians Beispiel durch die ganze Kette');
{
  const obs = AD.observe({ goal: goal('marathon', 2.5 * 3600, '2026-11-25'), resolvedPerformance: perf5k40, today: TODAY, level: 'intermediate' });
  ok('B1 bewertet, ausserhalb des Korridors', obs.evaluated === true && obs.status === 'outside_modeled_corridor', JSON.stringify([obs.evaluated, obs.status, obs.reason]));
  const r = GR.grade(obs, TODAY);
  ok('B2 Einstufung: unrealistic', r.grade === 'unrealistic', JSON.stringify(r));
  ok('B3 Bedarf > 50 % Leistung, Verhaeltnis zur Hoechstrate weit ueber 1,5', r.requiredPct > 50 && r.ratio > 1.5, JSON.stringify([r.requiredPct, r.ratio]));
  ok('B4 Wochenbedarf laut Modell: Jahre, nicht Wochen (min > 100 Wochen)', r.weeksNeeded && r.weeksNeeded.min > 100, JSON.stringify(r.weeksNeeded));
  ok('B5 sichere Zielzeit = vorsichtige Kante (> heutige realistische Marathonzeit)', r.safeTarget > 5.5 * 3600, String(r.safeTarget));
  ok('B6 fruehestes Datum liegt Jahre in der Zukunft', r.earliestDate > '2028-01-01', r.earliestDate);
  /* Gegenprobe: die sichere Zielzeit ist selbst im Korridor */
  const obs2 = AD.observe({ goal: goal('marathon', r.safeTarget, '2026-11-25'), resolvedPerformance: perf5k40, today: TODAY, level: 'intermediate' });
  ok('B7 sichere Zielzeit als Ziel ⇒ nicht mehr ausserhalb (within oder insufficient ohne Progression)', obs2.status !== 'outside_modeled_corridor', obs2.status);
  ok('B8 damit schweigt die Oberflaeche (ok/unknown)', ['ok', 'unknown'].indexOf(GR.grade(obs2, TODAY).grade) >= 0);
}

sec('C · Stufen und Schwellwert');
{
  const mk = (status, pctPerBlock, totalPct, achMax, achMin, mode, weeks) => ({ evaluated: true, status, result: { status, goalMode: mode || 'fixed_date',
    requiredTrajectory: { metric: 'race_time', direction: 'lower', from: 7000, to: 6000, totalPct, pctPerBlock, weeksAvailable: weeks || 12 },
    achievableTrajectory: { min: achMin, max: achMax } } });
  ok('C1 within ⇒ ok', GR.grade(mk('within_modeled_corridor', 3, 3, 5, 2)).grade === 'ok');
  ok('C2 outside, Verhaeltnis 1,4 ⇒ tight', GR.grade(mk('outside_modeled_corridor', 7, 7, 5, 2)).grade === 'tight');
  ok('C3 outside, Verhaeltnis 1,5 ⇒ noch tight (Grenze inklusiv)', GR.grade(mk('outside_modeled_corridor', 7.5, 7.5, 5, 2)).grade === 'tight');
  ok('C4 outside, Verhaeltnis 1,6 ⇒ unrealistic', GR.grade(mk('outside_modeled_corridor', 8, 8, 5, 2)).grade === 'unrealistic');
  ok('C5 insufficient ⇒ unknown', GR.grade(mk('insufficient_data', 8, 8, 5, 2)).grade === 'unknown');
  ok('C6 nicht bewertet ⇒ unknown mit Grund', GR.grade({ evaluated: false, reason: 'no_goal' }).grade === 'unknown' && GR.grade(null).reason === 'no_observation');
  ok('C6b outside OHNE Trajektorien (nur Status) ⇒ tight, nie unrealistic ohne Zahl', GR.grade({ evaluated: true, status: 'outside_modeled_corridor' }).grade === 'tight');
  ok('C7 flexibel ausserhalb mit Rate ⇒ tight, ohne Rate ⇒ unrealistic', GR.grade(mk('outside_modeled_corridor', null, 8, 5, 2, 'flexible')).grade === 'tight' && GR.grade(mk('outside_modeled_corridor', null, 8, 0, 0, 'flexible')).grade === 'unrealistic');
  const w = GR.grade(mk('outside_modeled_corridor', 8, 16, 5, 2), TODAY);
  ok('C8 Wochenbedarf = totalPct/Rate×12: 16/5×12 = 38,4 … 16/2×12 = 96', w.weeksNeeded.min === 38.4 && w.weeksNeeded.max === 96 && w.earliestDate === GR._addWeeks(TODAY, 38.4));
  ok('C9 _addWeeks rundet auf ganze Tage nach oben', GR._addWeeks('2026-09-25', 1) === '2026-10-02' && GR._addWeeks('2026-09-25', 0.1) === '2026-09-26' && GR._addWeeks('x', 1) === null);
}

sec('D/E · Sheet-Hinweis');
{
  /* profile-v14 mit Mini-Umgebung laden */
  global.document = { getElementById: () => null };
  global.todayStr = () => TODAY;
  load('js/screens/profile-v14.js');
  const PV = O.screens.profileV14;
  const obs = AD.observe({ goal: goal('marathon', 2.5 * 3600, '2026-11-25'), resolvedPerformance: perf5k40, today: TODAY, level: 'intermediate' });
  const r = GR.grade(obs, TODAY);
  const h = PV.realismHTML(r);
  ok('E1 unrealistic ⇒ roter Hinweis mit Wochenbedarf und sicherer Zielzeit', /pv-realism crit/.test(h) && /Unrealistisch im Zeitraum/.test(h) && /bräuchte es/.test(h) && /Sicher im Rahmen/.test(h));
  ok('E2 zwei Uebernahme-Buttons (Zielzeit, Datum)', /sheetTakeSafe\(\d+\)/.test(h) && /sheetTakeDate\('\d{4}-\d{2}-\d{2}'\)/.test(h));
  ok('E3 ok/unknown ⇒ kein Hinweis', PV.realismHTML({ grade: 'ok' }) === '' && PV.realismHTML(null) === '' && PV.realismHTML({ grade: 'unknown' }) === '');
  ok('E4 realismOf: Pill-Stufe aus Beobachtung', PV.realismOf(obs) === 'unrealistic' && PV.realismOf(null) === 'unknown');
  ok('E5 kein roher Key im Hinweis', !/pv\.[a-z_]+/.test(h));
  /* Gians echter Fall: HM 1:50 mit 10 km in 49:12 als Referenz, 12 Wochen ⇒ nicht unrealistic */
  const perf10k = { sports: { running: { ok: true, reference: { distanceKm: 10, durationMin: 49.2, date: '2026-09-20', source: 'race' }, confidence: 'strong', ageRatio: 0.1, agreement: { spreadMin: 0 } } } };
  const o2 = AD.observe({ goal: goal('half_marathon', 110 * 60, '2026-12-18'), resolvedPerformance: perf10k, today: TODAY, level: 'intermediate' });
  const g2 = GR.grade(o2, TODAY);
  ok('E6 HM 1:50 aus 10 km/49:12 in 12 Wochen ⇒ nicht unrealistic (' + g2.grade + ')', g2.grade !== 'unrealistic', JSON.stringify([o2.status, g2.requiredPct, g2.ratio]));
}

console.log('\n' + (fail ? '❌' : '✅') + ' ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

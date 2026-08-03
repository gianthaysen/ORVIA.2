/* ============================================================
   ORVIA · Engine 3c · I3a.6 — letzter Fail-closed-Fix für den Coach-Vertrag (Mikrofix)
   I3a.5 korrigierte acwrStatus.estimated, liess aber offen: fehlende/leere/null/ungültige
   ld.confidence wurden weiterhin über loadConfidenceContract's permissiven Fallback WIE
   'hoch' behandelt (value numerisch, assessable:true). Das widerspricht dem beauftragten
   Fail-closed-Vertrag.
   Fix: Confidence wird VOR dem Aufruf von loadConfidenceContract normalisiert — nur
   'hoch'/'reduziert'/'not_assessable' werden durchgereicht, alles andere (fehlt/null/leer/
   Tippfehler) wird konservativ zu 'not_assessable', mit einem verständlichen, unterscheidbaren
   Reason (load_confidence_missing_or_invalid). Einzige Änderung: die Confidence-Auflösung in
   buildAIReview(). goalEngine, buildTrainingDecision, Lastformeln/EWMA unverändert.
   node supabase/tests/engine_i3a6_confidence_normalize_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const base = new URL('../../../app/js/', import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, info) => { console.log((c ? '✅' : '❌') + ' ' + n + (info != null ? '  — ' + info : '')); c ? pass++ : fail++; };

globalThis.window = globalThis;
globalThis.ORVIA = { user: { id: 'u1' } };
(0, eval)(readFileSync(new URL('calc.js', base), 'utf8'));
const Calc = globalThis.Calc;
const calcSrc = readFileSync(new URL('calc.js', base), 'utf8');
const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');

/* ================= 0) Statischer Wiring-/Scope-Schutz ================= */
{
  ok('[0-1] buildAIReview normalisiert Confidence vor loadConfidenceContract (Allowlist hoch/reduziert/not_assessable)', /_lcValid2=\(_lcRaw2===['"]hoch['"]\|\|_lcRaw2===['"]reduziert['"]\|\|_lcRaw2===['"]not_assessable['"]\)/.test(uiSrc));
  ok('[0-2] verständlicher, unterscheidbarer Reason-Code load_confidence_missing_or_invalid vorhanden', /load_confidence_missing_or_invalid/.test(uiSrc));
  ok('[0-3] goalEngine (calc.js) unverändert seit I3a.4: Fail-closed-Marker weiterhin vorhanden', /load_confidence_missing/.test(calcSrc) && /load_confidence_invalid/.test(calcSrc));
  ok('[0-4] I3a.1-Safety-Gate-Zeile in buildTrainingDecision unverändert vorhanden', calcSrc.indexOf("if(_loadNotAssessable&&state==='GREEN')state='YELLOW';") !== -1);
}

/* ================= Coach-Report-Harness (buildAIReview im Sandbox, wie I3a.4/I3a.5) ================= */
function buildReviewWith(confidence, acwrNum) {
  const s = uiSrc.indexOf('function buildAIReview(){');
  const e = uiSrc.indexOf('function copyAIReview(){');
  const reviewBlock = uiSrc.slice(s, e);
  const sb = {}; sb.window = sb; sb.globalThis = sb; sb.Math = Math; sb.JSON = JSON; sb.isNaN = isNaN; sb.Object = Object;
  sb.DB = {};
  sb.dkey = off => '2026-07-' + (18 + off);
  sb.todayStr = () => '2026-07-18';
  sb.PROFILE = { name: 'Test' };
  sb.RACE = { date: '2026-10-01' };
  sb.goalOf = () => ({ type: 'half_marathon', raceDate: '2026-10-01' });
  sb.RACE_LABELS_P = { half_marathon: 'Halbmarathon' };
  sb.daysTo = () => 60;
  sb.buildGoal = () => ({ state: 'ontrack', tPred: 6000, target: 6300, vetos: [], nQuality: 5 });
  sb.runsWindow = () => [];
  sb.weekRunKm = off => off === 0 ? 30 : 28;
  sb.readinessFor = () => ({ score: 80 });
  sb.Calc = Object.assign({}, Calc, {
    loadModel: () => ({ acwr: acwrNum, acute: 100, chronic: 90, acwrReliable: true }),
    easyShare: () => null,
    weeklyJump: () => ({ lvl: 'g', ratio: null, msg: null }),
    weekKmTarget: () => 40,
    fmtTime: s => s + 's'
  });
  sb.allLoads = () => ({ loads: [1, 2, 3], confidence: confidence, completeness: { knownDays: 30 } });
  vm.createContext(sb);
  vm.runInContext(reviewBlock, sb, { filename: 'ui.js#review-i3a6' });
  return sb.buildAIReview();
}

/* ================= A) Rote Fälle — fehlende/ungültige Confidence, jeweils fail-closed ================= */
const badCases = [
  ['fehlend (Feld nicht gesetzt)', undefined],
  ['null', null],
  ['leere Zeichenkette', ''],
  ['Tippfehler', 'hoc'],
];
badCases.forEach(([label, val]) => {
  const rev = buildReviewWith(val, 1.12);
  ok('[A-' + label + '-1] value ist KEINE Zahl (null)', rev.acwrStatus && rev.acwrStatus.value === null, JSON.stringify(rev.acwrStatus));
  ok('[A-' + label + '-2] assessable === false', rev.acwrStatus && rev.acwrStatus.assessable === false, JSON.stringify(rev.acwrStatus));
  ok('[A-' + label + '-3] estimated === false', rev.acwrStatus && rev.acwrStatus.estimated === false, JSON.stringify(rev.acwrStatus));
  ok('[A-' + label + '-4] Legacy-acwr === null', rev.acwr === null, 'acwr=' + rev.acwr);
  ok('[A-' + label + '-5] Reason vorhanden und verständlich (load_confidence_missing_or_invalid)', rev.acwrStatus && /load_confidence_missing_or_invalid/.test(rev.acwrStatus.reason || ''), rev.acwrStatus && rev.acwrStatus.reason);
});

/* ================= B) Gegenproben — gültige Werte bleiben exakt wie beauftragt ================= */
{
  const revHoch = buildReviewWith('hoch', 1.12);
  ok('[B1-1] hoch: value numerisch', revHoch.acwrStatus && revHoch.acwrStatus.value === 1.12, JSON.stringify(revHoch.acwrStatus));
  ok('[B1-2] hoch: assessable true, estimated false', revHoch.acwrStatus && revHoch.acwrStatus.assessable === true && revHoch.acwrStatus.estimated === false);
  ok('[B1-3] hoch: Legacy-acwr numerisch', revHoch.acwr === 1.12, 'acwr=' + revHoch.acwr);

  const revRed = buildReviewWith('reduziert', 1.12);
  ok('[B2-1] reduziert: Schätzwert AUSSCHLIESSLICH in acwrStatus.value', revRed.acwrStatus && revRed.acwrStatus.value === 1.12 && revRed.acwrStatus.estimated === true, JSON.stringify(revRed.acwrStatus));
  ok('[B2-2] reduziert: Legacy-acwr === null (kein unmarkierter Schätzwert)', revRed.acwr === null, 'acwr=' + revRed.acwr);

  const revNA = buildReviewWith('not_assessable', 1.12);
  ok('[B3-1] not_assessable: vollständig unterdrückt (value null, assessable false, estimated false)', revNA.acwrStatus && revNA.acwrStatus.value === null && revNA.acwrStatus.assessable === false && revNA.acwrStatus.estimated === false, JSON.stringify(revNA.acwrStatus));
  ok('[B3-2] not_assessable: Legacy-acwr === null', revNA.acwr === null, 'acwr=' + revNA.acwr);
  ok('[B3-3] not_assessable: Reason bleibt die GENUINE Last-Meldung, NICHT der Missing/Invalid-Code (Unterscheidbarkeit)', revNA.acwrStatus && /nicht belastbar/.test(revNA.acwrStatus.reason || '') && !/load_confidence_missing_or_invalid/.test(revNA.acwrStatus.reason || ''), revNA.acwrStatus && revNA.acwrStatus.reason);

  // Goal-Veto bleibt fail-closed (Regression I3a.4, goalEngine unverändert).
  const runs = [
    { date: '2026-06-08', sub: 'Tempo', dist: 5, dur: 25, hr: 165 },
    { date: '2026-06-15', sub: 'Tempo', dist: 5, dur: 24, hr: 166 },
    { date: '2026-06-22', sub: 'Long Run', dist: 15, dur: 90, hr: 150 },
    { date: '2026-06-29', sub: 'Long Run', dist: 16, dur: 95, hr: 150 },
    { date: '2026-06-10', sub: 'Easy Z2', dist: 8, dur: 50, hr: 140 },
    { date: '2026-06-17', sub: 'Easy Z2', dist: 8, dur: 50, hr: 140 },
    { date: '2026-06-24', sub: 'Easy Z2', dist: 8, dur: 50, hr: 140 },
    { date: '2026-07-01', sub: 'Easy Z2', dist: 8, dur: 50, hr: 140 },
  ];
  const opts = { daysToRace: 200, targetMin: 100, lrMax28: 20, trackingWeeks: 6, avg4WeekKm: 30, ctlNow: 50, ctlPrev28: 60 };
  const rMissing = Calc.goalEngine(runs, opts);
  ok('[B4-1] goalEngine: fehlende Confidence weiterhin fail-closed (kein hartes CTL-Veto)', !(rMissing.vetos || []).some(v => v.indexOf('Fitness (CTL)') !== -1), JSON.stringify(rMissing.vetos));

  // RED bleibt RED.
  const decRed = Calc.buildTrainingDecision({ checkin: { readiness: 20, pain: 9, illness: false }, components: { recovery: 20 }, loads: { load3: 100, load7: 100, acuteAssessable: false }, plannedToday: { t: 'Laufen', hard: true }, profile: {}, dataQuality: { days: 40 } });
  ok('[B5-1] RED bleibt RED', decRed.dayState === 'RED', 'state=' + decRed.dayState);
  const decOk = Calc.buildTrainingDecision({ checkin: { readiness: 92, pain: 0, doms: 0, illness: false, sleepH: 8, sleepQ: 8, feel: 8, stress: 'Low', hrv: 'balanced' }, components: { recovery: 92 }, loads: { load3: 100, load7: 100, acuteAssessable: true }, plannedToday: { t: 'Laufen', l: 'Intervalle', hard: true }, profile: {}, dataQuality: { days: 40 } });
  ok('[B5-2] Gegenprobe: vollständig belastbare Last erlaubt weiterhin GREEN', decOk.dayState === 'GREEN', 'state=' + decOk.dayState);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
console.log('I3a.6: ' + (fail === 0 ? 'GRÜN — fehlende/leere/null/ungültige Last-Confidence wird in buildAIReview() fail-closed zu not_assessable normalisiert; gültige Werte unverändert korrekt.' : 'ROT — ' + fail + ' offen (erwartet vor dem Fix).'));

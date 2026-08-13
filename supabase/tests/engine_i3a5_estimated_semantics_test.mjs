/* ============================================================
   ORVIA · Engine 3c · I3a.5 — Semantik von acwrStatus.estimated korrigieren (Mikrofix)
   I3a.4 liess bei 'not_assessable' den Widerspruch value:null + estimated:true zu
   ("kein belastbarer/geschätzter Wert, aber geschätzt"). Zielvertrag (NUR estimated
   geändert, sonst nichts):
     estimated === true  genau dann, wenn die aufgelöste Confidence 'reduziert' ist
     UND ein modellierter numerischer Wert vorhanden ist (assessable === true).
   goalEngine, CTL/ATL/ACWR-Formeln, buildTrainingDecision, Safety-Gates bleiben
   unverändert (siehe Abschnitt E: Regressions-Pin).
   node supabase/tests/engine_i3a5_estimated_semantics_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const base = new URL(_APPREL + 'js/', import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, info) => { console.log((c ? '✅' : '❌') + ' ' + n + (info != null ? '  — ' + info : '')); c ? pass++ : fail++; };

globalThis.window = globalThis;
globalThis.ORVIA = { user: { id: 'u1' } };
(0, eval)(readFileSync(new URL('calc.js', base), 'utf8'));
const Calc = globalThis.Calc;
const calcSrc = readFileSync(new URL('calc.js', base), 'utf8');
const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');

/* ================= 0) Statischer Wortlaut-/Wiring-Schutz ================= */
{
  ok('[0-1] ui.js enthält NICHT mehr die alte "estimated=!hoch"-Formel (Widerspruch bei not_assessable)', uiSrc.indexOf("estimated:!!(_lc2&&_lc2!=='hoch')") === -1);
  ok('[0-2] ui.js: estimated hängt jetzt an assessable UND an "reduziert" (exakter Vertrag)', /estimated:\(_acwrAssessable&&_lc2===['"]reduziert['"]\)/.test(uiSrc));
  ok('[0-3] goalEngine (calc.js) unverändert seit I3a.4: Fail-closed-Marker weiterhin vorhanden', /load_confidence_missing/.test(calcSrc) && /load_confidence_invalid/.test(calcSrc));
  ok('[0-4] I3a.1-Safety-Gate-Zeile in buildTrainingDecision unverändert vorhanden', calcSrc.indexOf("if(_loadNotAssessable&&state==='GREEN')state='YELLOW';") !== -1);
}

/* ================= Coach-Report-Harness (buildAIReview im Sandbox, wie I3a.4) ================= */
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
  vm.runInContext(reviewBlock, sb, { filename: 'ui.js#review-i3a5' });
  return sb.buildAIReview();
}

/* ================= A) hoch ================= */
{
  const rev = buildReviewWith('hoch', 1.12);
  ok('[A1-1] hoch: value numerisch', rev.acwrStatus && rev.acwrStatus.value === 1.12, JSON.stringify(rev.acwrStatus));
  ok('[A1-2] hoch: assessable === true', rev.acwrStatus && rev.acwrStatus.assessable === true);
  ok('[A1-3] hoch: estimated === false', rev.acwrStatus && rev.acwrStatus.estimated === false, 'estimated=' + (rev.acwrStatus && rev.acwrStatus.estimated));
  ok('[A1-4] hoch: Legacy-acwr numerisch (Kompatibilität)', rev.acwr === 1.12, 'acwr=' + rev.acwr);
}

/* ================= B) reduziert ================= */
{
  const rev = buildReviewWith('reduziert', 1.12);
  ok('[B1-1] reduziert: value numerisch (Modellschätzwert)', rev.acwrStatus && rev.acwrStatus.value === 1.12, JSON.stringify(rev.acwrStatus));
  ok('[B1-2] reduziert: assessable === true', rev.acwrStatus && rev.acwrStatus.assessable === true);
  ok('[B1-3] reduziert: estimated === true', rev.acwrStatus && rev.acwrStatus.estimated === true, 'estimated=' + (rev.acwrStatus && rev.acwrStatus.estimated));
  ok('[B1-4] reduziert: Legacy-acwr === null (kein unmarkierter Schätzwert für Legacy-Konsumenten)', rev.acwr === null, 'acwr=' + rev.acwr);
}

/* ================= C) not_assessable — der eigentliche Zielfall dieses Mikrofixes ================= */
{
  const rev = buildReviewWith('not_assessable', 1.12);
  ok('[C1-1] not_assessable: value === null', rev.acwrStatus && rev.acwrStatus.value === null, JSON.stringify(rev.acwrStatus));
  ok('[C1-2] not_assessable: assessable === false', rev.acwrStatus && rev.acwrStatus.assessable === false);
  ok('[C1-3] not_assessable: estimated === false (KEIN Widerspruch mehr — kein Wert, also auch keine Schätzung)', rev.acwrStatus && rev.acwrStatus.estimated === false, 'estimated=' + (rev.acwrStatus && rev.acwrStatus.estimated));
  ok('[C1-4] not_assessable: Legacy-acwr === null', rev.acwr === null, 'acwr=' + rev.acwr);
  ok('[C1-5] not_assessable: strukturierter Reason bleibt erhalten ("nicht belastbar")', rev.acwrStatus && /nicht belastbar/.test(rev.acwrStatus.reason || ''), rev.acwrStatus && rev.acwrStatus.reason);
}

/* ================= D) fehlende/ungültige Confidence ================= */
{
  // D-1: buildAIReview-Ebene — estimated bleibt false (im Scope dieses Mikrofixes: NUR estimated
  // wurde geändert). value/assessable folgen weiterhin loadConfidenceContract's bestehendem
  // Fallback-Verhalten (unverändert seit I3a.2, außerhalb des Scopes dieses Batches) — echte
  // allLoads()-Aufrufe liefern in der Praxis ausschließlich 'hoch'/'reduziert'/'not_assessable'.
  const revMissing = buildReviewWith(null, 1.12);
  ok('[D1-1] fehlende Confidence: estimated === false', revMissing.acwrStatus && revMissing.acwrStatus.estimated === false, JSON.stringify(revMissing.acwrStatus));
  const revInvalid = buildReviewWith('kinda_ok', 1.12);
  ok('[D1-2] ungültige Confidence: estimated === false', revInvalid.acwrStatus && revInvalid.acwrStatus.estimated === false, JSON.stringify(revInvalid.acwrStatus));

  // D-2: goalEngine-Ebene — Regressions-Pin auf I3a.4 (fail-closed, kein hartes CTL-Veto).
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
  const rMissing = Calc.goalEngine(runs, opts); // kein loadConfidence-Feld
  ok('[D2-1] goalEngine: fehlende Confidence ⇒ kein hartes CTL-Veto (Regression I3a.4)', !(rMissing.vetos || []).some(v => v.indexOf('Fitness (CTL)') !== -1), JSON.stringify(rMissing.vetos));
  const rInvalid = Calc.goalEngine(runs, Object.assign({}, opts, { loadConfidence: 'kinda_ok' }));
  ok('[D2-2] goalEngine: ungültige Confidence ⇒ kein hartes CTL-Veto (Regression I3a.4)', !(rInvalid.vetos || []).some(v => v.indexOf('Fitness (CTL)') !== -1), JSON.stringify(rInvalid.vetos));
}

/* ================= E) Sicherheitsgegenprobe (Regressions-Pin, I3a.1-Gate unverändert) ================= */
{
  const goodCheckin = { readiness: 92, pain: 0, doms: 0, illness: false, sleepH: 8, sleepQ: 8, feel: 8, stress: 'Low', hrv: 'balanced' };
  const decBlocked = Calc.buildTrainingDecision({ checkin: goodCheckin, components: { recovery: 92 }, loads: { load3: 100, load7: 100, acuteAssessable: false }, plannedToday: { t: 'Laufen', l: 'Intervalle', hard: true }, profile: {}, dataQuality: { days: 40 } });
  ok('[E1-1] gute Signale + nicht belastbare akute Last: kein GREEN', decBlocked.dayState !== 'GREEN', 'state=' + decBlocked.dayState);
  const decRed = Calc.buildTrainingDecision({ checkin: { readiness: 20, pain: 9, illness: false }, components: { recovery: 20 }, loads: { load3: 100, load7: 100, acuteAssessable: false }, plannedToday: { t: 'Laufen', hard: true }, profile: {}, dataQuality: { days: 40 } });
  ok('[E2-1] RED bleibt RED', decRed.dayState === 'RED', 'state=' + decRed.dayState);
  const decOk = Calc.buildTrainingDecision({ checkin: goodCheckin, components: { recovery: 92 }, loads: { load3: 100, load7: 100, acuteAssessable: true }, plannedToday: { t: 'Laufen', l: 'Intervalle', hard: true }, profile: {}, dataQuality: { days: 40 } });
  ok('[E3-1] Gegenprobe: vollständig belastbare Last erlaubt weiterhin GREEN', decOk.dayState === 'GREEN', 'state=' + decOk.dayState);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
console.log('I3a.5: ' + (fail === 0 ? 'GRÜN — acwrStatus.estimated ist jetzt genau dann true, wenn Confidence "reduziert" UND ein modellierter Wert vorhanden ist; kein Widerspruch mehr bei not_assessable.' : 'ROT — ' + fail + ' offen (erwartet vor dem Fix).'));

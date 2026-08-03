/* ============================================================
   ORVIA · Engine 3c · I3a.4 — Fail-closed bei fehlender Confidence + Legacy-ACWR absichern
   Schliesst zwei verbleibende Fail-open-Pfade aus I3a.3:
   1) goalEngine() behandelte fehlendes loadConfidence via `||'hoch'` wie hohe Confidence —
      ein vergessener/veralteter Aufrufer konnte weiterhin ein hartes CTL-Trend-Veto ausloesen.
      Jetzt fail-closed: nur EXPLIZIT gueltige Confidence akzeptiert; fehlend/ungueltig ⇒
      kein hartes Veto, strukturierter Reason load_confidence_missing / load_confidence_invalid,
      niemals automatisch 'hoch'.
   2) buildAIReview() liess bei 'reduziert' im Legacy-Feld `acwr` eine unmarkierte Zahl stehen.
      Jetzt: Legacy-`acwr` NUR bei 'hoch' numerisch; bei 'reduziert'/'not_assessable' zwingend
      null. Der Modellschaetzwert lebt ausschliesslich in acwrStatus.value (estimated:true).
   Wiederverwendung des bestehenden Contracts (Calc.loadConfidenceContract) — keine zweite
   Confidence-Logik. Das I3a.1-Safety-Gate (buildTrainingDecision) ist NICHT Gegenstand dieser
   Aenderung; Abschnitt F ist eine Regressions-Gegenprobe.
   node supabase/tests/engine_i3a4_failclosed_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const base = new URL('../../js/', import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, info) => { console.log((c ? '✅' : '❌') + ' ' + n + (info != null ? '  — ' + info : '')); c ? pass++ : fail++; };

globalThis.window = globalThis;
globalThis.ORVIA = { user: { id: 'u1' } };
(0, eval)(readFileSync(new URL('calc.js', base), 'utf8'));
const Calc = globalThis.Calc;
const calcSrc = readFileSync(new URL('calc.js', base), 'utf8');
const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');

/* ================= 0) Statischer Fail-closed-/Wiring-Schutz ================= */
{
  ok('[0-1] goalEngine nutzt KEIN fail-open `o.loadConfidence||\'hoch\'` mehr', calcSrc.indexOf("o.loadConfidence||'hoch'") === -1);
  ok('[0-2] goalEngine fuehrt die Reason-Codes load_confidence_missing UND load_confidence_invalid', /load_confidence_missing/.test(calcSrc) && /load_confidence_invalid/.test(calcSrc));
  ok('[0-3] buildAIReview begrenzt Legacy-acwr auf hohe Confidence (_acwrLegacy hoch-only)', /_acwrLegacy/.test(uiSrc) && /acwr:_acwrLegacy/.test(uiSrc));
  ok('[0-4] I3a.1-Safety-Gate-Zeile in buildTrainingDecision unveraendert vorhanden', calcSrc.indexOf("if(_loadNotAssessable&&state==='GREEN')state='YELLOW';") !== -1);
  ok('[0-5] keine zweite Confidence-Logik: buildAIReview verwendet weiterhin Calc.loadConfidenceContract', (uiSrc.match(/loadConfidenceContract/g) || []).length >= 2);
}

/* ================= Fixtures ================= */
function mkRuns() {
  return [
    { date: '2026-06-08', sub: 'Tempo', dist: 5, dur: 25, hr: 165 },
    { date: '2026-06-15', sub: 'Tempo', dist: 5, dur: 24, hr: 166 },
    { date: '2026-06-22', sub: 'Long Run', dist: 15, dur: 90, hr: 150 },
    { date: '2026-06-29', sub: 'Long Run', dist: 16, dur: 95, hr: 150 },
    { date: '2026-06-10', sub: 'Easy Z2', dist: 8, dur: 50, hr: 140 },
    { date: '2026-06-17', sub: 'Easy Z2', dist: 8, dur: 50, hr: 140 },
    { date: '2026-06-24', sub: 'Easy Z2', dist: 8, dur: 50, hr: 140 },
    { date: '2026-07-01', sub: 'Easy Z2', dist: 8, dur: 50, hr: 140 },
  ];
}
// avg4WeekKm gesetzt, damit notAssessable NICHT durch das unabhaengige Volumen-Gate verunreinigt wird.
const bo = (extra) => Object.assign({ daysToRace: 200, targetMin: 100, lrMax28: 20, trackingWeeks: 6, avg4WeekKm: 30 }, extra || {});
const hasCtlVeto = (r) => (r.vetos || []).some(v => v.indexOf('Fitness (CTL)') !== -1);
const naHasCtl = (r) => (r.notAssessable || []).some(v => v.indexOf('Fitness (CTL)') !== -1);

/* ================= A) Fehlende / ungueltige Confidence bei goalEngine (FAIL-CLOSED) ================= */
{
  // loadConfidence fehlt vollstaendig, CTL faellt (50<=60).
  const rMissing = Calc.goalEngine(mkRuns(), bo({ ctlNow: 50, ctlPrev28: 60 }));
  ok('[A1-1] fehlende Confidence + fallender CTL: KEIN hartes Veto', !hasCtlVeto(rMissing), JSON.stringify(rMissing.vetos));
  ok('[A1-2] fehlende Confidence: ctlTrend.status NICHT "hoch" (nie automatisch hoch)', rMissing.ctlTrend && rMissing.ctlTrend.status !== 'hoch', JSON.stringify(rMissing.ctlTrend));
  ok('[A1-3] fehlende Confidence: strukturierter Status "not_assessable"', rMissing.ctlTrend && rMissing.ctlTrend.status === 'not_assessable', JSON.stringify(rMissing.ctlTrend));
  ok('[A1-4] fehlende Confidence: Reason-Code "load_confidence_missing"', rMissing.ctlTrend && rMissing.ctlTrend.reason === 'load_confidence_missing', JSON.stringify(rMissing.ctlTrend));
  ok('[A1-5] fehlende Confidence: strukturierter notAssessable-Hinweis zu Fitness/CTL', naHasCtl(rMissing), JSON.stringify(rMissing.notAssessable));

  // Ungueltiger Confidence-Wert (Tippfehler / veralteter Enum).
  const rInvalid = Calc.goalEngine(mkRuns(), bo({ ctlNow: 50, ctlPrev28: 60, loadConfidence: 'kinda_ok' }));
  ok('[A2-1] ungueltige Confidence: KEIN hartes Veto', !hasCtlVeto(rInvalid), JSON.stringify(rInvalid.vetos));
  ok('[A2-2] ungueltige Confidence: Status "not_assessable", Reason "load_confidence_invalid"', rInvalid.ctlTrend && rInvalid.ctlTrend.status === 'not_assessable' && rInvalid.ctlTrend.reason === 'load_confidence_invalid', JSON.stringify(rInvalid.ctlTrend));

  // Leerstring / null explizit ⇒ ebenfalls fail-closed (kein stiller hoch).
  const rEmpty = Calc.goalEngine(mkRuns(), bo({ ctlNow: 50, ctlPrev28: 60, loadConfidence: '' }));
  ok('[A3-1] leere Confidence: KEIN hartes Veto, Status nicht hoch', !hasCtlVeto(rEmpty) && rEmpty.ctlTrend.status !== 'hoch', JSON.stringify(rEmpty.ctlTrend));
}

/* ================= B) Explizit hohe Confidence — hartes Veto bleibt (kein Overcorrect) ================= */
{
  const rDecline = Calc.goalEngine(mkRuns(), bo({ ctlNow: 50, ctlPrev28: 60, loadConfidence: 'hoch' }));
  ok('[B1-1] hoch + fallender CTL: hartes Veto greift weiterhin', hasCtlVeto(rDecline), JSON.stringify(rDecline.vetos));
  ok('[B1-2] hoch: ctlTrend.status "hoch", reason null', rDecline.ctlTrend && rDecline.ctlTrend.status === 'hoch' && rDecline.ctlTrend.reason === null, JSON.stringify(rDecline.ctlTrend));

  const rRise = Calc.goalEngine(mkRuns(), bo({ ctlNow: 70, ctlPrev28: 60, loadConfidence: 'hoch' }));
  ok('[B2-1] hoch + steigender CTL: kein Veto (Richtungs-Gegenprobe)', !hasCtlVeto(rRise), JSON.stringify(rRise.vetos));
}

/* ================= Coach-Report-Harness (buildAIReview im Sandbox) ================= */
function buildReviewWith(confidence, acwrNum) {
  const reviewBlock = (() => {
    const s = uiSrc.indexOf('function buildAIReview(){');
    const e = uiSrc.indexOf('function copyAIReview(){');
    return uiSrc.slice(s, e);
  })();
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
  // Realer Calc (echter loadConfidenceContract), nur loadModel/Anzeigehelfer gestubbt.
  sb.Calc = Object.assign({}, Calc, {
    loadModel: () => ({ acwr: acwrNum, acute: 100, chronic: 90, acwrReliable: true }),
    easyShare: () => null,
    weeklyJump: () => ({ lvl: 'g', ratio: null, msg: null }),
    weekKmTarget: () => 40,
    fmtTime: s => s + 's'
  });
  sb.allLoads = () => ({ loads: [1, 2, 3], confidence: confidence, completeness: { knownDays: 30 } });
  vm.createContext(sb);
  vm.runInContext(reviewBlock, sb, { filename: 'ui.js#review-i3a4' });
  return sb.buildAIReview();
}

/* ================= C) reduzierte Confidence im Coach-Report ================= */
{
  const rev = buildReviewWith('reduziert', 1.12);
  ok('[C1-1] reduziert: acwrStatus.value enthaelt den Modellschaetzwert (1.12)', rev.acwrStatus && rev.acwrStatus.value === 1.12, JSON.stringify(rev.acwrStatus));
  ok('[C1-2] reduziert: acwrStatus.estimated === true', rev.acwrStatus && rev.acwrStatus.estimated === true, 'est=' + (rev.acwrStatus && rev.acwrStatus.estimated));
  ok('[C1-3] reduziert: acwrStatus.assessable === true', rev.acwrStatus && rev.acwrStatus.assessable === true, 'ass=' + (rev.acwrStatus && rev.acwrStatus.assessable));
  ok('[C1-4] reduziert: Legacy-Feld acwr === null (Legacy-Konsument erhaelt KEINE unmarkierte Schaetzung)', rev.acwr === null, 'acwr=' + rev.acwr);
  ok('[C1-5] reduziert: acwrStatus.reason ist "nicht exakt"-Kennzeichnung', rev.acwrStatus && /nicht exakt/.test(rev.acwrStatus.reason || ''), rev.acwrStatus && rev.acwrStatus.reason);
}

/* ================= D) nicht belastbare Confidence im Coach-Report ================= */
{
  const rev = buildReviewWith('not_assessable', 1.12);
  ok('[D1-1] not_assessable: acwrStatus.value === null', rev.acwrStatus && rev.acwrStatus.value === null, JSON.stringify(rev.acwrStatus));
  ok('[D1-2] not_assessable: Legacy-Feld acwr === null', rev.acwr === null, 'acwr=' + rev.acwr);
  ok('[D1-3] not_assessable: assessable === false, confidence bleibt strukturiert erhalten', rev.acwrStatus && rev.acwrStatus.assessable === false && rev.acwrStatus.confidence === 'not_assessable', JSON.stringify(rev.acwrStatus));
  ok('[D1-4] not_assessable: Reason "nicht belastbar" strukturiert erhalten', rev.acwrStatus && /nicht belastbar/.test(rev.acwrStatus.reason || ''), rev.acwrStatus && rev.acwrStatus.reason);
}

/* ================= E) hohe Confidence im Coach-Report — Legacy-Kompatibilitaet bleibt ================= */
{
  const rev = buildReviewWith('hoch', 1.12);
  ok('[E1-1] hoch: Legacy-Feld acwr enthaelt die belastbare Zahl (1.12)', rev.acwr === 1.12, 'acwr=' + rev.acwr);
  ok('[E1-2] hoch: acwrStatus.value === derselbe Wert', rev.acwrStatus && rev.acwrStatus.value === 1.12, JSON.stringify(rev.acwrStatus));
  ok('[E1-3] hoch: estimated === false, assessable === true', rev.acwrStatus && rev.acwrStatus.estimated === false && rev.acwrStatus.assessable === true, JSON.stringify(rev.acwrStatus));
}

/* ================= F) Sicherheitsgegenprobe (I3a.1-Gate unveraendert) ================= */
{
  const goodCheckin = { readiness: 92, pain: 0, doms: 0, illness: false, sleepH: 8, sleepQ: 8, feel: 8, stress: 'Low', hrv: 'balanced' };
  const decBlocked = Calc.buildTrainingDecision({ checkin: goodCheckin, components: { recovery: 92 }, loads: { load3: 100, load7: 100, acuteAssessable: false }, plannedToday: { t: 'Laufen', l: 'Intervalle', hard: true }, profile: {}, dataQuality: { days: 40 } });
  ok('[F1-1] gute Signale + nicht belastbare akute Last: kein GREEN', decBlocked.dayState !== 'GREEN', 'state=' + decBlocked.dayState);
  ok('[F1-2] kein Peak', decBlocked.statusText !== 'Peak', 'status=' + decBlocked.statusText);

  const decRed = Calc.buildTrainingDecision({ checkin: { readiness: 20, pain: 9, illness: false }, components: { recovery: 20 }, loads: { load3: 100, load7: 100, acuteAssessable: false }, plannedToday: { t: 'Laufen', hard: true }, profile: {}, dataQuality: { days: 40 } });
  ok('[F2-1] RED bleibt RED', decRed.dayState === 'RED', 'state=' + decRed.dayState);

  const decOk = Calc.buildTrainingDecision({ checkin: goodCheckin, components: { recovery: 92 }, loads: { load3: 100, load7: 100, acuteAssessable: true }, plannedToday: { t: 'Laufen', l: 'Intervalle', hard: true }, profile: {}, dataQuality: { days: 40 } });
  ok('[F3-1] Gegenprobe: vollstaendig belastbare Last erlaubt weiterhin GREEN', decOk.dayState === 'GREEN', 'state=' + decOk.dayState);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
console.log('I3a.4: ' + (fail === 0 ? 'GRÜN — fehlende/ungueltige Last-Confidence loest fail-closed KEIN hartes Veto aus; Legacy-acwr nur bei hoher Confidence numerisch; Safety-Gate unveraendert.' : 'ROT — ' + fail + ' offen (erwartet vor dem Fix).'));

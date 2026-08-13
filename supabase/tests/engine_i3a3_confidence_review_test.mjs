/* ============================================================
   ORVIA · Engine 3c · I3a.3 — Confidence bis Goal-Veto und Coach-Report durchreichen
   Schliesst zwei dokumentierte Confidence-Lecks aus I3a.2:
   1) goalEngine() nutzte ctlNow/ctlPrev28 fuer ein hartes Fitness-Veto OHNE die
      Belastbarkeit der zugrunde liegenden Lastserie zu pruefen.
   2) buildAIReview()/weekSummaryText() gab acwr:ac.ratio als rohe Zahl ohne
      Confidence-/Assessability-Angabe an den Coach weiter.
   Wiederverwendung der bestehenden Last-Confidence (ld.confidence / Calc.
   loadConfidenceContract aus I3a.2) — KEINE zweite parallele Confidence-Logik.
   Das I3a.1-Safety-Gate (buildTrainingDecision) ist NICHT Gegenstand dieser
   Aenderung; Abschnitt D ist eine Regressions-Gegenprobe, kein neuer Fix.
   node supabase/tests/engine_i3a3_confidence_review_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
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

/* ================= 0) Statischer Wortlaut-/Wiring-Schutz ================= */
{
  const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');
  ok('[0-1] buildGoal() reicht ld.confidence als loadConfidence an goalEngine weiter', /loadConfidence:ld\.confidence/.test(uiSrc));
  ok('[0-2] buildAIReview() baut einen strukturierten acwrStatus-Vertrag', uiSrc.indexOf('acwrStatus') !== -1 && /knownDays/.test(uiSrc));
  ok('[0-3] buildAIReview() nutzt Calc.loadConfidenceContract (kein Duplikat der Confidence-Logik)', (uiSrc.match(/loadConfidenceContract/g) || []).length >= 2);
  const calcSrc = readFileSync(new URL('calc.js', base), 'utf8');
  ok('[0-4] goalEngine fuehrt die strukturierten Gruende ctl_trend_estimated / ctl_trend_not_assessable', /ctl_trend_estimated/.test(calcSrc) && /ctl_trend_not_assessable/.test(calcSrc));
  ok('[0-5] I3a.1-Sicherheitsgate-Zeile in buildTrainingDecision ist wortgleich unveraendert vorhanden', calcSrc.indexOf("if(_loadNotAssessable&&state==='GREEN')state='YELLOW';") !== -1);
}

/* ================= Fixtures ================= */
function mkRuns() {
  // >=6 valide Laeufe, >=2 Quality (Tempo/Long Run, dist>=4), >=3 Wochen Tracking (separat via opts).
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
function baseOpts(extra) {
  // avg4WeekKm bekannt gesetzt, damit notAssessable NICHT durch das unabhaengige Volumen-Gate
  // (I2c) verunreinigt wird — Assertionen pruefen isoliert das CTL-Trend-Verhalten.
  return Object.assign({ daysToRace: 200, targetMin: 100, lrMax28: 20, trackingWeeks: 6, avg4WeekKm: 30 }, extra || {});
}

/* ================= A) Vollstaendig gemessen ("hoch") — bestehendes Veto bleibt wirksam ================= */
{
  const rDecline = Calc.goalEngine(mkRuns(), baseOpts({ loadConfidence: 'hoch', ctlNow: 50, ctlPrev28: 60 }));
  ok('[A1-1] hoch + CTL faellt: hartes Veto greift wie bisher', (rDecline.vetos || []).some(v => v.indexOf('Fitness (CTL)') !== -1), JSON.stringify(rDecline.vetos));
  ok('[A1-2] ctlTrend.status === "hoch"', rDecline.ctlTrend && rDecline.ctlTrend.status === 'hoch', JSON.stringify(rDecline.ctlTrend));

  const rRise = Calc.goalEngine(mkRuns(), baseOpts({ loadConfidence: 'hoch', ctlNow: 70, ctlPrev28: 60 }));
  ok('[A2-1] hoch + CTL steigt: KEIN Veto (Gegenprobe — Veto nur bei tatsaechlich fallendem CTL)', !(rRise.vetos || []).some(v => v.indexOf('Fitness (CTL)') !== -1), JSON.stringify(rRise.vetos));
}

/* ================= B) Gemessen + geschaetzt ("reduziert") — kein hartes Veto ================= */
{
  const r = Calc.goalEngine(mkRuns(), baseOpts({ loadConfidence: 'reduziert', ctlNow: 50, ctlPrev28: 60 }));
  ok('[B1-1] reduziert + CTL faellt: KEIN hartes Veto', !(r.vetos || []).some(v => v.indexOf('Fitness (CTL)') !== -1), JSON.stringify(r.vetos));
  ok('[B1-2] stattdessen strukturierter Hinweis in notAssessable', (r.notAssessable || []).some(v => v.indexOf('Fitness (CTL)') !== -1), JSON.stringify(r.notAssessable));
  ok('[B1-3] ctlTrend.status === "reduziert", reason === "ctl_trend_estimated"', r.ctlTrend && r.ctlTrend.status === 'reduziert' && r.ctlTrend.reason === 'ctl_trend_estimated', JSON.stringify(r.ctlTrend));
}

/* ================= C) Unbekannt / nicht belastbar ("not_assessable") ================= */
{
  const r = Calc.goalEngine(mkRuns(), baseOpts({ loadConfidence: 'not_assessable', ctlNow: 50, ctlPrev28: 60 }));
  ok('[C1-1] not_assessable + Werte vorhanden: KEIN hartes Veto', !(r.vetos || []).some(v => v.indexOf('Fitness (CTL)') !== -1), JSON.stringify(r.vetos));
  ok('[C1-2] strukturierter Hinweis "nicht belastbar" in notAssessable', (r.notAssessable || []).some(v => v.indexOf('Fitness (CTL)') !== -1 && /nicht belastbar/.test(v)), JSON.stringify(r.notAssessable));
  ok('[C1-3] ctlTrend.status === "not_assessable", reason === "ctl_trend_not_assessable"', r.ctlTrend && r.ctlTrend.status === 'not_assessable' && r.ctlTrend.reason === 'ctl_trend_not_assessable', JSON.stringify(r.ctlTrend));

  // Vollstaendig unbekannt (ctlNow/ctlPrev28 selbst null) — darf NIE zu 0 oder "Fitness sinkt" werden.
  const r2 = Calc.goalEngine(mkRuns(), baseOpts({ loadConfidence: 'not_assessable', ctlNow: null, ctlPrev28: null }));
  ok('[C2-1] ctlNow/ctlPrev28 unbekannt: KEIN Veto, KEIN erfundener CTL-Hinweis', !(r2.vetos || []).some(v => v.indexOf('Fitness (CTL)') !== -1) && !(r2.notAssessable || []).some(v => v.indexOf('Fitness (CTL)') !== -1), JSON.stringify({ vetos: r2.vetos, na: r2.notAssessable }));
  ok('[C2-2] ctlTrend.status spiegelt weiterhin die Last-Confidence ("not_assessable"), kein stiller Reset', r2.ctlTrend && r2.ctlTrend.status === 'not_assessable', JSON.stringify(r2.ctlTrend));
}

/* ================= C-bis) Rueckwaertskompatibilitaet: loadConfidence fehlt komplett ================= */
{
  const r = Calc.goalEngine(mkRuns(), baseOpts({ ctlNow: 50, ctlPrev28: 60 })); // kein loadConfidence-Feld
  // I3a.4: Vertrag geändert — fehlendes loadConfidence ist jetzt FAIL-CLOSED (nicht mehr 'hoch').
  ok('[CB-1] I3a.4: loadConfidence fehlt ⇒ fail-closed (kein hartes Veto, Status nicht hoch, reason load_confidence_missing)', !(r.vetos || []).some(v => v.indexOf('Fitness (CTL)') !== -1) && r.ctlTrend && r.ctlTrend.status !== 'hoch' && r.ctlTrend.reason === 'load_confidence_missing', JSON.stringify({ vetos: r.vetos, ctlTrend: r.ctlTrend }));
}

/* ================= D) Sicherheitsgegenprobe (Regressions-Pin, I3a.1-Gate unveraendert) ================= */
{
  const goodCheckin = { readiness: 92, pain: 0, doms: 0, illness: false, sleepH: 8, sleepQ: 8, feel: 8, stress: 'Low', hrv: 'balanced' };
  const decBlocked = Calc.buildTrainingDecision({ checkin: goodCheckin, components: { recovery: 92 }, loads: { load3: 100, load7: 100, acuteAssessable: false }, plannedToday: { t: 'Laufen', l: 'Intervalle', hard: true }, profile: {}, dataQuality: { days: 40 } });
  ok('[D1-1] gute Signale + nicht belastbare akute Last: weiterhin kein GREEN (Gate unveraendert)', decBlocked.dayState !== 'GREEN', 'state=' + decBlocked.dayState);
  ok('[D1-2] weiterhin kein Peak', decBlocked.statusText !== 'Peak', 'status=' + decBlocked.statusText);

  const decRed = Calc.buildTrainingDecision({ checkin: { readiness: 20, pain: 9, illness: false }, components: { recovery: 20 }, loads: { load3: 100, load7: 100, acuteAssessable: false }, plannedToday: { t: 'Laufen', hard: true }, profile: {}, dataQuality: { days: 40 } });
  ok('[D2-1] RED bleibt RED', decRed.dayState === 'RED', 'state=' + decRed.dayState);

  const decMeasured = Calc.buildTrainingDecision({ checkin: goodCheckin, components: { recovery: 92 }, loads: { load3: 100, load7: 100, acuteAssessable: true }, plannedToday: { t: 'Laufen', l: 'Intervalle', hard: true }, profile: {}, dataQuality: { days: 40 } });
  ok('[D3-1] Gegenprobe: vollstaendig belastbare Last erlaubt weiterhin GREEN', decMeasured.dayState === 'GREEN', 'state=' + decMeasured.dayState);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
console.log('I3a.3: ' + (fail === 0 ? 'GRÜN — CTL-Trend-Veto und Coach-ACWR-Report respektieren die bestehende Last-Confidence (hoch/reduziert/not_assessable); Sicherheitsgate unveraendert.' : 'ROT — ' + fail + ' offen (erwartet vor dem Fix).'));

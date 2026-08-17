/* ============================================================
   ORVIA · orvia_score_v9_test — Regression fuer die Score-Ueberarbeitung v9
   (Befunde Gian, 16.08.2026: "85, aber Gelb", "Schlafkonto 34", "Ruhepuls 89
   bei einem Schlag", "DOMS?", "Body Battery 100 statt 95", "vs. gestern —").

   Der Test prueft VERHALTEN, nicht Implementierung. Jede Zusicherung haengt an
   genau einem der Befunde und faellt rot, wenn die Ursache zurueckkehrt.
   Aufruf:  node supabase/tests/orvia_score_v9_test.mjs
   ============================================================ */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const Calc = require(path.resolve(here, '../../app/js/calc.js'));

let failed = 0, passed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + (detail ? '  → ' + detail : '')); }
}
function eq(name, actual, expected) { ok(name, actual === expected, 'erwartet ' + expected + ', war ' + actual); }

/* --- Gians reale Morgenlage vom 16.08.2026 (aus seinen Werten rekonstruiert) --- */
const MORNING = { knee: 0, hrvMs: 52, hrv: 'Balanced', feel: 9, sleepMin: 400, sleepQ: 8, rhr: 47, doms: 1, bb: 95, stress: 'Low' };
const CTX = {
  painToday: 2, sleepScore: 76, rhrBase: 46, rhrSd: 2.6, bbBase: 80,
  hrvN: 20, hrvBase7: Math.log(50), hrvSd28: 0.1, domsHitsToday: true,
  sleepDebtH: 3.2, stressAvg: 31
};

console.log('\n1) Schmerz ist regional — leichter Schmerz sperrt Gruen nur bei Betroffenheit');
{
  const base = { pain: 2, region: 'Hüfte', doms: 1, sleepH: 6.7, sleepQ: 8, feel: 9, stress: 'Low', hrv: 'Balanced', readiness: 87 };
  eq('2/10 Huefte, Einheit trifft die Region nicht → GREEN', Calc.dayStateEngine({ ...base, painHits: false }).state, 'GREEN');
  eq('2/10 Huefte, Einheit trifft die Region     → YELLOW', Calc.dayStateEngine({ ...base, painHits: true }).state, 'YELLOW');
  eq('4/10 bleibt regionsunabhaengig ORANGE (a)', Calc.dayStateEngine({ ...base, pain: 4, painHits: false }).state, 'ORANGE');
  eq('4/10 bleibt regionsunabhaengig ORANGE (b)', Calc.dayStateEngine({ ...base, pain: 4, painHits: true }).state, 'ORANGE');
  eq('6/10 bleibt RED', Calc.dayStateEngine({ ...base, pain: 6, painHits: false }).state, 'RED');
  ok('fehlende Angabe bleibt konservativ (wie vor v9)', Calc.dayStateEngine(base).state === 'YELLOW');
  ok('Begruendung nennt den Regionsbezug',
    /trifft die heutige Einheit nicht/.test(Calc.dayStateEngine({ ...base, painHits: false }).reasons.join('|')));
}

console.log('\n2) Schlafkonto — Ueberschuss zaehlt, aber nicht eins zu eins');
{
  const gleich = Array(7).fill(480);
  eq('exakt Bedarf → kein Defizit', Calc.sleepDebt(gleich, 480), 0);
  const eineKurze = [480, 480, 480, 300, 480, 480, 480];
  ok('eine 5-h-Nacht erzeugt 3 h Defizit', Math.abs(Calc.sleepDebt(eineKurze, 480) - 3) < 0.01);
  const ausgeglichen = [480, 480, 480, 420, 540, 480, 480];
  const bal = Calc.sleepDebt(ausgeglichen, 480);
  ok('eine lange Nacht gleicht eine kurze teilweise aus (0 < x < 1 h)', bal > 0 && bal < 1, 'war ' + bal.toFixed(2));
  const extrem = [480, 480, 480, 300, 900, 480, 480];
  ok('eine 15-h-Nacht loescht das Defizit NICHT komplett', Calc.sleepDebt(extrem, 480) > 2,
    'war ' + Calc.sleepDebt(extrem, 480).toFixed(2));
  ok('Rueckgabe nie negativ', Calc.sleepDebt([600, 600, 600, 600, 600, 600, 600], 480) === 0);
}

console.log('\n3) Ruhepuls skaliert mit der eigenen Streuung, nicht mit 11 Punkten je Schlag');
{
  const p = (dev, sd) => {
    const r = Calc.readiness({ ...MORNING, rhr: 46 + dev }, { ...CTX, rhrSd: sd });
    const x = r.parts.find(c => c[0] === 'Ruhepuls');
    return x ? Math.round(x[1]) : null;
  };
  ok('+1 bpm bei SD 2,6 kostet weniger als 10 Punkte', p(1, 2.6) >= 90, 'war ' + p(1, 2.6));
  ok('+5 bpm ist deutlich, aber nicht vernichtend', p(5, 2.6) > 50 && p(5, 2.6) < 75, 'war ' + p(5, 2.6));
  ok('sehr konstanter Schlaefer wird nicht ueberbestraft (SD-Untergrenze greift)', p(1, 0.2) >= 85, 'war ' + p(1, 0.2));
  ok('chaotische Historie macht die Groesse nicht wertlos (SD-Obergrenze greift)', p(10, 40) <= 70, 'war ' + p(10, 40));
  ok('unter der Baseline ist neutral', p(-3, 2.6) === 100);
}

console.log('\n4) Schlaf zaehlt nicht mehr vierfach; Namen sind eindeutig');
{
  const r = Calc.readiness(MORNING, CTX);
  const names = r.parts.map(c => c[0]);
  const W = r.parts.reduce((s, c) => s + c[2], 0);
  const sleepW = r.parts.filter(c => /Schlaf/.test(c[0])).reduce((s, c) => s + c[2], 0);
  ok('Schlafanteil unter 21 % (vorher 23 % auf vier Posten)', Math.round(sleepW / W * 100) <= 21, 'war ' + Math.round(sleepW / W * 100) + ' %');
  ok('keine zwei gleichnamigen Schlafzeilen', new Set(names).size === names.length);
  ok('Phasen entfallen bei vorhandenem Sleep Score (keine Doppelzaehlung)', !names.includes('Schlafphasen'));
  const ohneScore = Calc.readiness(MORNING, { ...CTX, sleepScore: null, phaseShareToday: 0.5, phaseShareBase: 0.4 });
  ok('ohne Sleep Score zaehlen die Phasen weiterhin', ohneScore.parts.map(c => c[0]).includes('Schlafphasen'));
  ok('kein Posten heisst mehr "DOMS"', !names.includes('DOMS'));
  ok('Muskelkater ist als Klartext benannt', names.includes('Muskelkater'));
}

console.log('\n5) Stress kommt aus dem gemessenen Tageswert');
{
  const g = (ctx) => { const x = Calc.readiness(MORNING, ctx).parts.find(c => c[0] === 'Stress'); return x ? Math.round(x[1]) : null; };
  eq('gemessener Ruhe-Stress (20) → volle Punkte', g({ ...CTX, stressAvg: 20 }), 100);
  ok('gemessener hoher Stress (80) → deutlich unter 40', g({ ...CTX, stressAvg: 80 }) < 40, 'war ' + g({ ...CTX, stressAvg: 80 }));
  ok('ohne Messwert greift die alte Kategorie', g({ ...CTX, stressAvg: null }) === 100);
  const a = g({ ...CTX, stressAvg: 50 }), b = g({ ...CTX, stressAvg: 51 });
  ok('kein Kategoriensprung mehr an einer willkuerlichen Grenze', Math.abs(a - b) <= 3, a + ' vs ' + b);
}

console.log('\n6) Headline ist die Summe der angezeigten Gruppen');
{
  const h = Calc.combineHeadline({ recovery: 87, riskRaw: 26, execution: 80 });
  eq('60/25/15 auf 87/74/80', h, 83);
  eq('fehlende Gruppen werden renormalisiert, nicht mit 0 gefuellt', Calc.combineHeadline({ recovery: 87 }), 87);
  const parts = (Calc.combineHeadline({ recovery: 87, riskRaw: 26, execution: 80 }), Calc.combineHeadline.lastParts);
  ok('Gewichte summieren sich auf 100 %', parts.reduce((s, p) => s + p.weight, 0) === 100);
  const zwei = (Calc.combineHeadline({ recovery: 87, riskRaw: 26 }), Calc.combineHeadline.lastParts);
  ok('bei zwei Gruppen ebenfalls 100 %', zwei.reduce((s, p) => s + p.weight, 0) === 100);
}

console.log('\n7) "geschaetzt" sperrt Gruen nicht mehr, "unbekannt" schon');
{
  const inp = (loads) => ({
    checkin: { pain: 0, doms: 0, sleepH: 7.5, sleepQ: 8, feel: 9, stress: 'Low', hrv: 'Balanced', readiness: 90 },
    components: { recovery: 90, riskRaw: 20, execution: 85 },
    loads, plannedToday: null, todayIndex: 0
  });
  const gesch = Calc.buildTrainingDecision(inp({ load3: 50, load7: 45, acuteAssessable: false, missingness: { unknownDays: 0, estimatedLoad: 120 } }));
  const unbek = Calc.buildTrainingDecision(inp({ load3: 50, load7: 45, acuteAssessable: false, missingness: { unknownDays: 2, estimatedLoad: 0 } }));
  const voll = Calc.buildTrainingDecision(inp({ load3: 50, load7: 45, acuteAssessable: true, missingness: { unknownDays: 0, estimatedLoad: 0 } }));
  eq('nur geschaetzte Last → GREEN bleibt', gesch.dayState, 'GREEN');
  eq('unbekannte Tage → weiterhin auf YELLOW herabgestuft', unbek.dayState, 'YELLOW');
  eq('vollstaendig gemessen → GREEN', voll.dayState, 'GREEN');
  ok('Peak bleibt bei geschaetzter Last gesperrt', gesch.statusText !== 'Peak');
  ok('Begruendung nennt den fehlenden RPE statt "unbekannt"',
    /RPE fehlt/.test((gesch.readinessReasons || []).join('|')));
  ok('kein Text behauptet mehr gleichzeitig geschaetzt UND unbekannt',
    !/geschätzt\/unbekannt/.test((gesch.readinessReasons || []).concat(unbek.readinessReasons || []).join('|')));
}

console.log('\n8) Der Rechenweg ist nach aussen sichtbar');
{
  const d = Calc.buildTrainingDecision({
    checkin: { pain: 0, doms: 0, sleepH: 7.5, sleepQ: 8, feel: 9, stress: 'Low', hrv: 'Balanced', readiness: 90 },
    components: { recovery: 90, riskRaw: 20, execution: 85 },
    loads: { load3: 50, load7: 45, acuteAssessable: true }, plannedToday: null, todayIndex: 0
  });
  ok('scoreParts vorhanden', Array.isArray(d.scoreParts) && d.scoreParts.length === 3);
  ok('subscores tragen ihr Gewicht', d.subscores.recovery.weight === 60);
  ok('scoreRaw und score sind beide da', d.scoreRaw != null && d.score != null);
  ok('scoreCapped meldet ehrlich, ob ein Deckel griff', typeof d.scoreCapped === 'boolean');
  ok('Summe der Gewichtsanteile = 100', d.scoreParts.reduce((s, p) => s + p.weight, 0) === 100);
}

console.log('\n9) Keine Regression an den Sicherheitsgrenzen');
{
  const hard = { pain: 8, region: 'Knie', doms: 2, sleepH: 7, sleepQ: 7, feel: 7, readiness: 90 };
  eq('Schmerz 8/10 bleibt RED, auch off-target', Calc.dayStateEngine({ ...hard, painHits: false }).state, 'RED');
  eq('Krankheit bleibt RED', Calc.dayStateEngine({ pain: 0, illness: true, readiness: 95 }).state, 'RED');
  const r = Calc.readiness({ ...MORNING, knee: 7 }, CTX);
  ok('harter Knie-Cap greift weiter (<=40)', r.score <= 40, 'war ' + r.score);
  ok('Score bleibt in 0..100', r.score >= 0 && r.score <= 100);
}

console.log('\n' + (failed === 0
  ? 'ALLE ' + passed + ' ZUSICHERUNGEN GRUEN'
  : failed + ' VON ' + (passed + failed) + ' ZUSICHERUNGEN ROT'));
process.exit(failed === 0 ? 0 : 1);

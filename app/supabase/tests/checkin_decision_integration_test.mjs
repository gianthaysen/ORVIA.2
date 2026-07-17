/* ORVIA · live/pre/post → Trainingsentscheidung — Integrationstest (reine Engine).
   Prüft: Readiness bleibt morgenbasiert, Entscheidung eskaliert getrennt, Priorität, Post.
   node supabase/tests/checkin_decision_integration_test.mjs */
const Calc = (await import(new URL('../../js/calc.js', import.meta.url))).default;
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const reasons = d => (d.readinessReasons || []).join(' | ');

function morning(readiness, loads) {
  return Calc.buildTrainingDecision({
    checkin: { pain: 0, doms: 0, illness: false, sleepH: 8, sleepQ: 8, feel: 9, stress: 'Low', hrv: 'Good', readiness: readiness },
    components: { recovery: readiness }, loads: loads || { load3: 100, load7: 100 },
    plannedToday: { t: 'Laufen', l: 'Tempo' }, todayIndex: 2
  });
}

// Fall 1: Morning 95 + Lastsprung + Pre gut → Readiness 95, Entscheidung reduziert, kein 64-Cap
let d = morning(95, { load3: 142, load7: 100 });
d = Calc.escalateWithExtras(d, { pre: { feel: 9, doms: 0, legs: 8 }, live: null, post: null });
ok('Fall1 Readiness ≥85 (kein 64-Cap)', d.score >= 85, 'score=' + d.score);
ok('Fall1 Entscheidung reduziert (ORANGE, Last)', d.dayState === 'ORANGE');
ok('Fall1 Pre gut → keine Eskalation durch Pre', d.escalatedBy == null);

// Fall 2: Morning 95 + Pre Schmerz 6 → Readiness 95, Entscheidung verschärft, Grund nennt Pre
d = morning(95);
const beforeScore = d.score;
d = Calc.escalateWithExtras(d, { pre: { knee: 6, complaints: [{ type: 'knee', score: 6 }] } });
ok('Fall2 Readiness bleibt (Score unverändert)', d.score === beforeScore && d.readinessScore === beforeScore, 'score=' + d.score);
ok('Fall2 Entscheidung verschärft → RED/stoppen', d.dayState === 'RED' && d.todayAction === 'REPLACE_WITH_RECOVERY');
ok('Fall2 Grund nennt Pre-Schmerz', /Vor dem Training: Schmerz 6\/10/.test(reasons(d)), reasons(d).slice(0, 80));

// Fall 3: Morning 90 + Live Krankheit → Headline 90, Entscheidung STOP/RED, Grund Live
d = morning(90);
d = Calc.escalateWithExtras(d, { live: { illness: true } });
ok('Fall3 Headline bleibt Morgen-Readiness 90', d.score === 90);
ok('Fall3 Entscheidung RED', d.dayState === 'RED');
ok('Fall3 Grund nennt Live-Krankheit', /Live-Check-in: Krankheitssymptome/.test(reasons(d)));

// Fall 4: Morning 90 + Post DOMS 8 → keine Rückwirkung, weitere Einheit begrenzt
d = morning(90);
const ds4 = d.dayState;
d = Calc.escalateWithExtras(d, { post: { doms: 8 } });
ok('Fall4 Morgen-Readiness unverändert (90)', d.score === 90);
ok('Fall4 dayState NICHT durch Post verändert', d.dayState === ds4);
ok('Fall4 weitere Einheit begrenzt + Grund Post-DOMS', d.furtherUnitsLimited === true && /Nach dem Training: DOMS 8\/10/.test(d.postWarning || ''));

// Fall 5: Morning 45 + Pre sehr gut → Pre hebt schlechte Morgenlage nicht auf
d = morning(45);
const ds5 = d.dayState;
d = Calc.escalateWithExtras(d, { pre: { feel: 10, legs: 10, doms: 0 } });
ok('Fall5 Pre gut hebt schlechte Lage nicht auf (nicht GREEN)', d.dayState !== 'GREEN' && _sev(d.dayState) >= _sev(ds5), d.dayState);
ok('Fall5 Score bleibt niedrig (≤50)', d.score <= 50, 'score=' + d.score);

// Fall 6: A Pre schlecht, B Pre gut → reine Funktion, keine Vermischung
const dA = Calc.escalateWithExtras(morning(90), { pre: { knee: 6 } });
const dB = Calc.escalateWithExtras(morning(90), { pre: { feel: 9 } });
ok('Fall6 A eskaliert, B nicht (keine geteilte State-Vermischung)', dA.dayState === 'RED' && dB.dayState !== 'RED');

// Priorität: Pre hart schlägt Live gut; harter Live bleibt relevant
const dP1 = Calc.escalateWithExtras(morning(90), { pre: { knee: 6 }, live: { feel: 9 } });
ok('Prio Pre hart + Live gut → escalatedBy pre, RED', dP1.escalatedBy === 'pre' && dP1.dayState === 'RED');
const dP2 = Calc.escalateWithExtras(morning(90), { pre: { feel: 9 }, live: { illness: true } });
ok('Prio harter Live bleibt relevant → escalatedBy live, RED', dP2.escalatedBy === 'live' && dP2.dayState === 'RED');

// Lastsprung bleibt eigener Grund, auch mit gutem Pre
const dL = Calc.escalateWithExtras(morning(95, { load3: 142, load7: 100 }), { pre: { feel: 9 } });
ok('Lastsprung bleibt sichtbarer Entscheidungsgrund', /Lastsprung/.test((dL.triggers || []).map(t => t.title).join(',')) || /Belastungssprung/.test(reasons(dL)));

function _sev(s) { return ['GREEN', 'YELLOW', 'ORANGE', 'RED'].indexOf(s); }

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
process.exit(fail ? 1 : 0);

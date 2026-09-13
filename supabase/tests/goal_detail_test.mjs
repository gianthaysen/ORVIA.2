/* ORVIA · goal_detail — B-02 Ziel-Detailseite (rein) + Verdrahtung
   node supabase/tests/goal_detail_test.mjs */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')].find(p => existsSync(join(p, 'js', 'goal-detail.js'))) || _flat);
require(join(APP, 'js/i18n.js')); require(join(APP, 'locales/de.js'));   /* B-13: Texte kommen aus dem Katalog */
const G = require(join(APP, 'js/goal-detail.js'));
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const HM = { id: 'g1', category: 'half_marathon', targetValue: 6600, unit: 's', targetDate: '2026-10-11', milestones: [{ title: '15 km lang', targetDate: '2026-09-20' }] };
const PI = { family: 'run', daysTo: 30, phase: 'build', target: { targetMin: 110, pacePerKmSec: 313 } };
const M = o => G.buildModel(Object.assign({ goal: HM, planInput: PI, catLabel: c => ({ half_marathon: 'Halbmarathon', muscle_gain: 'Muskeln aufbauen' })[c] || c }, o || {}));

sec('A · Modell (S1.5: Prototyp-v14-Tiefe)');
{
  const m = M({ engine: { tPred: 106.2, tRiegel: 105, tEF: 108, state: 'ontrack', nRuns: 14, nQuality: 6, vetos: [] }, feasibility: { evaluated: true, status: 'within_modeled_corridor' }, isMain: true, today: '2026-09-11',
    bests: { t5: 1414, t10: 2917, t21: null, t42: null, real: { k5: true, k10: true }, meas: { k10: { date: '2026-06-21' } } }, avg4WeekKm: 47, targetWeekKm: 50, longestRun28: 21.4, plannedKeyPerWeek: 3 });
  ok('A1 Titel/Kategorie/Datum/Phase/Wochen', m.title === 'Halbmarathon' && m.dateText === '11.10.2026' && m.phaseLabel === 'Aufbau' && m.daysTo === 30 && m.weeksTo === 5);
  ok('A2 Zielzeit h:mm:ss + Distanz/Pace-Zeile', m.targetText === '1:50:00' && /21,1 km/.test(m.targetSub) && /5:13 \/km/.test(m.targetSub));
  ok('A3 Fortschritt Zeit: Prognose 1:46:12 gegen 1:50 → 100 %, on track', m.progress.kind === 'time' && m.progress.percent === 100 && m.progress.state === 'ontrack' && m.progress.currentText === '1:46:12');
  ok('A4 Machbarkeit „Auf Kurs", Delta 3:48 unter dem Ziel', m.feas.cls === 'ok' && m.feas.title === 'Auf Kurs' && /3:48 unter dem Ziel/.test(m.feas.text));
  ok('A5 Gruende: Umfang plus, 10-km-Bestzeit → 1:47:16 plus, langer Lauf plus (Bedarf 14), Schluessel 1,0/Wo vs 3 minus, Unsicherheit neutral', m.reasons.length === 5 && m.reasons[0].kind === 'plus' && /1:47:16/.test(m.reasons[1].html) && m.reasons[1].kind === 'plus' && m.reasons[2].kind === 'plus' && /21,4 km/.test(m.reasons[2].html) && m.reasons[3].kind === 'minus' && /1,0 Schlüsseleinheiten/.test(m.reasons[3].html) && m.reasons[4].kind === 'neutral' && /ohne Wettkampf/.test(m.reasons[4].html));
  ok('A6 Ausgangswert = naechste gemessene Distanz (10 km), Riegel 48:37 → 107,3 min', m.baseline.key === 'k10' && Math.round(m.baseline.equivMin * 10) / 10 === 107.3);
  ok('A7 Zielvertrag: erreicht/Ausgangswert/wenn nicht/zaehlt — beschreibt race-result (±1 Tag, ±5 %)', m.contract.kind === 'race' && m.contract.lines.length === 4 && /21,1 km am 11\.10\.2026/.test(m.contract.lines[0].html) && /48:37 \(21\.06\.2026\)/.test(m.contract.lines[1].html) && /verfehlt/.test(m.contract.lines[2].html) && /± 5 %/.test(m.contract.lines[3].html));
  ok('A8 Stellschrauben = nur beeinflussbare Minus-Gruende (nie die Bestzeit), als Handlung formuliert, max. 2, ohne erfundene Sekunden', m.levers.length === 1 && m.levers[0].id === 'key' && /auf <b>3,0\/Woche<\/b> bringen/.test(m.levers[0].html) && /Planer/.test(m.levers[0].effect) && M({ engine: { tPred: 130, state: 'risk', nRuns: 10, nQuality: 4, vetos: [] }, bests: { t21: 8413, real: { k21: true }, meas: {} } }).levers.every(l => l.id !== 'best'));
  ok('A9 Meilensteine: eigener + Renntag als letzter Punkt', m.milestones.length === 2 && m.milestones[1].race === true && m.milestones[1].date === '2026-10-11');
  const slow = M({ engine: { tPred: 120, state: 'risk', nRuns: 8, nQuality: 2, vetos: ['Long Run: max. 12 km in 28T, nötig ≥14 km', 'Fitness (CTL) seit 4 Wochen nicht steigend'] }, longestRun28: 12 });
  ok('A10 Prognose 2:00 gegen 1:50 → 92 %, gefaehrdet, CTL-Veto als Minus', slow.progress.percent === 92 && slow.feas.cls === 'risk' && slow.reasons.some(r => /Fitness \(CTL\)/.test(r.html) && r.kind === 'minus') && slow.reasons.some(r => /fehlen Läufe ab 14 km/.test(r.html)));
  const nod = M({ engine: { state: 'nodata', need: '≥6 Läufe' } });
  ok('A11 nodata → „Noch keine Prognose" mit Bedarf, kein Prozent', nod.progress.percent === null && nod.feas.cls === 'none' && /≥6 Läufe/.test(nod.feas.text));
  const noT = M({ planInput: { family: 'run', daysTo: 30, phase: 'build', target: { targetMin: null } }, goal: Object.assign({}, HM, { targetValue: null }), engine: { tPred: 106.2, state: 'no_target' } });
  ok('A12 ohne Zielwert: „offen", kein Vertrag, keine Erfindung', noT.targetText === null && noT.contract === null && /Kein Zielwert/.test(noT.progress.note));
  const w = M({ goal: { id: 'g2', category: 'weight_loss', targetValue: 78, currentValue: 84, unit: 'kg' }, planInput: null });
  ok('A13 Wertziel (niedriger besser): 84 → 78 = 93 %, Wert-Vertrag', w.progress.kind === 'value' && w.progress.percent === 93 && w.contract.kind === 'value');
  ok('A14 nur Ziel-relevante Luecken', M({ strength: { gaps: [{ id: 'performance_reference' }, { id: 'section_constraints' }, { id: 'goal_date', action: 'goal_editor' }] } }).gaps.map(g => g.id).join() === 'performance_reference,goal_date');
  ok('A15 kein Ziel → null; kaputt → null', G.buildModel({ goal: null }) === null && G.buildModel() === null);
  const hist = M({ goal: Object.assign({}, HM, { history: [{ at: '2026-07-28T10:00:00Z', type: 'target', from: 6900, to: 6600, forecastMin: 110.7 }, { at: '2026-06-12T10:00:00Z', type: 'created', to: { targetValue: 6900, priority: 1 }, note: 'onboarding' }] }) });
  ok('A16 Historie: neueste zuerst, „verschärft" mit Prognose, angelegt mit Wert', hist.history.length === 2 && /verschärft/.test(hist.history[0].html) && /1:50:42/.test(hist.history[0].html) && /angelegt/.test(hist.history[1].html) && /onboarding/.test(hist.history[1].html));
  ok('A17 Titel nur aus Wert („12%") wird zur Kategorie', M({ goal: Object.assign({}, HM, { title: '12%' }) }).title === 'Halbmarathon');
  const conf = M({ conflicts: [{ conflictType: 'x', goalIds: ['g1', 'g9'], explanation: 'Beides gleichzeitig.' }], goals: [HM, { id: 'g9', title: 'Kraft' }] });
  ok('A18 Wechselwirkung nur fuer dieses Ziel, Gegenueber benannt', conf.conflicts.length === 1 && /Kraft/.test(conf.conflicts[0].title));
}

sec('B · HTML');
{
  const base = { engine: { tPred: 106.2, state: 'ontrack', nRuns: 14, nQuality: 6, vetos: [] }, isMain: true, today: '2026-09-11', avg4WeekKm: 47, targetWeekKm: 50, longestRun28: 21.4,
    weekPlan: [{ title: 'Di · Schwellenlauf', detail: 'Laufen · 45 min', icon: 'bolt', hardRun: true }], strength: { gaps: [{ id: 'performance_reference', label: 'Leistungsreferenz', sectionId: 'body' }] },
    runs: [{ date: '2026-09-09', dist: 8, dur: 42, sub: 'Tempo' }, { date: '2026-09-06', dist: 16, dur: 96, sub: 'Long Run' }, { date: '2026-08-30', dist: 6, dur: 36, sub: '' }], plannedKeyPerWeek: 2 };
  const h = G.html(M(base));
  ok('B1 Hero: Zielzeit, Tage/Wochen/Wettkampf', /gd-hero/.test(h) && /class="tv">1:50:00</.test(h) && /<b>30<\/b><span>Tage/.test(h) && /<b>5<\/b><span>Wochen/.test(h) && /<b>11\.10\.<\/b><span>Wettkampf/.test(h));
  ok('B2 Machbarkeit-Karte ok mit Gruenden', /gd-feas ok/.test(h) && (h.match(/gd-reason /g) || []).length >= 4);
  ok('B3 Zielvertrag + Prognoseverlauf-Karte (ohne Serie: ehrlicher Hinweis) + Plan dieser Woche + Einzahlungen 4 Wochen', /Zielvertrag/.test(h) && /Noch kein Verlauf/.test(h) && /Diese Woche · 1 Einheiten/.test(h) && (h.match(/class="gd-dep( miss)?"/g) || []).length === 4 && (h.match(/<span class="v">1 \/ 2</g) || []).length === 2);
  ok('B4 Meilenstein + Renntag, Historie „angelegt" aus createdAt, Verwalten-Zeilen (pausieren, Sichtbarkeit), Luecke als Zeile', /15 km lang/.test(h) && /Wettkampf Halbmarathon/.test(h) && /id="gd-pause"/.test(h) && /id="gd-vis"/.test(h) && /id="gd-gap-performance_reference"/.test(h));
  ok('B5 html(null) ist ein Hinweis, kein Wurf', /Kein Ziel/.test(G.html(null)));
  ok('B6 Escaping in Meilenstein-Titel', /&lt;b&gt;/.test(G.html(M({ goal: Object.assign({}, HM, { milestones: [{ title: '<b>x</b>' }] }) }))));
  const sv = G.html(M(Object.assign({}, base, { series: [{ date: '2026-08-01', tPred: 112 }, { date: '2026-08-15', tPred: 109 }, { date: '2026-09-11', tPred: 106.2 }] })));
  ok('B7 Prognoseverlauf als SVG mit Ziellinie', /<svg viewBox="0 0 320 110"/.test(sv) && /Ziel 1:50:00/.test(sv) && /stroke="#43D693"/.test(sv));
  ok('B8 Nicht-Hauptziel aktiv: „Zum Hauptziel machen"; erreicht: „Wieder aktivieren"', /id="gd-main"/.test(G.html(M({ isMain: false }))) && /id="gd-reactivate"/.test(G.html(M({ goal: Object.assign({}, HM, { status: 'achieved' }) }))));
}

sec('D · Reine Helfer: Prognoseverlauf + Einzahlungen');
{
  const Calc = { goalEngine: (runs, o) => ({ state: runs.length >= 3 ? 'ontrack' : 'nodata', tPred: 100 + runs.length }), weekKmTarget: () => 40 };
  const runs = []; for (let i = 0; i < 70; i += 3) runs.push({ date: new Date(Date.UTC(2026, 6, 1 + i)).toISOString().slice(0, 10), dist: 8, dur: 45, sub: i % 2 ? 'Tempo' : '' });
  const ser = G.forecastSeries({ calc: Calc, runs, today: '2026-09-11', weeks: 4, raceDate: '2026-10-11', targetMin: 110, distanceKm: 21.0975 });
  ok('D1 Serie: 5 Stichtage (4 Wochen + heute), Prognose je Fenster, letzter = heute', ser.length === 5 && ser[4].date === '2026-09-11' && ser.every(p => p.tPred == null || p.tPred > 100));
  const kw = G.keyWeeks({ runs: [{ date: '2026-09-08', dist: 8, dur: 42, sub: 'Tempo' }, { date: '2026-09-10', dist: 15, dur: 90, sub: 'Long Run' }, { date: '2026-09-01', dist: 5, dur: 30, sub: '' }], today: '2026-09-11', plannedKeyPerWeek: 2 });
  ok('D2 Einzahlungen: aktuelle Woche 2 Schluesseleinheiten, Vorwoche 0, Labels Mo–So', kw.length === 4 && kw[3].done === 2 && kw[3].current === true && kw[2].done === 0 && /^07\.09–13\.09\.$/.test(kw[3].label));
}

sec('C · Verdrahtung');
{
  const ui = readFileSync(join(APP, 'js/ui.js'), 'utf8'), idx = readFileSync(join(APP, 'index.html'), 'utf8'), sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  ok('C1 Plan-Kopf: Zieltitel oeffnet die Detailseite (Lauf- und Nicht-Lauf-Zweig)', (ui.match(/openGoalDetail\(\\''\+esc\(mg\.id\)/g) || []).length === 2);
  ok('C2 Skript + sw.js', idx.includes('js/goal-detail.js') && sw.includes("'./js/goal-detail.js'"));
  const src = readFileSync(join(APP, 'js/goal-detail.js'), 'utf8');
  ok('C3 Bearbeiten nur ueber openGoalEditor; Status nur ueber goalSetStatus/goalReactivate/goalMakeMain — kein eigener Schreibpfad', /openGoalEditor\(goal\.id\)/.test(src) && /goalSetStatus\(goal\.id, 'paused'\)/.test(src) && !/goalUpdate\(|commitGoals\(|saveProfile\(|_profileSave\(/.test(src));
  ok('C4 kein Ziel → Wizard statt leerer Seite', /if \(!goal\) \{ try \{ if \(typeof root\.openGoalEditor === 'function'\) root\.openGoalEditor\(\);/.test(src));
}
console.log('\n' + (fail ? '❌' : '✅') + ' goal_detail: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

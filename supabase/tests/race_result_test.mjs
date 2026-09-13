/* ORVIA · S1/E2 (12.09.2026) — Wettkampfergebnis aus Aktivitaeten (engine/race-result.js) + Ziel-Lebenszyklus.
   Befund: HM Flensburg am Zieldatum gelaufen, Ziel blieb aktiv, „noch 0 Wochen". */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import { tStub } from './_i18n-src.mjs';
const require = createRequire(import.meta.url);
const APP = ['../../app/', '../../'].map(p => new URL(p, import.meta.url)).find(u => existsSync(new URL('js/engine/race-result.js', u)));
require(new URL('js/run-bests.js', APP).pathname);
const RR = require(new URL('js/engine/race-result.js', APP).pathname);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const act = (id, sport, km, sec, date) => ({ clientRecordId: id, sportId: sport, status: 'completed', startedAt: date + 'T09:30:00Z', summary: { distance_m: km * 1000 }, durationSeconds: sec });
const HM = { id: 'g1', category: 'half_marathon', title: 'Halbmarathon unter 1:50', targetDate: '2026-09-06', targetValue: 6600, unit: 's', metricType: 'time', status: 'active', priority: 1 };

/* A · match */
{
  const acts = [act('hm', 'running', 21.18, 6730, '2026-09-06'), act('e', 'running', 8, 2800, '2026-09-04'), act('b', 'cycling', 21.2, 3000, '2026-09-06')];
  const m = RR.match(HM, acts);
  ok('A1 Flensburg-HM erkannt: Aktivitaet hm, 21,18 km, 6730 s', m && m.activityId === 'hm' && m.distanceKm === 21.18 && m.timeSec === 6730, JSON.stringify(m));
  ok('A2 Urteil: verfehlt um 130 s (1:52:10 vs 1:50:00)', m.verdict === 'missed' && m.deltaSec === 130 && m.targetSec === 6600);
  ok('A3 Radfahrt gleicher Distanz am selben Tag zaehlt NICHT (Sportfamilie)', m.activityId !== 'b');
  const fast = RR.match(HM, [act('hm2', 'running', 21.1, 6500, '2026-09-06')]);
  ok('A4 schneller als Ziel ⇒ achieved, deltaSec negativ', fast.verdict === 'achieved' && fast.deltaSec === -100);
  ok('A5 Nachbartag (±1) wird erkannt, zwei Tage nicht', RR.match(HM, [act('x', 'running', 21.1, 6500, '2026-09-07')]) && !RR.match(HM, [act('x', 'running', 21.1, 6500, '2026-09-08')]));
  ok('A6 Distanz ausserhalb des Fensters (18 km / 23 km) ⇒ kein Treffer', !RR.match(HM, [act('x', 'running', 18, 6000, '2026-09-06')]) && !RR.match(HM, [act('x', 'running', 23, 6000, '2026-09-06')]));
  ok('A7 ohne Zielzeit ⇒ finished, deltaSec null', RR.match(Object.assign({}, HM, { targetValue: null }), acts).verdict === 'finished');
  ok('A8 Kraftziel / Ziel ohne Datum ⇒ null (nicht erkennbar, keine Raterei)', RR.match({ category: 'hypertrophy', targetDate: '2026-09-06' }, acts) === null && RR.match(Object.assign({}, HM, { targetDate: null }), acts) === null);
  ok('A9 „Nicht mein Rennen" (dismissed) ⇒ diese Aktivitaet wird nicht mehr vorgeschlagen', RR.match(Object.assign({}, HM, { result: { dismissed: ['hm'] } }), acts) === null);
  ok('A10 Legacy-Kategorie halfmarathon wird kanonisiert', RR.match(Object.assign({}, HM, { category: 'halfmarathon' }), acts) !== null);
  const two = RR.match(HM, [act('a', 'running', 22.0, 7000, '2026-09-06'), act('b2', 'running', 21.2, 6800, '2026-09-06')]);
  ok('A11 zwei Kandidaten ⇒ geringste Distanzabweichung gewinnt', two.activityId === 'b2');
}
/* B · Ergebnis, Status, pending */
{
  const m = RR.match(HM, [act('hm', 'running', 21.18, 6730, '2026-09-06')]);
  const r = RR.toResult(m, '2026-09-12T10:00:00.000Z');
  ok('B1 toResult traegt alle Felder + confirmedAt', r.activityId === 'hm' && r.verdict === 'missed' && r.deltaSec === 130 && r.confirmedAt === '2026-09-12T10:00:00.000Z');
  ok('B2 statusFor: missed ⇒ missed, achieved ⇒ achieved', RR.statusFor(m) === 'missed' && RR.statusFor(Object.assign({}, m, { verdict: 'achieved' })) === 'achieved' && RR.statusFor(Object.assign({}, m, { verdict: 'finished' })) === 'achieved');
  ok('B3 pending: sechs Tage nach dem Datum ohne Ergebnis ⇒ daysSince 6', RR.pending(HM, '2026-09-12').daysSince === 6);
  ok('B4 pending null: vor dem Datum, mit Ergebnis, oder nicht aktiv', RR.pending(HM, '2026-09-01') === null && RR.pending(Object.assign({}, HM, { result: r }), '2026-09-12') === null && RR.pending(Object.assign({}, HM, { status: 'achieved' }), '2026-09-12') === null);
  ok('B5 raceActivityIds: erkannte + bestaetigte Aktivitaeten', RR.raceActivityIds([HM, { id: 'g2', result: { activityId: 'old' } }], [act('hm', 'running', 21.18, 6730, '2026-09-06')]).sort().join(',') === 'hm,old');
}
/* C · Modell: Status missed + result im Datensatz */
{
  const sb = { window: null }; sb.window = sb; sb.self = sb; sb.globalThis = sb; vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('js/profile-model.js', APP), 'utf8'), sb, { filename: 'profile-model.js' });
  const M = sb.ORVIA.profileModel;
  ok('C1 GOAL_STATUSES kennt missed', M.GOAL_STATUSES.indexOf('missed') >= 0);
  const gs = M.normalizeGoals([Object.assign({}, HM, { status: 'missed', result: { verdict: 'missed', timeSec: 6730 } })]);
  ok('C2 normalizeGoal behaelt status missed und result', gs[0].status === 'missed' && gs[0].result && gs[0].result.timeSec === 6730);
  ok('C3 ohne result ⇒ null (nicht {})', M.normalizeGoals([HM])[0].result === null);
  const upd = M.updateGoal([HM], 'g1', { result: { verdict: 'achieved', timeSec: 6500 }, status: 'achieved' });
  ok('C4 updateGoal setzt result + status in einem Schritt', upd[0].status === 'achieved' && upd[0].result.timeSec === 6500);
}
/* D · Repository und Migration */
{
  const repo = readFileSync(new URL('js/repos/goalRepository.js', APP), 'utf8');
  ok('D1 goalToRowFull sendet result nur, wenn belegt', /if \(goal\.result && typeof goal\.result === 'object'\) row\.result = goal\.result;/.test(repo));
  const st = readFileSync(new URL('js/profile-store.js', APP), 'utf8');
  ok('D2 Hydration nimmt result aus der Cloud-Zeile', /result: \(r\.result && typeof r\.result === 'object'\) \? r\.result : \(prev\.result \|\| null\)/.test(st));
  const mig = readFileSync(new URL('supabase/migrations/0044_goal_result_and_missed.sql', new URL('../../', import.meta.url)), 'utf8');
  ok('D3 Migration 0044: Spalte result + Status missed im CHECK', /add column if not exists result jsonb/.test(mig) && /'missed'/.test(mig));
}
/* E · Oberflaeche: Plan-Kopf-Block in drei Zustaenden */
{
  const ui = readFileSync(new URL('js/ui.js', APP), 'utf8');
  const src = ui.slice(ui.indexOf('function _raceMatchFor('), ui.indexOf('function renderRaceHeader('));
  const acts = [act('hm', 'running', 21.18, 6730, '2026-09-06')];
  const sb = { window: null, _uiT: tStub().t, escH: s => String(s == null ? '' : s), esc: s => String(s == null ? '' : s), fmtDe: n => String(n).replace('.', ','), todayStr: () => '2026-09-12', Math, String, Date, Number, Array, Object };
  sb.window = sb; sb.ORVIA = { raceResult: RR, activityStore: { listActivities: () => acts, isTombstoned: null } };
  vm.createContext(sb); vm.runInContext(src, sb);
  const h1 = sb._raceResultBlockHTML(HM);
  ok('E1 erkannt: Block mit Zeit, Urteil und zwei Aktionen', /Wettkampf erkannt/.test(h1) && /1:52:10/.test(h1) && /Ziel verfehlt um 2:10/.test(h1) && /goalConfirmResult\('g1','hm'\)/.test(h1) && /goalDismissRace\('g1','hm'\)/.test(h1), h1);
  const h2 = sb._raceResultBlockHTML(Object.assign({}, HM, { status: 'missed', result: RR.toResult(RR.match(HM, acts), 'x') }));
  ok('E2 bestaetigt: „Verfehlt · 1:52:10 · +2:10 · 21,18 km"', /Verfehlt/.test(h2) && /\+2:10/.test(h2) && /21,18 km/.test(h2) && !/goalConfirmResult/.test(h2), h2);
  sb.ORVIA.activityStore.listActivities = () => [];
  const h3 = sb._raceResultBlockHTML(HM);
  ok('E3 nichts erkannt, Datum vorbei: Frage mit Erreicht/Verfehlt/Neu terminieren', /vor 6 Tagen/.test(h3) && /goalSetStatus\('g1','achieved'\)/.test(h3) && /goalSetStatus\('g1','missed'\)/.test(h3) && /openGoalEditor\('g1'\)/.test(h3), h3);
  ok('E4 vor dem Datum: kein Block', sb._raceResultBlockHTML(Object.assign({}, HM, { targetDate: '2026-10-18' })) === '');
}
/* F · Ziel-Detail: Wettkampf-Block (Modell + Markup) */
{
  const gd = readFileSync(new URL('js/goal-detail.js', APP), 'utf8');
  const sb = { window: null, console, Date, Math, String, Number, Array, Object, JSON, document: { getElementById: () => null } };
  sb.window = sb; sb.self = sb; sb.ORVIA = { i18n: tStub() }; vm.createContext(sb);
  vm.runInContext(gd, sb, { filename: 'goal-detail.js' });
  const GD = sb.ORVIA.goalDetail;
  const m1 = GD.buildModel({ goal: HM, raceMatch: { activityId: 'hm', date: '2026-09-06', distanceKm: 21.18, timeSec: 6730, targetSec: 6600, deltaSec: 130, verdict: 'missed' } });
  ok('F1 Modell: erkannte Aktivitaet ⇒ race.kind match, +2:10', m1.race && m1.race.kind === 'match' && m1.race.deltaText === '+2:10' && m1.race.timeText === '1:52:10');
  const h1 = GD.html(m1);
  ok('F2 Markup: „Wettkampf erkannt", Zeit, Buttons gd-race-ok/gd-race-no', /Wettkampf erkannt/.test(h1) && /1:52:10/.test(h1) && /id="gd-race-ok"/.test(h1) && /id="gd-race-no"/.test(h1));
  const m2 = GD.buildModel({ goal: Object.assign({}, HM, { status: 'achieved', result: { verdict: 'achieved', timeSec: 6500, deltaSec: -100, distanceKm: 21.1, date: '2026-09-06', activityId: 'x' } }) });
  const h2 = GD.html(m2);
  ok('F3 bestaetigtes Ergebnis: „Wettkampfergebnis · Erreicht · −1:40", keine Buttons', m2.race.kind === 'result' && /Wettkampfergebnis/.test(h2) && /Erreicht/.test(h2) && /−1:40/.test(h2) && !/gd-race-ok/.test(h2));
  ok('F4 ohne beides: kein Block', GD.buildModel({ goal: HM }).race === null && !/gd-race/.test(GD.html(GD.buildModel({ goal: HM }))));
}
console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

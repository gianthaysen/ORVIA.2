/* ORVIA · Ziel-Historie (profile-model, Migration 0045) — S1.5, 13.09.2026
   node supabase/tests/goal_history_test.mjs */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const APP = ['../../app/', '../../'].map(p => new URL(p, import.meta.url)).find(u => existsSync(new URL('js/profile-model.js', u)));
const M = require(new URL('js/profile-model.js', APP).pathname);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
let gs = M.addGoal([], { category: 'half_marathon', title: 'HM', targetValue: 6900, metricType: 'time', targetDate: '2026-10-18', priority: 1 }, '2026-06-12T10:00:00Z', { source: 'onboarding', forecastMin: 115 });
const id = gs[0].id;
ok('H1 addGoal schreibt „created" mit Zielwert/Prio, Quelle und Prognose', gs[0].history.length === 1 && gs[0].history[0].type === 'created' && gs[0].history[0].to.targetValue === 6900 && gs[0].history[0].note === 'onboarding' && gs[0].history[0].forecastMin === 115);
gs = M.updateGoal(gs, id, { targetValue: 6600 }, '2026-07-28T10:00:00Z', { forecastMin: 110.7 });
ok('H2 Zielwert-Aenderung: ein Eintrag target 6900→6600 mit Prognose', gs[0].history.length === 2 && gs[0].history[1].type === 'target' && gs[0].history[1].from === 6900 && gs[0].history[1].to === 6600 && gs[0].history[1].forecastMin === 110.7);
gs = M.updateGoal(gs, id, { title: 'HM', motivation: 'egal' }, '2026-07-29T10:00:00Z');
ok('H3 Kosmetik (Motivation, gleicher Titel) erzeugt keinen Eintrag', gs[0].history.length === 2);
gs = M.updateGoal(gs, id, { targetDate: '2026-10-25', priority: 2 }, '2026-08-01T10:00:00Z');
ok('H4 Datum + Prioritaet: zwei Eintraege in einem Update', gs[0].history.length === 4 && gs[0].history[2].type === 'date' && gs[0].history[3].type === 'priority' && gs[0].history[3].to === 2);
gs = M.updateGoal(gs, id, { status: 'missed', result: { verdict: 'missed', timeSec: 8532, date: '2026-09-06' } }, '2026-09-13T10:00:00Z');
ok('H5 Status + Ergebnis protokolliert', gs[0].history.length === 6 && gs[0].history[4].type === 'status' && gs[0].history[5].type === 'result' && gs[0].history[5].to.verdict === 'missed' && gs[0].history[5].to.timeSec === 8532);
ok('H6 Historie ueberlebt normalizeGoals (Roundtrip) und bleibt append-only sortiert', M.normalizeGoals(gs)[0].history.length === 6 && M.normalizeGoals(gs)[0].history.every((h, i, a) => i === 0 || a[i - 1].at <= h.at));
ok('H7 normalizeHistory verwirft Muell und kappt auf 60', M.normalizeHistory([{ type: 'nope', at: 'x' }, null, { type: 'target', at: '2026-01-01T00:00:00Z', from: 1, to: 2 }]).length === 1 && M.normalizeHistory(Array.from({ length: 80 }, (_, i) => ({ type: 'title', at: '2026-01-' + String(1 + (i % 28)).padStart(2, '0') + 'T00:00:00Z', to: 'x' }))).length === 60);
const repo = readFileSync(new URL('js/repos/goalRepository.js', APP), 'utf8'), store = readFileSync(new URL('js/profile-store.js', APP), 'utf8'), prof = readFileSync(new URL('js/profile.js', APP), 'utf8');
ok('H8 Repo sendet history nur wenn belegt; Store hydriert; profile.js reicht Prognose-Kontext durch', /if \(Array\.isArray\(goal\.history\) && goal\.history\.length\) row\.history = goal\.history;/.test(repo) && /history: Array\.isArray\(r\.history\)/.test(store) && /_goalHistMeta\(id,reason\)/.test(prof));
ok('H9 Migration 0045 vorhanden (history jsonb)', existsSync(new URL('../supabase/migrations/0045_goal_history.sql', APP)) || existsSync(new URL('../../supabase/migrations/0045_goal_history.sql', APP)));
console.log('\ngoal_history: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

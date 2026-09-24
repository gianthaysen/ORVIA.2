import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const APP = new URL('../app/', import.meta.url);
globalThis.icon = (n, s) => '<svg class="ic ' + (s || 'sm') + '" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
require(new URL('js/i18n.js', APP).pathname); require(new URL('locales/de.js', APP).pathname);
const G = require(new URL('js/goal-detail.js', APP).pathname);
const HM = { id: 'g1', category: 'half_marathon', title: 'Halbmarathon unter 1:50', targetValue: 6600, unit: 's', metricType: 'time', targetDate: '2026-10-18', priority: 1, status: 'active', createdAt: '2026-06-12T10:00:00Z',
  milestones: [{ title: '10 km unter 50 Minuten', targetDate: '2026-06-21', status: 'achieved', targetValue: 3000, unit: 's', metricType: 'time' }, { title: 'Testlauf 15 km im Zieltempo', targetDate: '2026-09-27', status: 'in_progress' }, { title: 'Langer Lauf 20 km', targetDate: '2026-10-04' }],
  history: [{ at: '2026-07-28T10:00:00Z', type: 'target', from: 6900, to: 6600, forecastMin: 110.7 }, { at: '2026-06-21T10:00:00Z', type: 'milestone', from: 0, to: 1 }, { at: '2026-06-12T10:00:00Z', type: 'created', to: { targetValue: 6900, priority: 1 }, note: 'onboarding' }] };
const PI = { family: 'run', daysTo: 35, phase: 'build', distanceKm: 21.0975, target: { targetMin: 110, pacePerKmSec: 313 } };
const series = []; for (let i = 12; i >= 0; i--) { const d = new Date(Date.UTC(2026, 8, 13)); d.setUTCDate(d.getUTCDate() - 7 * i); series.push({ date: d.toISOString().slice(0, 10), tPred: i > 9 ? null : 118 - (12 - i) * 0.6 + (i % 3) * 0.4 }); }
const m = G.buildModel({ goal: HM, planInput: PI, isMain: true, today: '2026-09-13', catLabel: c => ({ half_marathon: 'Halbmarathon' }[c] || c),
  engine: { tPred: 111.3, tRiegel: 110.2, tEF: 113.9, state: 'border', nRuns: 14, nQuality: 6, vetos: [] }, feasibility: { evaluated: true, status: 'within_modeled_corridor' },
  bests: { t5: 1414, t10: 3270, t21: 8413, real: { k5: 1, k10: 1, k21: 1 }, meas: { k10: { date: '2026-08-09' }, k21: { date: '2026-09-06' } } }, avg4WeekKm: 31, targetWeekKm: 42, longestRun28: 21.3, plannedKeyPerWeek: 3,
  runs: [{ date: '2026-09-09', dist: 8, dur: 42, sub: 'Tempo' }, { date: '2026-09-06', dist: 21.3, dur: 142, sub: 'Long Run' }, { date: '2026-08-30', dist: 6, dur: 36, sub: '' }, { date: '2026-08-26', dist: 12, dur: 66, sub: 'Tempo' }, { date: '2026-08-20', dist: 16, dur: 98, sub: 'Long Run' }, { date: '2026-08-19', dist: 7, dur: 38, sub: 'Tempo' }],
  weekPlan: [{ title: 'Di · Schwellenlauf 4×8 min', detail: 'Laufen · 45 min', icon: 'bolt', hardRun: true }, { title: 'Do · Ruhiger Dauerlauf', detail: 'Laufen · 60 min', icon: 'bolt' }, { title: 'Sa · Kraft Unterkörper', detail: 'Gym · 50 min', icon: 'shield' }, { title: 'So · Langer Lauf 18 km', detail: 'Laufen · 100 min', icon: 'bolt', hardRun: true }],
  series, conflicts: [{ conflictType: 'x', goalIds: ['g1', 'g3'], explanation: 'Ein Kaloriendefizit senkt die Qualität der Schlüsseleinheiten messbar.' }], goals: [HM, { id: 'g3', title: 'Körperfett 10–12 %' }],
  strength: { gaps: [] } });
const css = readFileSync(new URL('styles.css', APP), 'utf8');
const page = '<!doctype html><html lang="de"><head><meta charset="utf-8"><style>' + css + '\nhtml,body{margin:0;background:#05080c}.ic{width:16px;height:16px;display:inline-block;vertical-align:middle}.ic.xs{width:12px;height:12px}.wrap{max-width:430px;margin:0 auto;padding:18px;background:#0b1017}h2.t{font-size:18px;font-weight:800;margin:0 0 14px}</style></head><body><div class="wrap"><h2 class="t">' + m.title + '<div class="gd-psub">Hauptziel · Halbmarathon</div></h2>' + G.html(m) + '</div></body></html>';
writeFileSync(new URL('gd-preview.html', import.meta.url), page); console.log('written', page.length);

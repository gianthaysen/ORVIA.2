import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const APP = new URL('../app/', import.meta.url);
const { tStub } = await import(new URL('../supabase/tests/_i18n-src.mjs', import.meta.url));
function makeSb(extra) {
  const sb = { window: null, console, Date, Math, String, Number, Array, Object, JSON, RegExp, isNaN, localStorage: { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = String(v); } },
    icon: (n, s) => '<svg class="ic ' + (s||'sm') + '" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/></svg>', goalCatLabel: c => ({ half_marathon: 'Halbmarathon', hypertrophy: 'Muskelaufbau', target_bodyfat: 'Körperfett', marathon: 'Marathon', custom: 'Eigenes Ziel' }[c] || c), todayStr: () => '2026-09-13',
    document: { getElementById: () => null } };
  sb.window = sb; sb.self = sb; sb.globalThis = sb; sb.ORVIA = { i18n: tStub() };
  Object.assign(sb, extra || {});
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('js/profile-model.js', APP), 'utf8'), sb, { filename: 'profile-model.js' });
  vm.runInContext(readFileSync(new URL('js/screens/profile-v14.js', APP), 'utf8'), sb, { filename: 'profile-v14.js' });
  return sb;
}
const goals = [
  { id: 'g1', category: 'marathon', title: 'Marathon Sub 3:30h', targetDate: '2027-09-05', targetValue: 12600, unit: 's', metricType: 'time', status: 'active', priority: 1 },
  { id: 'g2', category: 'custom', title: '70.3 Ironman 2027', status: 'active', priority: 2 },
  { id: 'g3', category: 'target_bodyfat', title: '12%', status: 'active', priority: 2, unit: '%', targetValue: '12' },
  { id: 'g4', category: 'half_marathon', title: 'Halbmarathon unter 1:50h', status: 'missed', priority: 2, result: { verdict: 'missed', timeSec: 8532, deltaSec: 1932, date: '2026-09-06', distanceKm: 21.3 } }];
const d = { today: '2026-09-13', sports: [{ id: 'running', label: 'Laufen', role: 'main' }, { id: 'cycling', label: 'Radfahren', role: 'secondary' }, { id: 'swimming', label: 'Schwimmen', role: 'secondary' }, { id: 'gym', label: 'Krafttraining', role: 'secondary' }, { id: 'hiking', label: 'Wandern', role: 'supplemental' }],
  goals, mainGoalId: 'g1', planInput: { targetDate: '2027-09-05', daysTo: 357, target: { targetMin: 210 } }, engine: null, feasibility: null,
  strength: { score: 100, band: 'stark', gaps: [] }, gmProfSyncLabel: null,
  season: { model: 'season', totalWeeks: 52, weeksToRace: 51, daysTo: 357, targetDate: '2027-09-05', phases: [{ key: 'base', n: 'Basis', weeks: 21, on: true, done: false, week: 1 }, { key: 'build', n: 'Aufbau', weeks: 25, on: false, done: false }, { key: 'peak', n: 'Spitze', weeks: 4, on: false, done: false }, { key: 'taper', n: 'Tapering', weeks: 2, on: false, done: false }] },
  weekStats: { km: 0, sessionsAvg: 3.5 }, load: { ctl: 137, acwr: 0.36, suppressed: false }, conflicts: [], matches: {},
  bests: { t5: 1414, t10: 3270, t21: 8413, t42: 13782, real: { k5: 1, k10: 1, k21: 1 }, meas: { k5: { date: '2026-08-13' }, k10: { date: '2026-08-09' }, k21: { date: '2026-09-06' } } },
  bestsAll: { cycling: { k20: { sec: 2649, date: '2026-06-20' } }, swimming: { m400: { sec: 1026, date: '2026-06-19' } } },
  strengthRecords: [], vo2: { value: 53, source: 'automatic' }, hfMax: { value: 194, source: 'measured', updatedAt: '2026-09-13' }, restingHr: { value: 54, source: 'device', updatedAt: '2026-09-13' },
  threshold: { paceSec: 382, ref: { distanceKm: 21.1, date: '2026-09-06' } }, activitiesCount: 155 };
const sb = makeSb({ gmProfSyncLabel: () => 'Garmin · vor 4 Min synchronisiert', ORVIA: { i18n: tStub(), gymVolume: { gymPipeline: () => ({ snapshots: [{ startedAt: '2026-09-02', exercises: [{ exerciseNameSnapshot: 'Kniebeuge', sets: [{ completed: true, set_type: 'working', weight: 100, reps: 5 }] }, { exerciseNameSnapshot: 'Klimmzug', sets: [{ completed: true, set_type: 'working', weight: null, reps: 11 }] }] }] }) } } });
const PV = sb.ORVIA.screens.profileV14;
const css = readFileSync(new URL('styles.css', APP), 'utf8');
const head = '<div class="ig-stats"><div class="ig-stat"><b>155</b><span>Einheiten</span></div><div class="ig-stat"><b>5</b><span>Sportarten</span></div><div class="ig-stat"><b>137</b><span>Fitness (sRPE)</span></div><div class="ig-stat"><b>3</b><span>Ziele</span></div></div>';
const tabs = ['ueber', 'ziele', 'leistung'];
const body = tabs.map(t => '<div class="screen" style="width:430px;flex:0 0 auto;background:var(--bg,#0b1017);padding-bottom:40px"><div id="gmProf">' + head + (PV.strengthNeedsCard(d.strength) ? PV.strengthCardHTML(d.strength) : '') + PV.navHTML(t) + '<div class="pv-tab">' + (t === 'ueber' ? PV.overviewHTML(d) : t === 'ziele' ? PV.goalsHTML(d) : PV.performanceHTML(d)) + '</div></div></div>').join('');
writeFileSync(new URL('pv-preview.html', import.meta.url), '<!doctype html><html lang="de"><head><meta charset="utf-8"><style>' + css + '\nhtml,body{margin:0;background:#05080c}.wrap{display:flex;gap:24px;padding:20px}.ic{width:16px;height:16px;display:inline-block;vertical-align:middle}.ic.xs{width:12px;height:12px}</style></head><body><div class="wrap">' + body + '</div></body></html>');
console.log('written');

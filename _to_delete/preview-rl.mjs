import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const APP = new URL('../app/', import.meta.url);
const ui = readFileSync(new URL('js/ui.js', APP), 'utf8');
const grab = (name) => { const i = ui.indexOf('function ' + name + '('); const j = ui.indexOf('\nfunction ', i + 10); return ui.slice(i, j); };
const src = grab('gmPlanLadderPainDays') + '\n' + grab('gmPlanConstraintModel') + '\n' + grab('gmPlanConstraintHTML') + '\n';
const sb = { console, window: null, Date, Math, String, Number, Array, Object, JSON, parseInt, parseFloat, isNaN,
  icon: (n, s) => '<svg class="ic ' + (s || 'sm') + '" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  gmEsc: (x) => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  todayStr: () => '2026-09-14', dkey: (o) => { const d = new Date(Date.UTC(2026, 8, 14 + o)); return d.toISOString().slice(0, 10); },
  DB: { '2026-09-13': { morning: { knee: 9 } }, '2026-09-12': { morning: { knee: 7 } } },
  PROFILE: { constraintsList: [{ id: 'c1', bodyRegion: 'knee', side: 'left', intensity: 9, status: 'active', title: 'Knie links' }] },
  _absenceReplannerOn: () => true, activeWeekPlan: () => { sb.ORVIA._lastAbsencePlan = { injury: { replaced: 4 } }; return []; } };
sb.window = sb; sb.globalThis = sb; sb.ORVIA = {};
vm.createContext(sb);
sb._uiT = (function () { const i18nSrc = readFileSync(new URL('js/i18n.js', APP), 'utf8'); const deSrc = readFileSync(new URL('locales/de.js', APP), 'utf8'); vm.runInContext(i18nSrc, sb); vm.runInContext(deSrc, sb); return (k, p) => sb.ORVIA.i18n.t(k, p); })();
vm.runInContext(readFileSync(new URL('js/engine/return-ladder.js', APP), 'utf8'), sb);
vm.runInContext(readFileSync(new URL('js/engine/absence-replanner.js', APP), 'utf8'), sb);
vm.runInContext(src, sb);
const variants = [];
variants.push(vm.runInContext('gmPlanConstraintHTML()', sb));
sb.PROFILE.constraintsList[0] = Object.assign({}, sb.PROFILE.constraintsList[0], { status: 'improved', intensity: 4, returnStage: 2, returnStageSince: '2026-09-11' });
sb.DB = { '2026-09-13': { morning: { knee: 2 } } };
variants.push(vm.runInContext('gmPlanConstraintHTML()', sb));
const css = readFileSync(new URL('styles.css', APP), 'utf8');
writeFileSync(new URL('rl-preview.html', import.meta.url), '<!doctype html><html lang="de"><head><meta charset="utf-8"><style>' + css + '\nhtml,body{margin:0;background:#05080c}.ic{width:16px;height:16px;display:inline-block;vertical-align:middle}.ic.xs{width:12px;height:12px}.wrap{max-width:430px;margin:0 auto;padding:18px;background:#0b1017}</style></head><body><div class="wrap">' + variants.join('<div style="height:24px"></div>') + '</div></body></html>');
console.log('written', variants.map(v => v.length));

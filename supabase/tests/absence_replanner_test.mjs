/* ORVIA · absence_replanner — B-09 (rein) + Verdrahtung
   node supabase/tests/absence_replanner_test.mjs */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')].find(p => existsSync(join(p, 'js', 'engine', 'absence-replanner.js'))) || _flat);
const A = require(join(APP, 'js/engine/absence-replanner.js'));
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const J = x => JSON.stringify(x);
const R = (l, d) => ({ t: 'Laufen', l, d, id: 'x' }), G = l => ({ t: 'Gym', l, d: '45 min' }), B = (l, d) => ({ t: 'Rad', l, d });
const week = () => [[G('Oberkörper')], [R('Intervalle', 'iv')], [G('Ganzkörper')], [R('Z2 Dauerlauf', 'ez')], [G('Beine')], [B('Long Ride', '2 h')], [R('Long Run', 'lr')]];
const L = w => w.map(d => d.map(i => i.l).join('+')).join(' | ');
const hardDays = w => w.map((d, i) => d.some(i2 => /interval|tempo|long/i.test(i2.l)) ? i : -1).filter(i => i >= 0);

sec('A · Bestandsschutz / Gueltigkeit');
{
  const w = week();
  ok('A1 nichts gemeldet → gleiche Referenz, changed false', A.replan(w, { todayIndex: 2 }).days === w && !A.replan(w, { todayIndex: 2 }).changed);
  ok('A2 Eingabe nie mutiert', (() => { const s = J(w); A.replan(w, { todayIndex: 2, illness: { activeToday: true, duration: 1, sinceEnd: 0 }, missed: [1] }); return J(w) === s; })());
  ok('A3 kaputte Eingabe → nie null, nie Wurf', A.replan(null, {}).days === null && A.replan([[]], { illness: { activeToday: true } }).changed === false && A.replan(w, null).days === w);
  ok('A4 immer 7 Tage', A.replan(w, { todayIndex: 0, illness: { activeToday: true, duration: 1, sinceEnd: 0 } }).days.length === 7);
}

sec('B · krank heute (kuerzen)');
{
  const r = A.replan(week(), { todayIndex: 2, illness: { activeToday: true, sinceEnd: 0, duration: 2 } });
  ok('B1 heute frei, Vergangenheit unangetastet', r.days[2].length === 0 && r.days[0][0].l === 'Oberkörper' && r.days[1][0].l === 'Intervalle', L(r.days));
  ok('B2 Rest der Woche ohne harten Reiz: Long Run/Long Ride weg, Kraft → Mobility', r.days[6].length === 0 && r.days[5].length === 0 && r.days[4][0].t === 'Mobilität');
  ok('B3 Z2 bleibt', r.days[3][0].l === 'Z2 Dauerlauf');
  ok('B4 Strategie kuerzen, Notiz', r.strategy === 'shorten' && r.notes.includes('sick_today_no_hard_sessions'));
  ok('B5 Rennen diese Woche → raceAtRisk', A.replan(week(), { todayIndex: 2, illness: { activeToday: true, sinceEnd: 0, duration: 1 }, raceDayIndex: 6 }).raceAtRisk === true);
  ok('B6 Intervalle nach heute → Z2 (nicht geloescht)', (() => { const w = week(); w[4] = [R('Intervalle', 'iv')]; const x = A.replan(w, { todayIndex: 2, illness: { activeToday: true, sinceEnd: 0, duration: 1 } }); return x.days[4][0].l === 'Z2 Dauerlauf' && x.days[4][0].d === 'ez'; })());
}

sec('C · Rueckkehrfenster nach Krankheit');
{
  const r = A.replan(week(), { todayIndex: 0, illness: { activeToday: false, sinceEnd: 1, duration: 3 } });
  ok('C1 Fenster 3 Tage: Mo–Mi weich (Kraft leicht, Intervalle → Z2), Do+ unveraendert', r.days[0][0].l === 'Oberkörper · leicht' && r.days[1][0].l === 'Z2 Dauerlauf' && r.days[2][0].l === 'Ganzkörper · leicht' && r.days[4][0].l === 'Beine' && r.days[6][0].l === 'Long Run', L(r.days));
  ok('C2 Fenster gedeckelt auf 7 (Dauer 20)', A.replan(week(), { todayIndex: 0, illness: { activeToday: false, sinceEnd: 1, duration: 20 } }).notes.includes('return_window_7d'));
  ok('C3 sinceEnd 5, Dauer 2 → Fenster vorbei, unveraendert', !A.replan(week(), { todayIndex: 0, illness: { activeToday: false, sinceEnd: 5, duration: 2 } }).changed);
  ok('C4 Long Run im Fenster → kurz und locker', (() => { const x = A.replan(week(), { todayIndex: 6, illness: { activeToday: false, sinceEnd: 1, duration: 4 } }); return x.days[6][0].l === 'Z2 Dauerlauf kurz'; })());
}

sec('D · Verletzung');
{
  const r = A.replan(week(), { todayIndex: 1, injury: { active: true } });
  ok('D1 Laufen ab heute → Mobility, Rad bleibt, Beine → Oberkörper', r.days[1][0].t === 'Mobilität' && r.days[6][0].t === 'Mobilität' && r.days[5][0].l === 'Long Ride' && r.days[4][0].l === 'Oberkörper' && r.days[0][0].l === 'Oberkörper', L(r.days));
  ok('D2 Notiz Kriterien-Rueckkehr', r.notes.includes('injury_criteria_return'));
}

sec('E · verpasster Kernreiz');
{
  const w = week(); w[3] = []; w[5] = [];              /* Do und Sa frei */
  const r = A.replan(w, { todayIndex: 2, missed: [1], phase: 'build' });
  ok('E1 Intervalle (Di verpasst) → Do nachgeholt (frei, kein harter Nachbar)', r.days[3].length === 1 && r.days[3][0].l === 'Intervalle · nachgeholt' && r.strategy === 'reinsert', L(r.days));
  ok('E2 keine zwei harten Tage hintereinander erzeugt', (() => { const h = hardDays(r.days); return h.every((d, i) => i === 0 || d - h[i - 1] > 1); })());
  ok('E3 kein freier Tag → gestrichen, strategy drop', A.replan(week(), { todayIndex: 2, missed: [1], phase: 'build' }).strategy === 'drop');
  ok('E4 taper → nichts nachholen', (() => { const x = A.replan(w, { todayIndex: 2, missed: [1], phase: 'taper' }); return x.strategy === 'drop' && x.notes.includes('taper_no_catchup') && x.days[3].length === 0; })());
  ok('E5 nie am Vortag des Rennens oder danach', (() => { const w2 = week(); w2[3] = []; w2[5] = []; const x = A.replan(w2, { todayIndex: 2, missed: [1], phase: 'build', raceDayIndex: 4 }); return x.days[3].length === 0 && x.days[5].length === 0 && x.strategy === 'drop'; })());
  ok('E6 zwei verpasste Kernreize → hoechstens einer nachgeholt', (() => { const w2 = week(); w2[2] = [R('Tempo', 'tempo')]; w2[4] = []; w2[5] = []; const x = A.replan(w2, { todayIndex: 3, missed: [1, 2], phase: 'build' }); return x.days.slice(4).filter(d => d.some(i => /nachgeholt/.test(i.l))).length === 1; })());
  ok('E7 verpasst + krank heute → krank gewinnt, kein Nachholen', A.replan(w, { todayIndex: 2, missed: [1], illness: { activeToday: true, sinceEnd: 0, duration: 1 } }).strategy === 'shorten');
  ok('E8 nur lockere Einheit verpasst → nichts', A.replan(week(), { todayIndex: 4, missed: [3], phase: 'build' }).notes.includes('missed_no_key_session'));
}

sec('F · illnessFromHistory + Verdrahtung');
{
  ok('F1 heute krank seit 3 Tagen', J(A.illnessFromHistory([true, true, true, false])) === J({ activeToday: true, sinceEnd: 0, duration: 3 }));
  ok('F2 seit 2 Tagen gesund, 2 Tage krank', J(A.illnessFromHistory([false, false, true, true, false])) === J({ activeToday: false, sinceEnd: 2, duration: 2 }));
  ok('F3 nie krank / leer', A.illnessFromHistory([false, false]).sinceEnd === null && A.illnessFromHistory([]).duration === 0);
  const ui = readFileSync(join(APP, 'js/ui.js'), 'utf8'), idx = readFileSync(join(APP, 'index.html'), 'utf8'), sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  const FF = require(join(APP, 'js/engine/feature-flags.js'));
  ok('F4 Flag bekannt + Migration 0040', FF.KNOWN.includes('absence_replanner') && /absence_replanner/.test(readFileSync(join(HERE, '..', 'migrations', '0040_absence_replanner_flag.sql'), 'utf8')));
  ok('F5 drei Lesepfade durch applyAbsenceToPlan, Flag-Schranke, Re-Entrancy-Guard', (ui.match(/applyAbsenceToPlan\(/g) || []).length === 4 && /if\(_absenceBusy\)return plan;/.test(ui) && /if\(!_absenceReplannerOn\(\)\)return plan;/.test(ui));
  ok('F6 Skript + sw.js', idx.includes('js/engine/absence-replanner.js') && sw.includes("'./js/engine/absence-replanner.js'"));
}
console.log('\n' + (fail ? '❌' : '✅') + ' absence_replanner: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

/* ============================================================
   ORVIA · profile_inputs_v14 — Profilstaerke-Seite (S6a, v14 pgStrength)
   ------------------------------------------------------------
     A. engine/profile-inputs: Zustaende je Eingabe, nichts erfunden
     B. Seite: Gruppen, KPI, Zeilen mit Editor-Weg; Einstieg von der B-03-Karte
   node supabase/tests/profile_inputs_v14_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _ex } from 'node:fs';
import { createRequire } from 'node:module';
import { tStub } from './_i18n-src.mjs';
const require = createRequire(import.meta.url);
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const PI = require(new URL(_APPREL + 'js/engine/profile-inputs.js', import.meta.url).pathname);

sec('A · Register');
{
  ok('A1 12 Eingaben, jede mit Leser-Text, Sektion, Wirkung', PI.INPUTS.length === 12 && PI.INPUTS.every(d => d.readers && d.sectionId && /^(high|medium)$/.test(d.impact) && typeof d.state === 'function'));
  const empty = PI.evaluate({ p: {} });
  ok('A2 leeres Profil: nichts vorhanden, Schaetzungen nur wo ein Standard gilt (Schlaf 8 h, Risiko ausgewogen)', empty.counts.present === 0 && empty.counts.estimated === 2 && empty.rows.filter(r => r.state === 'estimated').map(r => r.id).join() === 'sleep_goal,risk');
  const full = PI.evaluate({
    p: { hfMax: 192, rhrBaseline: 48, birthDate: '2004-03-01', weightKg: 74, sleepGoalH: 7.5, preferences: { riskTolerance: 'ambitious' } },
    planInput: { source: 'main_goal', category: 'half_marathon', targetDate: '2026-12-06', targetValue: 110, targetUnit: 'min', gaps: [] },
    perf: { sports: { running: { ok: true, confidence: 'strong', ageRatio: 0.2, reference: { distanceKm: 10, durationMin: 49.2, source: 'race' } } } },
    primary: { sportId: 'running', level: 'intermediate', sessionsPerWeek: 4 }, availableDays: 5, sections: { constraints: { complete: true, count: 0 } }
  });
  ok('A3 volles Profil: 12 vorhanden, 100 %', full.counts.present === 12 && full.pct === 100);
  ok('A4 Werte lesbar: Leistung „10 km in 49 min", Niveau „intermediate · 4/Woche", HFmax 192 bpm', full.rows.find(r => r.id === 'performance_ref').value === '10 km in 49 min' && full.rows.find(r => r.id === 'level_volume').value === 'intermediate · 4/Woche' && full.rows.find(r => r.id === 'hfmax').value === '192 bpm');
  const est = PI.evaluate({ p: { age: 22 }, planInput: { source: 'main_goal', category: 'half_marathon', gaps: ['target_date', 'target_value'] }, primary: { sportId: 'running', level: 'intermediate' }, availableDays: 2, perf: { sports: { running: { ok: true, confidence: 'informational', ageRatio: null } } } });
  ok('A5 HFmax aus Alter = geschaetzt (Tanaka 193), Ziel ohne Datum/Wert = fehlt, 2 Tage = geschaetzt, Niveau ohne Einheiten = geschaetzt', est.rows.find(r => r.id === 'hfmax').state === 'estimated' && /193 bpm/.test(est.rows.find(r => r.id === 'hfmax').value) && est.rows.find(r => r.id === 'goal_date').state === 'missing' && est.rows.find(r => r.id === 'goal_target').state === 'missing' && est.rows.find(r => r.id === 'training_days').state === 'estimated' && est.rows.find(r => r.id === 'level_volume').state === 'estimated');
  ok('A6 Leistungsreferenz informational ⇒ geschaetzt (nicht steuernd)', est.rows.find(r => r.id === 'performance_ref').state === 'estimated');
  ok('A7 Ruhepuls: Baseline fehlt, Check-ins vorhanden ⇒ geschaetzt', PI.evaluate({ p: {}, hasCheckinRhr: true }).rows.find(r => r.id === 'rhr').state === 'estimated');
  ok('A8 werfender Zustand ⇒ fehlt, kein Throw', (() => { const s = PI.INPUTS[0].state; PI.INPUTS[0].state = () => { throw new Error('x'); }; const r = PI.evaluate({}); PI.INPUTS[0].state = s; return r.rows[0].state === 'missing'; })());
  ok('A9 Gruppen: 6 stark, 6 mittel', full.groups.high.length === 6 && full.groups.medium.length === 6);
}

sec('B · Seite + Einstieg');
{
  const ui = rd('js/ui.js'), pc = rd('js/profile-center.js'), idx = rd('index.html'), sw = rd('sw.js'), de = rd('locales/de.js'), css = rd('styles.css');
  ok('B1 Route strength → gmProfStrengthPage', /strength:function\(\)\{return gmProfStrengthPage\(\);\}/.test(ui));
  const g = globalThis; g.window = g; g.ORVIA = { profileInputs: PI, profileCenter: { buildStrength: () => ({ score: 73, band: 'solide' }) } }; g._uiT = tStub().t; g.icon = n => '<svg data-i="' + n + '"></svg>'; g.gmEsc = s => String(s); g.GM_NA = 'n/a';
  g.gmPPageHead = (t, s) => '<div class="page-head"><h2>' + t + '</h2><p>' + s + '</p></div>';
  g.PROFILE = { hfMax: 190, age: 22 }; g.todayStr = () => '2026-09-28'; g.DB = {}; g.dkey = () => '2026-09-28';
  const fn = name => ui.match(new RegExp('\\n(function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\})\\n'))[1];
  (0, eval)(ui.match(/var GM_INPUT_STATE=\{[^\n]*\};/)[0] + '\n' + [fn('gmProfInputsCtx'), fn('gmProfStrengthPage'), fn('gmProfInputOpen')].join('\n') + '\nglobalThis.gmProfStrengthPage=gmProfStrengthPage;globalThis.gmProfInputOpen=gmProfInputOpen;');
  const h = g.gmProfStrengthPage();
  ok('B2 Seite: Kopf mit „n von 12 · %", Score 73 solide, KPI-Reihe, zwei Gruppen, 12 Zeilen', /von 12 Eingaben/.test(h) && /<b>73<\/b>/.test(h) && /ps-kpis/.test(h) && /Wirkt sich stark aus/.test(h) && /Wirkt sich mittel aus/.test(h) && (h.match(/class="prow"/g) || []).length === 12);
  ok('B3 Zeile: HFmax vorhanden (gruen, 190 bpm), fehlende rot mit „Fehlt", Editor-Weg je Sektion', /--ready\)">190 bpm/.test(h) && /--crit\)">Fehlt/.test(h) && /gmProfInputOpen\('goals'\)/.test(h) && /gmProfInputOpen\('body'\)/.test(h));
  let opened = [], closed = 0; g.gmCloseProfPage = () => closed++; g.openProfileSection = id => opened.push(id);
  g.gmProfInputOpen('availability');
  ok('B4 gmProfInputOpen schliesst die Seite und oeffnet die Sektion', closed === 1 && opened.join() === 'availability');
  ok('B5 B-03-Karte: Knopf „Alle Eingaben ansehen" nur mit Route + Modul, Handler → gmOpenProfPage(strength)', /pc-strength-all/.test(pc) && /typeof root\.gmOpenProfPage === 'function' && O\.profileInputs/.test(pc) && /root\.gmOpenProfPage\('strength'\)/.test(pc));
  ok('B6 index/sw/CSS/Katalog', /js\/engine\/profile-inputs\.js/.test(idx) && /'\.\/js\/engine\/profile-inputs\.js'/.test(sw) && /\.ps-score\{/.test(css) && /\.pc-strength-all\{/.test(css) && ['ui.profilstaerke', 'ui.ps_sub', 'ui.ps_intro', 'ui.ps_eduhint', 'pc.alle_eingaben'].every(k => de.indexOf("'" + k + "'") >= 0));
}

console.log('\n' + (fail ? '❌' : '✅') + ' profile_inputs_v14: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

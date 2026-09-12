/* ORVIA · S1/E5 (12.09.2026) — Zielwert lesbar + Countdown mit past-Zustand.
   Befund Produktionskonto: „Ziel: 6600 s" an vier Stellen, „noch 0 Wochen" eine Woche nach dem Rennen. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { existsSync as _exApp } from 'node:fs';
import { tStub, inlined } from './_i18n-src.mjs';
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const base = new URL(_APPREL + 'js/', import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

/* A · profile-model.formatGoalValue */
{
  const sb = { window: null }; sb.window = sb; sb.self = sb; sb.globalThis = sb; sb.console = console;
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('profile-model.js', base), 'utf8'), sb, { filename: 'profile-model.js' });
  const M = sb.ORVIA.profileModel;
  ok('A1 metricType time: 6600 s ⇒ 1:50:00 h', M.formatGoalValue({ metricType: 'time', unit: 's' }, 6600) === '1:50:00 h', M.formatGoalValue({ metricType: 'time', unit: 's' }, 6600));
  ok('A2 unit s ohne metricType ⇒ ebenfalls Zeit', M.formatGoalValue({ unit: 's' }, 2700) === '45:00 h');
  ok('A3 pace ⇒ min/km', M.formatGoalValue({ metricType: 'pace' }, 313) === '5:13 /km');
  ok('A4 Prozent unveraendert', M.formatGoalValue({ metricType: 'percent', unit: '%' }, 10) === '10 %');
  ok('A5 ohne Wert ⇒ leer (kein „null s")', M.formatGoalValue({ unit: 's' }, null) === '' && M.formatGoalValue({ unit: 's' }) === '');
  ok('A6 Standard: targetValue des Ziels', M.formatGoalValue({ metricType: 'time', targetValue: 3600 }) === '1:00:00 h');
}

/* B · Plan-Kopf + Profil-Zielkarte in ui.js: Countdown */
{
  const ui = readFileSync(new URL('ui.js', base), 'utf8');
  ok('B1 kein Math.max(0, …/7) Countdown mehr (Quelle von „noch 0 Wochen")', !/Math\.max\(0,Math\.ceil\(daysTo\(g\.raceDate\)\/7\)\)/.test(ui));
  ok('B2 Nicht-Lauf-Ziel im Plan-Kopf nutzt den Formatierer', /_goalValueFmt\(mg,mg\.targetValue\)/.test(ui));
  const src = ui.slice(ui.indexOf('function daysTo('), ui.indexOf('function _countdownText(')) + ui.slice(ui.indexOf('function _countdownText('), ui.indexOf('\n', ui.indexOf('function _countdownText(')) + 1);
  const sb = { _uiT: tStub().t, todayStr: () => '2026-09-12', Date, Math, String, Number, isNaN, window: null };
  sb.window = sb; vm.createContext(sb);
  vm.runInContext(src.replace(/^function _goalValueFmt[^\n]*\n/m, ''), sb);
  ok('B3 sechs Tage nach dem Rennen: „vor 6 Tagen"', sb._countdownText('2026-09-06') === 'vor 6 Tagen', sb._countdownText('2026-09-06'));
  ok('B4 Renntag: „heute"', sb._countdownText('2026-09-12') === 'heute');
  ok('B5 in 5 Tagen: Tage, in 30 Tagen: Wochen', sb._countdownText('2026-09-17') === 'noch 5 Tage' && sb._countdownText('2026-10-12') === 'noch 5 Wochen');
}

/* C · goal-detail nutzt den Formatierer (Rueckfall ohne profile-model bleibt) */
{
  const gd = readFileSync(new URL('goal-detail.js', base), 'utf8');
  ok('C1 targetText ueber fmtGoalValue, nicht Wert + Einheit', /m\.targetText = fmtGoalValue\(g, g\.targetValue\)/.test(gd) && !/m\.targetText = g\.targetValue \+/.test(gd));
  ok('C2 Fortschritt (value) ebenfalls', /m\.progress\.currentText = fmtGoalValue\(g, g\.currentValue\)/.test(gd));
}
/* D · profile.js: Editor-Zusammenfassung und Wizard-Liste */
{
  const pf = inlined(readFileSync(new URL('profile.js', base), 'utf8'));
  ok('D1 keine rohe targetValue-Ausgabe mehr in profile.js', !/escH\(''\+[dg]\.targetValue\)/.test(pf) && !/escH\(''\+[dg]\.currentValue\)/.test(pf));
  ok('D2 _goalValueLabel delegiert an profile-model', /M\.formatGoalValue==='function'\)return escH\(M\.formatGoalValue\(g,v\)\)/.test(pf));
}
console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

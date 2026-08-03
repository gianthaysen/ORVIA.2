/* ============================================================
   ORVIA · P3 — eine finale Tagesentscheidung, keine Widersprüche.
   Live-Konflikt-Fixture: Readiness 84 %, Krankheitssymptome aktiv,
   Kniebeschwerde niedrig, gute Schlafqualität → vorher „Guter Tag für
   Qualität" NEBEN „Belastung reduzieren". Verträge:
   - tipEngine: kein positiver Freigabe-Tipp bei illness ODER decisionState≠GREEN;
     stattdessen erklärender Tipp konsistent zur Entscheidung.
   - riskCard/recoveryDebt: Krankheit sichtbar, kein „wie geplant"-Text gegen SSoT.
   - GREEN + gesund + gute Werte → „Guter Tag für Qualität" bleibt möglich.
   - Legacy-Ampel als historische Einordnung gekennzeichnet.
   node supabase/tests/today_decision_p3_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../../app/js/', import.meta.url);

function makeIntel(opts) {
  opts = opts || {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb; sb.console = console;
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Object = Object; sb.Array = Array; sb.String = String; sb.Number = Number;
  sb.DB = { '2026-07-09': { morning: Object.assign({ sleepMin: 480, sleepQ: 8, rhr: 52, ill: !!opts.ill, knee: opts.knee != null ? opts.knee : 1 }, opts.morning || {}) } };
  sb.cur = '2026-07-09';
  sb.todayStr = () => '2026-07-09';
  sb.isDay = k => /^\d{4}-\d{2}-\d{2}$/.test(k);
  sb.recoveryCtx = () => ({ rhrBase: 52, hrvBase7: null, sleepDebtH: 0, hrvN: 14 });
  sb.readinessOf = () => (opts.ready != null ? opts.ready : 84);
  sb.activeModuleKeys = () => ['knee'];
  sb.issueScore = () => (opts.issue != null ? opts.issue : 1);
  sb.ORVIA_MODULES = { knee: { label: 'Knie' } };
  sb.weekRunKm = () => 20;
  sb.RACE = { date: '2026-10-01' };
  sb.daysTo = () => 84;
  sb.Calc = { weekKmTarget: () => 30 };
  sb.currentDecision = () => ({ state: opts.decision || 'GREEN' });
  sb.escH = s => String(s == null ? '' : s);
  sb.statusColorVar = () => '#fff';
  sb.document = { getElementById: () => null };
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('intelligence.js', base), 'utf8'), sb, { filename: 'intelligence.js' });
  return sb;
}

/* ---------- 1) Der Live-Konflikt: krank + Readiness 84 ---------- */
{
  const sb = makeIntel({ ill: true, ready: 84, issue: 1, decision: 'ORANGE' });
  const tips = sb.tipEngine();
  const titles = tips.map(t => t.title);
  ok('K1 KEIN „Guter Tag für Qualität" bei Krankheit', titles.indexOf('Guter Tag für Qualität') < 0, titles.join('|'));
  ok('K2 erklärender Krankheits-Tipp vorhanden', titles.some(t => /Krankheitssymptome/.test(t)));
  const topTip = tips[0];
  ok('K3 Krankheits-Tipp priorisiert (sev≥4) und verweist auf Tagesentscheidung', topTip && /Tagesentscheidung/.test(topTip.rec));
  const risk = sb.riskCard();
  ok('K4 riskCard nennt Krankheit als Grund', risk.why.some(w => /Krankheit/.test(w)));
  ok('K5 riskCard sagt nicht „wie geplant vertretbar"', !/wie geplant/.test(risk.rec));
  const debt = sb.recoveryDebt();
  ok('K6 recoveryDebt nennt Krankheit', debt.why.some(w => /Krankheit/.test(w)));
}

/* ---------- 2) Entscheidung ≠ GREEN ohne Krankheit ---------- */
{
  const sb = makeIntel({ ill: false, ready: 88, issue: 0, decision: 'ORANGE' });
  const tips = sb.tipEngine();
  const titles = tips.map(t => t.title);
  ok('D1 kein positiver Freigabe-Tipp bei ORANGE', titles.indexOf('Guter Tag für Qualität') < 0);
  ok('D2 Hinweis „Tagesentscheidung beachten"', titles.indexOf('Tagesentscheidung beachten') >= 0);
  const risk = sb.riskCard();
  ok('D3 riskCard verweist bei niedrigem Score auf die Entscheidung', /Tagesentscheidung \(ORANGE\)/.test(risk.rec), risk.rec);
}

/* ---------- 3) Gesund + GREEN: positiver Tipp bleibt möglich ---------- */
{
  const sb = makeIntel({ ill: false, ready: 88, issue: 0, decision: 'GREEN' });
  const tips = sb.tipEngine();
  ok('G1 „Guter Tag für Qualität" bei GREEN + gesund', tips.some(t => t.title === 'Guter Tag für Qualität'));
  const risk = sb.riskCard();
  ok('G2 riskCard darf „wie geplant" sagen', /wie geplant/.test(risk.rec));
}

/* ---------- 4) Beschwerde ≥3 blockt Freigabe auch ohne Krankheit ---------- */
{
  const sb = makeIntel({ ill: false, ready: 90, issue: 4, decision: 'GREEN' });
  const tips = sb.tipEngine();
  ok('B1 Beschwerde 4/10 verhindert Qualitäts-Freigabe', !tips.some(t => t.title === 'Guter Tag für Qualität'));
}

/* ---------- 5) Historische Ampel gekennzeichnet ---------- */
{
  const ui = readFileSync(new URL('ui.js', base), 'utf8');
  ok('H1 Ampel trägt Historien-Kennzeichnung', /Historische Einordnung dieses Tages/.test(ui));
  ok('H2 kein „Empfehlung heute" mehr in der Legacy-Ampel', !/Empfehlung heute:<\/b>/.test(ui.split('function renderAmpel')[1].split('\n}')[0]));
  const css = readFileSync(new URL('../styles.css', base), 'utf8');
  ok('H3 amp-hist-Stil vorhanden', /\.amp \.amp-hist/.test(css));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

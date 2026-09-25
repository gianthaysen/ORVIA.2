/* ============================================================
   ORVIA · goal_share_v14 — Zielanteil am Trainingsbudget auf der Zielkarte
   (Schnittplan v14, offene Entscheidung 2 — v8-406)
     A. collect() baut das Portfolio (goal-portfolio, rein) aus PROFILE/Zielen
     B. goalShare(): Spanne in %, Fokus-Kennzeichnung, null ohne Zuteilung
     C. goalsHTML: Anteil auf der Karte + Herkunftsnotiz statt Leerzustand
     D. ohne Portfolio-Modul: Leerzustand wie zuvor (kein Absturz)
   node supabase/tests/goal_share_v14_test.mjs
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { tStub } from './_i18n-src.mjs';
const APP = ['../../app/', '../../'].map(p => new URL(p, import.meta.url)).find(u => existsSync(new URL('js/screens/profile-v14.js', u)));
const src = f => readFileSync(new URL('js/' + f, APP), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
function mkSb(withPortfolio) {
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb; sb.console = console; sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Object = Object; sb.Array = Array; sb.String = String; sb.Number = Number; sb.isNaN = isNaN; sb.isFinite = isFinite; sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.RegExp = RegExp; sb.Error = Error; sb.Intl = Intl;
  sb.document = { getElementById: () => null };
  sb.ORVIA = { i18n: tStub() };
  vm.createContext(sb);
  ['training-domain.js', 'activity-config.js', 'profile-model.js'].concat(withPortfolio ? ['engine/goal-portfolio.js'] : []).concat(['screens/profile-v14.js']).forEach(f => vm.runInContext(src(f), sb, { filename: f }));
  const PM = sb.ORVIA.profileModel;
  const goals = PM.normalizeGoals([
    { id: 'g:hm', title: 'Halbmarathon', category: 'half_marathon', priority: 1, status: 'active', targetDate: '2026-12-18', metricType: 'time', targetValue: 6600, unit: 's' },
    { id: 'g:str', title: 'Stärker werden', category: 'get_stronger', priority: 2, status: 'active' }
  ], '2026-09-01T00:00:00.000Z');
  sb.PROFILE = { sports: [{ sportId: 'running', role: 'primary', activeInApp: true }, { sportId: 'gym', role: 'secondary', activeInApp: true }], goals: goals,
    availability: { days: { mo: { available: true }, di: { available: true }, mi: { available: false }, do: { available: true }, fr: { available: true }, sa: { available: true }, so: { available: true } } } };
  sb.listGoals = () => goals; sb.mainGoalOf = () => goals[0]; sb.todayStr = () => '2026-09-25';
  return sb;
}

{
  const sb = mkSb(true); const PV = sb.ORVIA.screens.profileV14;
  const d = PV.collect();
  ok('A1 Portfolio gebaut', !!d.portfolio && Array.isArray(d.portfolio.allocations) && d.portfolio.allocations.length === 2, JSON.stringify(d.portfolio && d.portfolio.missing));
  const s1 = PV.goalShare(d.goals[0], d), s2 = PV.goalShare(d.goals[1], d);
  ok('B1 Hauptziel: Spanne in %, Fokus', !!s1 && s1.max >= s1.min && s1.max <= 100 && /%/.test(s1.text) && s1.mode === 'focus' && /Fokus/.test(s1.text), JSON.stringify(s1));
  ok('B2 Nebenziel: Spanne, kleiner als Hauptziel-Obergrenze', !!s2 && s2.max <= s1.max, JSON.stringify(s2));
  ok('B3 Summe der Obergrenzen ≤ 100 % (Budget-Normalisierung)', s1.max + s2.max <= 100 + 1);
  ok('B4 unbekanntes Ziel ⇒ null', PV.goalShare({ id: 'nope' }, d) === null && PV.goalShare({ id: 'g:hm' }, { portfolio: null }) === null);
  const h = PV.goalsHTML(d);
  ok('C1 Anteil steht auf der Karte', /Anteil am Trainingsbudget/.test(h) && (h.match(/pv-share/g) || []).length === 2);
  ok('C2 Herkunftsnotiz (Rollenheuristik) statt Leerzustand', /Rollenheuristik/.test(h) && !/wird ausgewiesen, sobald/.test(h));
  ok('C3 kein roher Key', !/pv\.[a-z_]+/.test(h.replace(/onclick="[^"]*"/g, '')));
}
{
  const sb = mkSb(false); const PV = sb.ORVIA.screens.profileV14;
  const d = PV.collect();
  ok('D1 ohne Modul: kein Portfolio, kein Absturz', d.portfolio === null);
  const h = PV.goalsHTML(d);
  ok('D2 Leerzustand wie zuvor', /wird ausgewiesen, sobald/.test(h) && !/pv-share/.test(h));
}
console.log('\n' + (fail ? '❌' : '✅') + ' ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

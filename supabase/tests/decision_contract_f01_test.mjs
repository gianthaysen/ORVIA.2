/* ============================================================
   ORVIA · F01 (Metaanalyse 05.10.2026) — die Tagesentscheidung bindet ALLE
   Handlungstexte.

   Befund: Calc.buildTrainingDecision liefert `dayState`. intelCtx las `_d.state`
   und bekam IMMER null. tipEngine wertete null als Freigabe („Guter Tag für
   Qualität"), riskCard/recoveryDebt zeigten „Training wie geplant vertretbar" —
   live neben „Reduzieren empfohlen" auf dem Dashboard.

   Warum today_decision_p3_test das nicht fand: sein Stub lieferte `{state:…}` —
   er bildete den Tippfehler nach statt den echten Vertrag (CLAUDE.md §16.5).
   Dieser Test nimmt deshalb das ECHTE Objekt aus calc.js.

   Verträge:
   A  Vertrag: buildTrainingDecision trägt `dayState` (kein `state`).
   B  Integration: echtes YELLOW-Objekt → keine Qualitätsfreigabe, kein „wie geplant".
   C  Matrix GREEN/YELLOW/ORANGE/RED: jede Karte sagt dasselbe oder Konservativeres.
   D  Heute ohne Entscheidung (null, fremde Form, Legacy-`state`) → keine Freigabe.
   E  Vergangener Tag: die Entscheidung wird nicht abgefragt (Verhalten wie bisher).
   F  Neutrale Merkmale: riskScore/intelFeatures fragen die Entscheidung NIE ab —
      getDecision baut ohne Rückgriff auf sich selbst.
   G  Kein Roh-Enum (YELLOW/ORANGE/…) in Nutzertexten.
   node supabase/tests/decision_contract_f01_test.mjs
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
const _APPREL = existsSync(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const base = new URL(_APPREL + 'js/', import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

/* ---------- echte Engine ---------- */
const csb = { console }; csb.window = csb; csb.globalThis = csb; vm.createContext(csb);
vm.runInContext(readFileSync(new URL('calc.js', base), 'utf8') + '\n;globalThis.__Calc=Calc;', csb, { filename: 'calc.js' });
const Calc = csb.__Calc;
function realDecision(checkin, extra) {
  return Calc.buildTrainingDecision(Object.assign({
    checkin: Object.assign({ readiness: 85, illness: false, pain: 0, sleepH: 8, sleepQ: 8, feel: 8 }, checkin || {}),
    components: { recovery: 85, riskRaw: 5, loadFit: 90, execution: 80, progress: 80 },
    loads: { load3: 50, load7: 50, confidence: 'high', acuteAssessable: true },
    profile: {}, dataQuality: { confidence: 'hoch' },
    plannedToday: { label: 'Intervalle 6x800', kind: 'intervals' }, todayIndex: 0
  }, extra || {}));
}
/* Der Live-Fall der Prüfung: Erholung gut, Lastdaten lückenhaft → YELLOW. */
const DEC = {
  GREEN: realDecision(),
  YELLOW: realDecision({}, { loads: { load3: null, load7: null, confidence: 'not_assessable', acuteAssessable: false } }),
  ORANGE: realDecision({ pain: 4, painRegion: 'Knie' }),
  RED: realDecision({ fever: true })
};

/* ---------- intelligence.js in einer Sandbox ---------- */
const TODAY = '2026-10-05';
function makeIntel(opts) {
  opts = opts || {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb; sb.console = console;
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Object = Object; sb.Array = Array; sb.String = String; sb.Number = Number;
  const morning = Object.assign({ sleepMin: 480, sleepQ: 8, rhr: 52, ill: false }, opts.morning || {});
  sb.DB = {}; sb.DB[TODAY] = { morning }; sb.DB['2026-10-01'] = { morning };
  sb.cur = opts.cur || TODAY;
  sb.todayStr = () => TODAY;
  sb.isDay = k => /^\d{4}-\d{2}-\d{2}$/.test(k);
  sb.recoveryCtx = () => Object.assign({ rhrBase: 52, hrvBase7: null, sleepDebtH: 0, hrvN: 14 }, opts.rctx || {});
  sb.readinessOf = () => (opts.ready != null ? opts.ready : 88);
  sb.activeModuleKeys = () => ['knee'];
  sb.issueScore = () => (opts.issue != null ? opts.issue : 0);
  sb.ORVIA_MODULES = { knee: { label: 'Knie' } };
  sb.weekRunKm = () => 20;
  sb.RACE = { date: '2027-09-05' };
  sb.daysTo = () => 335;
  sb.Calc = { weekKmTarget: () => 30 };
  sb.__calls = 0;
  if (!opts.noDecisionFn) sb.currentDecision = () => { sb.__calls++; return ('decision' in opts) ? opts.decision : DEC.GREEN; };
  /* Die Wortliste lebt in ui.js (eine Quelle) — hier wie zur Laufzeit als Global. */
  sb.DECISION_WORD = { GREEN: 'Trainieren', YELLOW: 'Reduzieren', ORANGE: 'Ersetzen', RED: 'Pausieren' };
  sb.escH = s => String(s == null ? '' : s);
  sb.statusColorVar = () => '#fff';
  sb.document = { getElementById: () => null };
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('intelligence.js', base), 'utf8'), sb, { filename: 'intelligence.js' });
  return sb;
}
const QUALITY = 'Guter Tag für Qualität';
const RELEASE = /wie geplant|Normale Steuerung|Werte tragen/;
const titles = sb => sb.tipEngine().map(t => t.title);
const allText = sb => [].concat(sb.tipEngine().map(t => t.title + ' ' + t.reason + ' ' + t.rec), [sb.riskCard().rec, sb.recoveryDebt().rec]).join(' | ');

/* ---------- A · Vertrag ---------- */
['GREEN', 'YELLOW', 'ORANGE', 'RED'].forEach(k => {
  ok('A1 ' + k + ': echte Entscheidung trägt dayState=' + k, DEC[k] && DEC[k].dayState === k, DEC[k] && DEC[k].dayState);
});
ok('A2 die Entscheidung hat KEIN Feld `state` (der alte Lesefehler)', !('state' in DEC.YELLOW));
{
  const src = readFileSync(new URL('intelligence.js', base), 'utf8');
  ok('A3 intelligence.js liest dayState', /\.dayState\b/.test(src));
  ok('A4 intelligence.js liest nicht mehr `_d.state`', !/_d\.state\b/.test(src));
}

/* ---------- B · Integration mit dem echten YELLOW-Objekt ---------- */
{
  const sb = makeIntel({ decision: DEC.YELLOW, ready: 81 });
  const c = sb.intelCtx();
  ok('B1 intelCtx.decisionState = YELLOW', c.decisionState === 'YELLOW', String(c.decisionState));
  ok('B2 KEIN „Guter Tag für Qualität" bei YELLOW (Readiness 81, Schlaf gut)', titles(sb).indexOf(QUALITY) < 0, titles(sb).join('|'));
  ok('B3 Hinweis „Tagesentscheidung beachten" vorhanden', titles(sb).indexOf('Tagesentscheidung beachten') >= 0);
  ok('B4 riskCard sagt nicht „wie geplant vertretbar"', !RELEASE.test(sb.riskCard().rec), sb.riskCard().rec);
  ok('B5 recoveryDebt sagt nicht „Normale Steuerung möglich"', !RELEASE.test(sb.recoveryDebt().rec), sb.recoveryDebt().rec);
  ok('B6 riskCard nennt die Entscheidung beim deutschen Wort', /Reduzieren/.test(sb.riskCard().rec), sb.riskCard().rec);
}

/* ---------- C · Matrix: gleich oder konservativer ---------- */
['YELLOW', 'ORANGE', 'RED'].forEach(k => {
  const sb = makeIntel({ decision: DEC[k] });
  ok('C1 ' + k + ': keine Qualitätsfreigabe', titles(sb).indexOf(QUALITY) < 0);
  ok('C2 ' + k + ': kein Freigabe-Wortlaut in Risiko/Defizit', !RELEASE.test(sb.riskCard().rec) && !RELEASE.test(sb.recoveryDebt().rec));
});
{
  const sb = makeIntel({ decision: DEC.GREEN });
  ok('C3 GREEN + gesund: „Guter Tag für Qualität" bleibt möglich', titles(sb).indexOf(QUALITY) >= 0, titles(sb).join('|'));
  ok('C4 GREEN: riskCard darf „wie geplant" sagen', /wie geplant/.test(sb.riskCard().rec));
}
{
  /* Risiko moderat (Beschwerde 3 → Score 22): eigener Text erlaubt Intensität nach Warm-up.
     Gegen ORANGE („Ersetzen") wäre das die schwächere Aussage → Entscheidung gewinnt. */
  const sb = makeIntel({ decision: DEC.ORANGE, issue: 3 });
  const r = sb.riskCard();
  ok('C5 moderates Risiko + ORANGE: kein „Intensität nur nach Warm-up"', r.score >= 20 && r.score < 40 && !/Warm-up/.test(r.rec), r.score + ' · ' + r.rec);
}
{
  /* Risiko hoch (Beschwerde 5 → Score 40): eigener Text ist strenger als YELLOW → bleibt stehen. */
  const sb = makeIntel({ decision: DEC.YELLOW, issue: 5 });
  const r = sb.riskCard();
  ok('C6 hohes Risiko + YELLOW: strengerer Kartentext bleibt („Keine Intensität")', r.score >= 40 && /Keine Intensität/.test(r.rec), r.score + ' · ' + r.rec);
}

/* ---------- D · heute ohne verwertbare Entscheidung ---------- */
[['null', null], ['undefined', undefined], ['leeres Objekt', {}], ['Legacy {state:GREEN}', { state: 'GREEN' }], ['unbekannter Wert', { dayState: 'BLUE' }], ['Zahl', { dayState: 1 }]].forEach(([n, d]) => {
  const sb = makeIntel({ decision: d });
  ok('D1 ' + n + ': decisionState bleibt null', sb.intelCtx().decisionState === null, String(sb.intelCtx().decisionState));
  ok('D2 ' + n + ': keine Qualitätsfreigabe', titles(sb).indexOf(QUALITY) < 0, titles(sb).join('|'));
  ok('D3 ' + n + ': kein Freigabe-Wortlaut in Risiko/Defizit', !RELEASE.test(sb.riskCard().rec) && !RELEASE.test(sb.recoveryDebt().rec), sb.riskCard().rec + ' | ' + sb.recoveryDebt().rec);
});
{
  const sb = makeIntel({ noDecisionFn: true });
  ok('D4 currentDecision fehlt ganz: keine Qualitätsfreigabe', titles(sb).indexOf(QUALITY) < 0);
}
{
  const sb = makeIntel({ decision: DEC.GREEN });
  sb.currentDecision = () => { throw new Error('boom'); };
  ok('D5 currentDecision wirft: keine Qualitätsfreigabe, kein Absturz', titles(sb).indexOf(QUALITY) < 0);
}

/* ---------- E · vergangener Tag ---------- */
{
  const sb = makeIntel({ cur: '2026-10-01', decision: DEC.RED });
  const t = titles(sb);
  ok('E1 vergangener Tag: die heutige Entscheidung wird nicht abgefragt', sb.__calls === 0, 'Aufrufe=' + sb.__calls);
  ok('E2 vergangener Tag: historische Einordnung bleibt wie bisher', t.indexOf(QUALITY) >= 0 && t.indexOf('Tagesentscheidung beachten') < 0, t.join('|'));
}

/* ---------- F · neutrale Merkmale ---------- */
{
  const sb = makeIntel({ decision: DEC.ORANGE, issue: 3 });
  ok('F1 intelFeatures und riskScore existieren', typeof sb.intelFeatures === 'function' && typeof sb.riskScore === 'function');
  if (typeof sb.intelFeatures === 'function' && typeof sb.riskScore === 'function') {
    sb.__calls = 0;
    const f = sb.intelFeatures(), s = sb.riskScore(f);
    ok('F2 intelFeatures/riskScore fragen die Entscheidung nicht ab', sb.__calls === 0, 'Aufrufe=' + sb.__calls);
    ok('F3 intelFeatures trägt keinen Entscheidungszustand', !('decisionState' in f));
    ok('F4 riskScore liefert dieselbe Zahl wie riskCard', s.score === sb.riskCard().score, s.score + ' vs ' + sb.riskCard().score);
    const sG = makeIntel({ decision: DEC.GREEN, issue: 3 }), sR = makeIntel({ decision: DEC.RED, issue: 3 });
    ok('F5 Risiko-Score hängt nicht vom Entscheidungszustand ab', sG.riskCard().score === sR.riskCard().score && sG.recoveryDebt().score === sR.recoveryDebt().score);
  }
  const ui = readFileSync(new URL('ui.js', base), 'utf8');
  const gd = ui.split('function getDecision(){')[1].split('function currentDecision')[0];
  ok('F6 getDecision baut aus riskScore(intelFeatures()) — ohne Rückgriff auf sich selbst', /riskScore\(/.test(gd) && /intelFeatures\(/.test(gd));
}

/* ---------- G · kein Roh-Enum in Nutzertexten ---------- */
['YELLOW', 'ORANGE', 'RED'].forEach(k => {
  const txt = allText(makeIntel({ decision: DEC[k] }));
  ok('G1 ' + k + ': kein Roh-Enum im Text', !/\b(GREEN|YELLOW|ORANGE|RED)\b/.test(txt), txt.slice(0, 160));
});

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

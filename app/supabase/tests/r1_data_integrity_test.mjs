/* ============================================================
   ORVIA · R1 — Kritische Datenintegrität (Roadmap-Paket R1, Master-Matrix v8-183).
   (A) Live-Fremdsport behält sportId — NIE 'Gym'-Fallback (zentrale legacySessionKey).
   (B) Ziel-ID-Namespace kanonisch (half_marathon/run_5k/run_10k), Legacy lesbar.
   (C) Heutige Entscheidung nur Decision-SSoT; Calc.ampel = Historical-API.
   (D) Belastungsanzeigen über Calc.loadSeries/loadModel (keine Parallelrechnung).
   (E) Nutzermodus aus kanonischem Primärsport-Level; fehlend ⇒ nie Profi.
   node supabase/tests/r1_data_integrity_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../js/', import.meta.url);
const read = f => readFileSync(new URL(f, base), 'utf8');

function baseSandbox() {
  const sb = { window: null, console: { log() {}, warn() {}, error() {} } };
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object; sb.String = String; sb.Number = Number;
  sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN; sb.isFinite = isFinite; sb.Set = Set; sb.Intl = Intl;
  sb.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  sb.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ classList: { add() {}, remove() {} }, style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, remove() {} }), body: { appendChild() {} }, documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } } };
  sb.ORVIA = {};
  vm.createContext(sb);
  return sb;
}

/* ---------- (A) Sportidentität: zentrale legacySessionKey ---------- */
{
  const sb = baseSandbox();
  ['training-domain.js', 'onboarding/onboarding-sports-logic.js', 'activity-config.js'].forEach(f =>
    vm.runInContext(read(f), sb, { filename: f }));
  const AC = sb.ORVIA.activityConfig;
  ok('A1 legacySessionKey exportiert', AC && typeof AC.legacySessionKey === 'function');
  const K = x => (AC && AC.legacySessionKey) ? AC.legacySessionKey(x) : { key: null, sportId: null };
  ok('A2 football bleibt football (Label)', K('Fußball').sportId === 'football' && K('Fußball').key === 'Fußball', JSON.stringify(K('Fußball')));
  ok('A3 tennis bleibt tennis', K('Tennis').sportId === 'tennis' && K('Tennis').key === 'Tennis');
  ok('A4 padel bleibt padel', K('Padel').sportId === 'padel' && K('Padel').key === 'Padel');
  ok('A5 running → Legacy-Key Laufen', K('Laufen').key === 'Laufen' && K('Laufen').sportId === 'running');
  ok('A6 gym bleibt Gym (echtes Gym)', K('Gym').key === 'Gym' && K('Gym').sportId === 'gym');
  ok('A7 mobility → Mobilität', K('Mobility').key === 'Mobilität' && K('Mobility').sportId === 'mobility');
  ok('A8 hyrox behält Identität (nicht Gym)', K('HYROX').key !== 'Gym' && K('HYROX').sportId === 'hyrox', JSON.stringify(K('HYROX')));
  ok('A9 unbekannt → other, NIE gym', K('Weitere Aktivität').sportId === 'other' && K('Weitere Aktivität').key !== 'Gym');
  ok('A10 Custom-Name bleibt erhalten', K('Bouldern mit Max').key === 'Bouldern mit Max' && K('Bouldern mit Max').sportId === 'other');
  ok('A11 leer → neutraler Key, other', K('').key === 'Aktivität' && K('').sportId === 'other');
  ok('A12 kanonische ID direkt (basketball)', K('basketball').sportId === 'basketball' && K('basketball').key === 'Basketball');
}
{
  const wu = read('workout-ui.js');
  const _ri = wu.indexOf('function recordLiveToActivity');
  const rec = wu.slice(_ri, wu.indexOf('O.workoutUI.resume =', _ri));
  ok('A13 kein Gym-Fallback mehr in recordLiveToActivity', !/type\s*=\s*'Gym'/.test(rec) && !/!\(type in TYPES_OK\)/.test(rec), rec.slice(0, 120));
  ok('A14 zentrale Mapping-Funktion verdrahtet', /legacySessionKey/.test(rec));
  ok('A15 sportId wird verlustfrei mitgespeichert', /sportId/.test(rec));
  ok('A16 neuer Session-Key vor savePost-Löschung geschützt (activeTypes)', /activeTypes/.test(rec));
}

/* ---------- (B) Ziel-ID-Namespace ---------- */
{
  const sb = baseSandbox();
  vm.runInContext(read('profile-model.js'), sb, { filename: 'profile-model.js' });
  const M = sb.ORVIA.profileModel;
  ok('B1 canonGoalCategory exportiert', typeof M.canonGoalCategory === 'function');
  const C = typeof M.canonGoalCategory === 'function' ? M.canonGoalCategory : (() => null);
  ok('B2 halfmarathon → half_marathon', C('halfmarathon') === 'half_marathon');
  ok('B3 fast5k/fast10k → run_5k/run_10k', C('fast5k') === 'run_5k' && C('fast10k') === 'run_10k');
  ok('B4 kanonische IDs bleiben stabil', C('half_marathon') === 'half_marathon' && C('marathon') === 'marathon' && C('custom') === 'custom');
  const g1 = M.normalizeGoal({ id: 'g1', category: 'halfmarathon', title: 'HM', targetValue: '1:50:00', status: 'active' });
  ok('B5 normalizeGoal kanonisiert Legacy-Kategorie beim Lesen', g1.category === 'half_marathon', g1.category);
  ok('B6 Zeitmetrik-Inferenz greift für Legacy UND kanonisch', g1.metricType === 'time' && g1.unit === 's' && g1.targetValue === 6600);
  ok('B7 goalMetricTypeFor beide Namespaces', M.goalMetricTypeFor('half_marathon') === 'time' && M.goalMetricTypeFor('halfmarathon') === 'time' && M.goalMetricTypeFor('run_5k') === 'time');
  const g2 = M.normalizeGoal(g1);
  ok('B8 idempotent, KEINE Dublette (id stabil)', g2.id === 'g1' && g2.category === 'half_marathon' && g2.targetValue === 6600);
}
{
  // goalOf/isRaceGoal funktional (ui-Slices + profile-model)
  const ui = read('ui.js');
  const sb = baseSandbox();
  vm.runInContext(read('profile-model.js'), sb, { filename: 'profile-model.js' });
  const sGcat = ui.slice(ui.indexOf('function gcat'), ui.indexOf('function isRaceGoal'));
  const sRace = ui.slice(ui.indexOf('function isRaceGoal'), ui.indexOf('function generateWeekPlan'));
  const sGoal = ui.slice(ui.indexOf('const RACE_DIST'), ui.indexOf('function renderRaceHeader'));
  ok('B9 gcat-Helfer existiert in ui.js', sGcat.length > 10 && /canonGoalCategory/.test(sGcat));
  vm.runInContext(sGcat + '\n' + sRace + '\n' + sGoal, sb, { filename: 'ui-goal-slice.js' });
  sb.PROFILE = { goals: [{ id: 'g1', category: 'halfmarathon', status: 'active', priority: 1, metricType: 'time', targetValue: 6600, targetDate: '2026-10-04' }] };
  const g = sb.goalOf();
  ok('B10 goalOf erkennt Legacy-Kategorie als Race-Ziel', g.type === 'half_marathon' && g._canonicalId === 'g1', JSON.stringify(g));
  ok('B11 Zielzeit bleibt erhalten (110 min)', g.targetMin === 110 && Math.abs(g.distanceKm - 21.0975) < 0.001);
  ok('B12 isRaceGoal für kanonisch UND legacy', sb.isRaceGoal({ type: 'half_marathon', raceDate: '2026-10-04' }) === true && sb.isRaceGoal({ type: 'halfmarathon', raceDate: '2026-10-04' }) === true);
  ok('B13 isRunDistanceGoal beide Namespaces', sb.isRunDistanceGoal({ type: 'run_5k' }) === true && sb.isRunDistanceGoal({ type: 'fast5k' }) === true);
  sb.PROFILE = { goal: { type: 'fast10k', distanceKm: 10, raceDate: '', targetMin: 45 } };
  ok('B14 Legacy-Spiegel wird beim Lesen kanonisiert', sb.goalOf().type === 'run_10k');
  ok('B15 Editor schreibt NUR kanonische IDs', /\['run_5k'/.test(ui) && /\['half_marathon'/.test(ui) && !/\['fast5k','5 km'\]/.test(ui));
}

/* ---------- (C) Entscheidung: SSoT heute, Historical-API dokumentiert ---------- */
{
  const ui = read('ui.js');
  const cmd = ui.slice(ui.indexOf('function renderCommand'), ui.indexOf('function todayPrimaryUnit'));
  ok('C1 renderCommand ohne Calc.ampel (nur dayState-SSoT)', !/Calc\.ampel\(/.test(cmd));
  ok('C2 renderCommand fällt konservativ auf y zurück', /\|\|'y'/.test(cmd.replace(/\s/g, '')));
  const ug = ui.slice(ui.indexOf('function unitGuidance'), ui.indexOf('function avgSec'));
  ok('C3 unitGuidance nutzt getDecision statt eigener Ampel', /getDecision/.test(ug) && !/Calc\.ampel\(/.test(ug));
  const seg = ui.slice(ui.indexOf('function renderSegAusdauer'), ui.indexOf('function renderSegKraft') > 0 ? ui.indexOf('function renderSegKraft') : ui.indexOf('function renderSegAusdauer') + 2000);
  ok('C4 Nächster-Lauf-Empfehlung aus Decision-SSoT', /getDecision/.test(seg) && !/Calc\.ampel\(/.test(seg));
  const hist = ui.slice(ui.indexOf('function renderAmpel'), ui.indexOf('function renderAmpel') + 600);
  ok('C5 historische Anzeige bleibt (renderAmpel für Vergangenheit)', /Calc\.ampel\(/.test(hist) || /ampel/.test(hist));
  const calc = read('calc.js');
  ok('C6 Calc.ampel als HISTORICAL-API dokumentiert', /HISTORICAL/i.test(calc.slice(calc.indexOf('function ampel') - 600, calc.indexOf('function ampel'))));
  const ins = read('insights.js');
  ok('C7 insights-Rückblick als historisch markiert', /[Hh]istori/.test(ins.slice(0, ins.indexOf('Calc.ampel') + 50)));
}

/* ---------- (D) Belastung: loadSeries/loadModel als SSoT ---------- */
{
  const sb = baseSandbox();
  vm.runInContext(read('calc.js'), sb, { filename: 'calc.js' });
  const Calc = sb.Calc || (sb.window && sb.window.Calc);
  ok('D1 Calc.loadSeries exportiert', Calc && typeof Calc.loadSeries === 'function');
  const LS = (Calc && typeof Calc.loadSeries === 'function') ? Calc.loadSeries : (() => ({ atl: [], ctl: [], tsb: [] }));
  const loads28 = Array.from({ length: 28 }, (_, i) => (i % 7 === 6 ? 0 : 200 + (i % 5) * 40));
  const S = LS(loads28);
  ok('D2 Serienlängen = Eingabelänge', S.atl.length === 28 && S.ctl.length === 28 && S.tsb.length === 28);
  ok('D3 TSB-Serie = CTL−ATL (konsistent)', Math.abs(S.tsb[27] - +(S.ctl[27] - S.atl[27]).toFixed(1)) < 0.001);
  ok('D4 keine NaN/Infinity in Serien', [...S.atl, ...S.ctl, ...S.tsb].every(x => typeof x === 'number' && isFinite(x)));
  const lm = Calc.loadModel(loads28);
  ok('D5 loadModel liefert acute/chronic für die ACWR-Karte', lm && 'acute' in lm && 'chronic' in lm);
  ok('D6 loadModel-Endpunkte ≈ loadSeries-Endpunkte', lm && Math.abs(lm.atl - S.atl[27]) <= 0.5 && Math.abs(lm.ctl - S.ctl[27]) <= 0.5);
  ok('D7 <7 Datentage ⇒ null (keine erfundenen Kennzahlen)', Calc.loadModel([100, 100, 100]) === null);
  const flat = Calc.loadModel(Array(28).fill(300));
  ok('D8 SD=0 ⇒ Monotonie/Strain null, kein NaN', flat && flat.monotony === null && flat.strain === null);
  const ch = read('charts.js');
  ok('D9 drawForm nutzt Calc.loadSeries (keine Parallelrechnung)', /Calc\.loadSeries/.test(ch) && !/Calc\.ewma/.test(ch));
  const ui = read('ui.js');
  ok('D10 keine direkte Calc.acwr-Rechnung mehr in ui.js', !/Calc\.acwr\(/.test(ui));
  const card = ui.slice(ui.indexOf('function renderACWRCard'), ui.indexOf('function renderInsights'));
  ok('D11 ACWR-Karte über Calc.loadModel + Reliability', /Calc\.loadModel/.test(card) && /acwrReliable|enough/.test(card));
  const bg = ui.slice(ui.indexOf('function buildGoal'), ui.indexOf('function buildGoal') + 900);
  ok('D12 buildGoal-CTL aus Calc.loadSeries', /Calc\.loadSeries/.test(bg) && !/Calc\.ewma/.test(bg));
}

/* ---------- (E) Level/Nutzermodus ---------- */
{
  const sb = baseSandbox();
  vm.runInContext(read('profile-model.js'), sb, { filename: 'profile-model.js' });
  const M = sb.ORVIA.profileModel;
  ok('E1 normalizeLevelKey exportiert', typeof M.normalizeLevelKey === 'function');
  const N = typeof M.normalizeLevelKey === 'function' ? M.normalizeLevelKey : (() => 'FEHLT');
  ok('E2 en-Level kanonisch', N('beginner') === 'beginner' && N('intermediate') === 'intermediate' && N('advanced') === 'advanced' && N('competitive') === 'competitive');
  ok('E3 Legacy-de-Level normalisiert', N('anfaenger') === 'beginner' && N('fortgeschritten') === 'advanced' && N('profi') === 'competitive' && N('leistung') === 'competitive' && N('wiedereinstieg') === 'beginner');
  ok('E4 unbekannt ⇒ null (nie Profi)', N('quatsch') === null && N(null) === null);
  const PSL = typeof M.primarySportLevel === 'function' ? M.primarySportLevel : (() => 'FEHLT');
  ok('E5 primarySportLevel: Kit-Level schlägt Legacy-Feld', PSL({ level: 'fortgeschritten', sports: [{ sportId: 'running', role: 'primary', level: 'beginner' }] }) === 'beginner');
  ok('E6 ohne Kit: Legacy-Feld normalisiert', PSL({ level: 'profi', sports: [] }) === 'competitive');
  ok('E7 komplett fehlend ⇒ null (konservativ)', PSL({}) === null && PSL(null) === null);
  const wu = read('workout-ui.js');
  const ip = wu.slice(wu.indexOf('function isPro'), wu.indexOf('function fmtSet'));
  ok('E8 isPro aus kanonischem Level (advanced/competitive)', /primarySportLevel/.test(ip) && /advanced/.test(ip) && /competitive/.test(ip));
  ok('E9 isPro-Fehlerfall ⇒ false, nie Profi', /catch[^}]*return false/.test(ip.replace(/\n/g, ' ')) && !/return true;\s*\}\s*\}/.test(ip));
  ok('E10 kein Legacy-only PROFILE.level-Check mehr', !/PROFILE\.level\s*!==\s*'anfaenger'/.test(ip));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

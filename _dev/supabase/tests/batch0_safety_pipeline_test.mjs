/* ============================================================
   ORVIA · Batch 0 — Red-Flag-Safety-Pipeline (Vertrags-/Verhaltenstests)
   Schließt ENGINE-CONTRACT-AUDIT Befund 4 („Safety-Schicht dekorativ"):
   Erfassung (checkin-fields Registry + gatherMorning-Chips)
   → Persistenz (checkinRepository.toRow / checkin-store Hydration)
   → v1 (ui.js getDecision-Mapping + calc.js safetyCheck)
   → v2 (training-input-resolver.safetyFlagsFrom → decision-engine-v2)
   → Erklärung (Reason-Code red_flag_symptom).
   Methodik wie checkin_p6_preconditions_test: echte Funktionsblöcke in
   vm-Sandboxen, keine Stubs der geprüften Logik.
   node supabase/tests/batch0_safety_pipeline_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../../app/js/', import.meta.url);
const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');
const CODES = ['fever', 'chestPain', 'shortnessOfBreath', 'dizziness', 'neurologicalSymptoms', 'accidentPain', 'swelling', 'instability'];

function slice(src, startMarker, endMarker) {
  const s = src.indexOf(startMarker), e = src.indexOf(endMarker);
  if (s < 0 || e < 0 || e <= s) throw new Error('Funktionsgrenzen nicht gefunden: ' + startMarker + ' … ' + endMarker);
  return src.slice(s, e);
}

/* ---------- R: Registry-Vertrag (checkin-fields.js) ---------- */
{
  const sb = { window: {}, module: { exports: null } }; sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('checkin-fields.js', base), 'utf8'), sb, { filename: 'checkin-fields.js' });
  const REG = sb.ORVIA.checkinFields;
  const f = REG.byKey(REG.MORNING, 'redFlags');
  ok('R1 redFlags-Feld existiert in der Morning-Registry', !!f);
  ok('R2 kind=chipsMulti, el=m_redFlags, table=red_flags', !!f && f.kind === 'chipsMulti' && f.el === 'm_redFlags' && f.table === 'red_flags');
  const codes = f ? f.opts.map(l => f.optCodes[l]) : [];
  ok('R3 alle 8 kanonischen Codes gemappt (Label→Code vollständig)',
    codes.length === 8 && CODES.every(c => codes.indexOf(c) >= 0), JSON.stringify(codes));
  ok('R4 in BEIDEN Modi sichtbar (Safety hängt nicht am Check-in-Modus)',
    !!f && Array.isArray(f.modes) && f.modes.indexOf('full') >= 0 && f.modes.indexOf('quick') >= 0);
  ok('R5 kein Garmin-Auto-Fill (Warnzeichen = bewusste Angabe)', !!f && f.metricId == null);
}

/* ---------- G: gatherMorning (echter ui.js-Block) ---------- */
const gatherBlock = slice(uiSrc, 'function _sliderVal', 'function toggleAnkle');
function makeGather(opts) {
  opts = opts || {};
  const els = opts.els || {};
  const chipsSel = opts.chips || {};
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.Date = Date; sb.Number = Number; sb.Math = Math; sb.Object = Object; sb.Array = Array;
  sb.document = { getElementById: id => (id in els ? els[id] : null) };
  sb.v = id => { const e = sb.document.getElementById(id); return e ? e.value : ''; };
  sb.chipGet = id => chipsSel[id] || [];
  sb.numIn = () => null;
  sb.LIM = { rhr: [30, 120], bb: [0, 100], weight: [30, 250], hrvMs: [10, 200] };
  sb.entry = () => ({ morning: opts.prev || {} });
  sb.cur = '2026-07-18'; sb.todayStr = () => '2026-07-18';
  sb.ORVIA = {};
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('checkin-fields.js', base), 'utf8'), sb, { filename: 'checkin-fields.js' });
  vm.runInContext(gatherBlock, sb, { filename: 'ui.js#gatherMorning' });
  return sb;
}
{
  // G1: Chips ausgewählt ⇒ kanonische Codes im Objekt.
  const g1 = makeGather({ els: { m_ill: {}, m_redFlags: {} }, chips: { m_redFlags: ['Fieber', 'Schwindel/Ohnmacht'] } }).gatherMorning();
  ok('G1 Auswahl Fieber+Schwindel ⇒ {fever,dizziness}', !!g1.redFlags && g1.redFlags.fever === true && g1.redFlags.dizziness === true && Object.keys(g1.redFlags).length === 2, JSON.stringify(g1.redFlags));
  // G2: Element gerendert, nichts ausgewählt ⇒ {} (bewusst „keine Warnzeichen").
  const g2 = makeGather({ els: { m_ill: {}, m_redFlags: {} } }).gatherMorning();
  ok('G2 gerendert ohne Auswahl ⇒ leeres Objekt (kein null)', !!g2.redFlags && Object.keys(g2.redFlags).length === 0);
  // G3: Element NICHT gerendert ⇒ Vorwert bleibt erhalten (kein Datenverlust).
  const g3 = makeGather({ els: { m_ill: {} }, prev: { redFlags: { chestPain: true } } }).gatherMorning();
  ok('G3 nicht gerendert ⇒ Vorwert {chestPain} bleibt', !!g3.redFlags && g3.redFlags.chestPain === true);
  // G4: weder Element noch Vorwert ⇒ null (nicht erfasst, nichts erfunden).
  const g4 = makeGather({ els: { m_ill: {} } }).gatherMorning();
  ok('G4 nie erfasst ⇒ null', g4.redFlags === null);
}

/* ---------- H: Renderer stellt Auswahl aus Codes wieder her ---------- */
{
  const rendererBlock = slice(uiSrc, 'function _ciFieldHTML', 'function _ciFormHTML');
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.Object = Object; sb.Array = Array; sb.String = String;
  let captured = null;
  sb.chips = (label, id, opts, sel, multi) => { captured = { id, sel, multi }; return ''; };
  sb.esc = s => String(s == null ? '' : s);
  sb.slider = () => ''; sb.chipGet = () => [];
  sb._ciAutoMap = () => ({}); sb._ciManualMap = () => ({});
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('checkin-fields.js', base), 'utf8'), sb, { filename: 'checkin-fields.js' });
  vm.runInContext(rendererBlock, sb, { filename: 'ui.js#_ciFieldHTML' });
  const REG = sb.ORVIA.checkinFields;
  const f = REG.byKey(REG.MORNING, 'redFlags');
  sb._ciFieldHTML(f, { redFlags: { fever: true, instability: true } }, 'full');
  ok('H1 chipsMulti rendert multi=true mit wiederhergestellten Labels',
    !!captured && captured.multi === true && captured.sel.indexOf('Fieber') >= 0 && captured.sel.indexOf('Instabilität') >= 0 && captured.sel.length === 2, JSON.stringify(captured && captured.sel));
  captured = null;
  sb._ciFieldHTML(f, {}, 'quick');
  ok('H2 auch im Schnell-Modus gerendert (kein quick-Ersatzfeld nötig)', !!captured && captured.multi === true && captured.sel.length === 0);
}

/* ---------- P: Persistenz-Roundtrip (toRow → red_flags → Hydration) ---------- */
{
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Object = Object; sb.Array = Array; sb.JSON = JSON; sb.Number = Number; sb.String = String; sb.Math = Math;
  sb.isNaN = isNaN; sb.Promise = Promise;
  sb.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  sb.navigator = { onLine: true };
  sb.DB = {}; sb.todayStr = () => '2026-07-18';
  sb.ORVIA = { repos: {}, repoBase: {
    requireAuth: () => null, online: () => true, currentUserId: () => 'u1', sb: () => null, stampUser: r => r,
    ok: (d, x) => Object.assign({ success: true, data: d, error: null }, x || {}),
    fail: (c, m, x) => Object.assign({ success: false, data: null, error: { code: c, message: m } }, x || {}),
    upsert: async () => ({ success: true, data: null, error: null }),
    upsertMany: async () => ({ success: true, data: null, error: null })
  } };
  vm.createContext(sb);
  ['repos/checkinRepository.js', 'checkin-store.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  const toRow = sb.ORVIA.repos.checkin.toRow;
  const r1 = toRow('2026-07-18', 'morning', { ill: false, redFlags: { fever: true } });
  ok('P1 toRow sendet red_flags wenn belegt', !!r1.red_flags && r1.red_flags.fever === true);
  const r2 = toRow('2026-07-18', 'morning', { ill: false, redFlags: {} });
  ok('P2 leeres Objekt wird NICHT gesendet (0024-Kompatibilität, H3-Muster)', !('red_flags' in r2));
  const r3 = toRow('2026-07-18', 'morning', { ill: false });
  ok('P3 nicht erfasst ⇒ Spalte nicht gesendet', !('red_flags' in r3));
  const hydrated = sb.ORVIA.checkinStore.rowToCheckin({ illness: false, red_flags: { dizziness: true } });
  ok('P4 Hydration stellt morning.redFlags wieder her (Cross-Device)', !!hydrated.redFlags && hydrated.redFlags.dizziness === true);
  const noRf = sb.ORVIA.checkinStore.rowToCheckin({ illness: true });
  ok('P5 Zeile ohne red_flags ⇒ kein redFlags-Feld erfunden', noRf.redFlags === undefined);
}

/* ---------- V1: getDecision-Mapping + calc.js safetyCheck ---------- */
{
  ok('V1a getDecision liest Red Flags kanonisch aus morning.redFlags (mit Legacy-Fallback)',
    /fever:\(m\.redFlags&&m\.redFlags\.fever\)\|\|m\.fever/.test(uiSrc) &&
    /accidentPain:\(m\.redFlags&&m\.redFlags\.accidentPain\)\|\|m\.accidentPain/.test(uiSrc));
  const sb = { window: {}, console }; sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('calc.js', base), 'utf8'), sb, { filename: 'calc.js' });
  const sc = sb.Calc.safetyCheck || (sb.safetyCheck ? sb.safetyCheck : null);
  // safetyCheck ist über buildTrainingDecision erreichbar; direkter Export optional.
  if (sc) {
    const s1 = sc({ fever: true });
    ok('V1b safetyCheck: Fieber ⇒ level red', s1.level === 'red' && s1.redFlags.length === 1);
  } else {
    const d = sb.Calc.buildTrainingDecision({ checkin: { fever: true, readiness: 80, illness: false }, components: {}, loads: {}, profile: {}, dataQuality: {} });
    ok('V1b buildTrainingDecision: Fieber ⇒ RED + Safety ausgelöst', d.dayState === 'RED' && d.safety && d.safety.level === 'red', JSON.stringify({ state: d.dayState, level: d.safety && d.safety.level }));
  }
}

/* ---------- V2: Resolver → decision-engine-v2 (Kette + Erklärung) ---------- */
{
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object; sb.String = String; sb.Number = Number;
  sb.ORVIA = {};
  vm.createContext(sb);
  ['engine/engine-contracts.js', 'engine/readiness-engine-v2.js', 'engine/decision-engine-v2.js', 'engine/training-input-resolver.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  const R = sb.ORVIA.trainingInputResolver;
  ok('V2a RED_FLAG_KEYS = kanonische 8 Codes', JSON.stringify(R.RED_FLAG_KEYS) === JSON.stringify(CODES));
  const f1 = R.safetyFlagsFrom({ redFlags: { fever: true, swelling: true } });
  ok('V2b safetyFlagsFrom: redFlags-Objekt ⇒ sparse Flags', f1.fever === true && f1.swelling === true && Object.keys(f1).length === 2);
  const f2 = R.safetyFlagsFrom({ chestPain: true });
  ok('V2c Legacy-Direktfeld bleibt lesbar', f2.chestPain === true && Object.keys(f2).length === 1);
  ok('V2d ohne Angaben ⇒ leeres Objekt (nichts erfunden)', Object.keys(R.safetyFlagsFrom({})).length === 0 && Object.keys(R.safetyFlagsFrom(null)).length === 0);
  const input = R.buildDecisionInput({ morning: { ill: false, redFlags: { dizziness: true } } });
  ok('V2e buildDecisionInput befüllt safetyFlags (vorher hart {})', input.safetyFlags.dizziness === true);
  const dec = sb.ORVIA.decisionEngineV2.evaluate(input);
  ok('V2f Red Flag ⇒ RED + REST (Safety schlägt alles)', dec.dayState === 'RED' && dec.action === 'REST', JSON.stringify({ s: dec.dayState, a: dec.action }));
  ok('V2g Erklärung vorhanden (Reason-Code red_flag_symptom + Safeguard)',
    dec.reasons.some(r => r.code === 'red_flag_symptom') && dec.safeguards.length > 0);
  // Invariante: Red Flag darf durch optimistische Readiness NIE aufgeweicht werden.
  const dec2 = sb.ORVIA.decisionEngineV2.evaluate(R.buildDecisionInput({
    morning: { ill: false, redFlags: { chestPain: true } },
    readiness: { score: 95, confidence: 'high', warnings: [], missingData: [] }
  }));
  ok('V2h Red Flag + Readiness 95 ⇒ trotzdem RED', dec2.dayState === 'RED' && dec2.action === 'REST');
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

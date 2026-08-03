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
  /* ── GM6.3 (2026-07-27) — robuste Ermittlung der LIVE wirksamen renderCommand ──
     Der bisherige Anker
       ui.slice(ui.indexOf('function renderCommand'), ui.indexOf('function todayPrimaryUnit'))
     war aus zwei unabhaengigen Gruenden unzulaessig:
       (a) Er traf immer die ERSTE Deklaration. Bei mehreren gleichnamigen
           Top-Level-Funktionsdeklarationen gewinnt in JavaScript durch Hoisting
           aber die LETZTE; die frueheren sind toter Code. Bis GM6 wurden C1/C2
           deshalb nachweislich gegen eine tote Kopie geprueft.
       (b) Er hing an der Position einer FREMDEN Folgefunktion. Seit GM6 die tote
           Kopie entfernt hat, steht todayPrimaryUnit im Quelltext VOR
           renderCommand; slice(gross, klein) liefert einen LEEREN String und
           jede Negativ-Assertion wird vakuum-gruen.
     Ersatz: quelltextbewusster Scanner (Kommentare, Strings, Template-Literale und
     Regex-Literale werden maskiert), Auswahl der spaetesten wirksamen Deklaration
     unter ausdruecklichem Ausschluss einer noch spaeteren Zuweisung, danach
     vollstaendige Extraktion des Funktionskoerpers per Brace-Matching. Kein Bezug
     mehr auf irgendeine andere Funktion. */
  const gm63Mask = (src) => {
    /* 1 = Kommentar/String/Template-Text/Regex-Literal, also KEIN auswertbarer Code */
    const m = new Uint8Array(src.length);
    const KW = /(?:^|[^\w.$])(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;
    const tpl = [];
    let i = 0, lastSig = '', lastSigIdx = -1;
    const fill = (a, b) => { for (let k = a; k < b && k < src.length; k++) m[k] = 1; };
    while (i < src.length) {
      const c = src[i], d = src[i + 1];
      if (c === '/' && d === '/') { const j = src.indexOf('\n', i); const e = j < 0 ? src.length : j; fill(i, e); i = e; continue; }
      if (c === '/' && d === '*') { const j = src.indexOf('*/', i + 2); const e = j < 0 ? src.length : j + 2; fill(i, e); i = e; continue; }
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < src.length) { const q = src[j]; if (q === '\\') { j += 2; continue; } if (q === '\n') break; if (q === c) { j++; break; } j++; }
        fill(i, j); lastSig = c; lastSigIdx = j - 1; i = j; continue;
      }
      if (c === '`') {
        let j = i + 1; fill(i, i + 1);
        while (j < src.length) {
          const q = src[j];
          if (q === '\\') { fill(j, j + 2); j += 2; continue; }
          if (q === '`') { fill(j, j + 1); j++; break; }
          if (q === '$' && src[j + 1] === '{') { fill(j, j + 2); tpl.push(0); j += 2; break; }
          fill(j, j + 1); j++;
        }
        lastSig = '`'; lastSigIdx = j - 1; i = j; continue;
      }
      if (c === '}' && tpl.length) {
        if (tpl[tpl.length - 1] === 0) {
          tpl.pop(); fill(i, i + 1);
          let j = i + 1;
          while (j < src.length) {
            const q = src[j];
            if (q === '\\') { fill(j, j + 2); j += 2; continue; }
            if (q === '`') { fill(j, j + 1); j++; break; }
            if (q === '$' && src[j + 1] === '{') { fill(j, j + 2); tpl.push(0); j += 2; break; }
            fill(j, j + 1); j++;
          }
          lastSig = '`'; lastSigIdx = j - 1; i = j; continue;
        }
        tpl[tpl.length - 1]--;
      } else if (c === '{' && tpl.length) { tpl[tpl.length - 1]++; }
      if (c === '/') {
        const before = src.slice(Math.max(0, lastSigIdx - 12), lastSigIdx + 1);
        if (lastSigIdx < 0 || '(,=:[!&|?{};+-*%~^<>'.indexOf(lastSig) >= 0 || KW.test(before)) {
          let j = i + 1, cls = false, closed = false;
          while (j < src.length) {
            const q = src[j];
            if (q === '\\') { j += 2; continue; }
            if (q === '\n') break;
            if (cls) { if (q === ']') cls = false; j++; continue; }
            if (q === '[') { cls = true; j++; continue; }
            if (q === '/') { j++; closed = true; break; }
            j++;
          }
          if (closed) { while (j < src.length && /[a-z]/.test(src[j])) j++; fill(i, j); lastSig = '/'; lastSigIdx = j - 1; i = j; continue; }
        }
      }
      if (!/\s/.test(c)) { lastSig = c; lastSigIdx = i; }
      i++;
    }
    return m;
  };
  const gm63Code = gm63Mask(ui);
  const gm63InCode = (i) => gm63Code[i] === 0;
  const gm63Scan = (re) => { const out = []; let x; re.lastIndex = 0; while ((x = re.exec(ui))) { if (gm63InCode(x.index)) out.push(x.index); } return out; };
  const gm63Line = (i) => (i >= 0 ? ui.slice(0, i).split('\n').length : -1);

  /* Integritaet des Scanners: ueber die gesamte Datei muss die Klammerbilanz im
     Code exakt aufgehen und darf nie negativ werden. Ein desynchronisierter
     Scanner (z. B. ein als String fehlgedeutetes Regex-Literal) wuerde den
     Funktionskoerper still falsch schneiden — das muss ROT sein, nicht gruen. */
  let gm63Bal = 0, gm63Min = 0;
  for (let i = 0; i < ui.length; i++) {
    if (!gm63InCode(i)) continue;
    const ch = ui[i];
    if (ch === '{') gm63Bal++;
    else if (ch === '}') { gm63Bal--; if (gm63Bal < gm63Min) gm63Min = gm63Bal; }
  }

  const cmdDecls = gm63Scan(/\bfunction\s+renderCommand\s*\(/g);
  const cmdAssigns = gm63Scan(/(?:^|[^\w.$=!<>])(?:(?:var|let|const)\s+)?renderCommand\s*=(?!=)/gm)
    .concat(gm63Scan(/\.\s*renderCommand\s*=(?!=)/g));
  /* Hoisting: die spaeteste Deklaration ist die wirksame. Eine noch spaetere
     Zuweisung wuerde sie zur Laufzeit ueberschreiben (C0e). */
  const cmdAnchor = cmdDecls.length ? Math.max.apply(null, cmdDecls) : -1;
  const cmdOverrides = cmdAssigns.filter((p) => p > cmdAnchor);

  let cmd = '', cmdClosed = false, cmdEnd = -1;
  if (cmdAnchor >= 0) {
    const paren = ui.indexOf(')', cmdAnchor);
    const open = paren >= 0 ? ui.indexOf('{', paren) : -1;
    if (open >= 0) {
      let depth = 0;
      for (let i = open; i < ui.length; i++) {
        if (!gm63InCode(i)) continue;
        const ch = ui[i];
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) { cmd = ui.slice(cmdAnchor, i + 1); cmdClosed = true; cmdEnd = i; break; } }
      }
    }
  }

  /* ── GM6.3 §2 — harte Ankerpruefungen VOR den Fachpruefungen ──
     Ein leerer oder falsch verankerter Ausschnitt muss ausdruecklich ROT sein und
     darf die nachfolgenden Negativ-Assertions nicht vakuum-gruen machen. */
  ok('C0a renderCommand-Ausschnitt ist nicht leer', cmd.length > 0);
  ok('C0b Ausschnitt traegt die erwartete renderCommand-Signatur', /^function\s+renderCommand\s*\(\s*\)\s*\{/.test(cmd));
  ok('C0c Funktionskoerper per Brace-Matching vollstaendig geschlossen', cmdClosed === true && cmd.charAt(cmd.length - 1) === '}');
  ok('C0d Ausschnitt besitzt eine sinnvolle Mindestlaenge (>= 400 Zeichen)', cmd.length >= 400);
  ok('C0e geprueft wird die live wirksame Implementierung (spaeteste Deklaration, kein spaeterer Override)',
    cmdDecls.length >= 1 && cmdAnchor === Math.max.apply(null, cmdDecls) && cmdOverrides.length === 0);
  ok('C0f genau EINE renderCommand-Deklaration (keine Rueckkehr der toten Kopie)', cmdDecls.length === 1);
  ok('C0g Quelltext-Scanner synchron (Klammerbilanz der Datei geht auf)', gm63Bal === 0 && gm63Min === 0);
  console.log('     -> renderCommand: ' + cmdDecls.length + ' Deklaration(en) in Zeile ' + JSON.stringify(cmdDecls.map(gm63Line))
    + ', gewaehlt Zeile ' + gm63Line(cmdAnchor) + '-' + gm63Line(cmdEnd)
    + ', ' + cmd.length + ' Zeichen, spaetere Overrides: ' + cmdOverrides.length);

  ok('C1 renderCommand ohne Calc.ampel (nur dayState-SSoT)', !/Calc\.ampel\(/.test(cmd));
  /* ══════════════════════════════════════════════════════════════════════════
     C2 — konservativer Status-Fallback der LIVE wirksamen Dashboard-Kette
     ──────────────────────────────────────────────────────────────────────────
     Migration 2026-07-27 (Freigabe des Auftraggebers, GM6.3).
     Die frühere Fassung lautete
       ok('C2 renderCommand fällt konservativ auf y zurück', /\|\|'y'/.test(cmd…))
     und ist ersatzlos aufgehoben. Begründung, empirisch belegt: bis GM6.2 gab es
     ZWEI Deklarationen von renderCommand; durch Hoisting war die SPÄTERE (L3945,
     760 Zeichen) wirksam, das ||'y' stand ausschließlich in der TOTEN Kopie
     (L638, 3738 Zeichen). Der alte Anker traf per indexOf immer die tote Kopie.
     C2 hat also nie eine produktiv wirksame Eigenschaft geprüft.

     Die fachliche Invariante selbst bleibt bestehen und wird hier auf die heute
     wirksame Architektur gehoben:
       · renderCommand() delegiert an die aktive GM-Dashboard-Kette,
       · gmDashVM() besitzt für unbekannten/fehlenden Status einen konservativen
         Fallback,
       · dieser Fallback ist das aktuelle Designtoken 'attention',
       · ein unbekannter Status wird NIEMALS stillschweigend zu 'ready',
       · der Legacy-Fallback 'y' darf in der live geprüften Kette nicht
         wieder auftauchen.

     Prüfform: primär VERHALTENSBASIERT. Der Körper der live wirksamen
     gmDashVM wird aus dem Quelltext extrahiert und mit Fixtures in einem
     node:vm-Kontext tatsächlich AUSGEFÜHRT. Ein reiner String-Match wäre gegen
     genau den Fehler blind, der C2 elf Monate lang wertlos gemacht hat.
     ══════════════════════════════════════════════════════════════════════════ */
  const gm63Grab = (name) => {
    const decls = gm63Scan(new RegExp('\\bfunction\\s+' + name + '\\s*\\(', 'g'));
    const assigns = gm63Scan(new RegExp('(?:^|[^\\w.$=!<>])(?:(?:var|let|const)\\s+)?' + name + '\\s*=(?!=)', 'gm'))
      .concat(gm63Scan(new RegExp('\\.\\s*' + name + '\\s*=(?!=)', 'g')));
    const anchor = decls.length ? Math.max.apply(null, decls) : -1;
    const overrides = assigns.filter((p) => p > anchor);
    let body = '', closed = false, end = -1;
    if (anchor >= 0) {
      const paren = ui.indexOf(')', anchor);
      const open = paren >= 0 ? ui.indexOf('{', paren) : -1;
      if (open >= 0) {
        let depth = 0;
        for (let i = open; i < ui.length; i++) {
          if (!gm63InCode(i)) continue;
          const ch = ui[i];
          if (ch === '{') depth++;
          else if (ch === '}') { depth--; if (depth === 0) { body = ui.slice(anchor, i + 1); closed = true; end = i; break; } }
        }
      }
    }
    return { name, decls, anchor, end, body, closed, overrides };
  };

  const vmFn = gm63Grab('gmDashVM');
  console.log('     -> gmDashVM: ' + vmFn.decls.length + ' Deklaration(en) in Zeile ' + JSON.stringify(vmFn.decls.map(gm63Line))
    + ', gewaehlt Zeile ' + gm63Line(vmFn.anchor) + '-' + gm63Line(vmFn.end)
    + ', ' + vmFn.body.length + ' Zeichen, spaetere Overrides: ' + vmFn.overrides.length);

  /* --- C2a–C2c: der Ausschnitt muss die LIVE wirksame gmDashVM sein --- */
  ok('C2a gmDashVM-Ausschnitt nicht leer und mit erwarteter Signatur',
    vmFn.body.length > 0 && /^function\s+gmDashVM\s*\(\s*\)\s*\{/.test(vmFn.body));
  ok('C2b gmDashVM-Koerper per Brace-Matching vollstaendig geschlossen (>= 400 Zeichen)',
    vmFn.closed === true && vmFn.body.charAt(vmFn.body.length - 1) === '}' && vmFn.body.length >= 400);
  ok('C2c genau EINE gmDashVM-Deklaration, kein spaeterer Override (keine tote Kopie erfuellt den Test)',
    vmFn.decls.length === 1 && vmFn.overrides.length === 0);

  /* --- C2d: renderCommand delegiert nachweislich an genau diese Kette --- */
  ok('C2d renderCommand delegiert an die aktive GM-Dashboard-Kette (gmDashState + gmDashVM + gmHero)',
    /\bgmDashState\s*\(/.test(cmd) && /\bgmDashVM\s*\(/.test(cmd) && /\bgmHero\s*\(/.test(cmd));

  /* --- Verhaltensharness: die extrahierte LIVE-Funktion wird ausgefuehrt --- */
  const gm63RunVM = (osFixture) => {
    const sb = { console: { log() {}, warn() {}, error() {} } };
    sb.window = sb; sb.self = sb; sb.globalThis = sb;
    sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object;
    sb.String = String; sb.Number = Number; sb.Boolean = Boolean;
    vm.createContext(sb);
    sb.orviaScore = () => (typeof osFixture === 'function' ? osFixture() : osFixture);
    sb.todayStr = () => '2026-07-27';
    sb.DB = null;
    sb.gmMetric = () => null;
    sb.gmMoodKey = () => null;
    /* Kalibrierung: gmDashVM referenziert seit GM7.x weitere Block-Helfer — im Sandbox-
       Harness neutral gestubbt (Fixture-Muster wie gmMetric): fehlende Werte, keine Deltas,
       kein Konfidenz-VM. Die geprueften Statuspfade (statusColor/reco) bleiben unberuehrt. */
    sb.gmReadinessDeltas = () => null;
    sb.gmReadinessBreakdown = () => null;
    sb.gmConfVM = () => ({ levelLabel: null, levelColor: 'neutral', complete: null, sd: null, note: '', pct: null });
    sb.gmMetricSeries = () => null;
    sb.gmLoadContrib = () => null;
    sb.gmGoalLabel = () => null;
    sb.gmStandLbl = () => null;
    sb.getDecision = () => null;
    sb.gmEsc = (s) => String(s == null ? '' : s);
    sb.fmtDe = (n) => String(n);
    sb.GM_NA = '—';
    vm.runInContext(vmFn.body + '\n', sb, { filename: 'gmDashVM-live.js' });
    return sb.gmDashVM();
  };
  const gm63Color = (osFixture) => {
    try { return gm63RunVM(osFixture).statusColor; } catch (e) { return 'THREW:' + e.message; }
  };
  const gm63Reco = (osFixture) => {
    try { return gm63RunVM(osFixture).reco.cls; } catch (e) { return 'THREW:' + e.message; }
  };
  const FX = (c) => ({ score: 55, status: { c: c, l: 'Fixture' }, dayState: 'YELLOW' });

  /* --- C2e–C2h: gueltige Statuscodes bleiben erhalten --- */
  const cReady = gm63Color(FX('g')), cAtt = gm63Color(FX('y')), cAtt2 = gm63Color(FX('o')), cCrit = gm63Color(FX('r'));
  ok('C2e gueltiger Ready-Status bleibt Ready (g -> ready)', cReady === 'ready', String(cReady));
  ok('C2f gueltiger Attention-Status bleibt Attention (y -> attention)', cAtt === 'attention', String(cAtt));
  ok('C2g zweiter Attention-Status bleibt Attention (o -> attention)', cAtt2 === 'attention', String(cAtt2));
  ok('C2h gueltiger Critical-Status bleibt Critical (r -> crit)', cCrit === 'crit', String(cCrit));

  /* --- C2i–C2k: der konservative Fallback --- */
  const cUnknown = gm63Color(FX('zzz'));
  const cMissing = gm63Color({ score: 55, status: { l: 'ohne Code' }, dayState: 'YELLOW' });
  ok('C2i unbekannter Status ergibt Attention (nicht ready, nicht undefined)', cUnknown === 'attention', String(cUnknown));
  ok('C2j fehlender Status ergibt Attention', cMissing === 'attention', String(cMissing));
  const cNull = gm63Color(null), cUndef = gm63Color(undefined), cThrow = gm63Color(() => { throw new Error('fixture'); });
  ok('C2k null / undefined / Fehler ergeben den konservativen Zustand und nie ready',
    cNull === 'neutral' && cUndef === 'neutral' && cThrow === 'neutral'
    && gm63Reco(null) === 'attention' && gm63Reco(undefined) === 'attention',
    [cNull, cUndef, cThrow, gm63Reco(null)].join('/'));

  /* --- C2l: kein unbekannter Zustand darf jemals ready ergeben --- */
  const gm63Fuzz = ['', ' ', 'G', 'Y', 'O', 'R', 'x', 'zzz', 'ready', 'green', 'grün', '0', '1', 'true', 'null',
    'undefined', 'g ', ' g', 'gg', 'attention', 'crit', '#', 'y2', 'ampel'];
  const gm63Bad = gm63Fuzz.filter((c) => gm63Color(FX(c)) === 'ready');
  ok('C2l KEIN unbekannter Statuscode ergibt ready (' + gm63Fuzz.length + ' Varianten geprueft)',
    gm63Bad.length === 0, gm63Bad.join(','));
  const gm63NonAtt = gm63Fuzz.filter((c) => gm63Color(FX(c)) !== 'attention');
  ok('C2m alle unbekannten Statuscodes landen auf attention', gm63NonAtt.length === 0, gm63NonAtt.join(','));

  /* --- C2n–C2p: statische Absicherung gegen Legacy-Rueckkehr --- */
  ok('C2n aktive gmDashVM besitzt den Fallback attention', /\|\|\s*'attention'/.test(vmFn.body));
  ok('C2o aktive gmDashVM ohne Legacy-Fallback ||y', !/\|\|'y'/.test(vmFn.body.replace(/\s/g, '')));
  const gm63Chain = ['renderCommand', 'gmDashState', 'gmDashVM', 'gmHero', 'gmLevel'];
  const gm63ChainY = gm63Chain.filter((n) => /\|\|'y'/.test(gm63Grab(n).body.replace(/\s/g, '')));
  ok('C2p kein Legacy-Fallback ||y in der gesamten live geprueften Kette (' + gm63Chain.join(', ') + ')',
    gm63ChainY.length === 0, gm63ChainY.join(','));
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

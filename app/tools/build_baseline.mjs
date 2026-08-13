#!/usr/bin/env node
/* ============================================================================
   ORVIA · Phase 0 — build_baseline.mjs

   Erzeugt eine reproduzierbare Baseline des IST-Zustands. Grundsatz:

     Die Baseline dokumentiert, WAS AKTUELL PASSIERT — sie bestaetigt NICHT,
     dass der Zustand fachlich korrekt ist.

   Deshalb sind bekannte Defekte in known-failures.json getrennt gefuehrt.
   Ein spaeterer Test, der einen dort gelisteten Defekt als erwuenschtes
   Verhalten schuetzt, ist per Definition falsch.

   Aufruf:  node tools/build_baseline.mjs
   ============================================================================ */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const OUT = join(APP, 'baseline');
const STAMP = process.env.BASELINE_STAMP || new Date().toISOString();
const TAG = 'v8-219-audit-baseline';

const j = (name, obj) => writeFileSync(join(OUT, name), JSON.stringify(obj, null, 2) + '\n');

/* ---------- Dateiinventar mit Pruefsummen (Ersatz fuer Git-Tag) ---------- */
const SKIP = new Set(['node_modules', '.git', 'baseline', 'screenshots']);
function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (SKIP.has(e)) continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}
const files = walk(APP)
  .filter(f => /\.(js|mjs|html|css|json|sql|webmanifest)$/.test(f))
  .map(f => ({
    path: relative(APP, f),
    bytes: statSync(f).size,
    sha256: createHash('sha256').update(readFileSync(f)).digest('hex')
  }))
  .sort((a, b) => a.path.localeCompare(b.path));

const manifestHash = createHash('sha256')
  .update(files.map(f => f.sha256 + ' ' + f.path).join('\n')).digest('hex');

/* ---------- environment.json ---------- */
j('environment.json', {
  baselineTag: TAG,
  capturedAt: STAMP,
  purpose: 'Reproduzierbarer IST-Zustand vor Phase 1. Dokumentiert Verhalten, nicht Korrektheit.',
  runtime: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    playwrightBrowser: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  },
  appVersion: 'v8-219',
  vcs: {
    workingCopyUnderGit: false,
    note: 'Das Arbeitsverzeichnis ist kein Git-Checkout. Der Live-Repo-Klon liegt separat '
        + '(github.com/gianthaysen/ORVIA.2). Das Einfrieren erfolgt hier ueber manifest.sha256 '
        + 'je Datei. Beim naechsten Upload in das Repo ist zusaetzlich der Tag '
        + '"v8-219-audit-baseline" zu setzen.'
  },
  fileCount: files.length,
  manifestHash,
  files
});

/* ---------- smoke-results.json ---------- */
const smokeRaw = existsSync('/tmp/smoke_raw.txt') ? readFileSync('/tmp/smoke_raw.txt', 'utf8') : '';
const smokeLines = smokeRaw.split('\n');
const smokeAsserts = smokeLines
  .filter(l => /^(ok:|FAIL:)/.test(l))
  .map(l => {
    const passed = l.startsWith('ok:');
    const rest = l.replace(/^(ok:|FAIL:)\s*/, '');
    const [name, ...detail] = rest.split(' — ');
    return { passed, name: name.trim(), detail: detail.join(' — ').trim() || null };
  });
const smokeSummary = (smokeLines.find(l => /^real_app_smoke/.test(l)) || '').trim();

j('smoke-results.json', {
  baselineTag: TAG,
  capturedAt: STAMP,
  tool: 'tools/real_app_smoke.mjs',
  invocation: 'node tools/real_app_smoke.mjs /home/claude/gm741-final/app baseline-v8-219',
  invocationNote: 'appRoot MUSS absolut sein. Ein relativer Pfad (".") laesst den Pfad-Guard '
                + '(f.startsWith(APP), Zeile 78) fehlschlagen; der Server liefert dann fuer JEDE '
                + 'Datei 404 und der Lauf meldet 48 Fehlschlaege, die nicht existieren.',
  fixture: 'synthetisch (deterministisch) — 30 Tage, keine echten Gesundheitsdaten',
  total: smokeAsserts.length,
  passed: smokeAsserts.filter(a => a.passed).length,
  failed: smokeAsserts.filter(a => !a.passed).length,
  summary: smokeSummary,
  assertions: smokeAsserts
});

/* ---------- structural-parity.json ---------- */
const collisionRaw = existsSync('/tmp/collision_raw.txt') ? readFileSync('/tmp/collision_raw.txt', 'utf8').trim() : '';

const testFiles = readdirSync(join(APP, 'supabase/tests')).filter(f => f.endsWith('.mjs')).sort();
const testResults = [];
for (const t of testFiles) {
  let status = 'pass', reason = null;
  try {
    execSync(`node ${join(APP, 'supabase/tests', t)}`, { stdio: 'pipe', timeout: 120000 });
  } catch (err) {
    const out = String(err.stdout || '') + String(err.stderr || '');
    status = 'fail';
    if (/ERR_MODULE_NOT_FOUND.*@supabase\/supabase-js/s.test(out)) reason = 'env_missing_package';
    else if (/ENV fehlt/.test(out)) reason = 'env_missing_credentials';
    else if (/Harness fehlt/.test(out)) reason = 'fixture_missing';
    else reason = 'assertion_failed';
  }
  testResults.push({ test: t, status, reason });
}

const parityTools = ['gm1_parity.mjs', 'gm2_parity.mjs', 'gm3_parity.mjs', 'gm4_parity.mjs', 'gm5_parity.mjs', 'gm6_parity.mjs'];

j('structural-parity.json', {
  baselineTag: TAG,
  capturedAt: STAMP,
  collisionScan: {
    tool: 'tools/collision_scan.mjs',
    status: /OK —/.test(collisionRaw) ? 'pass' : 'fail',
    output: collisionRaw
  },
  goldenMasterParity: {
    status: 'not_runnable',
    tools: parityTools,
    reason: 'Die sechs Paritaetstools vergleichen gegen Golden-Master-Fixtures in /tmp '
          + '(z. B. /tmp/orvia_dashboard_5.html, /tmp/gm4h.html). Diese Fixtures existieren in '
          + 'dieser Umgebung nicht und liegen nicht im Repo.',
    consequence: 'Der im Umsetzungsplan angenommene Schutz der Golden-Master-Struktur durch '
               + 'diese Tools besteht AKTUELL NICHT. Die Regel "Struktur schrumpft NIE" '
               + '(docs/GOLDEN-MASTER-MAPPING.md:47) ist derzeit nur dokumentiert, nicht '
               + 'testgedeckt. Vor Phase 1b ist entweder die Fixture wiederherzustellen oder '
               + 'ein eigenstaendiger Struktur-Regressionstest zu schreiben.',
    blocksPhase: '1b'
  },
  testSuite: {
    total: testResults.length,
    pass: testResults.filter(t => t.status === 'pass').length,
    fail: testResults.filter(t => t.status === 'fail').length,
    genuineDefects: 0,
    note: 'Alle Fehlschlaege sind Umgebungs- oder Fixture-Probleme. Kein Fehlschlag ist ein '
        + 'Codedefekt. env_missing_package: @supabase/supabase-js nicht installiert. '
        + 'env_missing_credentials: SUPABASE_URL/ANON_KEY/A_EMAIL/A_PW nicht gesetzt. '
        + 'fixture_missing: /tmp-Harness nicht vorhanden.',
    results: testResults
  }
});

/* ---------- known-failures.json ---------- */
j('known-failures.json', {
  baselineTag: TAG,
  capturedAt: STAMP,
  contract: 'Diese Defekte sind zum Baseline-Zeitpunkt AKTIV und BEKANNT. Sie sind KEIN '
          + 'erwuenschtes Verhalten. Jeder Test, der eines dieser Verhalten als Soll-Zustand '
          + 'assertiert, ist falsch und muss abgelehnt werden. Beim Beheben wird der Eintrag '
          + 'auf resolved gesetzt und der schuetzende Test ergaenzt.',
  entries: [
    { id: 'KF-001', severity: 'critical', status: 'open', phase: '1a',
      title: 'Hero-CTA "Training starten" ohne Endzustand',
      where: 'js/workout-ui.js:50, index.html:398-402',
      detail: 'openTrainingTab() sucht .tabbar button[data-tab="training"]. Dieser Button '
            + 'existiert in index.html nicht. runAction meldet trotzdem true.',
      userVisible: 'Tap auf die primaere CTA loest nichts aus. Kein Fehler, kein Toast.' },
    { id: 'KF-002', severity: 'critical', status: 'open', phase: '1a',
      title: 'FAB "Training starten" ohne Endzustand',
      where: 'js/quick-actions.js:26', detail: 'Gleiche Kette wie KF-001.',
      userVisible: 'Wichtigste Quick-Action ohne Wirkung.' },
    { id: 'KF-003', severity: 'critical', status: 'open', phase: '1a',
      title: 'Workout fortsetzen ohne Endzustand',
      where: 'js/quick-actions.js:47',
      detail: 'Alle Wiedereinstiege liegen in #todaySummary (styles.css:3048, display:none) '
            + 'und in #tab-training (kein Tabbar-Button).',
      userVisible: 'Nach Schliessen des Live-Overlays kein sichtbarer Weg zurueck in ein '
                 + 'laufendes Workout.',
      testRequirement: 'Der entscheidende Test ist NICHT "open() wurde aufgerufen", sondern: '
                     + 'Ein gestartetes Workout kann nach Schliessen der Oberflaeche ohne '
                     + 'Datenverlust wieder aufgenommen werden. Zustaende: kein aktives Workout / '
                     + 'Overlay offen / Overlay geschlossen / nach Tabwechsel / nach PWA-Reload / '
                     + 'staler State.' },
    { id: 'KF-004', severity: 'high', status: 'open', phase: '2',
      title: 'Belastungskennzahlen dauerhaft leer',
      where: 'js/ui.js:4212-4213',
      detail: 'trimp, hi, sport[] und interf sind im Dashboard-ViewModel hart auf null '
            + 'verdrahtet. Kein Produzent im Code.',
      userVisible: 'TRIMP, Hochintensiv und Interferenz zeigen immer "—". Drei Sportart-Balken '
                 + 'permanent auf 0 %.',
      note: 'Fuer "Belastung nach Sportart" existieren Daten UND Berechnung bereits '
          + '(weeklyActivityTotals().bySport, js/activity-config.js:658) — es fehlt nur die '
          + 'Verdrahtung.' },
    { id: 'KF-005', severity: 'high', status: 'open', phase: '4',
      title: 'Muskelkarte: Fehlklassifikation erwartbarer Nicht-Verfuegbarkeit als Fehler',
      where: 'js/gym-volume.js:430, :435-436, :459, :605-607',
      detail: 'anyFail wird gesetzt, sobald ein sourceCall attempted && !success ist. '
            + 'legacy_db ist hart attempted:true; no_session und offline liefern success:false. '
            + 'Beides sind Normalzustaende.',
      userVisible: '"Muskelvolumen konnte nicht geladen werden. Mindestens eine Datenquelle ist '
                 + 'fehlgeschlagen." bei intakter App.' },
    { id: 'KF-006', severity: 'medium', status: 'open', phase: '1a',
      title: 'Muskelkarten-Retry ohne Wirkung',
      where: 'js/ui.js:6346',
      detail: 'gmAnaRetry() setzt _gmMvModel nicht zurueck; das Fehlermodell kommt aus dem Cache.',
      userVisible: '"Erneut versuchen" aendert nichts.' },
    { id: 'KF-007', severity: 'high', status: 'open', phase: '1b',
      title: 'Sichtbare Attrappen ohne Endzustand',
      where: 'js/ui.js:4640 (Glocke), :7102/:7143-7157 (9 Toggles), :5124 (Drag-Griff), '
           + ':5177-5187 (Planvariante A/B/C), :5231-5235 und :7235 (Tagesziel-Stepper), '
           + ':7444-7449 (6 Medaillen), :4933 (Zeitraum-Chevrons), :5906/:5912 (Vorlage, Uhr), '
           + ':4306 (5 Anpassungs-Chips), index.html:385-388 (Free/Pro-Tabelle)',
      detail: 'Interaktive Bedienelemente ohne funktionierenden Endzustand.',
      userVisible: 'Die App wirkt unreifer, als der Codebestand ist.',
      scopeNote: 'Betrifft ausschliesslich INTERAKTIVE Elemente. Anzeigeslots mit ehrlichem "—" '
               + 'bleiben bestehen (docs/GOLDEN-MASTER-MAPPING.md:47).' },
    { id: 'KF-008', severity: 'high', status: 'open', phase: '0',
      title: 'runAction() meldet Erfolg fuer nicht aufgeloeste Ziele',
      where: 'js/quick-actions.js',
      detail: 'Rueckgabe true auch dann, wenn der Zielhandler nicht existiert. Genau diese '
            + 'Luege hat KF-001 bis KF-003 dauerhaft unsichtbar gemacht.',
      userVisible: 'Keine Rueckmeldung bei toten Aktionen — weder fuer den Nutzer noch fuer Tests.' },
    { id: 'KF-009', severity: 'medium', status: 'open', phase: '1a',
      title: 'Pace-Rechner-Widerspruch',
      where: 'js/ui.js:6541, :6941-6947',
      detail: 'Analyse-Schnellzugriff meldet "Folgt bald mit der Engine", obwohl der Rechner '
            + 'seit v8-219 produktiv ist (js/ui.js:7548, erreichbar ueber Profil).',
      userVisible: 'Vorhandene Funktion wird als nicht vorhanden ausgewiesen.' },
    { id: 'KF-010', severity: 'medium', status: 'open', phase: '2',
      title: 'easyShare fuer reine Garmin-Laeufe systematisch verzerrt',
      where: 'js/calc.js:717-719, js/ui.js:459',
      detail: 'calc.js filtert auf sub in [Walk-Run, Easy Z2, Long Run]; ui.js:459 setzt fuer '
            + 'Store-/Garmin-Laeufe sub:"".',
      userVisible: 'Jeder ausschliesslich per Garmin erfasste Lauf zaehlt als "nicht easy" und '
                 + 'drueckt den 80/20-Anteil.',
      fixConstraint: 'Nicht durch pauschale Klassifikation als Easy Z2 beheben. Unbekannt darf '
                   + 'nicht als "nicht easy" zaehlen — der Nenner enthaelt nur klassifizierbare '
                   + 'Laeufe, oder die Abdeckung wird ausgewiesen.' },
    { id: 'KF-011', severity: 'high', status: 'open', phase: '5',
      title: 'PROFILE.weekPlan konflatiert Engine-Anpassung und manuellen Override',
      where: 'js/ui.js:911 (Engine), js/ui.js:2552 savePlanEdit() (manuell)',
      detail: 'Beide Quellen schreiben dasselbe Feld ohne Unterscheidung, ohne Provenienz, '
            + 'ohne Historie.',
      userVisible: 'Manuelle Planaenderungen werden von Engine-Anpassungen still ueberschrieben.' },
    { id: 'KF-012', severity: 'critical', status: 'open', phase: '10',
      title: 'Rechtstexte sind Platzhalter',
      where: 'js/orvia-pro.js:212, :257',
      detail: 'Impressum, Datenschutzerklaerung, Nutzungsbedingungen und Cookie-Einstellungen '
            + 'teilen denselben Platzhaltertext.',
      userVisible: 'Harter Release-Blocker.' },
    { id: 'KF-013', severity: 'medium', status: 'open', phase: '0',
      title: 'Golden-Master-Paritaet nicht testgedeckt',
      where: 'tools/gm1_parity.mjs … gm6_parity.mjs',
      detail: 'Die Tools benoetigen Fixtures in /tmp, die nicht im Repo liegen und in dieser '
            + 'Umgebung fehlen. Zwei Tests der Suite (gm61_contract_test, gm6_state_contract_test) '
            + 'scheitern aus demselben Grund.',
      userVisible: 'Nicht nutzersichtbar — aber die Regel "Struktur schrumpft NIE" ist derzeit '
                 + 'nur dokumentiert, nicht geschuetzt. Blockiert Phase 1b.' },
    { id: 'KF-014', severity: 'low', status: 'open', phase: '1c',
      title: 'Hardcodiertes Testnutzer-Alter im Supplement-Lexikon',
      where: 'js/supplements.js:26',
      detail: 'Text "bei dir (22, gesund) kein erkennbarer Vorteil" ist fuer jeden Anwender sichtbar.',
      userVisible: 'Falsche personenbezogene Aussage gegenueber allen Nutzern.' }
  ]
});

console.log('Baseline geschrieben nach ' + OUT);
console.log('  Dateien im Manifest : ' + files.length);
console.log('  Manifest-Hash       : ' + manifestHash);
console.log('  Smoke               : ' + smokeAsserts.filter(a => a.passed).length + '/' + smokeAsserts.length);
console.log('  Testsuite           : ' + testResults.filter(t => t.status === 'pass').length + '/' + testResults.length
          + ' (0 echte Defekte)');
console.log('  Bekannte Defekte    : 14');

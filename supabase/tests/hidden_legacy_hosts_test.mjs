/* ORVIA · Phase 0 — Inventar der versteckten Legacy-Hosts.

   Beim Umbau auf die GM-Oberflaeche wurden die Legacy-DOM-Baeume per CSS
   ausgeblendet, ohne fuer jedes Feature einen Ersatzpfad zu schaffen. Rund
   ein Dutzend vollstaendig implementierter Funktionen ist dadurch fuer den
   Nutzer nicht mehr auffindbar (Gap-Analyse Kapitel 5).

   Dieser Test BEWERTET NICHT — er DOKUMENTIERT. Sein Zweck:

     Beim Wiederanbinden in Phase 3 darf nichts still verloren gehen.

   Er faellt deshalb genau dann, wenn ein versteckter Host ODER sein Renderer
   verschwindet, ohne dass das Inventar bewusst nachgezogen wurde. Ein Host,
   der in Phase 3 wieder sichtbar wird, ist KEIN Fehler — dann wird sein
   Eintrag auf reconnected gesetzt.

   Rein statisch: kein Browser, kein /tmp, keine Fixture.

   node supabase/tests/hidden_legacy_hosts_test.mjs */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/* Zwei Checkout-Layouts: Cloud (App unter ../../) und Geraet (App unter ../../../app). */
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const css = readFileSync(join(APP, 'styles.css'), 'utf8');
const html = readFileSync(join(APP, 'index.html'), 'utf8');
const jsDir = join(APP, 'js');
function allJs(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) allJs(join(dir, e.name), acc);
    else if (e.name.endsWith('.js')) acc.push(join(dir, e.name));
  }
  return acc;
}
const jsFiles = allJs(jsDir);
const jsBlob = jsFiles.map(f => readFileSync(f, 'utf8')).join('\n');

/* ---------- Inventar: versteckter Host -> zugehoeriges Feature ----------
   status: 'hidden'      — ausgeblendet, kein GM-Ersatzpfad (Phase 3)
           'replaced'    — ausgeblendet, GM-Ersatz existiert (kein Handlungsbedarf)
   Quelle: docs/GAP-ANALYSE-2026-08.md Kapitel 5 + baseline/known-failures.json */
const INVENTORY = [
  { host: 'extraCheckin',  feature: 'Live-/Pre-/Post-Check-in', renderer: 'js/checkin-extra.js',
    status: 'hidden', phase: 3, behaviourChanging: true,
    note: 'Schreibt DB[date].live|pre|post und fliesst in buildTrainingDecision() ein. '
        + 'Reaktivierung ist eine VERHALTENSAENDERUNG, kein Navigationsfix.'
        + ' E-21 (2026-08-05): BEWUSST zurueckgestellt — zuerst die Garmin-basierte'
        + ' Vor-Start-Anzeige (Body Battery/Stress/Readiness im Start-Sheet); die App'
        + ' stellt keine Fragen, deren Antwort bereits gemessen vorliegt.' },
  { host: 'nutritionBox',  feature: 'Ernaehrung / Energieverfuegbarkeit', renderer: 'js/nutrition.js',
    status: 'reconnected', phase: 3, behaviourChanging: false, flag: 'nutrition',
    note: 'Phase 3 (2026-08-05, E-23): Karte auf Heute reaktiviert (.p3-live), Konfiguration kontextuell aus der Karte (openNutritionEditor).' },
  { host: 'routinesCard',  feature: 'Routinen & Supplements', renderer: 'js/ui.js',
    status: 'reconnected', phase: 3, behaviourChanging: false, flag: 'routines',
    note: 'Phase 3 (2026-08-05, E-22): generalisiert — PROFILE.routinesCustom + Editor (gmOpenRoutinesEditor); Ein-Nutzer-Hardcodes (Spanish-Squats-Feld) nur noch bei aktiver Routine.' },
  { host: 'eveCard',       feature: 'Abend-Check-in', renderer: 'js/ui.js',
    status: 'reconnected', phase: 3, behaviourChanging: false, flag: 'eveCheckin',
    note: 'Phase 3 (2026-08-05, E-24): kontextuell ab 17 Uhr sichtbar (gmEveVisible), Statuskopf erledigt/offen.' },
  { host: 'insights',      feature: 'Tip-Engine (Was ORVIA daraus macht)', renderer: 'js/intelligence.js',
    status: 'replaced', phase: null, behaviourChanging: false,
    note: 'Phase 3 (2026-08-05, E-25): tipEngine() speist jetzt die GM4-Insight-Slots (gmAnaOverview, Flag anaTips) — der Heute-Host bleibt aus (kein Doppelweg).' },
  { host: 'todaySummary',  feature: 'Heutige Aktivitaet / Workout fortsetzen', renderer: 'js/workout-ui.js',
    status: 'replaced', phase: null, behaviourChanging: false,
    note: 'P0 2026-08-05: sichtbarer Ersatz #resumeBanner auf Heute (renderResumeBanner) + Boot-Hydrierung. Kein Doppelweg: todaySummary bleibt aus.' },
  { host: 'readyOut',      feature: 'Readiness-Ausgabe (Legacy)', renderer: 'js/ui.js',
    status: 'hidden', phase: 1, behaviourChanging: false,
    note: 'Renderer laeuft ins Leere; in Phase 1c zu entfernen.' },
  { host: 'ampelOut',      feature: 'Ampel (Legacy)', renderer: 'js/ui.js',
    status: 'hidden', phase: 1, behaviourChanging: false,
    note: 'Renderer laeuft ins Leere; in Phase 1c zu entfernen.' },
  { host: 'topbar',        feature: 'Legacy-Kopfleiste', renderer: 'index.html',
    status: 'replaced', phase: null, behaviourChanging: false,
    note: 'Durch die GM-Kopfleiste ersetzt.' }
];

/* ---------- 1) Jeder inventarisierte Host ist tatsaechlich ausgeblendet ---------- */
const hideRules = css.split('\n').filter(l => /display\s*:\s*none/.test(l)).join('\n');
for (const e of INVENTORY) {
  const hiddenInCss = new RegExp('#' + e.host + '\\b').test(hideRules);
  if (e.status === 'reconnected') {
    /* Phase 3: Grundzustand bleibt versteckt (Flag-Rollback!), der Renderer setzt
       .p3-live kontextuell. Vertrag: Unhide-Regel + Flag existieren. */
    ok('reaktiviert mit Flag-Rollback: #' + e.host,
       hiddenInCss && new RegExp('#' + e.host + '\\.p3-live').test(css) && typeof e.flag === 'string',
       e.feature + ' · Flag ' + e.flag);
  } else {
    ok('ausgeblendet laut styles.css: #' + e.host, hiddenInCss, e.feature);
  }
}

/* ---------- 2) Host existiert weiterhin im DOM (sonst ist das Feature weg) ---------- */
for (const e of INVENTORY) {
  const inHtml = html.indexOf('id="' + e.host + '"') >= 0;
  const inJs = new RegExp("getElementById\\('" + e.host + "'\\)|getElementById\\(\"" + e.host + "\"\\)").test(jsBlob);
  ok('Host vorhanden: #' + e.host, inHtml || inJs, inHtml ? 'index.html' : 'dynamisch in js/');
}

/* ---------- 3) Der zugehoerige Renderer existiert noch ---------- */
for (const e of INVENTORY) {
  ok('Renderer vorhanden: ' + e.renderer + ' (' + e.feature + ')', existsSync(join(APP, e.renderer)));
}

/* ---------- 4) Vertragsaussagen ueber das Inventar selbst ---------- */
const hidden = INVENTORY.filter(e => e.status === 'hidden');
const replaced = INVENTORY.filter(e => e.status === 'replaced');
const reconnected = INVENTORY.filter(e => e.status === 'reconnected');
ok('Inventar unterscheidet ausgeblendet / ersetzt / reaktiviert',
   hidden.length > 0 && replaced.length > 0 && reconnected.length > 0,
   hidden.length + ' ohne Ersatz · ' + replaced.length + ' ersetzt · ' + reconnected.length + ' reaktiviert');
/* Phase 3: jede Reaktivierung hat einen kontextuellen Einstieg im Code. */
const ENTRY = { routinesCard: 'gmOpenRoutinesEditor', eveCard: 'gmEveVisible', nutritionBox: 'openNutritionEditor' };
for (const e of reconnected) {
  ok('kontextueller Einstieg verdrahtet: #' + e.host + ' → ' + ENTRY[e.host],
     ENTRY[e.host] && jsBlob.indexOf(ENTRY[e.host]) >= 0);
}
ok('jeder Eintrag ohne Ersatz hat eine zugeordnete Phase',
   hidden.every(e => Number.isInteger(e.phase)));
ok('verhaltenswirksame Reaktivierung ist markiert (nicht als Navigationsfix behandelt)',
   INVENTORY.some(e => e.behaviourChanging === true),
   INVENTORY.filter(e => e.behaviourChanging).map(e => '#' + e.host).join(', '));

/* ---------- 5) Der verhaltenswirksame Fall ist im Entscheidungspfad belegbar ---------- */
const decisionSrc = readFileSync(join(APP, 'js', 'calc.js'), 'utf8');
const extraSrc = readFileSync(join(APP, 'js', 'checkin-extra.js'), 'utf8');
ok('Beleg: checkin-extra schreibt in den Tagesspeicher',
   /\.(live|pre|post)\b/.test(extraSrc));
ok('Beleg: die Tagesentscheidung existiert als eigener Vertrag (buildTrainingDecision)',
   /function\s+buildTrainingDecision/.test(decisionSrc));

console.log('\nVersteckte Legacy-Hosts: ' + hidden.length + ' ohne GM-Ersatzpfad, '
          + replaced.length + ' ersetzt, ' + reconnected.length + ' in Phase 3 reaktiviert.');
console.log('hidden_legacy_hosts: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);

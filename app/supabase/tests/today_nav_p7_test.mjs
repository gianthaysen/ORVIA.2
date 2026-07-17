/* ============================================================
   ORVIA · P7 — Navigation + Routinen-Kuration.
   Verträge:
   - CSS: KEINE permanente tab-train-Hervorhebung mehr (Ring/Gold nur .on);
     .nav-plus bleibt einzige Dauer-Sonderaktion.
   - Routinen: Roll-up openRoutineTasks (pur nachvollziehbar), Karte nur bei
     offenen Aufgaben heute (Vergangenheit nur mit Bestandseinträgen),
     „x offen"-Badge, ssRepsIn-Guard.
   node supabase/tests/today_nav_p7_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../js/', import.meta.url);

/* ---------- 1) CSS-Verträge Bottom-Nav ---------- */
{
  const css = readFileSync(new URL('../styles.css', base), 'utf8');
  /* Produktentscheidung 2026-07-16 (Owner): KEINE Sonderoptik für den Training-Tab mehr —
     der Ring um die aktive Hantel ist entfernt, alle Tabs nutzen den Standard-.on-Zustand. */
  ok('N1 kein tab-train-Ring mehr (weder permanent noch .on)', !/\.tab-train(\.on)?::before/.test(css));
  ok('N2 keine permanente Gold-Icon-Regel (.tab-train .ic ohne .on)', !/\.tabbar button\.tab-train \.ic\{/.test(css));
  ok('N3 keine tab-train-Sonderregel für den aktiven Zustand (Standard .on gilt)', !/\.tabbar button\.tab-train\.on \.ic\{/.test(css));
  ok('N4 .nav-plus bleibt Sonderaktion (Gold-Verlauf)', /\.tabbar button\.nav-plus\{[^}]*linear-gradient/.test(css));
  ok('N5 Badge-Stil vorhanden (leer ⇒ unsichtbar)', /\.acc-badge:empty\{display:none\}/.test(css));
}

/* ---------- 2) Routinen-Kuration ---------- */
{
  const ui = readFileSync(new URL('ui.js', base), 'utf8');
  const rr = ui.split('function renderRoutines')[1].split('function toggleRoutine')[0];
  ok('R1 Roll-up-Funktion openRoutineTasks existiert', /function openRoutineTasks/.test(ui));
  ok('R2 Roll-up zählt offene Routinen UND ungenommene Empfehlungen', /activeRoutines\(\)\.filter/.test(ui.split('function openRoutineTasks')[1].slice(0, 400)) && /suppRecs/.test(ui.split('function openRoutineTasks')[1].slice(0, 400)));
  ok('R3 Karte nur bei offenen Aufgaben heute sichtbar', /routinesCard/.test(rr) && /open>0/.test(rr));
  ok('R4 Vergangenheit nur mit Bestandseinträgen', /hasHist/.test(rr));
  ok('R5 Badge „x offen"', /routinesOpenBadge/.test(rr) && /offen/.test(rr));
  ok('R6 ssRepsIn mit Null-Guard', /const ss=document\.getElementById\('ssRepsIn'\);if\(ss\)/.test(rr));
  ok('R7 routineChips mit Null-Guard', /const chips=document\.getElementById\('routineChips'\);\s*if\(chips\)/.test(rr));
  const html = readFileSync(new URL('../index.html', base), 'utf8');
  ok('R8 Karte + Badge im Markup', /id="routinesCard"/.test(html) && /id="routinesOpenBadge"/.test(html));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

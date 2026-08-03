/* ============================================================
   ORVIA · P7 — Navigation + Routinen-Kuration.
   Verträge:
   - CSS: KEINE permanente tab-train-Hervorhebung mehr (Ring/Gold nur .on);
     der Plus-Button bleibt einzige Dauer-Sonderaktion (seit Shell-v3/GM7 als
     `#navPlus.fab` außerhalb der Bar, nicht mehr als `.tabbar button.nav-plus`).
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
  /* GM7 (Legacy-Deaktivierung + Gesamtabgleich): Seit der Shell-v3-Migration liegt der
     Plus-Button als `#navPlus.fab` AUSSERHALB der Tabbar; die Klasse `nav-plus` kommt im
     gesamten Laufzeitcode nicht mehr vor, die Regel `.tabbar button.nav-plus` konnte also
     kein Element mehr treffen und wurde in GM7 als toter Bestand entfernt. Die Invariante
     „der Plus-Button ist die einzige goldene Dauer-Sonderaktion der Bottom-Nav" bleibt
     unverändert in Kraft und wird auf das wirksame Element gedreht — geprüft werden jetzt
     DREI Bedingungen statt einer: der FAB trägt den Gold-Verlauf, das Token ist wirklich
     ein linear-gradient, und kein Tab-Button trägt einen Dauer-Gold-Verlauf. */
  const _n4Fab   = /\.fab\{[^}]*background:var\(--gold-grad\)/.test(css);
  const _n4Token = /--gold-grad:\s*linear-gradient/.test(css);
  const _n4Solo  = !/\.tabbar button(?!\.on)[^{,]*\{[^}]*linear-gradient/.test(css);
  ok('N4 Plus-Button bleibt einzige goldene Dauer-Sonderaktion (#navPlus.fab)',
     _n4Fab && _n4Token && _n4Solo,
     'fab-gold=' + _n4Fab + ' token=' + _n4Token + ' solo=' + _n4Solo);
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

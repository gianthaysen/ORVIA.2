/* ORVIA · VORFALL 2026-08-16 — Toast-Sichtbarkeitsvertrag (statischer CSS-Test).
   Root Cause des Befunds „Übung hinzufügen tut nichts, ohne Fehlermeldung":
   .toast lag auf z-index 99, das Vollbild-Overlay des Live-Workouts
   (.wo-overlay) auf 9000 MIT deckendem Hintergrund. Jede Fehlermeldung im
   laufenden Workout (Übung hinzufügen, Beenden, Abbrechen, Satzvalidierung)
   wurde zwar ausgelöst, aber HINTER dem Overlay gezeichnet — der Nutzer sah
   ausschließlich „nichts passiert". Der Fehlschlag selbst war damit nicht
   diagnostizierbar.

   Dieser Test verhindert die FEHLERKLASSE: der Toast ist die letzte
   Rückmeldeinstanz der App und MUSS über jedem fixierten Element liegen.
   node supabase/tests/toast_zindex_contract_test.mjs */
import fs from 'fs';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/* Layoutrobust: kanonisch liegt styles.css unter ../../, umstrukturiert unter ../../app/. */
const APP = existsSync(join(HERE, '..', '..', 'styles.css')) ? join(HERE, '..', '..') : join(HERE, '..', '..', 'app');
const css = fs.readFileSync(join(APP, 'styles.css'), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

/* Alle Regeln mit z-index einsammeln: Selektor → höchster dort gesetzter z-index. */
const RULE = /([^{}]+)\{([^{}]*)\}/g;
const zBySelector = new Map();
let m;
while ((m = RULE.exec(css)) !== null) {
  const sel = m[1].trim().split('\n').pop().trim();
  const body = m[2];
  const z = /z-index\s*:\s*(-?\d+)/.exec(body);
  if (!z) continue;
  const val = parseInt(z[1], 10);
  const fixed = /position\s*:\s*(fixed|sticky|absolute)/.test(body);
  const prev = zBySelector.get(sel);
  if (!prev || val > prev.z) zBySelector.set(sel, { z: val, fixed: fixed || (prev && prev.fixed) || false });
}

const toast = zBySelector.get('.toast');
ok('.toast hat einen z-index', !!toast, toast ? 'z-index ' + toast.z : 'KEINE z-index-Regel für .toast gefunden');

if (toast) {
  /* Der Toast muss über allem liegen, was ihn verdecken kann. */
  const higher = [...zBySelector.entries()]
    .filter(([sel, v]) => sel !== '.toast' && v.z >= toast.z)
    .map(([sel, v]) => sel + ' (' + v.z + ')');
  ok('.toast liegt über jedem anderen z-index-Element', higher.length === 0,
    higher.length ? 'verdeckt durch: ' + higher.join(', ') + ' — Fehlermeldungen sind dort unsichtbar' : 'z-index ' + toast.z);

  /* Der konkrete Vorfall bleibt explizit abgesichert. */
  const woOverlay = zBySelector.get('.wo-overlay');
  ok('Live-Workout-Overlay (.wo-overlay) verdeckt den Toast nicht',
    !!woOverlay && toast.z > woOverlay.z,
    woOverlay ? '.toast ' + toast.z + ' > .wo-overlay ' + woOverlay.z : '.wo-overlay nicht gefunden');
  const woSheet = zBySelector.get('.wo-sheet-bg');
  ok('Workout-Sheet (.wo-sheet-bg) verdeckt den Toast nicht',
    !!woSheet && toast.z > woSheet.z,
    woSheet ? '.toast ' + toast.z + ' > .wo-sheet-bg ' + woSheet.z : '.wo-sheet-bg nicht gefunden');
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

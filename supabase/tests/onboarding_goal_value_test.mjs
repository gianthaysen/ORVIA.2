/* ============================================================
   ORVIA · onboarding_goal_value — A-07: der Zielwert im Onboarding
   ------------------------------------------------------------
   BEFUND (B5): Der Ziel-Schritt erhob Kategorie, Titel und Zieldatum — aber
   keine Zahl. Ein neuer Nutzer verliess das Onboarding mit „Halbmarathon am
   06.09."; ORVIA konnte nicht zwischen 1:50 und 2:15 unterscheiden.

   Geprueft werden vier Zusagen:
     1. Die Zahl wird im Onboarding erhoben — bei jedem Ziel, das eine hat.
     2. Fuer Ziele OHNE sinnvolle Metrik wird KEINE Ersatzzahl erfunden.
     3. Es gibt keinen zweiten Parser: „1:50:00" normalisiert profile-model.
     4. Leer bleibt leer — ein leeres Feld ist keine 0.

   node supabase/tests/onboarding_goal_value_test.mjs
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const UI = ['app/js/onboarding/onboarding-ui.js', 'js/onboarding/onboarding-ui.js']
  .map(p => join(REPO, p)).find(existsSync);
const PMP = ['app/js/profile-model.js', 'js/profile-model.js'].map(p => join(REPO, p)).find(existsSync);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const src = readFileSync(UI, 'utf8');
const M = require(PMP);

/* ---------- A · Welche Ziele bekommen ueberhaupt ein Feld? ---------- */
console.log('\nA · Metrikzuordnung');
{
  /* Die Feldtabelle muss GENAU die Metriken abdecken, die das Modell liefern
     kann. Eine Luecke hiesse: ein Ziel hat eine Metrik, aber kein Eingabefeld —
     der Nutzer koennte den Wert nie nennen. */
  const gemeldet = new Set();
  ['half_marathon', 'marathon', 'run_5k', 'run_10k', 'ironman', 'triathlon', 'rowing2k',
   'ftp', 'vo2max', 'weight_loss', 'weight_gain', 'muscle_gain', 'shredded', 'target_bodyfat',
   'halfmarathon', 'body_fat'].forEach(c => {
    const m = M.goalMetricTypeFor(c); if (m) gemeldet.add(m);
  });
  const tabelle = new Set((src.match(/^\s{4}(time|weight|power|count):\s*\{/gm) || [])
    .map(z => z.trim().split(':')[0]));
  ok('A1 jede Metrik des Modells hat ein Eingabefeld',
    [...gemeldet].every(m => tabelle.has(m)),
    'Modell: ' + [...gemeldet].sort().join(',') + ' · Felder: ' + [...tabelle].sort().join(','));
  ok('A2 … und die Feldtabelle erfindet keine Metrik, die es nicht gibt',
    [...tabelle].every(m => gemeldet.has(m)));

  ok('A3 Gesundheits- und Allgemeinziele haben KEINE Metrik',
    ['pain_free', 'train_regularly', 'keep_fit', 'improve_mobility', 'custom']
      .every(c => M.goalMetricTypeFor(c) == null),
    'fuer sie darf kein Feld erscheinen');
  ok('A4 … und der Erzeuger gibt fuer sie eine leere Zeichenkette zurueck',
    /if \(!f\) return '';/.test(src),
    'kein Feld, keine Ersatzfrage, keine erfundene Kennzahl');
}

/* ---------- B · Kein zweiter Parser ---------- */
console.log('\nB · Eine Wahrheit fuer die Umrechnung');
{
  const block = src.slice(src.indexOf('A-07 · Zielwert im Ziel-Schritt'), src.indexOf('function renderGoalsStep'));
  ok('B1 der Schritt schreibt ueber M.updateGoal (Modell normalisiert)',
    /M\.updateGoal\(curGoals\(\), g\.id, \{ targetValue: roh/.test(block));
  ok('B2 … und parst die Eingabe NICHT selbst',
    !/parseDuration|\.split\(':'\)/.test(block),
    'ein zweiter Parser waere ein zweiter Wahrheitsbegriff');

  /* Die Zusage, auf die sich B1 stuetzt — am Modell selbst geprueft. */
  const g0 = M.normalizeGoal({ category: 'half_marathon', title: 'HM' });
  const nach = M.updateGoal([g0], g0.id, { targetValue: '1:50:00', unit: 's', metricType: 'time' })[0];
  ok('B3 das Modell macht aus „1:50:00" 6600 Sekunden', nach.targetValue === 6600, String(nach.targetValue));
  const krumm = M.updateGoal([g0], g0.id, { targetValue: 'bald schnell', unit: 's', metricType: 'time' })[0];
  ok('B4 … und laesst Unverstandenes als Zeichenkette stehen (daran erkennt es der Schritt)',
    typeof krumm.targetValue === 'string', typeof krumm.targetValue);
}

/* ---------- C · Leer ist leer ---------- */
console.log('\nC · Datenluecke ≠ Wert');
{
  const block = src.slice(src.indexOf('function readGoalValueField'), src.indexOf('function renderGoalsStep'));
  ok('C1 leeres Feld setzt targetValue auf null, nicht auf 0',
    /if \(!roh\) \{[\s\S]{0,200}targetValue: null/.test(block));
  ok('C2 ein unverstaendlicher Wert wird zurueckgenommen statt halb gespeichert',
    /S\.goalValueErr =/.test(block) && /targetValue: null \}\);\s*\n\s*S\.goalValueErr/.test(block));
  ok('C3 geprueft wird das ERGEBNIS der Normalisierung, nicht die Eingabe',
    /typeof w === 'number' && isFinite\(w\) && w > 0/.test(block));
}

/* ---------- D · Verdrahtung ---------- */
console.log('\nD · Verdrahtung');
{
  ok('D1 das Feld erscheint im Ziel-Schritt', /goalValueFieldHTML\(ex\)/.test(src));
  ok('D2 es haengt an der Autospeicherung (Später fortsetzen, Escape, Tab-Wechsel)',
    /try \{ readGoalValueField\(\); \} catch \(e\) \{\}/.test(src)
    && /var gv = card\.querySelector\('#obg-value'\)/.test(src));
  ok('D3 „Weiter" haelt bei unverstaendlichem Wert an',
    /if \(S\.goalValueErr\) \{[\s\S]{0,240}S\.busy = false; return;/.test(src));
  ok('D4 … und der Fehler steht am Feld, nicht in der Konsole',
    /id="err-goalvalue"/.test(src));
  ok('D5 Zeitwerte werden fuer die Anzeige zurueckverwandelt (nicht als 6600 gezeigt)',
    /_secToClock\(g\.targetValue\)/.test(src));
}

console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

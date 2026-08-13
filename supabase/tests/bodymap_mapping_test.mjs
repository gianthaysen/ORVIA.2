#!/usr/bin/env node
/* GM7 · bodymap_mapping_test.mjs — anatomisches Slug→Engine-ID-Mapping der
   reaktivierten Körperkarte (Stufe 4). Sichert insbesondere die fachliche
   Korrektur: obliques = Core/abs (seitliche Bauchmuskulatur), NIE side_delts. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const _hx = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
import { existsSync as _exApp2 } from 'node:fs';
const APP = ([_hx, join(_hx, 'app'), join(_hx, '..', 'app')].find(p => _exApp2(join(p, 'index.html'))) || _hx);
const ui = readFileSync(join(APP, 'js', 'ui.js'), 'utf8');

function evalVar(name) {
  const i = ui.indexOf('var ' + name + '=');
  if (i < 0) throw new Error(name + ' nicht gefunden');
  let d = 0, j = ui.indexOf('=', i) + 1, start = j;
  for (; j < ui.length; j++) {
    const c = ui[j];
    if (c === '{' || c === '[') d++;
    else if (c === '}' || c === ']') d--;
    else if (c === ';' && d === 0) break;
  }
  return new Function('return (' + ui.slice(start, j) + ')')();
}

const MAP = evalVar('GM_ANAT_MAP');
const LIST_ONLY = evalVar('GM_ANAT_LIST_ONLY');
const FRONT_IDS = evalVar('GM_BODY_FRONT');
const BACK_IDS = evalVar('GM_BODY_BACK');
const ANT = evalVar('BODY_ANT');
const POST = evalVar('BODY_POST');

const CANON = ['chest','front_delts','side_delts','rear_delts','triceps','biceps','lats','upper_back','lower_back','quads','hamstrings','glutes','calves','abs','forearms'];

let n = 0, fail = 0;
const ok = (name, cond) => { n++; if (!cond) { fail++; console.error('FAIL:', name); } else console.log('ok:', name); };

/* 1. Jede gemappte ID ist kanonisch; kein stiller unbekannter Namensraum. */
for (const side of ['front', 'back']) {
  for (const [slug, id] of Object.entries(MAP[side])) {
    ok(`${side}/${slug} → ${id === null ? 'neutral' : id} ist kanonisch/neutral`, id === null || CANON.includes(id));
  }
}

/* 2. Jeder Slug im Mapping existiert wirklich als Polygonsatz (kein Tippfehler). */
for (const slug of Object.keys(MAP.front)) ok(`BODY_ANT hat Polygone für "${slug}"`, Array.isArray(ANT[slug]) && ANT[slug].length > 0);
for (const slug of Object.keys(MAP.back)) ok(`BODY_POST hat Polygone für "${slug}"`, Array.isArray(POST[slug]) && POST[slug].length > 0);

/* 3. Fachliche Korrektur: obliques gehört zu abs/Core — der frühere Blockfigur-Fehler
      (obliques→side_delts, „Seitliche Schulter an der Taille") darf nie zurückkommen. */
ok('obliques → abs (Core), NICHT side_delts', MAP.front.obliques === 'abs');
ok('kein Slug irgendeiner Seite mappt auf side_delts (keine eigene anatomische Region)',
  ![...Object.values(MAP.front), ...Object.values(MAP.back)].includes('side_delts'));
ok('side_delts wird als Listen-only geführt (bleibt sichtbar, nur nicht auf der Figur)',
  LIST_ONLY.front.includes('side_delts'));

/* 4. Vollständigkeit: jede kanonische ID der Segment-Listen ist auf der Figur ODER Listen-only. */
const frontMapped = new Set(Object.values(MAP.front).filter(Boolean));
const backMapped = new Set(Object.values(MAP.back).filter(Boolean));
for (const id of FRONT_IDS) ok(`Front-ID ${id} abgedeckt (Figur oder Liste)`, frontMapped.has(id) || LIST_ONLY.front.includes(id));
for (const id of BACK_IDS) ok(`Back-ID ${id} abgedeckt (Figur oder Liste)`, backMapped.has(id) || LIST_ONLY.back.includes(id));

/* 5. Beide Seiten decken die kanonische Union vollständig ab (15 Gruppen, keine erfundene). */
const union = new Set([...FRONT_IDS, ...BACK_IDS]);
ok('FRONT+BACK = exakt die 15 kanonischen IDs', union.size === 15 && CANON.every(id => union.has(id)));

/* 6. Schulterlinie-Regression: die Deltoid-Polygone liegen im oberen Drittel (y<80 in 0..200),
      die abs/obliques-Region auf Rumpfhöhe — Status „Schulter" darf nie an der Taille kleben. */
const yOf = pts => pts.trim().split(/\s+/).map(Number).filter((_, i) => i % 2 === 1);
const deltY = Math.min(...ANT['front-deltoids'].flatMap(yOf));
const oblY = Math.min(...ANT['obliques'].flatMap(yOf));
ok('front-deltoids beginnen deutlich über obliques (Anatomie stimmt)', deltY < oblY - 10);

console.log(`\nbodymap_mapping_test: ${n - fail}/${n} bestanden`);
process.exit(fail ? 1 : 0);

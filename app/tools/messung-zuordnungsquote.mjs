/* ORVIA · Messung der Zuordnungsquote (Schritt 1 aus PLAN-PUNKT-2-MUSKELGRUPPEN.md)

   WOZU: Der geplante Pruefer fuer plan.saetze_je_muskelgruppe ist nur dann
   sinnvoll, wenn sich geplante Uebungen ueberhaupt einer Muskelgruppe
   zuordnen lassen. Diese Messung beantwortet das gegen die AUSGELIEFERTE
   Bibliothek (Migrationen 0003+0006), nicht gegen ein Beispiel.

   Ergebnis am 2026-08-13: 91 %% moeglich, 33 %% erreichbar — die Luecke ist
   ein einziges Feld, das gmExLibEnsure beim Zwischenspeichern wegwirft.

   node app/tools/messung-zuordnungsquote.mjs
*/
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.ORVIA = {};
const G = require(new URL('../js/gym-volume.js', import.meta.url).pathname);

/* Die Bibliothek aus den Migrationen lesen — das ist die Liste, die die App
   wirklich ausliefert (is_system-Uebungen mit stabilem Slug). */
const dir = new URL('../../supabase/migrations/', import.meta.url).pathname;
const RE = /\('([a-z0-9_]+)'\s*,\s*true\s*,\s*'([^']+)'\s*,\s*'([a-z_]+)'\s*,\s*'([a-z_]+)'/g;
const uebungen = new Map();
readdirSync(dir).filter(f => /\.sql$/.test(f)).forEach(f => {
  const s = readFileSync(join(dir, f), 'utf8');
  let m;
  while ((m = RE.exec(s))) uebungen.set(m[1], { slug: m[1], name: m[2], pattern: m[4] });
});

const wege = { name: 0, slug: 0, pattern: 0, keiner: 0 };
const offen = [];
uebungen.forEach(u => {
  /* Genau die drei Wege, die musclesFor kennt — einzeln geprueft, damit
     sichtbar wird, WORAN die Zuordnung haengt. */
  const perName    = G.musclesFor({ exerciseNameSnapshot: u.name });
  const perSlug    = G.musclesFor({ exerciseId: u.slug });
  const perPattern = G.musclesFor({ movementPattern: u.pattern });
  if (perName) wege.name++;
  else if (perSlug) wege.slug++;
  else if (perPattern) wege.pattern++;
  else { wege.keiner++; offen.push(u.slug + ' (' + u.name + ', ' + u.pattern + ')'); }
});

const n = uebungen.size;
const zuordenbar = n - wege.keiner;
console.log('Uebungen in der ausgelieferten Bibliothek: ' + n);
console.log('  ueber den Namen      : ' + wege.name);
console.log('  ueber den Slug       : ' + wege.slug);
console.log('  ueber das Bewegungsmuster: ' + wege.pattern);
console.log('  gar nicht            : ' + wege.keiner);
console.log('QUOTE: ' + zuordenbar + '/' + n + ' = ' + Math.round(zuordenbar / n * 1000) / 10 + ' %');
if (offen.length) { console.log('\nnicht zuordenbar:'); offen.forEach(o => console.log('  · ' + o)); }

/* ── ABER: was steht ueberhaupt zur Verfuegung? ──
   `plannedExercises` fuehrt laut strength-plan@1 NUR `exerciseId` (UUID).
   Aufgeloest wird sie ueber gmExLib — und die speichert je Uebung
   ausschliesslich { name, slug }. Das Bewegungsmuster ist dort NICHT dabei.
   Also noch einmal messen mit genau dem, was am Bildschirm ankommt. */
let echt = 0; const echtOffen = [];
uebungen.forEach(u => {
  const m = G.musclesFor({ exerciseNameSnapshot: u.name }) || G.musclesFor({ exerciseId: u.slug });
  if (m) echt++; else echtOffen.push(u.slug + ' (' + u.name + ')');
});
console.log('\n── nur mit Name + Slug (das, was gmExLib liefert) ──');
console.log('QUOTE: ' + echt + '/' + n + ' = ' + Math.round(echt / n * 1000) / 10 + ' %');
console.log('Differenz zum Muster-Weg: ' + (zuordenbar - echt) + ' Uebungen haengen AM BEWEGUNGSMUSTER,');
console.log('das die Uebungsbibliothek im Browser gar nicht mitfuehrt.');

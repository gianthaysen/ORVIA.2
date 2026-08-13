/* ORVIA · Migrationsketten-Vertrag

   BEFUND (v8-291-Review): Im AKTIVEN Migrationsordner lag
   0028_user_metric_series_rollback.sql — dieselbe Versionsnummer wie die
   Vorwaertsmigration, und der Inhalt LOESCHT die gerade angelegte Tabelle.
   Je nach Werkzeug wird das als doppelte Version abgelehnt oder, schlimmer,
   in lexikografischer Reihenfolge NACH der Vorwaertsmigration ausgefuehrt —
   dann existiert die Tabelle nach einem frischen `db push` nicht.

   Der Vertrag dieses Tests:
     1. Kein Rollback im vorwaerts ausgefuehrten Verzeichnis. Rollbacks
        leben unter supabase/migrations_rollback/ und werden nur manuell
        angewendet.
     2. Jede Versionsnummer existiert genau EINMAL.
     3. Die Kette ist lueckenlos aufsteigend ab der kleinsten Version —
        eine Luecke hiesse: ein Teil der Kette liegt woanders (genau der
        0001–0031-unter-_dev-Befund).
     4. Kein aktives Skript enthaelt destruktive Statements ohne den
        ausdruecklichen Marker `-- DESTRUKTIV-BEABSICHTIGT`. drop table /
        drop column in einer Vorwaertsmigration ist sonst ein Alarmzeichen.

   node supabase/tests/migrations_chain_contract_test.mjs */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/* Migrationen liegen IMMER neben den Tests — layoutunabhaengig. */
const MIG = join(HERE, '..', 'migrations');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const files = readdirSync(MIG).filter(f => f.endsWith('.sql')).sort();
ok('der aktive Migrationsordner ist nicht leer', files.length > 0, String(files.length));

/* 1 · Rollbacks raus aus dem Vorwaertspfad. */
const rollbacks = files.filter(f => /rollback|revert|undo|down\b/i.test(f));
ok('kein Rollback/Revert im aktiven Vorwaertspfad', rollbacks.length === 0, rollbacks.join(', '));
ok('der Rollback-Ordner existiert als ausgewiesener Ort',
  existsSync(join(HERE, '..', 'migrations_rollback')));

/* 2 · Versionsnummern eindeutig. */
const nums = files.map(f => (f.match(/^(\d{4})_/) || [])[1]).filter(Boolean);
ok('jede Datei traegt eine vierstellige Versionsnummer', nums.length === files.length,
  files.filter(f => !/^\d{4}_/.test(f)).join(', '));
const dupes = nums.filter((n, i) => nums.indexOf(n) !== i);
ok('keine Versionsnummer existiert doppelt', dupes.length === 0, [...new Set(dupes)].join(', '));

/* 3 · Lueckenlos aufsteigend ab der kleinsten Version. */
const ints = [...new Set(nums)].map(n => parseInt(n, 10)).sort((a, b) => a - b);
const gaps = [];
for (let i = 1; i < ints.length; i++) if (ints[i] !== ints[i - 1] + 1) gaps.push(ints[i - 1] + 1);
ok('die Kette ist lueckenlos (fehlende Teile laegen sonst woanders — der _dev-Befund)',
  gaps.length === 0, 'fehlt: ' + gaps.join(', '));

/* 4 · Destruktive Statements nur BEDINGT (in einem gepruefte-Vorbedingung-
   Block) oder mit ausdruecklichem Marker. Historisch angewendete Migrationen
   werden NICHT veraendert (Geschichtsfaelschungs-Verbot) — 0002 und 0022
   enthalten bewusst gefuehrte drops in do-$$-Bloecken mit if-Vorbedingung
   (Daten zuerst migriert bzw. nur bei leerer Tabelle) und sind damit
   vertragskonform, ohne dass die Dateien angefasst werden muessen. */
const destructive = [];
for (const f of files) {
  const raw = readFileSync(join(MIG, f), 'utf8');
  let src = raw.replace(/--.*$/gm, '');                   /* Kommentare zaehlen nicht */
  /* Gefuehrte do-$$-Bloecke MIT if-Vorbedingung sind kein blinder Verlust. */
  src = src.replace(/do\s+\$\$[\s\S]*?\$\$/gi, m => (/\bif\b/i.test(m) ? '' : m));
  if (/drop\s+table|drop\s+column/i.test(src) && !/DESTRUKTIV-BEABSICHTIGT/.test(raw)) {
    /* drop constraint/index/policy/trigger sind normale Ersetzungsmuster —
       nur unbedingter Tabellen-/Spaltenverlust ist meldepflichtig. */
    destructive.push(f);
  }
}
ok('keine Vorwaertsmigration löscht Tabellen/Spalten unbedingt und unmarkiert',
  destructive.length === 0, destructive.join(', '));

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);

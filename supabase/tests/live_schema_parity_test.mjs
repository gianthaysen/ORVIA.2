/* ============================================================
   ORVIA · A-05 — Schema-Parität: der Prüfer muss mit den Migrationen mitwachsen
   ------------------------------------------------------------
   WORUM ES GEHT. Gate A verlangt „Live-Version == lokale Version" und prüft
   dafür die Versionsnummer im Service Worker. Das prüft den CODE. Das SCHEMA
   prüft es nicht — und genau dort ist der Gym-Bug vom 16.08. entstanden: Code
   ab v8-322 sendet `target_weight_kg`, in der Produktionsinstanz fehlte die
   Spalte (Migration 0035 war nie eingespielt), und alle 268 Tests waren grün,
   weil sie gegen die Migrationsdateien prüfen statt gegen die Instanz.

   WAS DIESER TEST KANN — UND WAS NICHT. Er kann nicht in die Produktionsdaten-
   bank sehen; dafür fehlen in CI die Zugangsdaten, und ein Test, der ohne sie
   still „grün" meldet, wäre genau die Sorte Grün, die ORVIA schon einmal
   teuer bezahlt hat. Er sichert deshalb die STUFE DAVOR: dass das Werkzeug,
   mit dem der Abgleich gefahren wird, vollständig ist und mitwächst.

   Konkret: `_live-check.sql` wird aus `supabase/migrations/` erzeugt. Kommt
   eine Migration hinzu und wird die Datei nicht neu erzeugt, ist dieser Test
   rot — die Handliste, die vorher existierte, wäre stillschweigend veraltet.

   Der eigentliche Abgleich bleibt ein bewusster Schritt im Supabase-SQL-Editor.
   Das ist Absicht: „gegen welche Datenbank" ist eine Entscheidung, keine
   Nebenwirkung eines Testlaufs.

   node supabase/tests/live_schema_parity_test.mjs
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
/* Layoutrobust: Werkzeuge liegen unter app/tools/ (Gerät) oder tools/ (Container). */
const TOOL = ['app/tools/gen-live-check.mjs', 'tools/gen-live-check.mjs']
  .map(p => join(REPO, p)).find(existsSync);
const MIG = ['supabase/migrations', '../supabase/migrations']
  .map(p => join(REPO, p)).find(existsSync);
const SQL = join(REPO, 'supabase', 'tests', '_live-check.sql');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

if (!TOOL || !MIG) {
  ok('Werkzeug und Migrationen gefunden', false,
    'TOOL=' + TOOL + ' MIG=' + MIG + ' — Pfadproblem, NICHT als bestanden werten');
  console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
  process.exit(1);
}

const { ausMigrationen, baueSql } = await import(pathToFileURL(TOOL).href);
const befund = ausMigrationen(MIG);
const erzeugt = baueSql(befund);

/* ---------- A · Der Parser sieht überhaupt etwas ---------- */
ok('A1 Migrationen werden gelesen', befund.dateien.length >= 30,
  befund.dateien.length + ' Dateien');
ok('A2 Tabellen erkannt', befund.tabellen.size >= 40, befund.tabellen.size + ' Tabellen');
ok('A3 Spalten erkannt', befund.spalten.size >= 50, befund.spalten.size + ' Spalten');

/* Kanarienvogel: genau der Fall, der den Gym-Bug ausgelöst hat. Fällt der
   Parser irgendwann auf 0 Treffer zurück, meldet A2/A3 das — diese Zeile
   nennt zusätzlich den Fall beim Namen. */
ok('A4 der Auslöser des Vorfalls steht in der Erwartungsliste',
  befund.spalten.has('workout_exercises.target_weight_kg'),
  '0035 · workout_exercises.target_weight_kg');
ok('A5 auch die zweite 0035-Spalte (Planseite)',
  befund.spalten.has('training_plan_exercises.target_weight_kg'));
ok('A6 eine frühe Tabelle aus 0002 fehlt nicht', befund.tabellen.has('user_profiles'));

/* ---------- B · Kein fremdes Schema in der Liste ---------- */
/* 0002 enthält `create table private.app_state_backup` in einem execute-String.
   Ohne Schema-Unterscheidung landete `private` als Tabellenname in der Liste —
   eine Prüfung, die dauerhaft „fehlt" gemeldet hätte, also ein Dauer-Rot ohne
   Ursache. Dieser Fall ist echt aufgetreten. */
ok('B1 kein Eintrag aus dem Schema `private`', !befund.tabellen.has('private'));
ok('B2 kein Eintrag namens `if` o. ä. (Parser-Ausrutscher)',
  !['if', 'not', 'exists', 'table'].some(w => befund.tabellen.has(w)));

/* ---------- C · Die eingecheckte Datei ist auf dem Stand ---------- */
ok('C1 _live-check.sql existiert', existsSync(SQL));
if (existsSync(SQL)) {
  const ist = readFileSync(SQL, 'utf8');
  ok('C2 _live-check.sql entspricht dem Migrationsstand', ist === erzeugt,
    ist === erzeugt ? 'deckungsgleich'
      : 'VERALTET — neu erzeugen: node app/tools/gen-live-check.mjs');
  ok('C3 die Abfrage ist vollständig (Abschluss vorhanden)',
    /order by e\.migration, e\.tabelle, e\.spalte;\s*$/.test(ist));
  const zeilen = (ist.match(/^ {2}\('\d{4}','(tabelle|spalte)'/gm) || []).length;
  ok('C4 Anzahl der Prüfungen stimmt mit dem Befund überein',
    zeilen === befund.tabellen.size + befund.spalten.size,
    zeilen + ' Zeilen für ' + (befund.tabellen.size + befund.spalten.size) + ' Objekte');
}

/* ---------- D · Nur Lesezugriffe ---------- */
/* Diese Datei wird von Hand in den SQL-Editor der PRODUKTIONSINSTANZ kopiert.
   Ein `drop`, `delete` oder `update` darin wäre kein Tippfehler, sondern ein
   Unfall mit Ansage. */
ok('D1 die erzeugte Abfrage verändert nichts',
  !/\b(drop|delete|update|insert|alter|truncate|grant|revoke)\b/i.test(
    erzeugt.replace(/^--.*$/gm, '')),
  'nur select/with');

console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

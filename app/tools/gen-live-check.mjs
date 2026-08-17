#!/usr/bin/env node
/* ============================================================
   ORVIA · Generator für den Live-Schema-Abgleich
   ------------------------------------------------------------
   WOZU. `public.schema_migrations` ist als Wahrheitsquelle wertlos: 21 der 34
   Migrationen tragen sich dort nicht ein. Ob eine Migration wirklich in der
   Produktionsinstanz gelandet ist, prüft deshalb niemand — genau daran ist der
   Gym-Bug vom 16.08. entstanden (Code ab v8-322 erwartete `target_weight_kg`,
   live fehlte die Spalte, alle 268 Tests waren grün, weil sie gegen die
   Migrationsdateien prüfen und nicht gegen die Instanz).

   WAS DIESES WERKZEUG TUT. Es liest `supabase/migrations/*.sql` und schreibt
   daraus die Erwartungsliste (Tabelle/Spalte) als SQL-Abfrage. Jede Zeile, die
   diese Abfrage in Supabase zurückgibt, FEHLT dort.

   WARUM GENERIERT STATT HANDGEPFLEGT. Die erste Fassung war eine Handliste.
   Eine Handliste veraltet mit der ersten neuen Migration, die jemand hinzufügt
   — und dann prüft der Prüfer weniger, als er behauptet. Der zugehörige Test
   (`live_check_generated_test.mjs`) schlägt fehl, sobald die eingecheckte SQL
   nicht mehr zum Migrationsstand passt.

   WAS ES NICHT TUT. Es führt nichts aus und verbindet sich mit nichts. Der
   Abgleich gegen die echte Datenbank bleibt ein bewusster Schritt im
   SQL-Editor (Blöcke A–D in `supabase/tests/_live-check.sql`).

   Aufruf:  node app/tools/gen-live-check.mjs [--check]
     ohne Argument: schreibt supabase/tests/_live-check.sql
     --check:       schreibt nichts, meldet nur Abweichungen (Exit 1)
   ============================================================ */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');                    // app/tools -> Repo-Wurzel
const MIG = join(REPO, 'supabase', 'migrations');
const OUT = join(REPO, 'supabase', 'tests', '_live-check.sql');

/* Nur das Schema `public` wird geprüft. `private` ist bewusst nicht Teil des
   Vertrags (0002 legt es an und schreibt dort eine Sicherungskopie), und
   `information_schema` sieht ohnehin nur, was wir ihm nennen. */
const NUR_SCHEMA = 'public';

/* ---------- Parsen ---------- */
export function ausMigrationen(verzeichnis) {
  const dateien = readdirSync(verzeichnis).filter(f => f.endsWith('.sql')).sort();
  const tabellen = new Map();   // tabelle -> migration (erste Nennung)
  const spalten = new Map();    // "tabelle.spalte" -> migration

  for (const datei of dateien) {
    const nr = (datei.match(/^(\d{4})/) || [null, datei])[1];
    /* Kommentare entfernen, damit ein auskommentiertes `create table` nicht als
       Erwartung zählt. Blockkommentare zuerst, dann Zeilenkommentare. */
    const sql = readFileSync(join(verzeichnis, datei), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*--.*$/gm, ' ');

    /* create table [if not exists] [<schema>.]name
       Das Schema wird MITGELESEN, nicht weggeworfen: 0002 enthält
       `create table private.app_state_backup` in einem execute-String. Ohne
       diese Unterscheidung landete `private` als Tabellenname in der
       Erwartungsliste — eine Prüfung, die dauerhaft „fehlt" gemeldet hätte. */
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?([a-z_][a-z0-9_]*)"?\s*\.\s*)?"?([a-z_][a-z0-9_]*)"?/gi)) {
      const schema = (m[1] || NUR_SCHEMA).toLowerCase();
      const t = m[2].toLowerCase();
      if (schema === NUR_SCHEMA && !tabellen.has(t)) tabellen.set(t, nr);
    }

    /* alter table [public.]name ... add column [if not exists] spalte
       Eine `alter table`-Anweisung kann mehrere `add column` enthalten; deshalb
       wird ab jedem `alter table` bis zum nächsten Semikolon gelesen. */
    for (const m of sql.matchAll(/alter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?(?:"?([a-z_][a-z0-9_]*)"?\s*\.\s*)?"?([a-z_][a-z0-9_]*)"?([\s\S]*?);/gi)) {
      const schema = (m[1] || NUR_SCHEMA).toLowerCase();
      const t = m[2].toLowerCase();
      if (schema !== NUR_SCHEMA) continue;
      for (const c of m[3].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-z_][a-z0-9_]*)"?/gi)) {
        const key = t + '.' + c[1].toLowerCase();
        if (!spalten.has(key)) spalten.set(key, nr);
      }
    }
  }
  return { tabellen, spalten, dateien };
}

/* ---------- SQL bauen ---------- */
export function baueSql({ tabellen, spalten, dateien }) {
  const zeilen = [];
  for (const [t, nr] of [...tabellen].sort((a, b) => a[0].localeCompare(b[0])))
    zeilen.push(`  ('${nr}','tabelle','${t}','')`);
  for (const [k, nr] of [...spalten].sort((a, b) => a[0].localeCompare(b[0]))) {
    const [t, s] = k.split('.');
    zeilen.push(`  ('${nr}','spalte','${t}','${s}')`);
  }

  return `-- ============================================================
-- ORVIA · Live-Schema-Abgleich  (ERZEUGT — nicht von Hand ändern)
-- Quelle: supabase/migrations/ (${dateien.length} Dateien)
-- Neu erzeugen: node app/tools/gen-live-check.mjs
-- ============================================================
-- Diese Abfrage beantwortet die eine Frage, die \`public.schema_migrations\`
-- nicht beantworten kann: Ist das, was die Migrationsdateien anlegen, in DIESER
-- Instanz wirklich vorhanden?
--
-- Ergebnis lesen: JEDE zurückgegebene Zeile FEHLT in der Datenbank.
-- Leeres Ergebnis = Migrationsdateien und Instanz sind deckungsgleich.
-- Nur Lesezugriffe.
--
-- Umfang: ${tabellen.size} Tabellen + ${spalten.size} Spalten = ${tabellen.size + spalten.size} Prüfungen.
-- Bewusst NICHT geprüft (kein Zugriff über information_schema in dieser Form):
-- Indizes, Constraints, Policies, Funktionen. Für Funktionen und RLS gibt es
-- die Blöcke A und C in _live-check-bloecke.sql.
-- ============================================================

with erwartet(migration, art, tabelle, spalte) as (values
${zeilen.join(',\n')}
)
select e.migration, e.art, e.tabelle, e.spalte
  from erwartet e
 where (e.art = 'tabelle' and not exists (
         select 1 from information_schema.tables t
          where t.table_schema='public' and t.table_name = e.tabelle))
    or (e.art = 'spalte' and not exists (
         select 1 from information_schema.columns c
          where c.table_schema='public' and c.table_name = e.tabelle
            and c.column_name = e.spalte))
 order by e.migration, e.tabelle, e.spalte;
`;
}

/* ---------- Hauptlauf ---------- */
if (process.argv[1] && process.argv[1].endsWith('gen-live-check.mjs')) {
  const befund = ausMigrationen(MIG);
  const sql = baueSql(befund);
  const pruefen = process.argv.includes('--check');

  if (pruefen) {
    if (!existsSync(OUT)) {
      console.error('❌ ' + OUT + ' fehlt — einmal ohne --check laufen lassen.');
      process.exit(1);
    }
    const ist = readFileSync(OUT, 'utf8');
    if (ist !== sql) {
      console.error('❌ _live-check.sql passt nicht mehr zu supabase/migrations/.');
      console.error('   Neu erzeugen: node app/tools/gen-live-check.mjs');
      process.exit(1);
    }
    console.log('✅ _live-check.sql ist auf dem Stand der Migrationen ('
      + befund.tabellen.size + ' Tabellen, ' + befund.spalten.size + ' Spalten).');
  } else {
    writeFileSync(OUT, sql, 'utf8');
    console.log('geschrieben: supabase/tests/_live-check.sql — '
      + befund.tabellen.size + ' Tabellen, ' + befund.spalten.size + ' Spalten, '
      + befund.dateien.length + ' Migrationsdateien gelesen.');
  }
}

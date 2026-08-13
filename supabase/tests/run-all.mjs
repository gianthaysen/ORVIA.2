#!/usr/bin/env node
/* ORVIA · Test-Runner (2026-08-06)

   WARUM ES IHN GIBT: Der Zustand der Suite wurde bisher per Textsuche über die
   Ausgaben ermittelt. Das ist zweimal schiefgegangen:
     • ein Muster auf „FAILED" traf den FEHLERCODE `SCHEDULER_V2_SOLVER_FAILED`
       in der Ausgabe eines GRÜNEN Tests → falscher Alarm;
     • ein Muster auf „fehlgeschlagen." traf auch „0 fehlgeschlagen." → 152 von
       215 Dateien fälschlich als rot gemeldet.
   Ein Prüfwerkzeug, dem man nicht trauen kann, ist schlimmer als keines.

   VERLÄSSLICHE QUELLE ist der Exit-Code, den jede Testdatei selbst setzt:
     0 = bestanden
     1 = fehlgeschlagen
     2 = ÜBERSPRUNGEN, weil Umgebungsvariablen fehlen (RLS-/RPC-Tests gegen eine
         echte Supabase-Instanz). Das ist kein Defekt — es wird getrennt gezählt
         und NIE als grün verbucht.

   Aufruf:
     node supabase/tests/run-all.mjs             # alles
     node supabase/tests/run-all.mjs phase8      # nur passende Dateinamen
     node supabase/tests/run-all.mjs --quiet     # nur die Zusammenfassung
*/
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const quiet = args.indexOf('--quiet') >= 0;
const filter = args.filter(a => a.indexOf('--') !== 0)[0] || null;

const files = readdirSync(HERE)
  .filter(f => /_test\.mjs$/.test(f))
  .filter(f => !filter || f.indexOf(filter) >= 0)
  .sort();

if (!files.length) { console.error('Keine Testdateien gefunden' + (filter ? ' für „' + filter + '"' : '')); process.exit(1); }

const passed = [], failed = [], skipped = [], crashed = [];
const t0 = Date.now();

files.forEach((f, i) => {
  const r = spawnSync(process.execPath, [join(HERE, f)], { encoding: 'utf8', timeout: 180000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const code = r.status;
  let bucket;
  if (r.error && r.error.code === 'ETIMEDOUT') { bucket = crashed; }
  else if (code === 0) bucket = passed;
  else if (code === 2) bucket = skipped;
  else if (code === 1) bucket = failed;
  else bucket = crashed;                       /* Absturz, Signal, unbekannter Code */
  bucket.push({ file: f, code: code, out: out });
  if (!quiet) {
    const mark = bucket === passed ? '✅' : bucket === skipped ? '⏭️ ' : '❌';
    /* Kurzfassung: die letzte nicht-leere Zeile der Ausgabe. */
    const last = out.trim().split('\n').filter(Boolean).pop() || '';
    console.log(mark + ' ' + String(i + 1).padStart(3) + '/' + files.length + ' ' +
      f.replace(/_test\.mjs$/, '').padEnd(42) + last.slice(0, 76));
  }
});

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log('\n' + '─'.repeat(72));
console.log('Bestanden      : ' + passed.length);
console.log('Fehlgeschlagen : ' + failed.length);
console.log('Übersprungen   : ' + skipped.length + (skipped.length ? '  (Umgebungsvariablen fehlen — kein Defekt)' : ''));
console.log('Abgestürzt     : ' + crashed.length);
console.log('Gesamt         : ' + files.length + ' Dateien in ' + secs + ' s');

if (skipped.length) {
  console.log('\nÜbersprungen (brauchen eine echte Supabase-Instanz):');
  skipped.forEach(s => console.log('  ⏭️  ' + s.file));
}
if (failed.length || crashed.length) {
  console.log('\nProblemfälle im Detail:');
  failed.concat(crashed).forEach(s => {
    console.log('\n❌ ' + s.file + '  (exit ' + s.code + ')');
    const lines = s.out.split('\n').filter(l => /^❌/.test(l));
    (lines.length ? lines : s.out.trim().split('\n').slice(-6)).slice(0, 10)
      .forEach(l => console.log('     ' + l.slice(0, 150)));
  });
}
console.log('\n' + (failed.length + crashed.length === 0
  ? '✅ GRÜN — keine fehlgeschlagenen Tests.'
  : '❌ ROT — ' + (failed.length + crashed.length) + ' Datei(en) mit Problemen.'));

process.exit(failed.length + crashed.length === 0 ? 0 : 1);

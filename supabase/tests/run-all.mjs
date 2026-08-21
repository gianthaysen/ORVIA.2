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

/* WARUM ÜBERSPRUNGEN WURDE, steht in der Ausgabe des Tests — bis v8-342 hat
   dieser Runner es trotzdem GERATEN und jeden Skip als „braucht eine echte
   Supabase-Instanz" beschriftet. Auf einem Rechner ohne Browser-Binary
   übersprangen 22 Dateien wegen fehlendem Chromium und wurden als
   Supabase-Sache ausgegeben: eine falsche Auskunft, die niemanden auf den
   fehlenden Browser stieß — und weil „0 fehlgeschlagen" darunter stand,
   sah der Lauf sauber aus, obwohl ein Zehntel der Abdeckung nicht lief. */
const GRUENDE = [
  { id: 'browser', treffer: /kein Browser-Binary|playwright install|ORVIA_CHROME/i,
    text: 'kein Browser-Binary — `npx playwright install chromium` holt es nach' },
  { id: 'supabase', treffer: /SUPABASE_URL|SUPABASE_ANON_KEY|ENV fehlt|Umgebungsvariablen fehlen/i,
    text: 'brauchen eine echte Supabase-Instanz (Zugangsdaten fehlen)' }
];
function grundVon(s) {
  const g = GRUENDE.find(g => g.treffer.test(s.out || ''));
  return g ? g.id : 'unbekannt';
}
const skipGruppen = new Map();
skipped.forEach(s => {
  const id = grundVon(s);
  if (!skipGruppen.has(id)) skipGruppen.set(id, []);
  skipGruppen.get(id).push(s);
});

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log('\n' + '─'.repeat(72));
console.log('Bestanden      : ' + passed.length);
console.log('Fehlgeschlagen : ' + failed.length);
console.log('Übersprungen   : ' + skipped.length + (skipped.length ? '  (NICHT geprüft — kein Defekt, aber auch kein Beleg)' : ''));
console.log('Abgestürzt     : ' + crashed.length);
console.log('Gesamt         : ' + files.length + ' Dateien in ' + secs + ' s');

if (skipped.length) {
  for (const [id, liste] of skipGruppen) {
    const g = GRUENDE.find(g => g.id === id);
    console.log('\nÜbersprungen — ' + (g ? g.text : 'Grund aus der Ausgabe nicht erkennbar') +
      '  (' + liste.length + ')');
    liste.forEach(s => console.log('  ⏭️  ' + s.file));
  }
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
/* Die Schlusszeile darf einen unvollständigen Lauf nicht wie einen
   vollständigen aussehen lassen. „Keine fehlgeschlagenen Tests" ist wahr und
   trotzdem irreführend, solange 29 Dateien gar nicht gelaufen sind. */
const nichtGeprueft = skipped.length;
console.log('\n' + (failed.length + crashed.length === 0
  ? (nichtGeprueft
    ? '✅ GRÜN, aber UNVOLLSTÄNDIG — ' + passed.length + ' geprüft, ' + nichtGeprueft +
      ' nicht gelaufen.' +
      (skipGruppen.has('browser')
        ? '\n   ' + skipGruppen.get('browser').length + ' davon nur wegen des fehlenden Browsers' +
          ' — die laufen mit `npx playwright install chromium` sofort mit.'
        : '')
    : '✅ GRÜN — alle ' + passed.length + ' Dateien geprüft, keine übersprungen.')
  : '❌ ROT — ' + (failed.length + crashed.length) + ' Datei(en) mit Problemen.'));

/* ── A-05 · Deploy-Marker ─────────────────────────────────────────
   Ein gruener Lauf hinterlaesst .suite-green mit dem HEAD-SHA; deploy-verify.sh
   (Block 0) laesst ohne diesen Marker keine Abnahme zu. Ein roter Lauf entfernt
   einen alten Marker, damit er keinen Deploy mehr autorisiert. Beobachter: das
   Schreiben aendert am Testergebnis nichts, es geschieht nach der Auszaehlung. */
const gruen = failed.length + crashed.length === 0;
/* Der Marker ist Beobachter: ein fehlendes Modul, ein Nicht-Repo-Verzeichnis
   oder ein Schreibfehler darf aus einem gruenen Lauf NIE einen roten machen.
   Deshalb dynamischer Import in try/catch. */
try {
  const M = await import('./_suite-marker.mjs');
  M.updateMarker({
    dir: HERE, green: gruen,
    passed: passed.length, skipped: skipped.length,
    sha: gruen ? M.headSha(HERE) : null,
    dirty: gruen ? M.treeDirty(HERE) : null
  });
} catch (e) {
  if (!quiet) console.error('Hinweis: Deploy-Marker nicht geschrieben (' + (e && e.message) + ')');
}

process.exit(gruen ? 0 : 1);

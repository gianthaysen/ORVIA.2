/* ============================================================
   ORVIA · _suite-marker — A-05 · Deploy-Marker (Kern)
   ------------------------------------------------------------
   WOZU. Auf `entwicklung` wird direkt gepusht. Ein PR-Gate mit erzwungenem
   Statuscheck wuerde genau diesen Weg blockieren — also gibt es keinen. Damit
   hindert heute technisch nichts daran, bei ROTER Suite zu deployen; der
   Schutz war rein prozedural ("erst gruen fahren, dann hochladen").

   Dieses Modul schliesst die Luecke an der Stelle, an der Schaden entsteht:
   ein gruener Lauf hinterlaesst .suite-green mit dem HEAD-SHA;
   deploy-verify.sh (Block 0) verweigert die Abnahme, wenn der Marker fehlt
   oder zu einem anderen Commit gehoert. Ein roter Test blockiert damit den
   DEPLOY statt eines Merges — technisch, nicht prozedural.

   WAS DER MARKER BELEGT — UND WAS NICHT. Er bindet einen gruenen Lauf an den
   HEAD-Commit und an den Zustand des Arbeitsbaums zu diesem Zeitpunkt. Er
   belegt NICHT, dass eine seither nicht committete Aenderung ebenfalls gruen
   waere: verschiebt sie den SHA nicht, bleibt der Marker gueltig. Diese
   Restluecke faengt Block 3 der deploy-verify (Byte-Vergleich der
   ausgelieferten Dateien), nicht der Marker. `dirty` macht den Fall sichtbar,
   statt ihn zu verschweigen.

   BEOBACHTER-DISZIPLIN. Kein Ausgang dieses Moduls veraendert einen Testlauf.
   Es wird NACH der Auszaehlung aufgerufen und schreibt nur eine Datei.

   Reiner Kern, ohne Seiteneffekte ausser der einen Datei — damit
   deploy_marker_test.mjs ihn ohne den vollen Runner pruefen kann.
   ============================================================ */
import { writeFileSync, existsSync, unlinkSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

/* HEAD-SHA des Repos, in dem `dir` liegt. null, wenn git fehlt oder `dir`
   kein Repo ist — dann ist der Marker bewusst nicht verwertbar (siehe unten). */
export function headSha(dir) {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

/* true = der Arbeitsbaum hatte zum Testzeitpunkt uncommittete Aenderungen.
   null = git nicht verfuegbar. Nur ein Hinweis, kein Sperrgrund: es gibt fast
   immer irgendeine unfertige Aenderung im Repo. */
export function treeDirty(dir) {
  const r = spawnSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim().length > 0 : null;
}

export function markerPath(dir) { return join(dir, '.suite-green'); }

/* green=true  → Marker schreiben und den Datensatz zurueckgeben.
   green=false → einen vorhandenen Marker ENTFERNEN und null zurueckgeben.
   Das Entfernen ist der Kern: ein alter gruener Marker darf einen roten Lauf
   nicht ueberleben, sonst autorisiert er weiter einen Deploy, obwohl die Suite
   jetzt rot ist. */
export function updateMarker({ dir, green, passed, skipped, sha, dirty, now }) {
  const p = markerPath(dir);
  if (!green) {
    if (existsSync(p)) unlinkSync(p);
    return null;
  }
  const rec = {
    sha: sha == null ? null : sha,
    complete: skipped === 0,   /* lokal fast immer false: Browser-Tests ueberspringen ohne Chromium */
    dirty: dirty == null ? null : dirty,
    passed: passed,
    skipped: skipped,
    ts: now || new Date().toISOString()
  };
  writeFileSync(p, JSON.stringify(rec, null, 2) + '\n');
  return rec;
}

/* Marker lesen. null, wenn er fehlt ODER unlesbar ist — beide bedeuten fuer
   die Abnahme dasselbe: kein verwertbarer Beleg. */
export function readMarker(dir) {
  const p = markerPath(dir);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch { return null; }
}

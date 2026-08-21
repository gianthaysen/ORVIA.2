/* ============================================================
   ORVIA · deploy_marker — A-05
   ------------------------------------------------------------
   Prueft den Kern hinter der Deploy-Sperre (_suite-marker.mjs):
     A. Ein gruener Lauf schreibt einen lesbaren Marker mit SHA, complete,
        dirty und Zeitstempel.
     B. Ein roter Lauf ENTFERNT einen vorhandenen Marker — sonst autorisiert
        ein alter gruener Lauf weiter einen Deploy, obwohl die Suite rot ist.
        Das ist die eigentliche Zusicherung des Pakets.
     C. Ein fehlender oder unlesbarer Marker liefert null, kein Wurf.
     D. headSha/treeDirty lesen den echten Repo-Zustand (oder null ohne git).
     E. Kein Ersatzwert: fehlt der SHA, steht null im Marker — nicht "".

   Bewusst OHNE den vollen Runner: der Kern ist ein reines Modul, damit genau
   diese Zusicherungen ohne 277 Testlaeufe pruefbar sind.

   node supabase/tests/deploy_marker_test.mjs
   ============================================================ */
import { mkdtempSync, existsSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const M = await import(join(HERE, '_suite-marker.mjs'));

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

/* Jeder Fall bekommt ein eigenes Wegwerf-Verzeichnis — kein .suite-green darf
   je in supabase/tests/ liegenbleiben (es wuerde deploy-verify verwirren). */
function tmp() { return mkdtempSync(join(tmpdir(), 'orvia-marker-')); }

/* ---------- A · gruener Lauf schreibt einen lesbaren Marker ---------- */
console.log('\nA · Schreiben bei gruen');
{
  const d = tmp();
  const rec = M.updateMarker({ dir: d, green: true, passed: 250, skipped: 22,
    sha: 'abc1234def5678', dirty: true, now: '2026-08-21T18:00:00.000Z' });
  ok('A1 Datei .suite-green existiert', existsSync(M.markerPath(d)));
  ok('A2 SHA uebernommen', rec.sha === 'abc1234def5678', rec.sha);
  ok('A3 complete=false, weil 22 uebersprungen', rec.complete === false, String(rec.complete));
  ok('A4 dirty durchgereicht', rec.dirty === true, String(rec.dirty));
  ok('A5 Zeitstempel uebernommen', rec.ts === '2026-08-21T18:00:00.000Z', rec.ts);
  const gelesen = M.readMarker(d);
  ok('A6 readMarker liefert denselben Datensatz', gelesen && gelesen.sha === 'abc1234def5678' && gelesen.passed === 250);
  /* complete nur dann true, wenn NICHTS uebersprungen wurde. */
  const d2 = tmp();
  const rec2 = M.updateMarker({ dir: d2, green: true, passed: 300, skipped: 0,
    sha: 'ffff000', dirty: false, now: '2026-08-21T18:00:00.000Z' });
  ok('A7 complete=true nur bei 0 uebersprungen', rec2.complete === true, String(rec2.complete));
  rmSync(d, { recursive: true, force: true });
  rmSync(d2, { recursive: true, force: true });
}

/* ---------- B · roter Lauf entfernt den Marker ---------- */
console.log('\nB · Entfernen bei rot (die Kernzusicherung)');
{
  const d = tmp();
  M.updateMarker({ dir: d, green: true, passed: 250, skipped: 0, sha: 'x', dirty: false, now: 't' });
  ok('B0 Marker liegt vor dem roten Lauf', existsSync(M.markerPath(d)));
  const res = M.updateMarker({ dir: d, green: false, passed: 240, skipped: 0, sha: null, dirty: null });
  ok('B1 roter Lauf entfernt den Marker', !existsSync(M.markerPath(d)));
  ok('B2 Rueckgabe ist null', res === null, String(res));
  /* rot OHNE vorhandenen Marker darf nicht werfen. */
  let threw = false;
  try { M.updateMarker({ dir: d, green: false, passed: 0, skipped: 0, sha: null, dirty: null }); }
  catch { threw = true; }
  ok('B3 rot ohne Marker wirft nicht', !threw);
  ok('B4 danach immer noch kein Marker', !existsSync(M.markerPath(d)));
  rmSync(d, { recursive: true, force: true });
}

/* ---------- C · fehlend/unlesbar → null ---------- */
console.log('\nC · Lesen ist robust');
{
  const d = tmp();
  ok('C1 fehlender Marker → null', M.readMarker(d) === null);
  writeFileSync(M.markerPath(d), 'kein json {{{');
  let c2val, c2threw = false;
  try { c2val = M.readMarker(d); } catch { c2threw = true; }
  ok('C2 unlesbarer Marker → null (kein Wurf)', c2threw === false && c2val === null, c2threw ? 'hat geworfen' : String(c2val));
  rmSync(d, { recursive: true, force: true });
}

/* ---------- D · headSha/treeDirty lesen den echten Zustand ---------- */
console.log('\nD · Repo-Zustand');
{
  const sha = M.headSha(REPO);
  const gitSha = (() => {
    const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : null;
  })();
  ok('D1 headSha == git rev-parse HEAD', sha === gitSha, sha + ' / ' + gitSha);
  ok('D2 SHA ist 40 Hexzeichen (oder null ohne git)',
    sha === null || /^[0-9a-f]{40}$/.test(sha), String(sha));
  const dirty = M.treeDirty(REPO);
  ok('D3 treeDirty liefert Boolean oder null', dirty === true || dirty === false || dirty === null, String(dirty));
  /* Ausserhalb eines Repos: null, kein Wurf. */
  const d = tmp();
  ok('D4 headSha ausserhalb eines Repos → null', M.headSha(d) === null);
  rmSync(d, { recursive: true, force: true });
}

/* ---------- E · kein Ersatzwert fuer fehlenden SHA ---------- */
console.log('\nE · Datenluecke != Wert');
{
  const d = tmp();
  const rec = M.updateMarker({ dir: d, green: true, passed: 1, skipped: 0, sha: null, dirty: null, now: 't' });
  ok('E1 fehlender SHA → null im Marker, nicht ""', rec.sha === null, JSON.stringify(rec.sha));
  ok('E2 fehlendes dirty → null im Marker', rec.dirty === null, JSON.stringify(rec.dirty));
  rmSync(d, { recursive: true, force: true });
}

console.log('\n' + '─'.repeat(60));
console.log('deploy_marker: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail === 0 ? 0 : 1);

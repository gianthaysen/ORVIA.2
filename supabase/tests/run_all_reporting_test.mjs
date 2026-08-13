/* ============================================================
   ORVIA · run-all: die Auskunft über den eigenen Lauf (v8-343)

   BEFUND, der diesen Test erzwungen hat: Der Runner beschriftete JEDEN
   übersprungenen Test mit „brauchen eine echte Supabase-Instanz" — geraten,
   nicht gelesen. Auf einem Rechner ohne Browser-Binary übersprangen 22
   Dateien wegen fehlendem Chromium und wurden als Supabase-Sache ausgegeben.
   Darunter stand „✅ GRÜN — keine fehlgeschlagenen Tests", und damit sah ein
   Lauf, dem ein Zehntel der Abdeckung fehlte, aus wie ein vollständiger.

   Der Runner ist das Werkzeug, dem alle anderen Zahlen dieses Projekts
   vertrauen — und er war selbst ungeprüft. Genau die Konstellation, aus der
   der Runner ursprünglich entstanden ist (Textsuche auf „FAILED", die einen
   Fehlercode in einer GRÜNEN Ausgabe traf).

   VERFAHREN: echte Prozesse, echte Ausgabe. Der Runner wird in einem
   Wegwerfverzeichnis unter dem Systemtemp gefahren, mit Testdateien, die
   nichts als einen Exit-Code und eine Meldung erzeugen. Nichts davon
   berührt das Repo, und keine Datei trägt den Namen echter Projektdaten.

   node supabase/tests/run_all_reporting_test.mjs
   ============================================================ */
import { mkdtempSync, writeFileSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNNER = join(HERE, 'run-all.mjs');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

if (!existsSync(RUNNER)) {
  console.log('❌ run-all.mjs nicht gefunden neben diesem Test');
  process.exit(1);
}

/* Eine Wegwerfsuite bauen und den ECHTEN Runner darauf loslassen. */
function lauf(dateien) {
  const dir = mkdtempSync(join(tmpdir(), 'orvia-runner-pruef-'));
  try {
    copyFileSync(RUNNER, join(dir, 'run-all.mjs'));
    Object.keys(dateien).forEach(name => writeFileSync(join(dir, name), dateien[name], 'utf8'));
    const r = spawnSync(process.execPath, [join(dir, 'run-all.mjs'), '--quiet'],
      { encoding: 'utf8', timeout: 60000 });
    return { out: (r.stdout || '') + (r.stderr || ''), code: r.status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const GRUEN = "console.log('probe_gruen: ALL PASSED (1 ok)'); process.exit(0);\n";
const ROT = "console.log('❌ eine Zusicherung ist gebrochen'); process.exit(1);\n";
const SKIP_BROWSER = "console.log('⏭️  ÜBERSPRUNGEN — playwright ist installiert, aber kein "
  + "Browser-Binary vorhanden (`npx playwright install chromium` holt es nach, oder ORVIA_CHROME setzen)');"
  + "\nprocess.exit(2);\n";
const SKIP_ENV = "console.log('ENV fehlt: SUPABASE_URL, SUPABASE_ANON_KEY, A_EMAIL, A_PW'); process.exit(2);\n";
const SKIP_RAETSEL = "console.log('uebersprungen: aus einem Grund, den keine Musterliste kennt'); process.exit(2);\n";

/* ══ 1 · Der Grund wird GELESEN, nicht geraten ══ */
sec('1 · übersprungen: der Grund kommt aus der Ausgabe');
{
  const r = lauf({ 'zz_a_probe_test.mjs': GRUEN, 'zz_b_probe_test.mjs': SKIP_BROWSER,
    'zz_c_probe_test.mjs': SKIP_ENV });
  ok('der Browser-Skip wird als Browser-Skip benannt',
    /Browser-Binary/.test(r.out) && /zz_b_probe_test\.mjs/.test(r.out));
  ok('  … und nennt den Weg heraus (playwright install)', /playwright install chromium/.test(r.out));
  ok('der Supabase-Skip steht in einer EIGENEN Gruppe',
    /Supabase-Instanz/.test(r.out) && /zz_c_probe_test\.mjs/.test(r.out));
  /* Die eigentliche Regression: beide in EINEN Topf, beschriftet mit dem
     Grund, der zufällig zuerst dastand. */
  const browserBlock = r.out.split(/Übersprungen — /).find(b => /Browser-Binary/.test(b)) || '';
  ok('  … und die beiden Gründe werden nicht vermischt',
    !/zz_c_probe_test\.mjs/.test(browserBlock),
    browserBlock.split('\n').filter(Boolean).slice(0, 3).join(' | '));
}

/* ══ 2 · Ein unbekannter Grund wird als unbekannt ausgewiesen ══ */
sec('2 · unbekannter Grund');
{
  const r = lauf({ 'zz_a_probe_test.mjs': GRUEN, 'zz_d_probe_test.mjs': SKIP_RAETSEL });
  ok('ein Grund ohne Muster wird NICHT in eine vorhandene Schublade gesteckt',
    /nicht erkennbar/.test(r.out) && !/Supabase-Instanz/.test(r.out),
    'Ein geratener Grund ist schlimmer als ein eingestandener');
}

/* ══ 3 · Die Schlusszeile darf nicht mehr behaupten, als gelaufen ist ══ */
sec('3 · die Schlusszeile');
{
  const unvollstaendig = lauf({ 'zz_a_probe_test.mjs': GRUEN, 'zz_b_probe_test.mjs': SKIP_BROWSER });
  ok('mit übersprungenen Dateien heißt es UNVOLLSTÄNDIG',
    /UNVOLLSTÄNDIG/.test(unvollstaendig.out),
    (unvollstaendig.out.trim().split('\n').filter(Boolean).slice(-2)[0] || '').slice(0, 90));
  ok('  … die Zahl der nicht gelaufenen Dateien steht dabei',
    /1 nicht gelaufen/.test(unvollstaendig.out));
  ok('  … und der Exit-Code bleibt 0 (übersprungen ist kein Defekt)',
    unvollstaendig.code === 0);

  const vollstaendig = lauf({ 'zz_a_probe_test.mjs': GRUEN });
  ok('ohne übersprungene Dateien heißt es ohne Einschränkung GRÜN',
    /keine übersprungen/.test(vollstaendig.out) && !/UNVOLLSTÄNDIG/.test(vollstaendig.out));

  const rot = lauf({ 'zz_a_probe_test.mjs': GRUEN, 'zz_e_probe_test.mjs': ROT });
  ok('ein echter Fehlschlag bleibt ROT und setzt den Exit-Code',
    /ROT/.test(rot.out) && rot.code === 1);
}

/* ══ 4 · Die Zählung selbst ══ */
sec('4 · die Zählung');
{
  const r = lauf({ 'zz_a_probe_test.mjs': GRUEN, 'zz_b_probe_test.mjs': SKIP_BROWSER,
    'zz_c_probe_test.mjs': SKIP_ENV, 'zz_e_probe_test.mjs': ROT });
  ok('bestanden/übersprungen/fehlgeschlagen werden getrennt gezählt',
    /Bestanden\s*:\s*1/.test(r.out) && /Übersprungen\s*:\s*2/.test(r.out) &&
    /Fehlgeschlagen\s*:\s*1/.test(r.out),
    (r.out.match(/Bestanden.*|Übersprungen.*|Fehlgeschlagen.*/g) || []).join(' · '));
  ok('  … und übersprungen wird nirgends zu bestanden addiert',
    !/Bestanden\s*:\s*3/.test(r.out));
}

console.log('\n' + '═'.repeat(62));
console.log('Ergebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

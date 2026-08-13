#!/usr/bin/env node
/* ============================================================
   ORVIA · mutation-probe — Mutationsproben als dauerhaftes Werkzeug.

   WOZU. Ein grüner Test beweist nur, dass er läuft — nicht, dass er etwas
   prüft. Eine Mutationsprobe bringt einen echten Defekt in den Produktivcode
   ein und verlangt, dass ein bestimmter Test dadurch ROT wird. Bleibt er
   grün, ist die Zusicherung ungeprüft: eine Testlücke.

   WARUM ALS WERKZEUG STATT ALS WEGWERFSKRIPT. Bis v8-329 wurden Proben je
   Runde neu getippt und danach weggeworfen. Der Nachweis ging damit jedes Mal
   verloren, und niemand konnte später prüfen, ob eine früher geschlossene
   Lücke wieder aufgegangen ist. Der Katalog (probes/*.json) ist deshalb
   versioniert und wiederholbar.

   DIE ENTSCHEIDENDE SICHERUNG. Eine Probe, deren Suchtext nicht passt, ändert
   NICHTS — und liest sich dann exakt wie ein grüner Test. Genau das ist in
   Runde Y7 passiert. Dieses Werkzeug prüft deshalb ZUERST, dass die Ersetzung
   tatsächlich gegriffen hat, und meldet sonst 'kein Aussagewert' statt eines
   Ergebnisses.

   DIE VIER LÜCKENMUSTER (Befunde aus v8-329, als Katalogkategorien):
     value_not_type  Der Test prüft nur TYPWIDRIGE Werte, nicht den gültigen
                     aber falschen Wert (M6: independentValidation false).
     fixture_masks   Das Fixture ist so schwach, dass eine ANDERE Sperre
                     vorher greift und die geprüfte Zusicherung maskiert
                     (M7: moderate/not_formally_assessed deckelt ohnehin).
     data_lacks_var  Der Test läuft gegen REALE Daten, die den fraglichen
                     Zweig gar nicht ausüben (M10: je nur eine essenzielle
                     Rolle, Rangtabelle bleibt ungeprüft).
     neighbour_guard Ein NACHBARSCHUTZ verdeckt die Zusicherung; gemessen wird
                     der falsche Mechanismus (M11: Object.freeze schluckt die
                     Zuweisung still).

   AUFRUF:
     node tools/mutation-probe.mjs                    # ganzer Katalog
     node tools/mutation-probe.mjs --file <katalog>   # eine Katalogdatei
     node tools/mutation-probe.mjs --id M6            # eine Probe
     node tools/mutation-probe.mjs --list             # nur auflisten

   EXITCODE 0 nur, wenn JEDE Probe angeschlagen hat. Eine grün gebliebene
   Probe ist ein Fehler, kein Hinweis.
   ============================================================ */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOG_DIR = join(HERE, 'probes');
const PATTERNS = ['value_not_type', 'fixture_masks', 'data_lacks_var', 'neighbour_guard', 'direct'];

const args = process.argv.slice(2);
const argOf = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const onlyId = argOf('--id');
const onlyFile = argOf('--file');
const listOnly = args.includes('--list');
/* --root verlegt die Wurzel, gegen die Datei- und Testpfade aufgeloest
   werden. Ohne Angabe ist es app/. Der Python-Worker liegt ausserhalb von
   app/ und laeuft nur dort, wo seine Umgebung steht — deshalb muss das
   Werkzeug die Wurzel wechseln koennen, statt fuer jeden Teil des Projekts
   neu geschrieben zu werden. */
const APP = resolve(argOf('--root') || resolve(HERE, '..'));
/* --test-root trennt die Wurzel der TESTS von der des Codes. Notwendig, weil
   die beiden Auschecklayouts auseinanderlaufen: im Container liegt alles
   unter app/, auf dem Geraet liegt der Code unter app/, die kanonische
   Testsammlung aber in der Repo-Wurzel. Ohne diese Trennung sucht das
   Werkzeug die Tests am falschen Ort und meldet 'crashed' — was wie ein
   Codefehler aussieht, aber ein Pfadfehler ist.
   Beispiel Geraet:  --root app --test-root . */
const TEST_ROOT = resolve(argOf('--test-root') || APP);

/* ---------- Katalog laden ---------- */
function loadCatalog() {
  if (!existsSync(CATALOG_DIR)) { console.error('Kein Probenkatalog unter ' + CATALOG_DIR); process.exit(2); }
  const files = onlyFile ? [onlyFile] : readdirSync(CATALOG_DIR).filter(f => f.endsWith('.json')).sort();
  const probes = [];
  for (const f of files) {
    const p = join(CATALOG_DIR, f);
    let doc;
    try { doc = JSON.parse(readFileSync(p, 'utf8')); }
    catch (e) { console.error('Katalog nicht lesbar: ' + f + ' — ' + e.message); process.exit(2); }
    if (!Array.isArray(doc.probes)) { console.error('Katalog ohne probes[]: ' + f); process.exit(2); }
    doc.probes.forEach(pr => probes.push(Object.assign(
      { _catalog: f, _target: doc.target, _test: doc.test, _runner: doc.runner, _python: doc.python,
        _requiresRoot: doc.requiresRoot }, pr)));
  }
  return probes;
}

/* ---------- Struktur einer Probe streng prüfen (fail-closed) ---------- */
function validateProbe(p) {
  const errs = [];
  const need = ['id', 'title', 'pattern', 'file', 'find', 'expectTest'];
  need.forEach(k => { if (typeof p[k] !== 'string' || !p[k].trim()) errs.push('Feld fehlt/leer: ' + k); });
  if (typeof p.replace !== 'string') errs.push('Feld fehlt: replace (leerer String = Löschung ist erlaubt)');
  if (p.pattern && PATTERNS.indexOf(p.pattern) < 0) errs.push('unbekanntes Muster: ' + p.pattern);
  if (p.find === p.replace) errs.push('find === replace — die Probe würde nichts ändern');
  const test = p.test || p._test;
  if (typeof test !== 'string' || !test.trim()) errs.push('kein Zieltest (test bzw. target-weites test)');
  return errs;
}

/* ---------- Notfall-Wiederherstellung ----------
   Waehrend eine Probe laeuft, liegt eine ABSICHTLICH DEFEKTE Fassung auf der
   Platte. Bricht der Prozess in diesem Moment ab (Strg-C, unerwarteter
   Fehler), bliebe sie liegen. Der Handler stellt zurueck, bevor der Prozess
   endet — und meldet laut, wenn selbst das nicht gelingt. */
const _pending = new Map();
function _restoreAll(why) {
  for (const [f, content] of _pending) {
    try {
      writeFileSync(f, content, 'utf8');
      console.error('↩️  wiederhergestellt nach ' + why + ': ' + f);
    } catch (e) {
      console.error('🚨 KONNTE NICHT WIEDERHERSTELLEN (' + why + '): ' + f + ' — ' + e.message);
      console.error('   Diese Datei ist absichtlich defekt. Bitte aus der Versionsverwaltung zuruecksetzen.');
    }
  }
  _pending.clear();
}
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(sig =>
  process.on(sig, () => { _restoreAll(sig); process.exit(130); }));
process.on('uncaughtException', (e) => { _restoreAll('Ausnahme'); console.error(e); process.exit(4); });

/* ---------- eine Probe fahren ---------- */
function runProbe(p) {
  const test = p.test || p._test;
  const file = join(APP, p.file);
  if (!existsSync(file)) {
    /* Ein Katalog, der eine ANDERE Wurzel braucht (z. B. der Python-Worker),
       ist beim App-Lauf nicht defekt — er gehoert hier schlicht nicht her.
       'skipped' statt 'invalid', damit ein sauberer Lauf nicht faelschlich
       nach Fehler aussieht. Uebersprungen ist aber ausdruecklich KEIN Beleg:
       der Bericht nennt jede uebersprungene Probe einzeln, damit sie nicht
       still aus der Abdeckung faellt. */
    if (p.requiresRoot || p._requiresRoot) {
      return { status: 'skipped', detail: 'braucht --root ' + (p.requiresRoot || p._requiresRoot) };
    }
    return { status: 'invalid', detail: 'Datei nicht gefunden: ' + p.file };
  }
  /* Fehlender Zieltest wird als PFADFEHLER gemeldet, nicht als Codebefund —
     sonst laesst sich 'crashed' nicht von 'Test liegt woanders' unterscheiden
     (genau diese Verwechslung kostete beim ersten Geraetelauf eine Runde). */
  if (p.runner !== 'pytest' && p._runner !== 'pytest' && !existsSync(join(TEST_ROOT, test))) {
    return { status: 'invalid', detail: 'Zieltest nicht gefunden: ' + join(TEST_ROOT, test) + ' (--test-root pruefen)' };
  }

  const orig = readFileSync(file, 'utf8');
  const hits = orig.split(p.find).length - 1;
  /* SICHERUNG 1 — Suchtext muss existieren. Sonst ändert die Probe nichts und
     liest sich wie ein grüner Test (Lehre aus Y7). */
  if (hits === 0) return { status: 'not_applied', detail: 'Suchtext kommt nicht vor' };
  /* SICHERUNG 2 — Suchtext muss EINDEUTIG sein. Bei mehreren Treffern wüsste
     niemand, welche Stelle mutiert wurde. */
  if (hits > 1) return { status: 'ambiguous', detail: hits + ' Treffer — Suchtext nicht eindeutig' };

  const mutated = orig.replace(p.find, p.replace);
  /* SICHERUNG 3 — der Dateiinhalt muss sich messbar geändert haben. */
  if (mutated === orig) return { status: 'not_applied', detail: 'Ersetzung ohne Wirkung' };

  /* Wiederherstellung aus dem SPEICHER, nicht ueber eine Backup-Datei
     (v8-330b). Grund: auf dem Geraete-Mount ist Loeschen verboten ('EPERM
     unlink') — eine Backup-Datei bliebe dort nach jeder Probe liegen und das
     Werkzeug brach mitten im Lauf ab. Der Originalinhalt liegt ohnehin schon
     in `orig`; eine zweite Kopie auf der Platte war nie noetig.
     Fuer den Absturzfall haengt weiter unten ein Notfall-Handler. */
  _pending.set(file, orig);
  let result;
  try {
    writeFileSync(file, mutated, 'utf8');
    if (readFileSync(file, 'utf8') !== mutated) throw new Error('Schreiben nicht wirksam');
    const runner = p.runner || p._runner || 'node';
    const cmd = runner === 'pytest'
      ? { bin: (p.python || p._python || 'python3'), argv: ['-m', 'pytest', test, '-q', '--no-header', '-p', 'no:cacheprovider'] }
      : { bin: 'node', argv: [test] };
    let out = '', red = false, code = 0;
    try { out = execFileSync(cmd.bin, cmd.argv, { cwd: TEST_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { red = true; code = e.status; out = String((e.stdout || '') + (e.stderr || '')); }
    /* Ein Zieltest, der sich in DIESER Umgebung selbst ueberspringt (fehlender
       Browser, fehlende Zugangsdaten), meldet Exitcode 2 und sagt es. Das ist
       weder ein Beleg noch ein Codebefund — es als 'crashed' zu fuehren wuerde
       ein Umgebungsproblem wie einen Defekt aussehen lassen, und als 'ok' zu
       fuehren waere schlicht gelogen. Deshalb eigener Status. */
    if (code === 2 && /ÜBERSPRUNGEN|UEBERSPRUNGEN|⏭/.test(out)) {
      return { status: 'skipped', detail: 'Zieltest überspringt sich in dieser Umgebung (' +
        (out.split('\n').find(l => /ÜBERSPRUNGEN|UEBERSPRUNGEN|⏭/.test(l)) || '').trim().slice(0, 90) + ')' };
    }
    const lines = out.split('\n');
    /* Die beiden Testwelten melden Fehlschlaege unterschiedlich: die
       ORVIA-JS-Tests mit '❌ <Zusicherung>', pytest mit 'FAILED <datei>::<fn>'
       bzw. einer '<fn> ... FAILED'-Zeile. Beides wird auf dieselbe Liste
       'failing' abgebildet, damit expectTest in beiden Welten gleich
       funktioniert. */
    const failing = runner === 'pytest'
      ? lines.filter(l => /^FAILED\s|^ERROR\s/.test(l))
        .map(l => l.replace(/^(FAILED|ERROR)\s+/, '').replace(/^[^:]*::/, '').trim())
      : lines.filter(l => l.startsWith('❌')).map(l => l.replace(/^❌\s*/, '').trim());
    /* expectTest ist ein PRAEFIX der erwarteten Fehlerzeile. Tests tragen in
       ORVIA teils IDs ('QN5'), teils ganze Saetze — beides muss zuordenbar
       sein. Der Praefix muss lang genug gewaehlt werden, dass er eindeutig
       ist; das Werkzeug meldet sonst 'wrong_test' mit den echten Zeilen. */
    const hitExpected = failing.some(l => l.startsWith(p.expectTest));
    if (red && hitExpected) result = { status: 'ok', detail: p.expectTest };
    else if (red && failing.length) result = { status: 'wrong_test', detail: 'rot bei: ' + failing.slice(0, 2).join(' | ') };
    else if (red) result = { status: 'crashed', detail: 'Test brach ab, ohne eine Zusicherung zu melden' };
    else result = { status: 'gap', detail: 'Test bleibt GRÜN — Zusicherung ungeprüft' };
  } finally {
    writeFileSync(file, orig, 'utf8');
    _pending.delete(file);
    /* SICHERUNG 4 — Wiederherstellung beweisen, nie nur annehmen. */
    if (readFileSync(file, 'utf8') !== orig) {
      console.error('\n🚨 ABBRUCH: ' + p.file + ' konnte nicht wiederhergestellt werden.');
      process.exit(3);
    }
  }
  return result;
}

/* ---------- Ablauf ---------- */
const all = loadCatalog();
const probes = onlyId ? all.filter(p => p.id === onlyId) : all;
if (!probes.length) { console.error('Keine passende Probe gefunden.'); process.exit(2); }

if (listOnly) {
  probes.forEach(p => console.log(`${p.id.padEnd(6)} ${(p.pattern || '?').padEnd(16)} ${p.file}  →  ${p.expectTest}`));
  process.exit(0);
}

console.log('ORVIA Mutationsproben — ' + probes.length + ' Proben aus ' +
  new Set(probes.map(p => p._catalog)).size + ' Katalogdatei(en)\n');

const ICON = { ok: '✅', gap: '❌', skipped: '⏭️ ', not_applied: '⚠️ ', ambiguous: '⚠️ ', invalid: '⚠️ ', wrong_test: '⚠️ ', crashed: '⚠️ ' };
const counts = {};
let worst = 0;
for (const p of probes) {
  const structErrs = validateProbe(p);
  let r;
  if (structErrs.length) r = { status: 'invalid', detail: structErrs.join('; ') };
  else r = runProbe(p);
  counts[r.status] = (counts[r.status] || 0) + 1;
  if (r.status === 'gap') worst = Math.max(worst, 2);
  else if (r.status !== 'ok' && r.status !== 'skipped') worst = Math.max(worst, 1);
  console.log(`${ICON[r.status] || '⚠️ '} ${p.id.padEnd(6)} ${(p.pattern || '').padEnd(16)} ${p.title}`);
  if (r.status !== 'ok') console.log(`       └─ ${r.status}: ${r.detail}`);
}

console.log('\n' + '─'.repeat(72));
Object.keys(counts).sort().forEach(k => console.log(`  ${k.padEnd(12)} ${counts[k]}`));
if (counts.gap) {
  console.log('\n❌ TESTLÜCKEN: ' + counts.gap + ' Probe(n) blieben grün. Diese Zusicherungen sind ungeprüft.');
} else if (worst) {
  console.log('\n⚠️  Nicht alle Proben haben Aussagewert — siehe oben. Kein Freibrief.');
} else if (counts.skipped) {
  console.log('\n✅ Jede GEFAHRENE Probe schlägt an. ' + counts.skipped +
    ' übersprungen (andere Wurzel) — übersprungen ist KEIN Beleg, siehe oben.');
} else {
  console.log('\n✅ Jede Probe schlägt an — jede geprüfte Zusicherung ist testgedeckt.');
}
process.exit(worst ? 1 : 0);

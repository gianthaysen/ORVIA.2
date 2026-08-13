/* ORVIA · Versionsdrift der entscheidungsrelevanten Module (Bauplan Stufe 0a)

   WOFÜR: Das Entscheidungs-Log speichert nur die Top-5-Kandidaten. Der Rest ist
   rekonstruierbar, WEIL die Engine-Module pur sind — aber nur innerhalb
   derselben Codeversion. Deshalb trägt jeder Eintrag einen decisionRuntimeHash
   aus den VERSION-Konstanten aller entscheidungsrelevanten Module.

   DIESER TEST IST DIE BEDINGUNG, UNTER DER DAS ÜBERHAUPT ETWAS WERT IST.
   Eine VERSION-Konstante, die bei einer Verhaltensänderung nicht hochgezählt
   wird, macht den ganzen Mechanismus wertlos: Der Hash bliebe gleich, das Log
   würde eine Rekonstruktion anbieten, und die käme aus geändertem Code. Genau
   die stille Falschaussage, die der Bauplan (Regel 2) verbietet.

   VERFAHREN
     _module-versions.json hält je Modul {version, contentHash} fest.
     - Inhalt geändert, VERSION gleich  → ROT. Das ist der Fehlerfall.
     - Inhalt geändert, VERSION geändert → grün, Manifest wird nachgezogen.
     - Neues Modul                       → grün, wird aufgenommen (einmalig).
   Das Manifest ist ein Werkzeug für Entwicklung, keine Laufzeitdatei; es wird
   nicht ausgeliefert und steht deshalb neben den Tests.

   node supabase/tests/module_version_drift_test.mjs [appRoot-absolut] */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
/* ROBUSTE APP-AUFLOESUNG: Das Repo existiert in zwei Layouts — kanonisch
   (app/supabase/tests, App-Wurzel = HERE/../..) und umstrukturiert
   (supabase/tests neben app/, App-Wurzel = HERE/../../app). Eine starre
   Aufloesung fand im jeweils anderen Layout den falschen Ordner und liess
   die GANZE Suite scheinbar fehlschlagen (0/46 statt gruen). Gesucht wird
   deshalb der erste Kandidat mit index.html UND js/engine. */
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);
const MANIFEST = join(HERE, '_module-versions.json');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

/* Die Liste MUSS deckungsgleich zu decision-log.RUNTIME_MODULES sein — das wird
   unten geprüft. Zwei auseinanderlaufende Listen wären genau die Lücke, die
   dieser Test schließen soll. */
const GUARDED = {
  designer: 'js/engine/week-plan-designer.js',
  policy: 'js/engine/week-plan-policy.js',
  loadProfile: 'js/engine/load-profile.js',
  variants: 'js/engine/plan-variants.js',
  zones: 'js/engine/performance-zones.js',
  flags: 'js/engine/feature-flags.js',
  log: 'js/engine/decision-log.js',
  /* 0b: Der Herkunftsvertrag entscheidet ueber Prognosebaender und darueber, ob
     ein Wert ueberhaupt verwendet wird — eine Aenderung daran aendert Plaene. */
  evidence: 'js/engine/evidence.js',
  resolver: 'js/engine/performance-resolver.js',
  /* G1: entscheidet, welche Werte ueberhaupt in die Zonen gelangen. */
  perfInput: 'js/engine/performance-input.js',
  /* C3: liefert die Grundwahrheit, an der spaetere Stufen ihre Anpassung messen. */
  debrief: 'js/engine/session-debrief.js',
  /* C1: Historie steuert Progression und Ausweichentscheidungen. */
  history: 'js/engine/load-history.js',
  /* C2: entscheidet ueber die Wochenmenge — die folgenreichste Einzelgroesse. */
  progression: 'js/engine/progression.js',
  /* Stufe 5: bewertet zwar nur, aber die Bewertung wird sichtbar und gatet
     spaeter die Plananwendung — eine stille Aenderung waere folgenreich. */
  feasibility: 'js/engine/goal-feasibility.js',
  /* Schattenbetrieb: aendert heute nichts am Plan — aber genau seine
     Beobachtungen entscheiden ueber die spaetere Freigabe. Eine stille
     Aenderung hier verfaelschte die Abnahmegrundlage. */
  shadow: 'js/engine/shadow-adaptive.js',
  /* Stufe 6a: der Uebersetzer beruehrt heute keinen Plan — aber sobald er es
     darf, ist er die Stelle, an der Zahlen zu Einheiten werden. */
  translator: 'js/engine/plan-translator.js',
  /* Observer ausserhalb der Kohorte — aber seine Modellversion trennt
     Kalibrierungsgruppen; stille Aenderungen wuerden Messreihen vermischen. */
  prediction: 'js/engine/prediction-observer.js',
  /* Persistenzvertrag des Debriefs: veraendert er sich still, aendert sich
     die Grundwahrheit aller Konsumenten. */
  debriefRecord: 'js/engine/debrief-record.js',
  /* Der EINE Eingang der Beobachtungsschicht (v8-299): ein anderer Adapter
     ist eine andere Beobachtungsbedeutung — seine Version steht deshalb
     auch in der Abnahmekohorte (shadow-adaptive@7, Feld 'input'). */
  observerInput: 'js/engine/observer-input.js',
  observerSource: 'js/engine/observer-source.js'
};

/* Derselbe FNV-1a wie im Modul — bewusst nachgebaut statt importiert: Ein Test,
   der die Rechnung des Prüflings übernimmt, prüft nichts (Bauplan-Regel 8). */
function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('00000000' + h.toString(16)).slice(-8);
}

function versionOf(src, file) {
  const m = src.match(/var\s+VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!m) throw new Error('keine VERSION-Konstante in ' + file);
  return m[1];
}

/* Kommentare und Leerraum fließen NICHT in den Inhalts-Hash ein: Eine bessere
   Begründung im Kopf eines Moduls ist keine Verhaltensänderung und soll nicht
   zu einem VERSION-Bump zwingen. Sonst würde der Test dazu erziehen, Kommentare
   nicht mehr zu pflegen. */
function behaviouralSource(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"])\/\/.*$/gm, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

let manifest = {};
if (existsSync(MANIFEST)) {
  try { manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch (e) { manifest = {}; }
}

sec('Liste deckungsgleich zum Modulvertrag');
{
  const src = readFileSync(join(APP, 'js/engine/decision-log.js'), 'utf8');
  const block = src.slice(src.indexOf('var RUNTIME_MODULES'), src.indexOf('var SENSITIVE'));
  const keys = [...block.matchAll(/\['([a-zA-Z]+)',\s*'([a-zA-Z]+)'\]/g)].map(m => m[1]);
  /* 'engine' ist die App-Version, keine Datei. evidence/resolver stehen nicht in
     RUNTIME_MODULES (sie liefern keine eigene Entscheidung, sondern speisen die
     Zonen), werden aber bewacht — die Pruefung laeuft deshalb nur in eine
     Richtung: jedes Modul des Vertrags MUSS bewacht sein, nicht umgekehrt. */
  const expected = keys.filter(k => k !== 'engine');
  const guarded = Object.keys(GUARDED).filter(k => k !== 'log');
  const missing = expected.filter(k => !(k in GUARDED));
  ok('jedes Modul aus RUNTIME_MODULES ist hier bewacht', missing.length === 0, 'ungeschützt: ' + missing.join(','));
  ok('die Bewachung ist eine Obermenge des Vertrags',
    expected.every(k => guarded.indexOf(k) >= 0 || k in GUARDED));
}

sec('Inhaltsänderung ohne VERSION-Bump');
{
  let changed = false;
  for (const [key, rel] of Object.entries(GUARDED)) {
    const file = join(APP, rel);
    if (!existsSync(file)) { ok(key + ': Datei vorhanden', false, rel + ' fehlt'); continue; }
    const raw = readFileSync(file, 'utf8');
    const version = versionOf(raw, rel);
    const hash = fnv1a(behaviouralSource(raw));
    const prev = manifest[key];

    if (!prev) {
      manifest[key] = { version, contentHash: hash }; changed = true;
      ok(key + ': neu aufgenommen', true, version + ' · ' + hash);
      continue;
    }
    if (prev.contentHash === hash) {
      ok(key + ': unverändert', prev.version === version,
        prev.version === version ? version : 'VERSION geändert ohne Inhaltsänderung: ' + prev.version + ' → ' + version);
      if (prev.version !== version) { manifest[key] = { version, contentHash: hash }; changed = true; }
      continue;
    }
    /* Inhalt anders — jetzt entscheidet allein, ob VERSION mitgezogen wurde. */
    const bumped = prev.version !== version;
    ok(key + ': Verhalten geändert ⇒ VERSION hochgezählt', bumped,
      bumped ? prev.version + ' → ' + version
        : 'VERSION steht weiter auf ' + version + ' — decisionRuntimeHash wäre unverändert und das Log '
          + 'würde eine Rekonstruktion aus geändertem Code anbieten. VERSION in ' + rel + ' hochzählen.');
    if (bumped) { manifest[key] = { version, contentHash: hash }; changed = true; }
  }
  if (changed) {
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
    console.log('   ℹ Manifest nachgezogen: supabase/tests/_module-versions.json');
  }
}

sec('Eigenprüfung des Verfahrens');
{
  /* Der Test wäre wertlos, wenn sein eigener Hash Verhaltensänderungen nicht
     sähe. Zwei Gegenproben mit konstruierten Quellen. */
  const a = 'var VERSION = "x@1"; function f(){ return 1; }';
  const b = 'var VERSION = "x@1"; function f(){ return 2; }';
  ok('geänderte Logik ⇒ anderer Inhalts-Hash', fnv1a(behaviouralSource(a)) !== fnv1a(behaviouralSource(b)));

  const c = '/* eine bessere Erklärung */ var VERSION = "x@1"; function f(){ return 1; }';
  ok('geänderter Kommentar ⇒ gleicher Inhalts-Hash', fnv1a(behaviouralSource(a)) === fnv1a(behaviouralSource(c)));

  const d = 'var VERSION = "x@1";\n\n  function f(){\n    return 1;\n  }';
  ok('geänderte Einrückung ⇒ gleicher Inhalts-Hash', fnv1a(behaviouralSource(a)) === fnv1a(behaviouralSource(d)));

  ok('VERSION wird korrekt gelesen', versionOf(a, 'x') === 'x@1');
}

console.log('\n' + '═'.repeat(62));
console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);

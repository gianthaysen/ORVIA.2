#!/usr/bin/env node
/* ============================================================
   ORVIA · knowledge-ingest — Wissen einspeisen.

   AUFRUF:
     node tools/knowledge-ingest.mjs <notiz.json>
         nur pruefen. Schreibt NICHTS. Meldet bei jedem fehlenden Punkt, was
         zu tun ist.

     node tools/knowledge-ingest.mjs <notiz.json> --schreiben
         erzeugt zwei Module:
           js/engine/knowledge/<sport>-knowledge-sources.js
           js/engine/knowledge/<sport>-knowledge-pack.js

     … --technisch-geprueft "Dein Name"
         setzt zusaetzlich den technischen Pruefstatus. OHNE diesen Schalter
         bleibt das Paket auf 'draft' — und dann waehlt der Vertrag es in
         JEDEM Modus ab. Eingespeistes Wissen wirkt also erst, wenn jemand
         ausdruecklich bestaetigt, es angesehen zu haben.

   WARUM NUR-PRUEFEN DER STANDARD IST. Dasselbe Muster wie beim Garmin-Push
   (`--send`): der schreibende Weg braucht einen zweiten, bewussten Griff.
   Ein Werkzeug, das beim ersten Aufruf Dateien anlegt, erzeugt irgendwann
   Dateien, die niemand wollte.

   WAS DIESES WERKZEUG NICHT TUT. Es haengt sich NICHT in das bestehende
   Quellenregister (`knowledge-sources.js`) ein. Dessen Inhalts-Hash ist in
   allen Consumern gepinnt; ein zusaetzlicher Eintrag wuerde die
   Running-Kette blockieren. Jede eingespeiste Sportart bekommt deshalb ihr
   EIGENES Register — getrennt, ohne Nebenwirkung auf Bestehendes.

   WISSENSCHAFTLICHE FREIGABE vergibt dieses Werkzeug NIE. Sie erfordert
   einen qualifizierten Pruefer mit hinterlegtem Verifikationsdatensatz und
   laeuft ausschliesslich ueber den Vertragsweg.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..');

const args = process.argv.slice(2);
const argOf = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const datei = args.find(a => !a.startsWith('--') && args.indexOf(a) !== args.indexOf(argOf('--technisch-geprueft')));
const schreiben = args.includes('--schreiben');
const ueberschreiben = args.includes('--ueberschreiben');
const pruefer = argOf('--technisch-geprueft');

if (!datei) {
  console.error('Aufruf: node tools/knowledge-ingest.mjs <notiz.json> [--schreiben] [--technisch-geprueft "Name"]');
  process.exit(2);
}
const pfad = resolve(datei);
if (!existsSync(pfad)) { console.error('Datei nicht gefunden: ' + pfad); process.exit(2); }

/* Die Module werden als echte Module geladen — nicht nachgebaut. Wenn sich
   der Vertrag aendert, muss dieses Werkzeug es merken. */
const KI = require(join(APP, 'js/engine/knowledge/knowledge-ingest.js'));
const KC = require(join(APP, 'js/engine/knowledge/knowledge-contracts.js'));

let notiz;
try { notiz = JSON.parse(readFileSync(pfad, 'utf8')); }
catch (e) {
  console.error('❌ Die Datei ist kein gültiges JSON.\n   ' + e.message +
    '\n   Häufigste Ursache: ein Komma zu viel vor einer schließenden Klammer.');
  process.exit(1);
}

console.log('ORVIA · Wissen einspeisen — ' + basename(pfad) + '\n');

const r = KI.ingest(notiz);
if (!r.ok) {
  console.error('❌ Noch nicht vollständig. ' + r.fehler.length + ' Punkt(e):\n');
  console.error(KI.fehlerText(r.fehler));
  console.error('\nNichts geschrieben. Ergänze die Punkte und rufe es erneut auf.');
  process.exit(1);
}

const sport = String(notiz.sport).toLowerCase().replace(/[^a-z0-9_]/g, '');
console.log('✅ Vollständig: ' + r.sources.length + ' Quelle(n), ' + r.rules.length + ' Regel(n) für "' + sport + '"\n');

/* Technische Prüfung — nur mit Namen, nie automatisch. */
if (pruefer) {
  const heute = new Date().toISOString().slice(0, 10);
  r.rules.forEach(rr => { rr.governance.technicalStatus = 'reviewed'; rr.governance.technicalReviewedAt = heute; });
  console.log('   technisch geprüft von: ' + pruefer + ' (' + heute + ')');
} else {
  console.log('   ⚠️  technischer Prüfstatus: draft — der Vertrag wählt diese Regeln in JEDEM Modus ab.');
  console.log('      Mit --technisch-geprueft "Dein Name" bestätigst du, sie angesehen zu haben.');
}
console.log('   wissenschaftlicher Prüfstatus: ungeprüft (dieses Werkzeug vergibt keine Freigabe)');

/* ---------- Gegen den ECHTEN Vertrag prüfen ---------- */
const registry = { registryVersion: 1, sources: r.sources };
registry.contentHash = KC.registryContentHash(registry);
const rv = KC.validateRegistry(registry);
if (!rv.valid) {
  console.error('\n❌ Das Quellenregister ist nicht vertragskonform:');
  rv.errors.forEach(e => console.error('   • ' + e.code + ' ' + (e.detail || '')));
  process.exit(1);
}
const pack = { packId: sport, version: 1, knowledgeVersion: 'kb-' + sport + '-v1.0.0',
  sport: sport, rules: r.rules, contentHash: null };
pack.contentHash = KC.packContentHash(pack);
const pv = KC.validatePack(pack, registry);
if (!pv.valid) {
  console.error('\n❌ Das Wissenspaket ist nicht vertragskonform:');
  pv.errors.forEach(e => console.error('   • ' + e.code + ' ' + (e.detail || '')));
  process.exit(1);
}
console.log('\n✅ Register und Paket sind vertragskonform (geprüft mit dem echten Vertrag v' +
  KC.KNOWLEDGE_CONTRACT_VERSION + ').');

/* ---------- Was die Regeln bewirken dürfen ---------- */
const sourcesById = rv.sourcesById;
console.log('\nEinordnung je Regel:');
r.rules.forEach(rr => {
  const klasse = KC.ruleEvidenceCeiling(rr, sourcesById);
  const conf = KC.maxConfidenceFor(rr, sourcesById);
  const d = KC.disclosureFor(rr, sourcesById);
  const zahl = rr.claims.some(c => KC.prescriptiveNumberAllowed(c, sourcesById, rr));
  console.log('  ' + rr.ruleId + '  Klasse ' + klasse + ' · Confidence ' + conf +
    ' · Basis: ' + (d && d.basisLabel) + (zahl ? ' · darf eine Zahl vorgeben' : ' · qualitativ'));
});

const pins = {
  expectedKnowledgeContractVersion: KC.KNOWLEDGE_CONTRACT_VERSION,
  expectedKnowledgeVersion: pack.knowledgeVersion,
  expectedPackContentHash: pack.contentHash,
  expectedSourceRegistryVersion: registry.registryVersion,
  expectedSourceRegistryHash: registry.contentHash
};
const sel = KC.selectRules(pack, registry, Object.assign({ mode: 'advisory', sport: sport }, pins));
console.log('\nIm Modus "advisory" ausgewählt: ' + sel.rules.length + ' von ' + r.rules.length + ' Regel(n)' +
  (sel.excluded.length ? ('  (ausgeschlossen: ' + sel.excluded.map(x => x.ruleId + '/' + x.code).join(', ')) + ')' : ''));

if (!schreiben) {
  console.log('\nNur geprüft — nichts geschrieben. Mit --schreiben werden die Module erzeugt.');
  process.exit(0);
}

/* ---------- Module schreiben ---------- */
const ZIEL = join(APP, 'js/engine/knowledge');
if (!existsSync(ZIEL)) mkdirSync(ZIEL, { recursive: true });

/* ÜBERSCHREIBSCHUTZ.
   Gefunden beim ersten echten Einspeiseversuch, bevor er lief: ein Lauf mit
   --schreiben fuer "running" haette running-knowledge-pack.js (34 KB, von
   Hand gepflegt) durch eine Datei mit zwei Regeln ERSETZT. Ohne Warnung,
   ohne Sicherung, ohne Rueckweg. Eine Notizdatei mit einer Regel haette den
   gesamten Wissensstand einer Sportart geloescht.

   Das ist kein Randfall, sondern der Normalfall: wer eine zweite Quelle
   einspeist, hat fast immer schon ein Paket. Deshalb faellt der Schreibweg
   jetzt geschlossen aus, und der Text sagt genau, was verloren ginge. */
{
  const bestehende = [
    join(ZIEL, sport + '-knowledge-sources.js'),
    join(ZIEL, sport + '-knowledge-pack.js')
  ].filter(existsSync);

  if (bestehende.length && !ueberschreiben) {
    console.log('\n⛔ Es gibt bereits ein Wissenspaket für "' + sport + '". Nichts geschrieben.\n');
    for (const p of bestehende) {
      let regeln = '?';
      try {
        const alt = require(p);
        regeln = Array.isArray(alt && alt.rules) ? (alt.rules.length + ' Regel(n)')
          : Array.isArray(alt && alt.sources) ? (alt.sources.length + ' Quelle(n)')
            : 'Inhalt unbekannt';
      } catch (e) { regeln = 'nicht lesbar (' + e.message + ')'; }
      console.log('   ' + basename(p) + '  —  bisher: ' + regeln);
    }
    console.log('\n   Diese Datei brächte: ' + r.sources.length + ' Quelle(n), ' + r.rules.length + ' Regel(n).');
    console.log('   Der Schreibweg ERSETZT die Dateien vollständig — er ergänzt sie nicht.');
    console.log('\n   Wenn das gewollt ist: die bestehenden Regeln in die Notizdatei übernehmen');
    console.log('   und erneut aufrufen. Nur wenn der Verlust bewusst ist:');
    console.log('       --ueberschreiben');
    process.exit(3);
  }
  if (bestehende.length && ueberschreiben) {
    console.log('\n⚠️  --ueberschreiben gesetzt: ' + bestehende.length + ' bestehende Datei(en) werden ersetzt.');
  }
}

const kopf = (was) => `/* ============================================================
   ORVIA · ${was} für "${sport}" — EINGESPEIST, nicht von Hand geschrieben.

   Erzeugt von tools/knowledge-ingest.mjs aus ${basename(pfad)}.
   Änderungen gehören in die Notizdatei, nicht hierher: beim nächsten Lauf
   wird diese Datei überschrieben.

   Governance: technisch ${pruefer ? ('geprüft von ' + pruefer) : 'UNGEPRÜFT (draft)'},
   wissenschaftlich ungeprüft. Eine wissenschaftliche Freigabe vergibt das
   Werkzeug nicht — sie erfordert einen qualifizierten Prüfer über den
   Vertragsweg.
   ============================================================ */`;

const srcDatei = join(ZIEL, sport + '-knowledge-sources.js');
writeFileSync(srcDatei, kopf('Quellenregister') + `
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var registry = {
    registryVersion: ${registry.registryVersion},
    sources: ${JSON.stringify(r.sources, null, 2).split('\n').join('\n    ')},
    contentHash: null
  };
  if (O.knowledgeContracts && typeof O.knowledgeContracts.registryContentHash === 'function') {
    registry.contentHash = O.knowledgeContracts.registryContentHash(registry);
  }
  registry.byId = {};
  registry.sources.forEach(function (s) { registry.byId[s.sourceId] = s; });
  if (typeof module !== 'undefined' && module.exports) module.exports = registry;
  O.knowledgeSources_${sport} = registry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
`, 'utf8');

const packDatei = join(ZIEL, sport + '-knowledge-pack.js');
writeFileSync(packDatei, kopf('Wissenspaket') + `
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var pack = {
    packId: ${JSON.stringify(pack.packId)},
    version: ${pack.version},
    knowledgeVersion: ${JSON.stringify(pack.knowledgeVersion)},
    sport: ${JSON.stringify(pack.sport)},
    rules: ${JSON.stringify(r.rules, null, 2).split('\n').join('\n    ')},
    contentHash: null
  };
  if (O.knowledgeContracts && typeof O.knowledgeContracts.packContentHash === 'function') {
    pack.contentHash = O.knowledgeContracts.packContentHash(pack);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = pack;
  O.knowledgePack_${sport} = pack;
})(typeof globalThis !== 'undefined' ? globalThis : this);
`, 'utf8');

console.log('\nGeschrieben:');
console.log('  ' + srcDatei.replace(APP + '/', ''));
console.log('  ' + packDatei.replace(APP + '/', ''));
console.log('\nPins für den Consumer (unabhängig hinterlegen, NIE zur Laufzeit aus dem Paket lesen):');
Object.keys(pins).forEach(k => console.log('  ' + k + ': ' + JSON.stringify(pins[k])));
console.log('\nNoch zu tun: beide Dateien in index.html einbinden und in den Offline-Vorrat von sw.js aufnehmen.');

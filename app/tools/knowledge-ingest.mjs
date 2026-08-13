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
const schreiben = args.includes('--schreiben');
const ueberschreiben = args.includes('--ueberschreiben');
const pruefer = argOf('--technisch-geprueft');
const paketName = argOf('--paket');

/* v8-353 — MEHRERE NOTIZEN IN EIN PAKET.
   Bis hierher nahm das Werkzeug genau EINE Notizdatei und ersetzte damit das
   ganze Paket. Sein eigener Ueberschreibschutz gab den Rat: „die bestehenden
   Regeln in die Notizdatei uebernehmen und erneut aufrufen" — also alle
   Quellen in EINE Datei kopieren. Das ist das Gegenteil der Ordnung, die
   docs/wissen pflegt: eine Datei je Quelle, mit ihrer eigenen Herkunft,
   ihren eigenen Grenzen und ihrem eigenen Pruefdatum.

   Deshalb nimmt es jetzt beliebig viele Notizen und fuegt sie zu EINEM Paket
   zusammen. Zusammengefuegt wird nur, was zusammengehoert: gleiche Sportart,
   keine doppelten Regel- oder Quellen-Kennungen. Bei jeder Kollision faellt
   es aus, statt stillschweigend eine Regel zu ueberschreiben — zwei Regeln
   mit derselben Kennung waeren im Paket nicht mehr unterscheidbar, und
   welche gewinnt, haenge an der Reihenfolge der Argumente. */
const dateien = args.filter((a, i) => !a.startsWith('--')
  && args[i - 1] !== '--technisch-geprueft' && args[i - 1] !== '--paket');

if (!dateien.length) {
  console.error('Aufruf: node tools/knowledge-ingest.mjs <notiz.json> [weitere.json …] [--schreiben]');
  console.error('        [--technisch-geprueft "Name"] [--paket <praefix>] [--ueberschreiben]');
  console.error('\n  --paket <praefix>  schreibt <praefix>-knowledge-pack.js statt <sport>-knowledge-pack.js.');
  console.error('                     Noetig, wenn fuer die Sportart bereits ein handgepflegtes');
  console.error('                     Paket existiert, das einen eigenen Konsumenten hat.');
  process.exit(2);
}
const pfade = dateien.map(d => resolve(d));
for (const pf of pfade) {
  if (!existsSync(pf)) { console.error('Datei nicht gefunden: ' + pf); process.exit(2); }
}
const pfad = pfade[0];

/* Die Module werden als echte Module geladen — nicht nachgebaut. Wenn sich
   der Vertrag aendert, muss dieses Werkzeug es merken. */
const KI = require(join(APP, 'js/engine/knowledge/knowledge-ingest.js'));
const KC = require(join(APP, 'js/engine/knowledge/knowledge-contracts.js'));

console.log('ORVIA · Wissen einspeisen — ' + pfade.map(p => basename(p)).join(', ') + '\n');

/* Jede Notiz einzeln durch den ECHTEN Vertrag, danach zusammenfuegen. Eine
   Notiz, die der Vertrag abweist, bricht den ganzen Lauf ab: ein Paket aus
   fuenf von sechs Quellen waere ein anderes Paket als das gewollte, und
   niemand saehe den Unterschied an der Datei. */
const teile = [];
let sport = null;
for (const pf of pfade) {
  let notiz;
  try { notiz = JSON.parse(readFileSync(pf, 'utf8')); }
  catch (e) {
    console.error('❌ ' + basename(pf) + ' ist kein gültiges JSON.\n   ' + e.message +
      '\n   Häufigste Ursache: ein Komma zu viel vor einer schließenden Klammer.');
    process.exit(1);
  }
  const teil = KI.ingest(notiz);
  if (!teil.ok) {
    console.error('❌ ' + basename(pf) + ' ist noch nicht vollständig. ' + teil.fehler.length + ' Punkt(e):\n');
    console.error(KI.fehlerText(teil.fehler));
    console.error('\nNichts geschrieben. Ergänze die Punkte und rufe es erneut auf.');
    process.exit(1);
  }
  const s2 = String(notiz.sport).toLowerCase().replace(/[^a-z0-9_]/g, '');
  /* Ein Paket ist je Sportart gepinnt und wird je Sportart ausgewaehlt.
     Zwei Sportarten in einer Datei waeren im Consumer nicht trennbar. */
  if (sport === null) sport = s2;
  else if (sport !== s2) {
    console.error('❌ Verschiedene Sportarten in einem Aufruf: "' + sport + '" und "' + s2 +
      '" (' + basename(pf) + ').\n   Ein Paket gehört zu genau einer Sportart. Getrennt aufrufen.');
    process.exit(1);
  }
  console.log('   ' + basename(pf).padEnd(46) + teil.sources.length + ' Quelle(n), ' + teil.rules.length + ' Regel(n)');
  teile.push({ pfad: pf, erg: teil });
}

/* ZUSAMMENFUEGEN mit Kollisionsprüfung. Zwei Regeln mit derselben Kennung
   waeren im Paket nicht mehr unterscheidbar, und welche gewinnt, haenge an
   der Reihenfolge der Argumente — genau die Sorte stiller Abhaengigkeit,
   die dieses Projekt an mehreren Stellen teuer bezahlt hat. */
const r = { ok: true, sources: [], rules: [] };
const quelleVon = {}, regelVon = {};
for (const t of teile) {
  for (const q of t.erg.sources) {
    if (quelleVon[q.sourceId]) {
      console.error('❌ Quellen-Kennung doppelt: ' + q.sourceId + '\n   in ' +
        basename(quelleVon[q.sourceId]) + ' und ' + basename(t.pfad) +
        '\n   Zwei Quellen mit derselben Kennung sind im Register nicht unterscheidbar.');
      process.exit(1);
    }
    quelleVon[q.sourceId] = t.pfad;
    r.sources.push(q);
  }
  for (const rr of t.erg.rules) {
    if (regelVon[rr.ruleId]) {
      console.error('❌ Regel-Kennung doppelt: ' + rr.ruleId + '\n   in ' +
        basename(regelVon[rr.ruleId]) + ' und ' + basename(t.pfad) +
        '\n   Welche Regel gälte, hinge an der Reihenfolge der Argumente.');
      process.exit(1);
    }
    regelVon[rr.ruleId] = t.pfad;
    r.rules.push(rr);
  }
}

console.log('\n✅ Vollständig: ' + r.sources.length + ' Quelle(n), ' + r.rules.length +
  ' Regel(n) aus ' + teile.length + ' Notiz(en) für "' + sport + '"\n');

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
/* Der Dateiname und die globale Kennung folgen `--paket`, die SPORTART
   bleibt, was in den Notizen steht. Beides zu vermischen waere der Fehler:
   ein Paket „running-notizen" ist trotzdem ein Laufpaket und muss fuer
   `sport: 'running'` ausgewaehlt werden. */
const praefix = (paketName || sport).toLowerCase().replace(/[^a-z0-9_-]/g, '');
const global_ = praefix.replace(/-/g, '_');
const pack = { packId: praefix, version: 1, knowledgeVersion: 'kb-' + praefix + '-v1.0.0',
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
    join(ZIEL, praefix + '-knowledge-sources.js'),
    join(ZIEL, praefix + '-knowledge-pack.js')
  ].filter(existsSync);

  if (bestehende.length && !ueberschreiben) {
    console.log('\n⛔ Es gibt bereits ein Wissenspaket unter "' + praefix + '". Nichts geschrieben.\n');
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
    console.log('\n   Wenn das gewollt ist, gibt es zwei saubere Wege:');
    console.log('     • alle Notizdateien gemeinsam übergeben — sie werden zu EINEM Paket');
    console.log('       zusammengefügt (seit v8-353), die Quellendateien bleiben getrennt;');
    console.log('     • oder unter eigenem Namen schreiben: --paket <praefix>. Das ist der');
    console.log('       Weg, wenn das bestehende Paket handgepflegt ist und einen eigenen');
    console.log('       Konsumenten hat — dann darf es gar nicht ersetzt werden.');
    console.log('\n   Nur wenn der Verlust bewusst ist:  --ueberschreiben');
    process.exit(3);
  }
  if (bestehende.length && ueberschreiben) {
    console.log('\n⚠️  --ueberschreiben gesetzt: ' + bestehende.length + ' bestehende Datei(en) werden ersetzt.');
  }
}

const kopf = (was) => `/* ============================================================
   ORVIA · ${was} für "${sport}" — EINGESPEIST, nicht von Hand geschrieben.

   Erzeugt von tools/knowledge-ingest.mjs aus:
${pfade.map(p => '     · ' + basename(p)).join('\n')}
   Änderungen gehören in die Notizdateien, nicht hierher: beim nächsten Lauf
   wird diese Datei überschrieben.

   Governance: technisch ${pruefer ? ('geprüft von ' + pruefer) : 'UNGEPRÜFT (draft)'},
   wissenschaftlich ungeprüft. Eine wissenschaftliche Freigabe vergibt das
   Werkzeug nicht — sie erfordert einen qualifizierten Prüfer über den
   Vertragsweg.
   ============================================================ */`;

const srcDatei = join(ZIEL, praefix + '-knowledge-sources.js');
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
  O.knowledgeSources_${global_} = registry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
`, 'utf8');

const packDatei = join(ZIEL, praefix + '-knowledge-pack.js');
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
  O.knowledgePack_${global_} = pack;
})(typeof globalThis !== 'undefined' ? globalThis : this);
`, 'utf8');

console.log('\nGeschrieben:');
console.log('  ' + srcDatei.replace(APP + '/', ''));
console.log('  ' + packDatei.replace(APP + '/', ''));
console.log('\nPins für den Consumer (unabhängig hinterlegen, NIE zur Laufzeit aus dem Paket lesen):');
Object.keys(pins).forEach(k => console.log('  ' + k + ': ' + JSON.stringify(pins[k])));
console.log('\nNoch zu tun: beide Dateien in index.html einbinden und in den Offline-Vorrat von sw.js aufnehmen.');

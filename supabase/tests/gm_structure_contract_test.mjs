/* ORVIA · KF-013 — Semantischer Strukturvertrag.

   ERSETZT die sechs tools/gm*_parity.mjs. Diese verglichen gegen Golden-Master-
   Fixtures in /tmp (/tmp/orvia_dashboard_5.html, /tmp/gm4h.html, /tmp/gm6h.html),
   die nicht im Repo liegen. Sie sind seit deren Verlust nicht mehr lauffaehig —
   damit war die verbindliche Regel

     „Struktur schrumpft NIE"  (docs/GOLDEN-MASTER-MAPPING.md:47)

   nur noch dokumentiert, aber nicht geschuetzt. Genau das ist KF-013.

   Dieser Test macht es anders und bewusst enger:
     • KEIN pixelnaher Vergleich kompletter HTML-Fixtures.
     • Geprueft wird SEMANTIK: welche Bereiche und Anzeigeslots existieren
       muessen — nicht, wie sie aussehen.
     • Anker sind stabile IDs und die Produktvokabeln der Sektionslabels,
       eingecheckt in docs/gm-ref/structure-contract.json.
     • Ein Slot DARF leer sein und „—" oder einen ehrlichen Grund zeigen.
     • Ein Slot darf NICHT 0 oder einen Schaetzwert als Messung ausgeben.
     • Funktionslose interaktive Elemente DUERFEN verschwinden — sie sind
       ausdruecklich nicht Teil des Vertrags (Phase 1b entfernt sie).
     • Keine Abhaengigkeit von /tmp, Downloads oder externen Harness-Dateien.

   node supabase/tests/gm_structure_contract_test.mjs */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const _hx = join(HERE, '..', '..');
import { existsSync as _exApp2 } from 'node:fs';
const APP = ([_hx, join(_hx, 'app'), join(_hx, '..', 'app')].find(p => _exApp2(join(p, 'index.html'))) || _hx);
const CONTRACT = join(APP, 'docs', 'gm-ref', 'structure-contract.json');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

ok('Strukturvertrag liegt im Repo (keine /tmp-Abhaengigkeit)', existsSync(CONTRACT), 'docs/gm-ref/structure-contract.json');
if (!existsSync(CONTRACT)) {
  console.log('\ngm_structure_contract: 1 FAILED — Vertrag fehlt. Erzeugen mit: node tools/build_structure_contract.mjs <appRoot-absolut>');
  process.exit(1);
}
const C = JSON.parse(readFileSync(CONTRACT, 'utf8'));

ok('Vertrag ist versioniert', typeof C.contractVersion === 'string' && /^\d+\.\d+\.\d+$/.test(C.contractVersion), C.contractVersion);
ok('E-13 · Vertrag verankert Slots ueber data-gm-slot, nicht ueber Labeltexte',
   !!C.requiredSlots && C.rules.some(r => /data-gm-slot/.test(r)));
ok('E-13 · Labeltexte sind ausdruecklich nur informativ',
   C.rules.some(r => /informativ/.test(r) && /Umbenennen/.test(r)));
ok('Vertrag nennt seine Regeln explizit', Array.isArray(C.rules) && C.rules.length >= 5);
ok('Vertrag verbietet ausdruecklich Schein-Nullwerte',
   C.rules.some(r => /NICHT 0|nicht 0/.test(r) && /Messung/.test(r)));
ok('Vertrag erlaubt ausdruecklich das Verschwinden funktionsloser Bedienelemente',
   C.rules.some(r => /interaktive Elemente/.test(r) && /verschwinden/.test(r)));

/* ---------- Live-Pruefung gegen die echte App ---------- */
/* Der Kollektor faehrt einen echten Browser — ohne playwright ist das ein
   UEBERSPRUNGEN (exit 2) wie bei den uebrigen Browser-Tests, kein Crash:
   Der Vertrag selbst wurde oben bereits statisch geprueft. */
{
  const _pwReq = (await import('node:module')).createRequire(import.meta.url);
  const _pwPath = ['playwright', join(_hx, 'node_modules', 'playwright'),
    join(_hx, 'app', 'node_modules', 'playwright'), join(_hx, '_dev', 'node_modules', 'playwright')]
    .map(c => { try { return _pwReq.resolve(c); } catch (_e) { return null; } })
    .find(Boolean) || null;
  const _pwOk = !!_pwPath;
  /* v8-307b: Modul vorhanden reicht nicht — auch das BINARY muss existieren,
     sonst crasht der Kollektor am Container-Pfad statt ehrlich zu skippen.
     Geladen wird ueber den AUFGELOESTEN Pfad — der nackte Name 'playwright'
     ist aus diesem Verzeichnis nicht aufloesbar (kein node_modules-Nachbar). */
  let _pwBin = false;
  if (_pwOk) {
    try {
      const _chr = _pwReq(_pwPath).chromium;
      _pwBin = !!(await import('./_pw-chrome.mjs')).resolveChrome(_chr);
    } catch (_e) { _pwBin = false; }
  }
  if (!_pwOk || !_pwBin) {
    console.log('⏭️  ÜBERSPRUNGEN — playwright ' + (_pwOk ? 'ohne Browser-Binary (`npx playwright install chromium` holt es nach)' : 'ist in dieser Umgebung nicht installiert (npm install im Repo-Stamm holt es nach)') + '; der statische Vertragsteil oben ist geprueft');
    process.exit(2);
  }
}
const { collectStructure } = await import(join(APP, 'tools', 'build_structure_contract.mjs'));
const live = await collectStructure(APP);

/* 1) Tabbar-Vertrag */
const missingTabs = C.requiredTabs.filter(t => live.tabbar.indexOf(t) < 0);
ok('alle vertraglich zugesagten Tabs existieren', missingTabs.length === 0,
   missingTabs.length ? 'fehlt: ' + missingTabs.join(', ') : live.tabbar.join(', '));

/* 2) GM-Bereiche muessen im DOM existieren (stabile IDs) */
const html = readFileSync(join(APP, 'index.html'), 'utf8');
const missingHosts = C.requiredGmHosts.filter(id => html.indexOf('id="' + id + '"') < 0);
ok('alle GM-Bereiche existieren als stabile IDs in index.html', missingHosts.length === 0,
   missingHosts.length ? 'fehlt: ' + missingHosts.join(', ') : C.requiredGmHosts.length + ' Hosts');

/* 3) Anzeigeslots: Struktur schrumpft NIE */
function checkSlots(name, required, actual) {
  const missing = (required || []).filter(s => (actual || []).indexOf(s) < 0);
  ok('Slots erhalten: ' + name, missing.length === 0,
     missing.length ? 'VERSCHWUNDEN: ' + missing.join(' · ')
                    : (required || []).length + ' Slot(s)');
}
checkSlots('Plan', C.requiredSlots.plan, live.areas.plan.slots);
checkSlots('Heute', C.requiredSlots.heute, live.areas.heute.slots);
checkSlots('Aktivitaeten', C.requiredSlots.akt, live.areas.akt.slots);
checkSlots('Analyse', C.requiredSlots.dash, live.areas.dash.slots);
checkSlots('Profil', C.requiredSlots.mehr, live.areas.mehr.slots);
for (const [seg, req] of Object.entries(C.requiredSlots.dashSegments || {})) {
  checkSlots('Analyse/' + seg, req, (live.areas.dash.segments || {})[seg] && live.areas.dash.segments[seg].slots);
}
/* Der Vertrag darf nicht leer laufen: ohne Slots wuerde jede Pruefung trivial gruen. */
const totalSlots = Object.values(C.requiredSlots)
  .reduce((a, v) => a + (Array.isArray(v) ? v.length : Object.values(v).reduce((b, x) => b + x.length, 0)), 0);
ok('Vertrag schuetzt tatsaechlich Slots (nicht leer)', totalSlots >= 15, totalSlots + ' Slots');

/* 4) Ehrlichkeit: leere Slots duerfen „—" zeigen — das ist erwuenscht, kein Defekt.
      Der Test haelt fest, dass diese Ehrlichkeit NICHT wegoptimiert wurde. */
ok('leere Slots bleiben ehrlich („—" statt erfundener Werte)',
   live.honesty.emDashCount > 0 || live.honesty.notAvailableCount > 0,
   '„—" ' + live.honesty.emDashCount + 'x · „Noch nicht verfügbar" ' + live.honesty.notAvailableCount + 'x');

/* 5) Der Vertrag selbst darf nicht von fluechtigen Fixtures abhaengen. */
const selfSrc = readFileSync(join(HERE, 'gm_structure_contract_test.mjs'), 'utf8');
const genSrc = readFileSync(join(APP, 'tools', 'build_structure_contract.mjs'), 'utf8');
const tmpRef = /['"`]\/tmp\//;
ok('Test referenziert kein /tmp', !tmpRef.test(selfSrc.replace(/\/\*[\s\S]*?\*\//g, '')));
ok('Generator referenziert kein /tmp', !tmpRef.test(genSrc.replace(/\/\*[\s\S]*?\*\//g, '')));

/* 6) Nachweis, dass die abgeloesten Paritaetstools als veraltet markiert sind. */
const parity = ['gm1', 'gm2', 'gm3', 'gm4', 'gm5', 'gm6'].map(g => join(APP, 'tools', g + '_parity.mjs'));
const present = parity.filter(existsSync);
const marked = present.filter(f => /VERALTET|DEPRECATED/.test(readFileSync(f, 'utf8').slice(0, 1200)));
ok('abgeloeste gm*_parity.mjs sind als veraltet markiert', present.length === 0 || marked.length === present.length,
   marked.length + '/' + present.length + ' markiert');

console.log('\ngm_structure_contract: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);

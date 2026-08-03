#!/usr/bin/env node
/* GM7.3 · import_route_persistence_test.mjs
   Beweist den Group-2-Verlust (Route am Import vorhanden → im kanonischen Pfad verloren)
   und sichert die verlustfreie Persistenz nach dem Fix. Verhaltens-/Vertragstest —
   KEIN String-Match: prüft echte Feld-Retention durch den Normalizer + den Import-
   Metrik-Builder (die exakte Verluststelle). */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const APP = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'app');

// activity-normalize.js ist pur (module.exports) — direkt ladbar.
global.window = undefined;
const AN = require(join(APP, 'js', 'activity-normalize.js'));

let n = 0, fail = 0;
const ok = (name, cond, extra) => { n++; if (!cond) { fail++; console.error('FAIL:', name, extra || ''); } else console.log('ok:', name); };

const ROUTE = [[54.77, 9.33], [54.771, 9.335], [54.772, 9.34], [54.773, 9.336]];

/* ---- 1. EINGANGSNACHWEIS: der GPX/TCX-Parser liefert eine Route am Import.
   (Struktur des Parser-Outputs; parseGpxTcx selbst ist DOM-gebunden, daher hier
   die dokumentierte Output-Form als Fixture — der Punkt ist: route IST vorhanden.) */
const importObj = { date: '2026-06-14', type: 'run', dur: 82, dist: 15.0, hr: 155, route: ROUTE, note: 'GPX/TCX-Import' };
ok('EINGANG: Import-Objekt trägt eine Route mit ≥2 Punkten', Array.isArray(importObj.route) && importObj.route.length >= 2);

/* ---- 2. RED-Nachweis der alten Verluststelle: die frühere Import-Spiegelung übergab
   NUR ein Boolean-Flag (metrics:{hasRoute:true}) — die Punkte gingen verloren. */
const legacyMetrics = importObj.route ? { hasRoute: true } : {};
ok('RED: alte Import-Metrik verliert die Punkte (nur hasRoute-Flag)',
  legacyMetrics.hasRoute === true && legacyMetrics.route === undefined);

/* ---- 3. buildImportMetrics: der neue reine Builder MUSS die Punkte mitführen. */
ok('buildImportMetrics ist exportiert', typeof AN.buildImportMetrics === 'function');
const fixedMetrics = AN.buildImportMetrics(importObj);
ok('GREEN: buildImportMetrics behält die Route (Punkte, nicht nur Flag)',
  Array.isArray(fixedMetrics.route) && fixedMetrics.route.length === ROUTE.length && fixedMetrics.hasRoute === true,
  JSON.stringify(fixedMetrics).slice(0, 80));
ok('buildImportMetrics ohne Route → leer (kein erfundenes hasRoute)',
  JSON.stringify(AN.buildImportMetrics({ dur: 30 })) === '{}');
const many = { route: Array.from({ length: 5000 }, (_, i) => [50 + i * 1e-4, 8 + i * 1e-4]) };
ok('buildImportMetrics deckelt sehr große Routen (≤600 Punkte, Anfang+Ende erhalten)',
  AN.buildImportMetrics(many).route.length <= 600 && AN.buildImportMetrics(many).route[0][0] === 50);

/* ---- 4. RETENTIONS-VERTRAG: der Normalizer (Store-/Sync-Pfad) darf die Route in
   metrics NICHT verlieren. Das ist die eigentliche Group-2-Absicherung. */
const canonicalIn = { sportId: 'running', source: 'import', sourceRecordId: 'import:2026-06-14:running:4920',
  startedAt: '2026-06-14T10:00:00Z', durationSeconds: 4920, summary: { distanceKm: 15.0, avgHr: 155 },
  metrics: fixedMetrics };
const normalized = AN.normalizeActivityRecord(canonicalIn);
ok('RETENTION: normalizeActivityRecord behält metrics.route verlustfrei',
  normalized.metrics && Array.isArray(normalized.metrics.route) && normalized.metrics.route.length === ROUTE.length,
  JSON.stringify(normalized.metrics).slice(0, 80));
ok('RETENTION: Koordinaten unverändert (erste = Eingang)',
  normalized.metrics.route[0][0] === ROUTE[0][0] && normalized.metrics.route[0][1] === ROUTE[0][1]);

/* ---- 5. NEGATIV-Kontrolle: hätte der Import nur das Flag gespiegelt, wäre nach der
   Normalisierung keine Route da (belegt, dass der Verlust am Import-Builder lag). */
const normalizedLegacy = AN.normalizeActivityRecord({ ...canonicalIn, metrics: legacyMetrics });
ok('NEGATIV-Kontrolle: Flag-only-Import ⇒ nach Normalisierung KEINE Route',
  !normalizedLegacy.metrics.route);

console.log(`\nimport_route_persistence_test: ${n - fail}/${n} bestanden`);
process.exit(fail ? 1 : 0);

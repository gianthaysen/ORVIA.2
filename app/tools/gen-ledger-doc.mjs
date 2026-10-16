#!/usr/bin/env node
/* ============================================================
   ORVIA · Generator fuer app/docs/PERFORMANCE-LEDGER.md (v8-448A)

   Rekorddefinitionen je Sportart und ihr Freigabestand werden NICHT von Hand geschrieben: sie kommen
   aus app/js/engine/performance-ledger.js (DEFS, MILESTONES) und dem Urteil von metric-eligibility
   fuer die Bezugs-Aktivitaeten aus gen-eligibility-doc (Garmin bestmoeglich belegt / eigene Daten).
   Aufruf:  node app/tools/gen-ledger-doc.mjs [--check]
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const OUT = join(APP, 'docs', 'PERFORMANCE-LEDGER.md');
const require = createRequire(import.meta.url);
globalThis.window = globalThis;
for (const f of ['js/onboarding/onboarding-sports-logic.js', 'js/training-domain.js', 'js/activity-normalize.js', 'js/activity-config.js', 'js/activity-time.js']) require(join(APP, f));
const GEN = await import(join(HERE, 'gen-eligibility-doc.mjs'));
require(join(APP, 'js', 'engine', 'performance-ledger.js'));
const L = globalThis.ORVIA.performanceLedger, ME = globalThis.ORVIA.metricEligibility;

const SPORT_LABEL = { running: 'Laufen', walking: 'Gehen', hiking: 'Wandern', cycling: 'Radfahren', swimming: 'Schwimmen', rowing: 'Rudern', gym: 'Krafttraining',
  triathlon: 'Triathlon', football: 'Fußball', handball: 'Handball', padel: 'Padel', tennis: 'Tennis', athletics: 'Leichtathletik', basketball: 'Basketball',
  mobility: 'Mobility', volleyball: 'Volleyball', hockey: 'Hockey', rugby: 'Rugby', badminton: 'Badminton', golf: 'Golf', climbing: 'Klettern', yoga: 'Yoga', hyrox: 'HYROX' };
const KIND_DE = { fastest_time: 'schnellste Zeit (niedriger ist besser)', longest_distance: 'längste Distanz', longest_duration: 'längste Dauer',
  greatest_volume: 'größtes Volumen', highest: 'höchster Wert', lowest: 'niedrigster Wert' };

/* Freigabe einer Definition: Garmin (bester Beleg, Herkunft vollstaendig) und eigene Daten (manuell / ORVIA-Workout) */
function verdict(d, variant) {
  const sport = d.sport;
  const a = variant === 'own' ? { id: 'own', sportId: sport, source: sport === 'gym' ? 'orvia_workout' : 'manual', status: 'completed', startedAt: '2026-10-01T06:00:00.000Z',
    durationSeconds: 3600, summary: sport === 'gym' ? { totalVolumeKg: 8400 } : { distanceM: 10000, distanceKm: 10 }, metrics: {} }
    : GEN.referenceActivity(['running', 'cycling', 'swimming', 'gym', 'walking', 'hiking', 'rowing'].includes(sport) ? sport : 'running', 'best');
  if (variant !== 'own') { a.sportId = sport; }
  const r = ME.evaluate(a, d.metric, d.opts);
  return r.eligible ? '**frei**' : '`' + r.reason + '`';
}

export function render() {
  const out = [`# Athlete Performance Ledger

**Status: IMPLEMENTIERT, INTEGRIERT HINTER FLAG (\`performance_ledger\`, Standard aus, keine sichtbare Änderung)** · Rechenversion \`${L.CALC_VERSION}\` · v8-448B

> Erzeugt: \`node app/tools/gen-ledger-doc.mjs\`. Definitionen und Freigaben kommen aus dem Code
> (\`app/js/engine/performance-ledger.js\`, \`app/js/engine/metric-eligibility.js\`); ein Test vergleicht Datei und Code.

## 1 · Aufbau

| Baustein | Datei | Aufgabe |
|---|---|---|
| Rechenkern (rein) | \`app/js/engine/performance-ledger.js\` | Definitionen, Einträge, Rekordhistorie, Meilensteine, inkrementelle Aktualisierung |
| Urteil + Wert | \`app/js/engine/metric-eligibility.js\` | einzige Stelle, die entscheidet, ob ein Wert zählt — und welcher (\`evaluate().value\`) |
| Wirksamer Wert | \`app/js/activity-effective.js\` | manuelle Korrekturen (z. B. 341 → 75 min) |
| Doppelte | \`app/js/activity-config.js\` \`attachRecordings\` | gekoppelte Uhr-Aufzeichnung ist keine eigene Einheit |
| Nachführen | \`app/js/performance-ledger-store.js\` | Flag (fail-closed, je Sitzung fest), vollständiger Bestand (Index + Änderungen), IndexedDB-Zwischenspeicher je Nutzer, Speichern in Teilen, Probelauf \`dryRun()\` |
| Umschalten | \`app/js/engine/records-bridge.js\` | einzige Stelle, die entscheidet, ob run-bests / pb-sync / achievements aus dem Register lesen (\`off\` · \`pending\` · \`on\`) |
| Speichern | \`app/js/repos/performanceLedgerRepository.js\` | RPC \`orvia_ledger_apply\` (eine Transaktion) |
| Datenbank | \`supabase/migrations/0051_performance_ledger.sql\` | Tabellen, RLS, Konsistenzregeln, „neu zu berechnen", Flag-Name |
| Ansicht | \`app/js/screens/performance-ledger-view.js\` | „Leistungsentwicklung": Bestwerte, Verlauf, Verbesserungen, Sportart-Überblick, Monatsumfang, Meilensteine, Herkunft je Rekord, Wartendes |

## 2 · Regeln

- **Eintrag** je Aktivität × Definition: \`value\`/\`unit\` nur, wenn die Eligibility freigibt; sonst \`blocked\` mit Grund und **ohne Wert**.
- **Kennzahl** = \`<sportart>.<rekord>@<kontextklasse>\`. Kontextklassen: \`standard\` (nicht als indoor/virtuell belegt), \`indoor\`, \`virtual\`, \`pool\`, \`open_water\`.
  Verschiedene Klassen werden **nie** verglichen (Rolle ≠ Straße, Laufband ≠ draußen, Becken ≠ Freiwasser). Kontext kommt aus dem Garmin-Typ
  oder — bei eigenen Daten — aus der Eingabe des Nutzers; nie aus GPS, Titel oder Uhrzeit.
- **Historie** je Kennzahl aus allen freigegebenen Einträgen, sortiert nach dem **UTC-Zeitpunkt der Aktivität** (nie Importzeit; angezeigt in Ortszeit):
  \`first\` · \`improved\` (echt besser auf der Genauigkeitsstufe der Einheit: ${Object.entries(L.PRECISION).map(([u, p]) => u + ' ' + p).join(', ')}) · \`equalled\` (gleich; der frühere Halter bleibt).
  Jede Verbesserung trägt Vorgänger, Verbesserung (absolut, %), Tage seit dem Vorgänger, Datum.
- **Neuberechnung** immer vollständig für genau die betroffenen Kennzahlen → Nachimport älterer Einheiten, Korrektur, Löschung und
  Reimport ergeben dieselbe Historie wie eine Berechnung von Grund auf (Test). Jede Änderung steht im Protokoll (\`performance_ledger_log\`).
- **Geltungsbereich:** „ORVIA-Bestwert seit <erste Aktivität der Sportart>". Ein Allzeitrekord wird nie behauptet.
- **Inkrementell:** Fingerabdruck je Aktivität (Eingabe ohne volle Messreihen + Belegstand der Eligibility). Unverändert = nicht neu geprüft.
  Steigt eine Belegstufe (z. B. nach dem Census), rechnet das Register automatisch alles neu.

## 3 · Rekorde je Sportart

Freigabe heute: **Garmin** = Bezugs-Aktivität mit bestmöglichem Beleg (Vertrag 3, volle Auflösung, Herkunft vollständig) · **eigene Daten** = manuelle Einheit / ORVIA-Workout.

| Sportart | Rekord | Art | Kennzahl (Eligibility) | Garmin | eigene Daten |
|---|---|---|---|---|---|`];
  const seen = new Set();
  for (const d of L.DEFS) {
    const s = d.sport;
    const label = SPORT_LABEL[s] || s;
    const optTxt = d.opts.targetM ? ' (' + d.opts.targetM + ' m)' : d.opts.windowS ? ' (' + d.opts.windowS + ' s)' : '';
    out.push(`| ${label} | ${d.label} | ${KIND_DE[d.kind]} | \`${d.metric}\`${optTxt} | ${verdict(d, 'garmin')} | ${verdict(d, 'own')} |`);
    seen.add(s);
  }
  out.push(`
Sportarten nur mit „Längste Einheit" (Dauer): ${L.DEFS.filter(d => d.kind === 'longest_duration' && d.byContext === false && d.sport !== 'gym').map(d => SPORT_LABEL[d.sport] || d.sport).join(', ')}.
\`other\` hat bewusst keinen Rekord (unvergleichbar).

## 4 · Meilensteine

| Meilenstein | Regel |
|---|---|
${L.MILESTONES.map(m => '| ' + m.label + ' | ' + (m.kind === 'first_distance' ? 'erste Einheit mit freigegebener Distanz ≥ ' + m.threshold + ' m (' + m.sport + ')'
    : m.kind === 'month_distance' ? 'Kalendermonat (Ortszeit) mit Summe freigegebener Distanzen ≥ ' + m.threshold + ' m; gesperrte zählen nicht (Summe = Untergrenze, markiert)'
    : 'jede Verbesserung einer Distanz-Kennzahl') + ' |').join('\n')}

## 5 · Was wartet

Gesperrt bleibt alles, was die Eligibility nicht freigibt — heute vor allem \`unverified_semantics\` (Bedeutung der Garmin-Quelle für die Sportart
nicht belegt): Garmin-Distanz/-Dauer bei Rad, Schwimmen, Gehen, Wandern, Rudern, Kraft; Leistungs-Bestwerte. Sobald der Census bzw. ein Vergleich mit
Garmin Connect die Belegstufe hebt (\`EVIDENCE\` in metric-eligibility.js), werden diese Kennzahlen ohne Codeänderung am Register frei und die Historie
wird rückwirkend rekonstruiert.

## 6 · Zeit

- **Reihenfolge** = UTC-Zeitpunkt: \`garmin.start_gmt\` → \`startedAt\` mit Zonenangabe → Wanduhrzeit, umgerechnet mit der Zeitzone des Nutzers.
  Herbst-Umstellung (doppelte Stunde): erste Stunde. Frühjahrs-Lücke: nach vorn verschoben. Die Grundlage steht je Eintrag (\`utcBasis\`).
- **Anzeige** = Ortszeit der Aktivität (Kalendertag, Monat). Eine Reise über Zeitzonen ändert die Reihenfolge nicht.

## 7 · Verhältnis zu bestehenden Auswertungen (records-bridge)

| Bestehend | Flag aus (\`off\`) | Flag an, Register lädt (\`pending\`) | Register bereit (\`on\`) |
|---|---|---|---|
| \`run-bests.js\` Lauf 1 km … Marathon | unverändert | unverändert angezeigt | **nur** Register (Kontext standard) |
| \`run-bests.js\` Rad / Schwimmen | unverändert | unverändert | unverändert (kennt das Register nicht) |
| \`engine/pb-sync.js\` → Profil | unverändert | **pausiert** (kein Hin-und-her) | aus Register-Bestzeiten |
| \`achievements.js\` Einzelmaxima | unverändert | unverändert | nur freigegebene Distanzen, Kontext standard |
| \`achievements.js\` Summen | unverändert | unverändert | nur freigegebene Distanzen, alle Kontexte |
| \`engine/highlights.js\` (vorbereitet) | — | — | bekommt künftig Rekord-Ereignisse als belegte Kandidaten |

Kein Rekord wird an zwei Stellen gerechnet: was das Register kennt, kommt bei \`on\` nur aus dem Register.

## 8 · Vollständiger Bestand

Die App lädt sonst nur die jüngsten 200 Aktivitäten. Das Register liest einen schlanken Index über **alle** Aktivitäten (Schlüssel-Blättern,
je 1000), holt nur geänderte Zeilen (\`updated_at\`) mit genau den Feldern der Prüfung und gilt erst dann als vollständig, wenn jede Seite gelesen wurde.
Eine Aktivität gilt nur als gelöscht, wenn (a) der Index vollständig ist **und** die Gegenprobe ihre Abwesenheit bestätigt, oder (b) sie lokal
ausdrücklich gelöscht wurde (Tombstone). Nicht geladen heißt nie gelöscht.

## 9 · Freigabeplan (nicht Teil dieses Schritts — jeder Schritt durch Gian)

1. **App ausliefern, Flag aus** (Build ≥ v8-448). Erwartung: keine sichtbare Änderung; run-bests, Profil-Bestzeiten und Medaillen identisch.
2. **Echtdaten-Probelauf, schreibt nichts, braucht keine Migration:** angemeldet in der Desktop-Konsole
   \`await ORVIA.performanceLedgerStore.dryRun()\` → \`report.meta\` (\`complete: true\`, \`indexed\` = Anzahl Aktivitäten),
   \`report.records\`, \`report.waiting\`, \`report.legacyComparison.running\` (je Distanz \`gleich\` / \`abweichend\` / \`nur_bisher\` / \`nur_register\`).
   Jede Abweichung erklären, bevor es weitergeht (typisch: Laufband-Einheit, gesperrte Distanz, Einheit außerhalb der 200 geladenen).
3. **Migration 0051** im SQL-Editor (vorher lokal geprüft: \`supabase/tests/performance_ledger_db_v448_test.mjs\`).
   Rückweg: \`supabase/migrations_rollback/0051_performance_ledger_rollback.sql\`.
4. **Flag nur für das eigene Konto** (service_role, Befehl im Kopf der Migration). Erster Lauf vollständig, danach inkrementell.
5. **Prüfen:** Profil → Bestzeiten → „Leistungsentwicklung"; Herkunft je Rekord; Tabelle \`performance_ledger_log\`; zweites Gerät / Neustart (Zwischenspeicher).
6. **Rücknahme** jederzeit: Flag aus (sofort wirksam) → bisherige Anzeigen wie vor dem Einschalten; Daten bleiben unberührt.
7. Erst nach mehreren Tagen ohne Abweichung: weitere Konten.
`);
  return out.join('\n').trimEnd() + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = render();
  if (process.argv.includes('--check')) {
    const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (cur !== text) { console.error('PERFORMANCE-LEDGER.md ist veraltet — node app/tools/gen-ledger-doc.mjs'); process.exit(1); }
    console.log('Ledger-Dokument aktuell.');
  } else { writeFileSync(OUT, text); console.log('geschrieben: ' + OUT + ' (' + text.length + ' Zeichen)'); }
}

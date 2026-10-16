#!/usr/bin/env node
/* ============================================================
   ORVIA · Generator fuer app/docs/PERFORMANCE-DATA-ELIGIBILITY.md (v8-447.3)

   Die Spalten „ledger eligible?" und „reason" werden NICHT von Hand geschrieben: sie sind
   das Urteil von app/js/engine/metric-eligibility.js fuer eine Bezugs-Aktivitaet je Sportart
   („bestmoeglicher Fall": Garmin, Details-Vertrag 3, vollstaendig geliefert, alle Felder da).
   Ist selbst der beste Fall nicht zulaessig, liegt es an einem fehlenden BELEG — und genau
   das zeigt das Dokument. Ein Test vergleicht Datei und Ausgabe dieses Werkzeugs.

   Aufruf:  node app/tools/gen-eligibility-doc.mjs [--check]
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const OUT = join(APP, 'docs', 'PERFORMANCE-DATA-ELIGIBILITY.md');
const require = createRequire(import.meta.url);
globalThis.ORVIA = globalThis.ORVIA || {};
require(join(APP, 'js', 'activity-effective.js'));
require(join(APP, 'js', 'activity-streams.js'));
require(join(APP, 'js', 'activity-capabilities.js'));
const ME = require(join(APP, 'js', 'engine', 'metric-eligibility.js'));

/* ---- Bezugs-Aktivitaeten: der beste Fall je Sportart ------------------- */
const T = [0, 60, 120, 180, 240, 300];
const windows = q => Object.fromEntries(ME.POWER_WINDOWS.map(w => [String(w), { w: 250, at: 10, q }]));
const targets = () => Object.fromEntries(ME.DISTANCE_TARGETS.map(t => [String(t), { s: Math.round(t * 0.3), over_m: 2, at: 0, q: 'measured' }]));

/* Varianten: best (alles belegt und bestaetigt) · backfilled (Herkunft + Rohfelder da, Bedeutungspruefung
   noch nicht gelaufen) · prod (Stand 15.10.2026 fuer 40 von 41: volle Aufloesung, aber kein Typ, keine
   Startzeiten, keine Rohfelder) · thinned (ausgeduennt) · legacy (Vertrag < 3) · own (eigene Daten) */
export function referenceActivity(sport, variant) {
  const v = variant || 'best';
  if (v === 'own') {
    return { id: 'own-' + sport, sportId: sport, source: sport === 'gym' ? 'orvia_workout' : 'manual', status: 'completed', durationSeconds: 3600,
      summary: sport === 'gym' ? { totalVolumeKg: 8400, workingSetCount: 18 } : { distanceM: 10000, avgHr: 150, maxHr: 172 }, metrics: {} };
  }
  const cad = sport === 'running' ? { stream: [170, 171, 172, 171, 170, 172], meta: { kind: 'running_cadence_spm', unit: 'spm', source: 'directDoubleCadence' } }
    : sport === 'cycling' ? { stream: [90, 91, 92, 91, 90, 92], meta: { kind: 'cycling_cadence_rpm', unit: 'rpm', source: 'directBikeCadence' } } : null;
  const hasPower = sport === 'cycling' || sport === 'rowing' || sport === 'running';
  const hasDist = sport !== 'gym' && sport !== 'swimming';
  const streams = { time: T, heart_rate: [140, 150, 152, 151, 150, 149] };
  const meta = { time: { kind: 'elapsed_s', unit: 's', source: 'directTimestamp' } };
  if (hasDist) streams.distance = [0, 2000, 4000, 6000, 8000, 10000];
  if (cad) { streams.cadence = cad.stream; meta.cadence = cad.meta; }
  if (hasPower) streams.power = [240, 250, 255, 250, 248, 252];
  const stats = { heart_rate: { n: 3600, avg: 150, max: 172 } };
  if (cad) stats.cadence = { n: 3600, avg: 171, max: 180, kind: cad.meta.kind };
  if (hasPower) stats.power = { n: 3600, avg: 250, max: 620 };
  const be = { v: 1, rows: 3600, total: 3600, native: v !== 'thinned', time_source: 'directTimestamp', stats };
  const prov = v === 'prod' ? {} : { type_key: sport === 'swimming' ? 'lap_swimming' : sport, start_gmt: '2026-10-08T06:00:00Z',
    start_local: '2026-10-08T08:00:00', utc_offset_s: 7200 };
  if (hasPower) be.power = { v: 1, basis: 'elapsed', status: 'ok', native: v !== 'thinned', interval_s: v === 'thinned' ? 3 : 1, windows: windows(v === 'thinned' ? 'approx' : 'exact') };
  if (ME.sportsOf('distanceBest').includes(sport)) be.distance = { v: 1, basis: 'elapsed', status: 'ok', targets: targets() };
  const fields = { duration: 3600, distance: 10000, averageHR: 150, maxHR: 172, calories: 700, aerobicTrainingEffect: 3.2 };
  if (sport === 'swimming') Object.assign(fields, { poolLength: 25, averageSwolf: 38, averageSwimCadenceInStrokesPerMinute: 27 });
  if (sport === 'gym') Object.assign(fields, { totalSets: 18, totalReps: 140, totalVolume: 8400000 });
  const a = { id: 'ref-' + sport, sportId: sport, source: 'garmin', status: 'completed', durationSeconds: 3600,
    summary: { avgHr: 150, maxHr: 172, caloriesKcal: 700 },
    metrics: { detailsVersion: v === 'legacy' ? 2 : 3, detailsFetchedAt: '2026-10-08T06:00:00Z', streams, stream_meta: v === 'legacy' ? undefined : meta,
      garmin: { v: 1, ...prov, timer_duration_s: 3600, moving_duration_s: 3590, elapsed_duration_s: 3700, stream_rows: 3600, stream_total: 3600,
        /* Bestaetigung der Summenwerte gibt es nur aus vollstaendiger Lieferung (Worker: semantic_checks.confirmed) */
        semantics_ok: v === 'best' && sport === 'running' ? { averageRunningCadence: { reading: 'directDoubleCadence zeitgewichtet ohne Nullen', list: 171 } } : undefined },
      best_efforts: v === 'legacy' ? undefined : be, ext: v === 'prod' ? { v: 1, series: {} } : { v: 1, fields } } };
  if (sport !== 'gym') a.summary.distanceM = sport === 'swimming' ? 2000 : 10000;
  if (v === 'legacy') { delete a.metrics.streams.time; delete a.metrics.garmin.timer_duration_s; }
  return a;
}

/* ---- feste Beschreibung je Kennzahl ------------------------------------ */
const DOC = {
  duration: { label: 'Dauer', source: 'Spalte `duration_seconds` (Garmin: Timer-Dauer des Listeneintrags; ORVIA-Workout: Zeitstempel der Session)',
    cond: 'Garmin: Details-Vertrag 3 und `garmin.timer_duration_s` weicht höchstens 5 s / 1 % ab', manual: 'wirksamer Wert zählt; bleibt als manuell markiert; Quelle bleibt erhalten',
    safe: 'ja, sobald nachgeladen', note: 'Bewegungs- und verstrichene Zeit stehen getrennt in `metrics.garmin`' },
  distance: { label: 'Distanz', source: '`summary.distanceM` (Garmin: Listenfeld `distance`)',
    cond: 'Garmin: Details-Vertrag 3 und Ende der Reihe `streams.distance` weicht höchstens 20 m / 1 % ab', manual: 'Modell vorbereitet, Eingabe in der App nicht freigegeben',
    safe: 'ja, sobald nachgeladen', note: 'Schwimmen: Distanz = Bahnen × Bahnlänge laut Uhr — Bedeutung unbelegt' },
  pace: { label: 'Tempo (Ø)', source: 'Distanz / Dauer (beide wirksam)', cond: 'wie Dauer und Distanz', manual: 'erbt die Markierung von Dauer / Distanz', safe: 'ja, sobald nachgeladen', note: 'nur Lauf, Gehen, Wandern' },
  heartRate: { label: 'Herzfrequenz (Ø)', source: '`best_efforts.stats.heart_rate.avg` — alle gelieferten Zeilen',
    cond: 'Details-Vertrag 3; weicht höchstens 2 bpm vom Listenwert ab; bei Ausdünnung als Näherung gekennzeichnet', manual: 'keine Korrektur vorgesehen', safe: 'ja, sobald nachgeladen', note: 'nicht aus der Anzeige-Reihe' },
  maxHeartRate: { label: 'Herzfrequenz (Max)', source: '`best_efforts.stats.heart_rate.max`',
    cond: 'nur wenn Garmin alle Zeilen lieferte — ein Maximum aus ausgedünnten Zeilen ist eine Untergrenze', manual: 'keine Korrektur vorgesehen', safe: 'nur mit vollständiger Lieferung', note: 'Listenfeld `maxHR` ist nicht belegt' },
  runningCadence: { label: 'Schrittfrequenz (Ø)', source: '`best_efforts.stats.cadence` aus `directDoubleCadence`',
    cond: 'Details-Vertrag 3, Bedeutung der Reihe = `running_cadence_spm`', manual: 'keine Korrektur vorgesehen', safe: 'ja, sobald nachgeladen — Altwerte (Halbwert-Verdacht) nie', note: 'Listenfeld der Ø-Kadenz wird nicht benutzt' },
  cyclingCadence: { label: 'Trittfrequenz (Ø)', source: '`best_efforts.stats.cadence` aus `directBikeCadence`',
    cond: 'Details-Vertrag 3, Bedeutung = `cycling_cadence_rpm`', manual: 'keine Korrektur vorgesehen', safe: 'erst nach Beleg', note: 'Quellname unbelegt (kein Rad-Mitschnitt)' },
  power: { label: 'Leistung (Ø)', source: '`best_efforts.stats.power`', cond: 'Details-Vertrag 3', manual: 'keine Korrektur vorgesehen', safe: 'erst nach Beleg', note: 'Quellname `directPower` unbelegt' },
  powerBest: { label: 'Leistungs-Bestwert', source: '`best_efforts.power.windows` — Worker, vor der Ausdünnung',
    cond: 'Güte `exact`: Garmin lieferte alle Zeilen, sekündliche Aufzeichnung; kein Sensor-Aussetzer im Fenster; Fenster auf verstrichener Zeit', manual: 'Konflikt, wenn die korrigierte Dauer kürzer ist als das Fenster',
    safe: 'erst nach Beleg und nur bei vollständiger Lieferung', note: 'Fenster: 1 s … 60 min' },
  distanceBest: { label: 'Strecken-Bestzeit', source: '`best_efforts.distance.targets` — Worker, vor der Ausdünnung',
    cond: 'Güte `measured`: zwischen zwei echten Messzeilen, Überhang ≤ 1 % / 10 m; verstrichene Zeit', manual: 'Konflikt, wenn die korrigierte Dauer kürzer ist als die Bestzeit',
    safe: 'ja, sobald nachgeladen', note: 'gemessene Obergrenze der wahren Bestzeit — nie zu schnell' },
  distanceBestActive: { label: 'Aktive Strecken-Bestzeit', source: 'kleinster von: `best_efforts.distance_active.targets` (Timer-Achse, Worker v8-449.1) · ganze Aktivität mit `garmin.timer_duration_s`, wenn ihre Distanz die Zielstrecke trifft · verstrichenes Fenster als Obergrenze',
    cond: 'Timer = Garmin `sumDuration` (manuelle und Auto-Pause ausgeschlossen, nicht unterscheidbar); ganze Aktivität nur bei Überhang ≤ 10 m / 1 %; Strecke bei stehendem Timer = `pause_conflict`', manual: 'korrigierte Dauer zählt als Gesamtzeit der Aktivität (manuell markiert)',
    safe: 'ja — Messgrundlage je Wert benannt', note: 'aktive Trainingsbestzeit, nie mit der Bestzeit einschließlich Pausen verglichen; keine Bewegungszeit' },
  raceResult: { label: 'Wettkampf-Bestzeit', source: 'ganze Aktivität, verstrichene Zeit (`garmin.elapsed_duration_s`; eigene Daten: Angabe)',
    cond: 'nur, wenn du die Aktivität als Wettkampfergebnis bestätigt hast; Distanz trifft die Wettkampfstrecke (≤ 10 m / 1 %)', manual: 'wirksame Dauer bei eigenen Daten',
    safe: 'vorbereitet — nur bestätigte Ergebnisse', note: 'nie aus Sportart oder Datum geraten' },
  swolf: { label: 'SWOLF', source: '`ext.fields.averageSwolf`', cond: 'Garmin-Typ `lap_swimming`, Bahnlänge bekannt', manual: 'keine Korrektur vorgesehen', safe: 'erst nach Beleg', note: 'alle Schwimm-Felder unbelegt' },
  strokeRate: { label: 'Zugfrequenz', source: '`ext.fields.averageSwimCadenceInStrokesPerMinute`', cond: 'Garmin-Typ `lap_swimming`, Bahnlänge bekannt', manual: 'keine Korrektur vorgesehen', safe: 'erst nach Beleg', note: 'eigene Größe — nie in der Reihe `cadence`' },
  trainingEffect: { label: 'Training Effect', source: '`ext.fields.aerobicTrainingEffect`', cond: 'Feld geliefert', manual: 'keine Korrektur vorgesehen', safe: 'erst nach Beleg', note: 'nur im Rohblock (Serverliste)' },
  strengthVolume: { label: 'Kraft-Volumen', source: 'ORVIA-Workout: `summary.totalVolumeKg`', cond: 'eigene Sätze mit Gewicht', manual: 'folgt den Sätzen des Workouts', safe: 'ja (eigene Daten)', note: 'Garmin `totalVolume`: Einheit unbelegt' },
  calories: { label: 'Kalorien', source: '`summary.caloriesKcal` (Garmin-Listenfeld)', cond: 'Feld geliefert', manual: 'keine Korrektur vorgesehen', safe: 'erst nach Beleg', note: 'keine Leistungskennzahl' },
  ftp: { label: 'FTP', source: 'keine Aktivitäts-Kennzahl (Tagesmessung `user_metrics.ftp_watts`)', cond: '—', manual: '—', safe: 'nein (nicht aus Aktivitäten)', note: 'gehört dem Athleten, nicht der Einheit' }
};
const REASON_DE = { missing_data: 'Wert oder Grundlage fehlt', legacy_schema: 'noch nicht nachgeladen', unverified_semantics: 'Bedeutung der Quelle nicht belegt',
  insufficient_resolution: 'Auflösung reicht nicht', invalid_time_axis: 'Zeitachse fehlt / ungültig', unsupported_source: 'Quelle kann das nicht tragen',
  unsupported_sport: 'gibt es für die Sportart nicht', manual_override_conflict: 'manuelle Korrektur widerspricht der Aufzeichnung', not_completed: 'nicht abgeschlossen',
  unverified_context: 'kontextgebundene Auswertung verlangt, Kontext nicht belegt', pause_conflict: 'Strecke bei angehaltenem Timer', unknown_metric: 'unbekannt' };
const EV_DE = { fixture: 'ja — Mitschnitt', validated: 'ja — gegen Garmin Connect geprüft', own: 'eigene Daten', observed: 'geliefert, Bedeutung offen', library: 'nur Bibliothek', assumed: 'nein — angenommen' };

const SPORTS = ['running', 'cycling', 'swimming', 'gym', 'walking', 'hiking', 'rowing'];
const cell = v => String(v == null || v === '' ? '—' : v).replace(/\|/g, '\\|');

function rowsFor(sport, variant) {
  const a = referenceActivity(sport, variant);
  const rows = [];
  for (const metric of ME.METRICS) {
    const sp = ME.sportsOf(metric);
    if (sp && !sp.includes(sport)) continue;
    if (metric === 'ftp' && sport !== 'cycling') continue;
    const param = ME.paramOf(metric);
    const opts = param === 'windowS' ? { windowS: 300 } : param === 'targetM' ? { targetM: 5000 } : {};
    const r = ME.evaluate(a, metric, opts);
    const ev = Object.entries(r.provenance.evidence);
    rows.push({ sport, metric, r, ev, label: DOC[metric].label + (param === 'windowS' ? ' (alle Fenster)' : param === 'targetM' ? ' (alle Distanzen)' : '') });
  }
  return rows;
}

export function render() {
  const out = [`# Performance-Daten: Was darf ins Leistungsregister?

**Status: IMPLEMENTIERT, AUSGELIEFERT HINTER FLAG (\`performance_ledger\`, Standard aus)** · Stand v8-449.1 · Prüfinstanz des Athlete Performance Ledger

> Diese Datei wird **erzeugt**: \`node app/tools/gen-eligibility-doc.mjs\`. Die Spalten *ledger eligible?* und *reason*
> sind das Urteil von \`app/js/engine/metric-eligibility.js\` — nicht von Hand geschrieben. Ein Test vergleicht Datei und Code.
> Das Modul wird seit v8-448B von der App geladen und ist die **einzige** Prüfinstanz des Leistungsregisters.
> Es wirkt erst, wenn das Flag \`performance_ledger\` für ein Konto an ist; bis dahin ruft es niemand auf.

## 1 · Die Frage

„Welche meiner ORVIA-Daten darf ich guten Gewissens für historische Rekorde, Fortschritte, Ziele und Highlights verwenden?"

Antwort je **Kennzahl**, nicht je Aktivität: eine Einheit kann eine belastbare Distanz und eine unbelegte Kadenz tragen.
\`ORVIA.metricEligibility.evaluate(aktivität, kennzahl)\` liefert \`{ eligible, reason, reasons, provenance }\`.

Eine Kennzahl ist zulässig, wenn sie

1. **vorhanden** ist — der Wert steht in der Zeile;
2. **normalisiert** ist — Garmin-Zeile auf Details-Vertrag ${ME.DETAILS_VERSION_CURRENT}, Bedeutung der Messreihe vermerkt;
3. **belegt** ist — die *Bedeutung* der Quelle ist für diese Sportart nachgewiesen (Mitschnitt, dokumentierter Vergleich mit Garmin Connect, oder eigene Daten);
4. **gestützt** ist — wo es zwei unabhängige Angaben gibt (Listenwert und Aufzeichnung), stimmen sie überein.

Sonst: nicht zulässig, mit Grund. „Wahrscheinlich richtig" gibt es nicht.

## 2 · Gründe

| reason | Bedeutung |
|---|---|
${Object.entries(REASON_DE).map(([k, v]) => `| \`${k}\` | ${v} |`).join('\n')}

## 3 · Belege heute

Zulässig machen nur die Stufen **${ME.TRUSTED.join(', ')}**. Der einzige echte Mitschnitt im Repo ist die Detailantwort **eines Laufs**.

| Beleg | Sportarten mit Nachweis | sonst |
|---|---|---|
${Object.entries(ME.EVIDENCE).map(([k, v]) => `| \`${k}\` | ${Object.entries(v).filter(([s]) => s !== '*').map(([s, l]) => `${s}: ${l}`).join(', ') || '—'} | ${v['*'] || 'assumed'} |`).join('\n')}

Im Produktions-Zensus **geliefert** heißt nicht **belegt**: der Zensus zeigt, dass Garmin ein Feld schickt — nicht, was es bedeutet.
Hochgestuft wird eine Zeile erst durch einen Mitschnitt (\`fixture\`) oder einen dokumentierten Vergleich mit Garmin Connect
(\`validated\`, mit Datum in \`VALIDATIONS\`). Dokumentierte Vergleiche bisher: ${Object.keys(ME.VALIDATIONS).length || 'keine'}.

## 4 · Je Sportart — bester Fall

Bezugs-Aktivitäten: Garmin, Details-Vertrag ${ME.DETAILS_VERSION_CURRENT}, **vollständig geliefert**, alle Felder vorhanden. Ist selbst dieser Fall nicht
zulässig, fehlt ein Beleg — nicht ein Wert.

| sport | metric | source | observed? | normalized? | quality conditions | manual override behavior | ledger eligible? | reason | historical backfill safe? | notes |
|---|---|---|---|---|---|---|---|---|---|---|`];
  for (const sport of SPORTS) {
    for (const x of rowsFor(sport, 'best')) {
      const d = DOC[x.metric];
      const observed = x.ev.length ? x.ev.map(([k, l]) => `${k}: ${EV_DE[l] || l}`).join('; ') : '—';
      const normalized = x.r.reasons.includes('unsupported_source') && x.metric === 'ftp' ? '—' : `ja (Vertrag ${ME.DETAILS_VERSION_CURRENT})`;
      out.push(`| ${sport} | ${cell(x.label)} | ${cell(d.source)} | ${cell(observed)} | ${normalized} | ${cell(d.cond)} | ${cell(d.manual)} | **${x.r.eligible ? 'ja' : 'nein'}** | ${x.r.eligible ? '—' : '`' + x.r.reason + '`'} | ${cell(x.r.eligible ? d.safe : (d.safe.startsWith('ja') ? 'nach Beleg' : d.safe))} | ${cell(d.note)} |`);
    }
  }
  out.push(`
## 5 · Eigene Daten (ORVIA-Workout, manuelle Eingabe)

| sport | metric | source | ledger eligible? | reason | notes |
|---|---|---|---|---|---|`);
  for (const sport of ['gym', 'running']) {
    const a = referenceActivity(sport, 'own');
    for (const metric of ['duration', 'distance', 'pace', 'heartRate', 'strengthVolume', 'distanceBest', 'powerBest']) {
      const sp = ME.sportsOf(metric);
      if (sp && !sp.includes(sport)) continue;
      if (sport === 'gym' && metric === 'distance') continue;
      const param = ME.paramOf(metric);
      const r = ME.evaluate(a, metric, param === 'windowS' ? { windowS: 300 } : param === 'targetM' ? { targetM: 5000 } : {});
      out.push(`| ${sport} (${a.source}) | ${DOC[metric].label} | ${cell(r.provenance.basis)} | **${r.eligible ? 'ja' : 'nein'}** | ${r.eligible ? '—' : '`' + r.reason + '`'} | ${metric === 'heartRate' ? 'eingegebener Wert' : metric.endsWith('Best') ? 'keine Aufzeichnung — kein Bestwert' : '—'} |`);
    }
  }
  const thin = ME.evaluate(referenceActivity('cycling', 'thinned'), 'powerBest', { windowS: 300, evidence: { 'details.power': { cycling: 'fixture' }, 'details.time': { cycling: 'fixture' } } });
  const legacy = ME.evaluate(referenceActivity('running', 'legacy'), 'runningCadence');
  out.push(`
## 6 · Zwei Fälle, die das Register kennen muss

- **Garmin hat ausgedünnt** (im einzigen Mitschnitt: 1855 von 5527 Zeilen): ein Leistungs-Bestwert ist dann höchstens eine
  Näherung → \`${thin.reason}\` — auch wenn die Bedeutung der Leistungsreihe belegt wäre. Zulässig wird er nur, wenn Garmin alle Zeilen liefert.
- **Altzeile** (Details-Vertrag < ${ME.DETAILS_VERSION_CURRENT}): die Schrittfrequenz kann der Halbwert sein → \`${legacy.reason}\`. Sie wird nie umgerechnet, nur neu geladen.

## 7 · Manuelle Korrekturen

- Das Register benutzt den **wirksamen** Wert (\`activityEffective\`): korrigiert ist korrigiert.
- Jede Antwort trägt \`provenance.manual\`. Ein Rekord aus einem korrigierten Wert ist möglich, bleibt aber als solcher erkennbar;
  die Quelle steht weiter in \`metrics.corrections\`.
- **Konflikt** (\`manual_override_conflict\`): ein Bestwert aus der Aufzeichnung, dessen Fenster länger ist als die manuell korrigierte Dauer,
  kann nicht stimmen — dann zählt keiner von beiden.

## 8 · Empfehlung für v8-448

Registerfähig bei vollständig gelieferten Daten (heutiger Belegstand; das Nachladen auf Vertrag 3 ist abgeschlossen):

${(() => { const ok = []; const no = [];
    for (const sport of SPORTS) for (const x of rowsFor(sport, 'best')) (x.r.eligible ? ok : no).push(`${sport}: ${x.label}`);
    return '**Ja:** ' + (ok.join(' · ') || '—') + '\n\n**Eigene Daten:** Dauer (alle Quellen), Kraft-Volumen (ORVIA-Workout), Distanz und Tempo manueller Einheiten.\n\n**Noch nicht** (' + no.length + ' Zeilen) — fast immer `unverified_semantics`: der Wert ist da, aber seine Bedeutung für diese Sportart ist nicht belegt. Der Weg dorthin: Feldzensus (Lieferung), dann Mitschnitt oder Vergleich mit Garmin Connect (Bedeutung).'; })()}

## 9 · Freigabe je Kennzahl (finales Gate v8-447.3)

Drei Stände je Kennzahl, alle vom Modul geurteilt (Bezugs-Aktivität wie Abschnitt 4):

- **heute** — Stand 15.10.2026 für 40 von 41 Garmin-Aktivitäten: vollständige Auflösung (maxchart=20000), aber ohne Garmin-Typ,
  ohne Startzeiten, ohne Rohfelder des Listeneintrags.
- **nach Herkunfts-Backfill** — \`PROVENANCE_BACKFILL=apply\`: Typ, UTC-/Ortszeit, Versatz und Rohfelder ergänzt (nur Liste, keine Detailabrufe).
- **nach Neuprüfung** — \`DETAIL_REFETCH_SEMANTICS=1\`: Details einmal neu geladen, damit die Bedeutungsprüfung mit den nun vorhandenen
  Rohfeldern läuft (nur dafür nötig: sie braucht alle Messzeilen).

| Freigabe | Bedeutung |
|---|---|
| **FREI** | heute registerfähig |
| **FREI NACH HERKUNFTS-BACKFILL** | registerfähig, sobald der Metadaten-Backfill gelaufen ist |
| **FREI NACH NEUPRÜFUNG** | zusätzlich erst nach dem einmaligen Neuladen für die Bedeutungsprüfung |
| **NICHT FREI** | Grund in Klammern — es fehlt ein Beleg; Backfill und Neuladen ändern daran nichts |

| Sportart | Kennzahl | Freigabe |
|---|---|---|
${(() => { const lines = [];
    for (const sport of SPORTS) {
      const best = rowsFor(sport, 'best'), mid = rowsFor(sport, 'backfilled'), now = rowsFor(sport, 'prod');
      best.forEach((x, i) => {
        const status = now[i].r.eligible ? '**FREI**' : mid[i].r.eligible ? '**FREI NACH HERKUNFTS-BACKFILL**'
          : x.r.eligible ? '**FREI NACH NEUPRÜFUNG**' : 'NICHT FREI (`' + x.r.reason + '`)';
        lines.push('| ' + sport + ' | ' + x.label + ' | ' + status + ' |');
      });
    }
    return lines.join('\n'); })()}
| eigene Daten | Dauer (ORVIA-Workout, manuell) | **FREI** — manuell korrigierte Werte zählen mit ihrem wirksamen Wert und bleiben gekennzeichnet |
| eigene Daten | Kraft-Volumen (ORVIA-Workout) | **FREI** |
| eigene Daten | Distanz / Tempo (manuelle Einheit) | **FREI** — Bestzeiten nicht (keine Aufzeichnung) |

Eine unvollständige Herkunft sperrt **keine** Kennzahl pauschal: Dauer, Distanz, Tempo, Herzfrequenz und Strecken-Bestzeit des Laufs
brauchen weder Typ noch Ortszeit. Gesperrt wird nur, was den Kontext oder die Rohfelder wirklich braucht.

## 10 · Kontext: Laufband, Rolle, Becken, Freiwasser

Kontext kommt **nur** aus Garmins Typ (\`metrics.garmin.type_key\`) und nur, wenn der Name ihn ausdrücklich nennt. Ein generischer Typ
(\`running\`, \`cycling\`) oder ein fehlender Typ = **unbelegt** (nicht „draußen"). Kein Raten aus GPS — auch virtuelle Fahrten haben eine
Strecke —, aus dem Titel oder der Uhrzeit. Kontextgebundene Auswertungen fragen mit \`opts.environment\` und bekommen sonst \`unverified_context\`.

| Garmin-Typ | Kontext |
|---|---|
${Object.entries(ME.CONTEXT).map(([k, v]) => '| `' + k + '` | ' + v + ' |').join('\n')}
| alle anderen / keiner | unbelegt |

| Fall | Urteil |
|---|---|
${(() => {
    const withType = (sport, tk) => { const a = referenceActivity(sport, 'best'); a.metrics.garmin.type_key = tk; if (!tk) delete a.metrics.garmin.type_key; return a; };
    const E = { evidence: { 'list.swim': { swimming: 'fixture' }, 'details.power': { cycling: 'fixture' }, 'details.time': { cycling: 'fixture' } } };
    const cases = [
      ['Lauf `running`: 5-km-Bestzeit', withType('running', 'running'), 'distanceBest', { targetM: 5000 }],
      ['Lauf ohne Garmin-Typ: 5-km-Bestzeit', withType('running', null), 'distanceBest', { targetM: 5000 }],
      ['Lauf `treadmill_running`: 5-km-Bestzeit', withType('running', 'treadmill_running'), 'distanceBest', { targetM: 5000 }],
      ['Lauf `running`: 5-km-Bestzeit **draußen** verlangt', withType('running', 'running'), 'distanceBest', { targetM: 5000, environment: 'outdoor' }],
      ['Lauf `trail_running`: 5-km-Bestzeit **draußen** verlangt', withType('running', 'trail_running'), 'distanceBest', { targetM: 5000, environment: 'outdoor' }],
      ['Rad `virtual_ride`: 20-min-Leistung **draußen** verlangt (Beleg Leistung angenommen)', withType('cycling', 'virtual_ride'), 'powerBest', Object.assign({ windowS: 1200, environment: 'outdoor' }, E)],
      ['Rad `road_biking`: 20-min-Leistung **draußen** verlangt (Beleg Leistung angenommen)', withType('cycling', 'road_biking'), 'powerBest', Object.assign({ windowS: 1200, environment: 'outdoor' }, E)],
      ['Schwimmen `lap_swimming`: SWOLF (Beleg angenommen)', withType('swimming', 'lap_swimming'), 'swolf', E],
      ['Schwimmen `open_water_swimming`: SWOLF', withType('swimming', 'open_water_swimming'), 'swolf', E],
      ['Schwimmen ohne Garmin-Typ: SWOLF', withType('swimming', null), 'swolf', E]
    ];
    return cases.map(([label, a, metric, opts]) => { const r = ME.evaluate(a, metric, opts);
      return '| ' + label + ' | ' + (r.eligible ? '**ja**' : 'nein (`' + r.reason + '`)') + ' |'; }).join('\n'); })()}

## 11 · Protokoll der Gates

| Datum | Prüfung | Ergebnis | Folge |
|---|---|---|---|
${ME.GATE_LOG.map(g => '| ' + g.date + ' | ' + g.what + ' | ' + g.result + ' | ' + g.consequence + ' |').join('\n')}
`);
  return out.join('\n').trimEnd() + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = render();
  if (process.argv.includes('--check')) {
    const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (cur !== text) { console.error('PERFORMANCE-DATA-ELIGIBILITY.md ist veraltet — node app/tools/gen-eligibility-doc.mjs'); process.exit(1); }
    console.log('Eligibility-Dokument aktuell.');
  } else {
    writeFileSync(OUT, text);
    console.log('geschrieben: ' + OUT + ' (' + text.length + ' Zeichen)');
  }
}

/* ORVIA · Phase 7 S3 (2026-08-05) — Kapazitäts-Adapter: kanonische Lastserie → capacity.perSport.
   Beweise:
   1. PURE-Fensterinvarianten identisch zum Producer (chronic28 = acute7 + prior21;
      activeLoadDays zählt L>0 ODER unknown; dataDays NUR L>0; insufficientChronic-Regel).
   2. INTEGRATION: die Adapter-loadHistory besteht die STRENGE Producer-Klassifikation
      der echten running-capacity-factory (kanonisch) — eine manipulierte Historie
      (Summeninvariante verletzt) wird von der Factory als nicht-kanonisch erkannt
      (Negativkontrolle: der Beweis misst wirklich).
   3. buildPerSport nutzt die ECHTE kanonische Formel (dailyLoadUnits) — keine eigene
      Lastformel im Adapter (Vertrag 2: kein zweiter Rechenweg).
   4. Ehrlichkeit: Sport ohne Daten ⇒ 'not_assessable'; unvollständige Dauer/Distanz
      ⇒ null + missingFields, nie Schätzwerte.
   node supabase/tests/phase7_s3_capacity_adapter_test.mjs [appRoot-absolut] */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2]) : (existsSync(join(_flat, 'index.html')) ? _flat : join(_flat, '..', 'app'));

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const R = f => readFileSync(join(APP, f), 'utf8');

/* Module in Ladereihenfolge (contracts vor pack — Load-Time-Hash). */
require(join(APP, 'js/engine/knowledge/knowledge-contracts.js'));
require(join(APP, 'js/engine/knowledge/knowledge-sources.js'));
require(join(APP, 'js/engine/knowledge/running-knowledge-pack.js'));
const RCF = require(join(APP, 'js/engine/running-capacity-factory.js'));
require(join(APP, 'js/activity-config.js'));
const CA = require(join(APP, 'js/engine/capacity-adapter.js'));
const AC = globalThis.ORVIA.activityConfig;

/* ============ 1) PURE-Fensterinvarianten ============ */
function entry(load, opts) { return Object.assign({ load: load, measuredLoad: load, estimatedLoad: 0, unknownUnits: 0, ambiguousUnits: 0, hardDay: false }, opts || {}); }
{
  /* 20 aktive Tage über die volle Spanne: heute 100, Tag 3 unknown-only, sonst Muster. */
  const entries = [];
  for (let i = 0; i < 28; i++) {
    if (i === 3) entries.push(entry(0, { measuredLoad: 0, unknownUnits: 1 }));      // aktiv OHNE Last
    else if (i % 2 === 0) entries.push(entry(100));
    else entries.push(entry(0));
  }
  const lh = CA.windowsFromDayEntries(entries);
  const q = lh.quality;
  ok('PURE · chronic28 = acute7 + prior21 (alle 5 Summenfelder)',
     ['measuredLoad', 'estimatedLoad', 'unknownUnits', 'ambiguousUnits', 'activeLoadDays']
       .every(k => q.chronic28[k] === q.acute7[k] + q.prior21[k]));
  ok('PURE · activeLoadDays zählt unknown-Tag mit, dataDays NICHT (dataDays < activeLoadDays)',
     q.chronic28.activeLoadDays === 15 && lh.dataDays === 14, 'active=' + q.chronic28.activeLoadDays + ' data=' + lh.dataDays);
  ok('PURE · unknownUnits im acute7-Fenster ⇒ ratioConfidence low (winConf-Regel identisch)',
     lh.ratioConfidence === 'low' && q.acuteConfidence === 'low');
  ok('PURE · acute7/chronic28PerWeek korrekt gerundet',
     lh.acute7 === 400 && lh.chronic28PerWeek === Math.round(1400 / 4), lh.acute7 + '/' + lh.chronic28PerWeek);
}
{
  /* Junge Historie: nur letzte 6 Tage aktiv ⇒ insufficientChronic + low. */
  const entries = [];
  for (let i = 0; i < 28; i++) entries.push(entry(i < 6 ? 80 : 0));
  const lh = CA.windowsFromDayEntries(entries);
  ok('PURE · reine letzte Woche ⇒ insufficientChronicHistory + low (Historienreife-Regel)',
     lh.quality.insufficientChronicHistory === true && lh.ratioConfidence === 'low'
     && lh.quality.historySpanDays === 6);
}
{
  /* hardStreak: gestern+vorgestern hart, heute egal. */
  const entries = [];
  for (let i = 0; i < 28; i++) entries.push(entry(50, { hardDay: i === 1 || i === 2 }));
  const lh = CA.windowsFromDayEntries(entries);
  ok('PURE · hardYesterday + hardStreak = aufeinanderfolgende harte Tage ab gestern',
     lh.hardYesterday === true && lh.hardStreak === 2);
  ok('PURE · negative Last ⇒ null (fail-closed wie dailyLoadSeries)',
     CA.windowsFromDayEntries([entry(-1)].concat(entries.slice(1))) === null);
  ok('PURE · falsche Länge ⇒ null', CA.windowsFromDayEntries(entries.slice(0, 27)) === null);
}

/* ============ 2) INTEGRATION: echte Factory klassifiziert die Adapter-Historie als kanonisch ============ */
function snapshotWith(lh) {
  return { schemaVersion: 1, now: Date.parse('2026-08-05T10:00:00Z'), today: '2026-08-05', timezone: 'Europe/Berlin',
    dataQuality: { missing: [] }, loadHistory: lh, athlete: { experienceLevel: 'recreational' }, currentMetrics: null };
}
{
  const entries = [];
  for (let i = 0; i < 28; i++) entries.push(entry(i % 2 === 0 ? 120 : 0));
  const lh = CA.windowsFromDayEntries(entries);
  const good = RCF.buildRunningCapacity(snapshotWith(lh));
  const goodStr = JSON.stringify(good);
  ok('FACTORY · Adapter-loadHistory: KEIN snapshot_loadhistory_invalid, KEIN quality_not_object',
     goodStr.indexOf('snapshot_loadhistory_invalid') < 0 && goodStr.indexOf('quality_not_object') < 0
     && goodStr.indexOf('window_invalid') < 0, good.status);
  /* Negativkontrolle: Summeninvariante verletzen ⇒ Factory erkennt Nicht-Kanonik. */
  const bad = JSON.parse(JSON.stringify(lh)); bad.quality.chronic28.measuredLoad += 7;
  const badRes = RCF.buildRunningCapacity(snapshotWith(bad));
  const badStr = JSON.stringify(badRes);
  ok('FACTORY-NEGATIVKONTROLLE · manipulierte Summeninvariante wird erkannt (Ergebnis degradiert)',
     badStr !== goodStr && /not_sum|quality|coherent/i.test(badStr), (badStr.match(/[a-z_]*not_sum[a-z_]*/) || ['(kein Code, aber Ergebnis abweichend)'])[0]);
}

/* ============ 3) buildPerSport mit der ECHTEN kanonischen Formel ============ */
{
  const acts = [];
  /* Laufen: 8 Läufe über 24 Tage, RPE+Dauer (gemessene sRPE-Last), 10 km je. */
  for (let i = 0; i < 24; i += 3) acts.push({ id: 'r' + i, sport: 'running', startedAt: shift('2026-08-05', -i) + 'T07:00:00Z', durationSeconds: 3600, summary: { rpe: 5 }, distanceKm: 10 });
  /* Rad: 4 Fahrten, ohne Distanz (kmComplete=false). */
  for (let i = 1; i < 20; i += 5) acts.push({ id: 'c' + i, sport: 'cycling', startedAt: shift('2026-08-05', -i) + 'T17:00:00Z', durationSeconds: 5400, summary: { rpe: 4 } });
  function shift(day, delta) { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + delta); return d.toISOString().slice(0, 10); }
  const r = CA.buildPerSport(acts, { today: '2026-08-05', timezone: 'UTC', activityConfig: AC });
  ok('buildPerSport · ok + beide Sportarten vorhanden', r.ok === true && !!r.perSport.running && !!r.perSport.cycling);
  const run = r.perSport.running;
  ok('buildPerSport · running: weeklyLoadAU aus kanonischer Formel, Minuten + km aggregiert',
     run.weeklyLoadAU === r.loadHistoryBySport.running.chronic28PerWeek
     && run.weeklyMinutes === Math.round(8 * 60 / 4) && run.weeklyDistanceKm === 20
     && run.longSessionCeiling === 60 && run.source === 'observed_history', JSON.stringify(run));
  ok('buildPerSport · cycling: fehlende Distanz ⇒ null + missingFields (kein Schätzwert)',
     r.perSport.cycling.weeklyDistanceKm === null && r.perSport.cycling.missingFields.indexOf('distance_incomplete') >= 0);
  ok('buildPerSport · Sportarten sind GETRENNTE Historien (running-Last ≠ cycling-Last)',
     r.loadHistoryBySport.running.chronic28PerWeek !== r.loadHistoryBySport.cycling.chronic28PerWeek);
  ok('buildPerSport · ohne today ⇒ fail-closed', CA.buildPerSport(acts, { activityConfig: AC }).ok === false);
  /* Leerer Sport ⇒ not_assessable (über observedCapacity mit leerer Historie). */
  const empty = CA.observedCapacity(CA.windowsFromDayEntries(Array.from({ length: 28 }, () => entry(0))), { sessionCount: 0 });
  ok('observedCapacity · keine aktiven Tage ⇒ not_assessable (Vertragsform der scheduler-input-factory)',
     empty === 'not_assessable');
}

/* ============ 4) Vertrag: keine eigene Lastformel + Einbindung ============ */
const src = R('js/engine/capacity-adapter.js');
ok('Adapter enthält KEINE eigene Lastformel (kein rpe*/dur*-Produkt; nur dailyLoadUnits-Aufruf)',
   src.indexOf('dailyLoadUnits') >= 0 && !/\brpe\s*\*|\*\s*rpe|durationMin\s*\*/.test(src));
ok('Adapter shadow-only: keinerlei PROFILE-/DOM-/localStorage-Zugriff',
   !/\bPROFILE\b|document\.|localStorage/.test(src));
const idx = R('index.html'), sw = R('sw.js');
ok('index.html lädt capacity-adapter NACH scheduler-input-factory',
   idx.indexOf('js/engine/capacity-adapter.js') > idx.indexOf('js/engine/scheduler-input-factory.js'));
ok('sw.js precacht capacity-adapter', sw.indexOf("'./js/engine/capacity-adapter.js'") >= 0);
const swv = (sw.match(/orvia-v8-(\d+)/) || [])[1];
ok('SW-Version >= 236, genau einmal', swv != null && Number(swv) >= 236 && (sw.match(/orvia-v8-\d+/g) || []).length === 1, 'orvia-v8-' + swv);

console.log('\nphase7_s3_capacity_adapter: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);

/* ============================================================
   ORVIA · DT1/DT1b — Kanonischer Wochen-Vertrag (Data Truth)
   EIN reiner, deterministischer Wochen-Aggregator (weeklyActivityTotals) über
   dem bestehenden Per-Tag-Dedupe+Last-Vertrag dailyLoadUnits.
   DT1b ergänzt: Nutzerzeitzone (injiziert, UTC-Default statt still Wien),
   Missingness/Completeness (fehlend ≠ 0), belastbare Konsumenten-Körper-Prüfung,
   Dedupe-Gegenprobe über den echten mergeAllActivities-Vertrag.
   node supabase/tests/activity_week_truth_dt1_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
const base = new URL('../../../app/js/', import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, info) => { console.log((c ? '✅' : '❌') + ' ' + n + (info != null ? '  — ' + info : '')); c ? pass++ : fail++; };

globalThis.window = globalThis;
globalThis.ORVIA = { user: { id: 'u1' } };
await import(new URL('training-domain.js', base));
await import(new URL('activity-normalize.js', base));
await import(new URL('activity-config.js', base));
const cfg = globalThis.ORVIA.activityConfig;
const norm = globalThis.ORVIA.trainingDomain.normSport;
const VIE = 'Europe/Vienna';

/* ---------- Sportnormalisierung (§2.12) ---------- */
ok('[N1] run/running/Laufen → running', norm('run') === 'running' && norm('running') === 'running' && norm('Laufen') === 'running');
ok('[N2] ride/cycling/bike/Radfahren → cycling', norm('ride') === 'cycling' && norm('cycling') === 'cycling' && norm('bike') === 'cycling' && norm('Radfahren') === 'cycling');
ok('[N3] swim/swimming/Schwimmen → swimming', norm('swim') === 'swimming' && norm('swimming') === 'swimming' && norm('Schwimmen') === 'swimming');
ok('[N4] gym/strength/Krafttraining/traditional_strength_training → gym', norm('gym') === 'gym' && norm('strength') === 'gym' && norm('Krafttraining') === 'gym' && norm('traditional_strength_training') === 'gym');
ok('[A0] weeklyActivityTotals existiert', typeof cfg.weeklyActivityTotals === 'function');

/* ---------- Referenzszenario: 2 Läufe / 19 km / 1 Gym (Mo 2026-07-13 .. So 2026-07-19) ---------- */
const activities = [
  { clientRecordId: 'a:run1', source: 'garmin', sourceRecordId: 'grmn:1', sportId: 'running', startedAt: '2026-07-14T08:00:00.000Z', durationSeconds: 3000, summary: { distanceKm: 10, rpe: 6 } },
  { clientRecordId: 'a:run2', source: 'manual', sourceRecordId: 'man:1', sportId: 'running', startedAt: '2026-07-16T08:00:00.000Z', durationSeconds: 2700, summary: { distanceKm: 9, rpe: 7 } },
  { clientRecordId: 'a:gym1', source: 'orvia_workout', sourceRecordId: 'wk:1', workoutSessionId: 'wk:1', sportId: 'gym', startedAt: '2026-07-15T18:00:00.000Z', durationSeconds: 2700, summary: { rpe: 6, workingSetCount: 20 } },
  { clientRecordId: 'a:tomb', source: 'garmin', sourceRecordId: 'grmn:9', sportId: 'running', startedAt: '2026-07-17T08:00:00.000Z', durationSeconds: 1800, summary: { distanceKm: 5 } }
];
const DB = {
  '2026-07-14': { sessions: { Laufen: { dist: 10, dur: 50, derivedFromActivity: true } } },   // Legacy-Spiegel → P1 raus
  '2026-07-15': { sessions: { Rad: { dist: 20, dur: 60 } } },                                   // eigenständig → zählt
  '2026-07-18': { sessions: { Laufen: { source: 'plan_done' } } }                              // geplant → zählt nicht
};
const wk = cfg.weeklyActivityTotals(activities, DB, { weekRef: '2026-07-15', timezone: VIE, isTombstoned: (a) => (a && (a.clientRecordId || a.id)) === 'a:tomb' });
const run = (wk.bySport.running) || {}, gym = (wk.bySport.gym) || {}, cyc = (wk.bySport.cycling) || {};
ok('[DT1] running.sessionCount === 2', run.sessionCount === 2, 'ist=' + run.sessionCount);
ok('[DT2] running.distanceKm === 19 (vollständig)', run.distanceKm === 19 && run.completeness.distance === true, 'ist=' + run.distanceKm);
ok('[DT3] gym erscheint genau einmal', gym.sessionCount === 1);
ok('[DT4] Spiegel + gelöschte Aktivität erhöhen nichts', run.sessionCount === 2 && run.distanceKm === 19);
ok('[DT5] eigenständige Legacy-Einheit (Rad) bleibt', cyc.sessionCount === 1 && cyc.distanceKm === 20);
ok('[DT6] Wochenabgrenzung Mo–So', wk.weekStart === '2026-07-13' && wk.weekEnd === '2026-07-19');
ok('[DT7] geplant/gelöscht zählt nicht als Ist', run.sessionCount === 2);

/* ---------- DT1b · Zeitzone ---------- */
// Vienna-Grenze: So spät zählt, Mo früh (nächste KW) nicht.
const vieBoundary = cfg.weeklyActivityTotals([
  { clientRecordId: 'b:in', source: 'garmin', sourceRecordId: 'g:in', sportId: 'running', startedAt: '2026-07-19T21:00:00.000Z', durationSeconds: 1800, summary: { distanceKm: 4, rpe: 5 } },
  { clientRecordId: 'b:out', source: 'garmin', sourceRecordId: 'g:out', sportId: 'running', startedAt: '2026-07-19T23:00:00.000Z', durationSeconds: 1800, summary: { distanceKm: 4, rpe: 5 } }
], {}, { weekRef: '2026-07-15', timezone: VIE });
ok('[TZ1] Europe/Vienna: So 23:00 zählt, Mo 01:00 (nächste KW) nicht', vieBoundary.bySport.running && vieBoundary.bySport.running.sessionCount === 1, 'ist=' + (vieBoundary.bySport.running && vieBoundary.bySport.running.sessionCount));
// Zweite, deutlich andere Zone: dieselbe Aktivität landet je Zone in einer anderen KW.
const edge = [{ clientRecordId: 'e1', source: 'garmin', sourceRecordId: 'e:1', sportId: 'running', startedAt: '2026-07-13T02:00:00.000Z', durationSeconds: 1800, summary: { distanceKm: 5, rpe: 5 } }];
const inVie = cfg.weeklyActivityTotals(edge, {}, { weekRef: '2026-07-15', timezone: VIE });         // Wien 04:00 Mo 07-13 → in KW
const inNY = cfg.weeklyActivityTotals(edge, {}, { weekRef: '2026-07-15', timezone: 'America/New_York' }); // NY 22:00 So 07-12 → nicht in KW
ok('[TZ2] andere Zone (America/New_York) ordnet dieselbe Aktivität einer anderen KW zu',
  (inVie.bySport.running && inVie.bySport.running.sessionCount) === 1 && !(inNY.bySport.running && inNY.bySport.running.sessionCount),
  'vie=' + (inVie.bySport.running && inVie.bySport.running.sessionCount) + ' ny=' + (inNY.bySport.running && inNY.bySport.running.sessionCount));
ok('[TZ3] Aggregator ist rein: ohne opts.timezone neutraler UTC-Default (kein stilles Europe/Vienna)', cfg.weeklyActivityTotals(edge, {}, { weekRef: '2026-07-15' }).timezone === 'UTC');

/* ---------- DT1b · Missingness / Completeness ---------- */
// Fall A: keine Einheit dieser Sportart → echtes Nullergebnis (Bucket fehlt → Consumer liest 0).
ok('[M-A] keine Läufe ⇒ Fall A (kein running-Bucket, Consumer 0/0)', wk2NoRun().running === undefined);
function wk2NoRun() { return cfg.weeklyActivityTotals([{ clientRecordId: 'g', source: 'orvia_workout', sourceRecordId: 'w', sportId: 'gym', startedAt: '2026-07-15T18:00:00.000Z', durationSeconds: 2400, summary: { rpe: 6 } }], {}, { weekRef: '2026-07-15', timezone: VIE }).bySport; }
// Fall B: Einheit vorhanden, Distanz komplett unbekannt → distanceKm = null (NICHT 0).
const fB = cfg.weeklyActivityTotals([{ clientRecordId: 'r', source: 'garmin', sourceRecordId: 'r1', sportId: 'running', startedAt: '2026-07-15T08:00:00.000Z', durationSeconds: 1800, summary: { rpe: 6 } }], {}, { weekRef: '2026-07-15', timezone: VIE }).bySport.running;
ok('[M-B] Lauf ohne Distanz ⇒ distanceKm=null (nicht 0), sessionCount>0, completeness.distance=false',
  fB.sessionCount === 1 && fB.distanceKm === null && fB.knownDistanceKm === 0 && fB.completeness.distance === false, JSON.stringify({ d: fB.distanceKm, k: fB.knownDistanceKm, c: fB.completeness.distance }));
// Fall C: 9 km bekannt + eine unbekannte Laufdistanz → unvollständig, Teilsumme erhalten.
const fC = cfg.weeklyActivityTotals([
  { clientRecordId: 'r9', source: 'manual', sourceRecordId: 'c1', sportId: 'running', startedAt: '2026-07-14T08:00:00.000Z', durationSeconds: 2700, summary: { distanceKm: 9, rpe: 6 } },
  { clientRecordId: 'rx', source: 'garmin', sourceRecordId: 'c2', sportId: 'running', startedAt: '2026-07-16T08:00:00.000Z', durationSeconds: 1800, summary: { rpe: 6 } }
], {}, { weekRef: '2026-07-15', timezone: VIE }).bySport.running;
ok('[M-C] gemischt (9 km + unbekannt) ⇒ distanceKm=null, knownDistanceKm=9, completeness.distance=false',
  fC.sessionCount === 2 && fC.distanceKm === null && fC.knownDistanceKm === 9 && fC.completeness.distance === false, JSON.stringify({ d: fC.distanceKm, k: fC.knownDistanceKm }));
// Garmin ohne RPE ⇒ keine erfundene Last (loadUnits=null, nicht geschätzte Zahl).
const noRpe = cfg.weeklyActivityTotals([{ clientRecordId: 'gr', source: 'garmin', sourceRecordId: 'nr1', sportId: 'running', startedAt: '2026-07-15T08:00:00.000Z', durationSeconds: 3000, summary: { distanceKm: 10 } }], {}, { weekRef: '2026-07-15', timezone: VIE }).bySport.running;
ok('[M-L] Garmin ohne RPE ⇒ loadUnits=null (keine erfundene Last), completeness.load=false, knownLoadUnits=0',
  noRpe.loadUnits === null && noRpe.completeness.load === false && noRpe.knownLoadUnits === 0, JSON.stringify({ l: noRpe.loadUnits, k: noRpe.knownLoadUnits }));
// Referenz bleibt vollständig.
ok('[M-Ref] Referenz 2 Läufe/19 km vollständig (distanceKm=19, completeness.distance=true)', run.distanceKm === 19 && run.completeness.distance === true);

/* ---------- DT1b · Dedupe-Gegenprobe über den ECHTEN mergeAllActivities-Vertrag ---------- */
const serverRep = [{ id: 'srv:1', clientRecordId: 'a:x', source: 'garmin', sourceRecordId: 'dup:1', sportId: 'running', startedAt: '2026-07-14T08:00:00.000Z', durationSeconds: 3000, summary: { distanceKm: 10, rpe: 6 } }];
const localRep = [{ clientRecordId: 'a:x', source: 'garmin', sourceRecordId: 'dup:1', sportId: 'running', startedAt: '2026-07-14T08:00:00.000Z', durationSeconds: 3000, summary: { distanceKm: 10, rpe: 6 }, syncStatus: 'synced' }];
const merged = cfg.mergeAllActivities(serverRep, localRep, [], { isTombstoned: () => false });
const wkMerge = cfg.weeklyActivityTotals(merged, {}, { weekRef: '2026-07-15', timezone: VIE });
ok('[DUP] Server- + lokale Repräsentation derselben Aktivität → nach echtem Merge genau EINMAL gezählt',
  wkMerge.bySport.running && wkMerge.bySport.running.sessionCount === 1 && wkMerge.bySport.running.distanceKm === 10, 'count=' + (wkMerge.bySport.running && wkMerge.bySport.running.sessionCount));

/* ---------- DT1b · Konsumenten-Funktionskörper (belastbar, nicht dateiweit) ---------- */
const proSrc = readFileSync(new URL('orvia-pro.js', base), 'utf8');
const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');
function body(src, sig, endMarker) { const s = src.indexOf(sig); if (s < 0) return ''; const e = src.indexOf(endMarker, s); return src.slice(s, e < 0 ? src.length : e); }
const rwBody = body(proSrc, 'function renderWeekly(){', '\nfunction trainingDays(');
const rgBody = body(uiSrc, 'function renderGoals(){', '\nfunction setHmTarget(');
ok('[C1] renderWeekly-Körper ruft weeklyActivityTotals + effectiveTimezone auf', /weeklyActivityTotals\(/.test(rwBody) && /effectiveTimezone\(/.test(rwBody));
ok('[C2] renderWeekly berechnet Istwerte NICHT erneut aus DB[date].sessions und hat keine Europe/Vienna-Konstante', !/sessions\.Laufen|s\.Laufen|s\.Gym/.test(rwBody) && !/Europe\/Vienna/.test(rwBody));
ok('[C3] renderGoals-Körper ruft weeklyActivityTotals + effectiveTimezone auf', /weeklyActivityTotals\(/.test(rgBody) && /effectiveTimezone\(/.test(rgBody));
ok('[C4] renderGoals nutzt sessionsPerWeek als Soll (relevante Profilsportart), keine DB.sessions-Wochenschleife, kein Europe/Vienna', /sessionsPerWeek/.test(rgBody) && /weeklyPlanTargets\(/.test(rgBody) && !/e\.sessions\)\.forEach/.test(rgBody) && !/Europe\/Vienna/.test(rgBody));
ok('[C5] renderGoals leitet Sichtbarkeit aus Plan + Profil ab (nicht aus Ist-Aktivitäten)', /PROFILE\.sports/.test(rgBody) && /weeklyPlanTargets\(/.test(rgBody) && !/bySport\[[^\]]*\]\.sessionCount[^]{0,40}visible/.test(rgBody));

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
console.log('DT1/DT1b: ' + (fail === 0 ? 'GRÜN — ein kanonischer Wochen-Vertrag; Nutzerzeitzone injiziert, Missingness≠0, Konsumentenkörper belegt, Dedupe über echten Merge.' : 'ROT — ' + fail + ' offene Punkt(e).'));

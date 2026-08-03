/* ============================================================
   ORVIA · Batch 2c — Korrekturen der Abnahmeblocker aus dem 2b-Audit:
   1 Härte-Signale statt globaler 14-km-Regel (lockere 40-km-Radfahrt ≠ hart)
   2 Last-Qualität (estimatedShare/unknown/ambiguous/loadConfidence) bis in
     recentLoad/Snapshot/Decision-Engine — Ratio-Gates nicht auf Schätzbasis
   3 hardStreak über echte aufeinanderfolgende Tage
   4 Fingerprint = Ambiguität, kein Auto-Dedupe/RPE-Transfer
   5 timezone-sichere Tageszuordnung (Europe/Vienna um UTC-Mitternacht)
   6 stabile Planned-Session-IDs auch im echten generateWeekPlan()-Fallback
   7 Metrics-Merge-Autoritätsregel (partielles Serverobjekt löscht nichts)
   node supabase/tests/batch2c_load_quality_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../js/', import.meta.url);
const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');

function makeSb(opts) {
  opts = opts || {};
  const store = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object;
  sb.String = String; sb.Number = Number; sb.isNaN = isNaN; sb.isFinite = isFinite;
  sb.Intl = opts.tz ? {
    DateTimeFormat: function (loc, o) {
      if (loc === undefined && o === undefined) return { resolvedOptions: () => ({ timeZone: opts.tz }) };
      return new Intl.DateTimeFormat(loc, o);
    }
  } : Intl;
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb._store = store;
  sb.ORVIA = { user: { id: 'u1' } };
  sb.todayStr = (d) => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  sb.DB = opts.DB || {};
  vm.createContext(sb);
  ['training-domain.js', 'activity-normalize.js', 'activity-store.js', 'activity-config.js',
   'engine/engine-contracts.js', 'engine/readiness-engine-v2.js', 'engine/decision-engine-v2.js',
   'checkin-field-resolver.js', 'engine/training-input-resolver.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  return sb;
}
const act = (o) => Object.assign({ id: null, clientRecordId: 'c1', sportId: 'running', source: 'import', sourceRecordId: 's1', workoutSessionId: null, startedAt: '2026-07-17T10:00:00.000Z', durationSeconds: 3600, status: 'completed', summary: {}, syncStatus: 'synced' }, o);
const dayIso = (offsetDays, hh) => { const d = new Date(); d.setDate(d.getDate() - offsetDays); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T' + hh + ':00.000Z'; };

/* ---------- Q: Last-Qualität → Decision-Engine (Blocker 2) ---------- */
{
  const sb = makeSb({});
  const E = sb.ORVIA.decisionEngineV2;
  const mkInput = (lc) => ({
    readiness: { score: 80, confidence: 'high', warnings: [], missingData: [] },
    safetyFlags: {}, illness: false, constraints: [],
    plannedSession: { sport: 'running', intensity: 'easy', label: 'DL' },
    recentLoad: Object.assign({ acute7: 3000, chronic28PerWeek: 500, dataDays: 14, hardYesterday: false, hardStreak: 0 }, lc),
    goalContext: { daysToEvent: null }, availabilityToday: true
  });
  const dLow = E.evaluate(mkInput({ loadConfidence: 'low', estimatedShare: 0.9, unknownUnits: 0, ambiguousUnits: 0 }));
  ok('Q1 loadConfidence low ⇒ KEIN load_spike trotz Ratio 6.0',
    !dLow.reasons.some(r => r.code === 'load_spike' || r.code === 'high_recent_load') && dLow.dayState === 'GREEN',
    JSON.stringify(dLow.reasons.map(r => r.code)));
  ok('Q2 stattdessen ehrlicher Qualitäts-Hinweis + missingData load_quality',
    dLow.reasons.some(r => r.code === 'low_data_confidence' && r.inputValues.marker === 'load_quality') && dLow.missingData.indexOf('load_quality') >= 0);
  const dHigh = E.evaluate(mkInput({ loadConfidence: 'high', estimatedShare: 0.0 }));
  ok('Q3 loadConfidence high ⇒ load_spike feuert (ORANGE)',
    dHigh.reasons.some(r => r.code === 'load_spike') && dHigh.dayState === 'ORANGE');
  const dLegacy = E.evaluate(mkInput({}));
  ok('Q4 Alt-Input ohne loadConfidence ⇒ Bestandsverhalten (Gate feuert)',
    dLegacy.reasons.some(r => r.code === 'load_spike'));
  // Safety-Invariante: geringe Last-Qualität kann Warnungen nur unterlassen, nie aufheben.
  const dRed = E.evaluate(Object.assign(mkInput({ loadConfidence: 'low' }), { safetyFlags: { chestPain: true } }));
  ok('Q5 Red Flag bleibt RED trotz loadConfidence low', dRed.dayState === 'RED' && dRed.action === 'REST');
}

/* ---------- H: hardStreak über echte Folge-Tage (Blocker 3) ---------- */
{
  const sb = makeSb({});
  const mk = (off) => act({ clientRecordId: 'h' + off, sourceRecordId: 'h' + off, startedAt: dayIso(off, '09:00'), durationSeconds: 3600, summary: { rpe: 8 } });
  sb.localStorage.setItem('orvia_activities_u1', JSON.stringify([mk(1), mk(2), mk(3)]));
  const raw = sb.ORVIA.trainingInputResolver.collectRaw();
  ok('H1 drei harte Folgetage ⇒ hardStreak=3 (vorher max. 1)', raw.recentLoad.hardStreak === 3 && raw.recentLoad.hardYesterday === true, JSON.stringify(raw.recentLoad));
  const E = sb.ORVIA.decisionEngineV2;
  const d = E.evaluate({ readiness: { score: 80, confidence: 'high', warnings: [], missingData: [] }, safetyFlags: {}, illness: false, constraints: [], plannedSession: { sport: 'running', intensity: 'hard', label: 'IV' }, recentLoad: raw.recentLoad, goalContext: {}, availabilityToday: true });
  ok('H2 hardStreak≥2 + harte Einheit ⇒ consecutive_hard_days feuert endlich',
    d.reasons.some(r => r.code === 'consecutive_hard_days') && d.action !== 'KEEP', JSON.stringify(d.reasons.map(r => r.code)));
  // Lücke bricht die Serie: hart nur an Tag 1 und 3.
  const sb2 = makeSb({});
  sb2.localStorage.setItem('orvia_activities_u1', JSON.stringify([mk(1), mk(3)]));
  ok('H3 Lücke am Tag 2 ⇒ hardStreak=1', sb2.ORVIA.trainingInputResolver.collectRaw().recentLoad.hardStreak === 1);
}

/* ---------- A: Ambiguität + Confidence-Propagation (Blocker 2+4) ---------- */
{
  // Gefordertes Szenario: EIGENSTÄNDIGE Legacy-Einheit + gleich lange/weite
  // kanonische Einheit am selben Tag ⇒ beide zählen, als ambig markiert.
  const sb = makeSb({});
  const yk = sb.todayStr(new Date(Date.now() - 864e5));
  sb.localStorage.setItem('orvia_activities_u1', JSON.stringify([
    act({ clientRecordId: 'amb1', sourceRecordId: 'amb1', startedAt: yk + 'T07:00:00.000Z', durationSeconds: 3600, summary: { distanceKm: 10 } })
  ]));
  sb.DB[yk] = { sessions: { Laufen: { dur: 60, dist: 10, rpe: 6 } } };   // keine Referenz — könnte dieselbe ODER eine zweite Einheit sein
  const raw = sb.ORVIA.trainingInputResolver.collectRaw();
  ok('A1 beide zählen (300+360), ambiguousUnits=2', raw.recentLoad.acute7 === 660 && raw.recentLoad.ambiguousUnits === 2, JSON.stringify(raw.recentLoad));
  ok('A2 loadConfidence low (Ambiguität)', raw.recentLoad.loadConfidence === 'low');
  const snap = sb.ORVIA.trainingInputResolver.collectSnapshot();
  ok('A3 Snapshot: loadHistory trägt Qualität + dataQuality meldet conflict',
    snap.loadHistory.loadConfidence === 'low' && snap.loadHistory.ambiguousUnits === 2 &&
    snap.dataQuality.missing.some(x => x.path === 'loadHistory.quality' && x.kind === 'conflict'));
  // Nur-Garmin-Woche (alles geschätzt) ⇒ estimatedShare 1 ⇒ low.
  const sb2 = makeSb({});
  sb2.localStorage.setItem('orvia_activities_u1', JSON.stringify([
    act({ clientRecordId: 'g1', sourceRecordId: 'g1', startedAt: dayIso(1, '09:00'), durationSeconds: 2700, summary: { distanceKm: 8 } }),
    act({ clientRecordId: 'g2', sourceRecordId: 'g2', startedAt: dayIso(3, '09:00'), durationSeconds: 2700, summary: { distanceKm: 8 } })
  ]));
  const r2 = sb2.ORVIA.trainingInputResolver.collectRaw().recentLoad;
  ok('A4 reine Dauer×Default-Woche ⇒ estimatedShare=1, loadConfidence=low', r2.estimatedShare === 1 && r2.loadConfidence === 'low');
  // Gemessene Woche MIT ausreichender älterer Historie ⇒ high (Batch 2e:
  // ohne Vorperiode wäre die Confidence zurecht low — insufficient_chronic_history).
  const sb3 = makeSb({});
  sb3.localStorage.setItem('orvia_activities_u1', JSON.stringify(
    [1, 8, 10, 12, 14, 16].map(o => act({ clientRecordId: 'm' + o, sourceRecordId: 'm' + o, startedAt: dayIso(o, '09:00'), durationSeconds: 3600, summary: { rpe: 6 } }))
  ));
  const r3 = sb3.ORVIA.trainingInputResolver.collectRaw().recentLoad;
  ok('A5 gemessene Woche + reife Historie ⇒ loadConfidence=high', r3.loadConfidence === 'high' && r3.estimatedShare === 0, JSON.stringify(r3.quality));
}

/* ---------- T: timezone-sichere Tageszuordnung (Blocker 5) ---------- */
{
  const sb = makeSb({});
  const dol = sb.ORVIA.activityConfig.dayOfActLocal;
  ok('T1 Sommer: 22:30Z ⇒ Folgetag in Wien (UTC+2)', dol({ startedAt: '2026-06-03T22:30:00.000Z' }, 'Europe/Vienna') === '2026-06-04');
  ok('T2 Sommer: 21:59Z ⇒ noch derselbe Tag (23:59 Wien)', dol({ startedAt: '2026-06-03T21:59:00.000Z' }, 'Europe/Vienna') === '2026-06-03');
  ok('T3 Winter (UTC+1): 23:30Z ⇒ Folgetag', dol({ startedAt: '2026-01-10T23:30:00.000Z' }, 'Europe/Vienna') === '2026-01-11');
  ok('T4 ohne Zone ⇒ dokumentierter UTC-Fallback', dol({ startedAt: '2026-06-03T22:30:00.000Z' }, null) === '2026-06-03');
  ok('T5 ungültige Zone ⇒ Fallback statt Crash', dol({ startedAt: '2026-06-03T22:30:00.000Z' }, 'Not/AZone') === '2026-06-03');
  // Integration: Aktivität gestern 22:30Z = HEUTE in Wien ⇒ zählt heute, nicht als „gestern hart".
  const sbV = makeSb({ tz: 'Europe/Vienna' });
  const y = new Date(Date.now() - 864e5);
  const ykUtc = y.getUTCFullYear() + '-' + String(y.getUTCMonth() + 1).padStart(2, '0') + '-' + String(y.getUTCDate()).padStart(2, '0');
  sbV.localStorage.setItem('orvia_activities_u1', JSON.stringify([
    act({ clientRecordId: 'tz1', sourceRecordId: 'tz1', startedAt: ykUtc + 'T22:30:00.000Z', durationSeconds: 3600, summary: { rpe: 8 } })
  ]));
  const rV = sbV.ORVIA.trainingInputResolver.collectRaw().recentLoad;
  ok('T6 Wien-Zuordnung: 22:30Z von „gestern (UTC)" ⇒ heutiger Trainingstag (hardYesterday=false, Last gezählt)',
    rV.hardYesterday === false && rV.acute7 === 480, JSON.stringify(rV));
}

/* ---------- P: stabile IDs im ECHTEN generateWeekPlan()-Fallback (Blocker 6) ---------- */
{
  function slice(src, a, b) { const s = src.indexOf(a), e = src.indexOf(b); if (s < 0 || e < 0 || e <= s) throw new Error('Grenzen fehlen: ' + a); return src.slice(s, e); }
  const planBlock = uiSrc.slice(0, uiSrc.indexOf('var PLAN_PRESETS'));
  const mk = () => {
    const sb = {}; sb.window = sb; sb.globalThis = sb;
    sb.console = console; sb.Date = Date; sb.Math = Math; sb.Object = Object; sb.Array = Array;
    sb.String = String; sb.Number = Number; sb.Set = Set; sb.JSON = JSON;
    sb.todayStr = () => '2026-07-18';
    sb.goalOf = () => ({ type: 'half_marathon', raceDate: '2026-09-06' });
    sb.userLevel = () => 'fortgeschritten';
    sb.PROFILE = { sports: [{ sportId: 'running', activeInApp: true }, { sportId: 'gym', activeInApp: true }], weekPlan: null, trainingDays: null, issues: [] };
    sb.ORVIA = { profileModel: { canonGoalCategory: t => t, effectiveTrainingConfig: () => ({ availableDayIdx: [0, 1, 2, 4, 5, 6], targetDays: 4, daysSource: 'availability' }) } };
    sb.saveProfile = () => {};
    vm.createContext(sb);
    vm.runInContext(planBlock, sb, { filename: 'ui.js#plan' });
    return sb;
  };
  const sbA = mk();
  const p1 = sbA.activeWeekPlan();
  const units1 = p1.flatMap((d, di) => d.map(u => ({ di, id: u.id, t: u.t, l: u.l })));
  ok('P1 generierter Plan: JEDE Einheit trägt eine psg:-ID', units1.length > 0 && units1.every(u => /^psg:\d+:\d+:/.test(u.id)), JSON.stringify(units1.slice(0, 3)));
  const p2 = sbA.activeWeekPlan();
  ok('P2 Reload-Stabilität: zweiter Aufruf ⇒ identische IDs', JSON.stringify(p2.flatMap(d => d.map(u => u.id))) === JSON.stringify(p1.flatMap(d => d.map(u => u.id))));
  const sbB = mk();
  ok('P3 frische Session (Reload) ⇒ gleiche IDs (deterministisch aus Inhalt+Position)',
    JSON.stringify(sbB.activeWeekPlan().flatMap(d => d.map(u => u.id))) === JSON.stringify(p1.flatMap(d => d.map(u => u.id))));
  // Start einer GENERIERTEN Einheit: startPlannedUnit reicht die psg:-ID durch.
  const startBlock = slice(uiSrc, 'function planNoteFor', '/* F1: geplante Einheit ohne Live-Tracking');
  let captured = null;
  sbA.closeSupp = () => {};
  sbA.ORVIA.workoutUI = { startSport: (sport, opts) => { captured = { sport, opts }; } };
  vm.runInContext(startBlock, sbA, { filename: 'ui.js#start' });
  const di = p1.findIndex(d => d.length);
  sbA.startPlannedUnit(di, 0);
  // Batch 2d: durchgereicht wird die OCCURRENCE-ID (po:<Datum>:<Template>), Template getrennt.
  const expOcc = sbA.plannedOccurrenceIdFor(p1[di][0], di);
  ok('P4 Start generierte Einheit ⇒ plannedSessionId = Occurrence der psg:-Template-ID',
    !!captured && captured.opts.plannedSessionId === expOcc && captured.opts.templateSessionId === p1[di][0].id, JSON.stringify(captured && captured.opts.plannedSessionId));
}

/* ---------- M: Metrics-Merge-Autoritätsregel (Blocker 7) ---------- */
{
  const sb = makeSb({});
  const AS = sb.ORVIA.activityStore;
  const row = (metrics) => ({ id: 'srv-m', user_id: 'u1', sport_id: 'running', source: 'import', source_record_id: 'gm:1', started_at: '2026-06-03T10:00:00.000Z', duration_seconds: 1800, status: 'completed', summary: {}, metrics });
  AS.mergeServerActivities([row({ source_sport_raw: 'running', avgSpeedKmh: 10.5, poolLengthM: null })]);
  AS.mergeServerActivities([row({ avgSpeedKmh: 11.2 })]);   // partielles Update
  const a = AS.getActivityBySource('import', 'gm:1');
  ok('M1 partielles Serverobjekt: Server gewinnt je Key, lokale Keys bleiben',
    a.metrics.avgSpeedKmh === 11.2 && a.metrics.source_sport_raw === 'running', JSON.stringify(a.metrics));
  AS.mergeServerActivities([row({})]);
  ok('M2 leeres Serverobjekt ändert nichts', AS.getActivityBySource('import', 'gm:1').metrics.source_sport_raw === 'running');
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

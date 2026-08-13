/* ============================================================
   ORVIA · Batch 2a — Kanonische Tageslast ohne Doppelzählung
   dailyLoadUnits (activity-config.js, PURE) + Engine-Anbindung
   (training-input-resolver collectRaw → recentLoad.source).
   Deckt den P0-Befund „zwei Lastwahrheiten": Live-Spiegel, Manual-
   Projektionen und Tag+Sport-Kollisionen dürfen nie doppelt zählen;
   server-gepullte Garmin-Aktivitäten müssen erstmals Last beitragen.
   node supabase/tests/batch2a_canonical_load_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL(_APPREL + 'js/', import.meta.url);

function makeSb(opts) {
  opts = opts || {};
  const store = opts.localStorage || {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object;
  sb.String = String; sb.Number = Number; sb.Intl = Intl; sb.isNaN = isNaN; sb.isFinite = isFinite;
  sb.parseFloat = parseFloat; sb.parseInt = parseInt;
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb.ORVIA = { user: { id: 'u1' } };
  sb.todayStr = (d) => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  sb.DB = opts.DB || {};
  vm.createContext(sb);
  const files = ['training-domain.js', 'activity-normalize.js'].concat(opts.withStore !== false ? ['activity-store.js'] : [])
    .concat(['activity-config.js', 'engine/engine-contracts.js', 'engine/readiness-engine-v2.js', 'engine/decision-engine-v2.js', 'checkin-field-resolver.js', 'engine/training-input-resolver.js']);
  files.forEach(f => vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  return sb;
}
const act = (o) => Object.assign({ id: null, clientRecordId: 'crid1', sportId: 'running', source: 'orvia_workout', sourceRecordId: 'sr1', workoutSessionId: null, startedAt: '2026-07-17T10:00:00.000Z', durationSeconds: 3600, status: 'completed', summary: {}, syncStatus: 'synced' }, o);

/* ---------- L: dailyLoadUnits (pur) ---------- */
{
  const sb = makeSb({ withStore: false });
  const D = sb.ORVIA.activityConfig.dailyLoadUnits;
  // L1: kanonische Activity 60 min · RPE 6 ⇒ 360 (srpe_measured, high).
  const r1 = D([act({ summary: { rpe: 6 } })], {});
  ok('L1 Activity 60min·RPE6 ⇒ 360, srpe_measured/high + Ausweis komplett',
    r1.load === 360 && r1.units[0].loadBasis === 'srpe_measured' && r1.units[0].confidence === 'high' &&
    r1.units[0].durationUnit === 'min' && r1.units[0].loadUnit === 'srpe_au' && r1.units[0].source === 'orvia_workout' &&
    r1.units[0].dedupe.decision === 'counted', JSON.stringify(r1.units[0]));
  // L2: Live-Spiegel (workoutSessionId) zählt NICHT doppelt.
  const r2 = D([act({ workoutSessionId: 'W1', summary: { rpe: 6 } })],
    { Laufen: { dur: 60, rpe: 6, source: 'live', workoutSessionId: 'W1', sportId: 'running' } });
  ok('L2 Live-Spiegel (wsid) ⇒ einmal 360, nicht 720', r2.load === 360 && r2.units.length === 1);
  // L3: Manual-Projektion (derivedFromActivity) zählt NICHT doppelt.
  const r3 = D([act({ clientRecordId: 'CR9', summary: { rpe: 7 } })],
    { Laufen: { dur: 60, rpe: 7, derivedFromActivity: true, canonicalActivityId: 'CR9' } });
  ok('L3 derivedFromActivity-Projektion ⇒ einmal 420', r3.load === 420 && r3.units.length === 1);
  // L3b: Referenz über canonicalActivityId (ohne derived-Flag) ⇒ ebenfalls dedupliziert.
  const r3b = D([act({ clientRecordId: 'CR9', summary: { rpe: 7 } })],
    { Laufen: { dur: 60, rpe: 7, canonicalActivityId: 'CR9' } });
  ok('L3b canonicalActivityId-Referenz ⇒ einmal 420', r3b.load === 420 && r3b.units.length === 1);
  // L4: Garmin-Aktivität ohne RPE ⇒ KEIN erfundenes RPE (rpe null); Last-Schätzung
  //     ausgewiesen als duration_default_intensity mit confidence low.
  const r4 = D([act({ source: 'import', summary: { distanceKm: 8 } })], {});
  ok('L4 Garmin ohne RPE ⇒ rpe=null, basis duration_default_intensity, 300, low',
    r4.load === 300 && r4.units[0].rpe === null && r4.units[0].loadBasis === 'duration_default_intensity' &&
    r4.units[0].confidence === 'low' && r4.estimatedShare === 1, JSON.stringify(r4.units[0]));
  // L5 (Batch 2c): Fingerprint-Nähe ohne stabile Referenz ⇒ KEIN Duplikat,
  //     KEIN RPE-Transfer — beide zählen, beide als possible_duplicate markiert.
  const r5 = D([act({ source: 'import', sourceRecordId: 'g1', summary: {} })],
    { Laufen: { dur: 58, rpe: 8 } });
  ok('L5 Fingerprint ⇒ ambiguous: BEIDE zählen (300+464=764), kein Transfer',
    r5.load === 764 && r5.units.length === 2 && r5.ambiguousUnits === 2 &&
    r5.units.every(u => u.ambiguity === 'possible_duplicate') &&
    !r5.units.some(u => u.rpeSource === 'transferred'), JSON.stringify({ loads: r5.units.map(u => u.load), amb: r5.ambiguousUnits }));
  // L5b: P4 — keine Fingerprint-Nähe ⇒ beide zählen OHNE Ambiguität.
  const r5b = D([act({ source: 'import', sourceRecordId: 'g1', summary: {} })],
    { Laufen: { dur: 50, rpe: 8 } });
  ok('L5b keine Nähe ⇒ beide zählen (300+400=700), ambiguousUnits=0',
    r5b.load === 700 && r5b.units.length === 2 && r5b.ambiguousUnits === 0, JSON.stringify(r5b.units.map(u => u.load)));
  // L6: plan_done (ohne Messwerte) + kanonische Activity ⇒ kanonisch zählt, Legacy auditierbar ausgeschlossen.
  const r6 = D([act({ source: 'import', summary: { rpe: 6 } })],
    { Laufen: { source: 'plan_done', note: 'Als erledigt markiert (ohne Messwerte)' } });
  ok('L6 plan_done datenlos ⇒ kanonisch 360, excluded_no_data dokumentiert',
    r6.load === 360 && r6.units.length === 1 && r6.units[0].kind === 'activity' &&
    r6.excluded.some(x => x.dedupe.decision === 'excluded_no_data'));
  // L7: nur Legacy (Alt-Daten) ⇒ Verhalten wie Calc.sessionLoad inkl. Mobilität=2 und rpe-||-Semantik.
  const r7 = D([], { Laufen: { dur: 40, rpe: 6 }, 'Mobilität': { dur: 30 }, Gym: { dur: 60, rpe: 0 } });
  ok('L7 Legacy pur: 40·6 + 30·2 + 60·5(rpe0⇒Default) = 600', r7.load === 600, JSON.stringify(r7.units));
  // L8 (Batch 2c): getrennte Härte-Signale statt globaler 14-km-Regel.
  const r8 = D([act({ summary: { rpe: 7 } }), act({ clientRecordId: 'c2', sourceRecordId: 's2', sportId: 'cycling', durationSeconds: 5400, summary: { distanceKm: 40 } })], {});
  ok('L8 RPE7 ⇒ intensityHard+hardDay; lockere 40-km-Radfahrt (90 min) ⇒ NICHT hart',
    r8.units[0].intensityHard === true && r8.units[0].hardDay === true &&
    r8.units[1].intensityHard === false && r8.units[1].longSession === false && r8.units[1].hardDay === false,
    JSON.stringify(r8.units.map(u => ({ i: u.intensityHard, l: u.longSession, h: u.hardDay }))));
  // L8b: langer Lauf (15 km, easy/ohne RPE) ⇒ longSession + Impact ⇒ mechanisch harter Tag.
  const r8b = D([act({ durationSeconds: 5100, summary: { distanceKm: 15 } })], {});
  ok('L8b 15-km-Long-Run ohne RPE ⇒ longSession+hardDay (mechanisch), intensityHard=false',
    r8b.units[0].longSession === true && r8b.units[0].hardDay === true && r8b.units[0].intensityHard === false);
  const r8c = D([act({ summary: { distanceKm: 8 } })], {});
  ok('L8c 8-km-Lauf ohne RPE ⇒ kein Härte-Signal', r8c.units[0].hardDay === false && r8c.units[0].longSession === false);
  // L9: deterministisch + nicht-mutierend.
  const acts = [act({ summary: { rpe: 6 } })]; const sess = { Laufen: { dur: 60, rpe: 6, workoutSessionId: 'X' } };
  const j1 = JSON.stringify(D(acts, sess)), j2 = JSON.stringify(D(acts, sess));
  ok('L9 deterministisch + Eingaben unverändert', j1 === j2 && acts[0].summary.rpe === 6 && sess.Laufen.dur === 60);
  // L10: leere Eingaben ⇒ Last 0, keine Erfindung.
  const r10 = D([], {});
  ok('L10 leer ⇒ load 0, units []', r10.load === 0 && r10.units.length === 0 && r10.estimatedShare === 0);
}

/* ---------- I: Engine-Anbindung (collectRaw → recentLoad) ---------- */
{
  // Garmin-Aktivität NUR im Store (gestern) — der bisherige blinde Fleck.
  const y = new Date(); y.setDate(y.getDate() - 1);
  const sbA = makeSb({});
  const yk = sbA.todayStr(y);
  const garmin = act({ source: 'import', sourceRecordId: 'garmin:1', startedAt: yk + 'T09:00:00.000Z', durationSeconds: 2700, summary: { distanceKm: 8.2 } });
  sbA.localStorage.setItem('orvia_activities_u1', JSON.stringify([garmin]));
  const rawA = sbA.ORVIA.trainingInputResolver.collectRaw();
  ok('I1 server-gepullte Garmin-Last erreicht die Engine (45·5=225)', rawA.recentLoad && rawA.recentLoad.acute7 === 225 && rawA.recentLoad.dataDays === 1, JSON.stringify(rawA.recentLoad));
  ok('I2 Quelle ehrlich: canonical_activities', rawA.recentLoad.source === 'canonical_activities');
  const snapA = sbA.ORVIA.trainingInputResolver.collectSnapshot();
  ok('I3 Snapshot.loadHistory übernimmt kanonische Quelle', snapA.loadHistory.source === 'canonical_activities' && snapA.loadHistory.acute7 === 225);

  // Spiegel-Szenario: Live-Workout in BEIDEN Welten ⇒ einmal zählen.
  const sbB = makeSb({});
  const ykB = sbB.todayStr(y);
  sbB.localStorage.setItem('orvia_activities_u1', JSON.stringify([
    act({ workoutSessionId: 'W7', startedAt: ykB + 'T18:00:00.000Z', durationSeconds: 3600, summary: { rpe: 8 } })
  ]));
  sbB.DB[ykB] = { sessions: { Laufen: { dur: 60, rpe: 8, source: 'live', workoutSessionId: 'W7', sportId: 'running' } } };
  const rawB = sbB.ORVIA.trainingInputResolver.collectRaw();
  ok('I4 Live-Spiegel: acute7=480 (einmal), hardYesterday=true', rawB.recentLoad.acute7 === 480 && rawB.recentLoad.hardYesterday === true, JSON.stringify(rawB.recentLoad));

  // Fallback: ohne Store/Config bleibt der Legacy-Pfad — ehrlich etikettiert.
  const DB = {}; const sbC0 = makeSb({ withStore: false });
  const ykC = sbC0.todayStr(y);
  DB[ykC] = { sessions: { Laufen: { dur: 60, rpe: 6 } } };
  const sbC = makeSb({ withStore: false, DB });
  sbC.Calc = { sessionLoad: e => { let L = 0; const ss = e && e.sessions; if (ss) Object.keys(ss).forEach(t => { if (t !== '_ts') L += (ss[t].dur || 0) * (t === 'Mobilität' ? 2 : (ss[t].rpe || 5)); }); return L; } };
  // activityConfig ist geladen, aber activityStore fehlt ⇒ kanonischer Pfad nicht möglich.
  ok('I5 Vorbedingung: Store im Fallback-Szenario nicht geladen', !sbC.ORVIA.activityStore);
  const rawC = sbC.ORVIA.trainingInputResolver.collectRaw();
  ok('I6 Fallback rechnet Legacy weiter, source=legacy_sessions', rawC.recentLoad && rawC.recentLoad.acute7 === 360 && rawC.recentLoad.source === 'legacy_sessions', JSON.stringify(rawC.recentLoad));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

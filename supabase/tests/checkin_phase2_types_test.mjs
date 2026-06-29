/* ORVIA · Phase-2 Teilblock 2 (live/pre/post Check-in Datenschicht) — Unit-Tests.
   Lädt echte Module mit gestubbtem Supabase/Queue/DB. node supabase/tests/checkin_phase2_types_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, info) => { console.log((c ? '✅' : '❌') + ' ' + n + (info ? '  — ' + info : '')); c ? pass++ : fail++; };

global.window = {}; global.DB = {}; global.todayStr = () => '2026-06-19'; global.renderDay = () => {};
let invalidated = 0; global.invalidateDecision = () => { invalidated++; };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/repos/repoBase.js');
load('js/repos/checkinRepository.js');
load('js/checkin-store.js');
const O = global.window.ORVIA;
const Calc = (await import(new URL('../../js/calc.js', import.meta.url))).default;

function sbStub(result, capture) {
  const obj = {};
  ['select', 'eq', 'gte', 'lte', 'order', 'limit', 'delete', 'insert', 'update'].forEach(m => obj[m] = () => obj);
  obj.upsert = (row, opts) => { if (capture) { capture.row = row; capture.opts = opts; } return obj; };
  obj.maybeSingle = () => Promise.resolve(result);
  obj.then = (res, rej) => Promise.resolve(result).then(res, rej);
  return { from: () => obj };
}
const VS = ['supabase', 'indexeddb', 'legacy_blob', 'empty'], VSY = ['synced', 'pending', 'conflict', 'failed'];
const shape = r => r && typeof r.success === 'boolean' && ('data' in r) && ('error' in r) && VS.includes(r.source) && VSY.includes(r.sync_status);

const run = async () => {
  O.user = { id: 'A' }; O.sb = sbStub({ data: [{ id: 'x' }], error: null }); navigator.onLine = true;
  const payloadLive = { feel: 7, stress: 'Med', doms: 3, illness: false, legs: 6, bb: 70,
    complaints: [{ type: 'knee', score: 2, region: 'left', note: 'leicht' }, { type: 'back', score: 1, note: 'ok' }], knee: 2, ts: Date.parse('2026-06-19T13:00:00Z') };

  // A. Mapping live/pre/post → korrekte Spalten
  for (const t of ['live', 'pre', 'post']) {
    const row = O.repos.checkin.toRow('2026-06-19', t, { feel: 7, stress: 'Low', doms: 2, illness: false, legs: 6, bb: 80, rhr: 55 });
    ok('A ' + t + ': Spalten gemappt + checkin_type', row.checkin_type === t && row.feel === 7 && row.stress === 'Low' && row.doms === 2 && row.illness === false && row.leg_strength === 6 && row.body_battery === 80 && row.resting_hr === 55);
  }

  // B. Typprüfung
  let r = await O.checkinStore.persistCheckin('2026-06-19', 'live', payloadLive);
  ok('B live erlaubt', shape(r) && r.success);
  r = await O.checkinStore.persistCheckin('2026-06-19', 'bogus', payloadLive);
  ok('B ungültiger Typ → success false, invalid_type', shape(r) && !r.success && r.error.code === 'invalid_type');

  // C. Online-Upsert: eigene user_id, checkin_type, Konflikt-Key
  const cap = {}; O.sb = sbStub({ data: [{ id: 'x' }], error: null }, cap); navigator.onLine = true;
  r = await O.checkinStore.persistCheckin('2026-06-19', 'pre', { feel: 8 });
  ok('C online success, source supabase', shape(r) && r.success && r.source === 'supabase');
  ok('C Upsert: user_id=A, type=pre, Konflikt-Key', cap.row.user_id === 'A' && cap.row.checkin_type === 'pre' && cap.opts.onConflict === 'user_id,local_date,checkin_type');
  const cap2 = {}; O.sb = sbStub({ data: [{ id: 'x' }], error: null }, cap2);
  await O.checkinStore.persistCheckin('2026-06-19', 'pre', { feel: 9 });
  ok('C erneutes Speichern nutzt denselben Konflikt-Key (kein Insert-Dup)', cap2.opts.onConflict === 'user_id,local_date,checkin_type');

  // D. Offline
  navigator.onLine = false; let enq = {};
  O.offlineQueue = { enqueue: async (t, rr, ck) => { enq = { t, rr, ck }; return { success: true, data: rr, error: null, source: 'indexeddb', sync_status: 'pending' }; } };
  r = await O.checkinStore.persistCheckin('2026-06-19', 'post', Object.assign({}, payloadLive, { user_id: 'FREMD' }));
  ok('D offline → pending, indexeddb', shape(r) && r.success && r.source === 'indexeddb' && r.sync_status === 'pending');
  ok('D Queue: Tabelle + checkin_type + Konflikt-Key', enq.t === 'daily_checkins' && enq.rr.checkin_type === 'post' && enq.ck === 'user_id,local_date,checkin_type');
  ok('D fremde user_id im Payload wird überschrieben (=A)', enq.rr.user_id === 'A');
  O.offlineQueue = undefined; r = await O.checkinStore.persistCheckin('2026-06-19', 'live', payloadLive);
  ok('D Queue fehlt → success false', shape(r) && !r.success && r.source === 'indexeddb');
  O.offlineQueue = { enqueue: () => { throw new Error('idb kaputt'); } };
  r = await O.checkinStore.persistCheckin('2026-06-19', 'live', payloadLive);
  ok('D Queue wirft → success false, failed', shape(r) && !r.success && r.sync_status === 'failed');

  // E. Round-Trip
  const row = O.repos.checkin.toRow('2026-06-19', 'live', payloadLive);
  const back = O.checkinStore.rowToCheckin(row);
  ok('E Felder erhalten (feel/stress/doms/illness/legs/bb)', back.feel === 7 && back.stress === 'Med' && back.doms === 3 && back.illness === false && back.legs === 6 && back.bb === 70);
  ok('E mehrere Beschwerden + Notiz + Region + knee', back.complaints.length === 2 && back.complaints[0].note === 'leicht' && back.complaints[0].region === 'left' && back.complaints[1].type === 'back' && back.knee === 2);
  ok('E recorded_at round-trip (ts vorhanden)', typeof back.ts === 'number');

  // F. Referenztrennung
  const rowF = { complaints: [{ type: 'knee', score: 5 }] };
  const mF = O.checkinStore.rowToCheckin(rowF); mF.complaints[0].score = 99;
  ok('F rowToCheckin: keine Referenzteilung', rowF.complaints[0].score === 5);
  const morF = { complaints: [{ type: 'back', score: 2 }] };
  const rF = O.repos.checkin.toRow('d', 'live', morF); rF.complaints[0].score = 88;
  ok('F toRow: keine Referenzteilung', morF.complaints[0].score === 2);

  // G. Hydrierung live/pre/post
  navigator.onLine = true; O.user = { id: 'A' };
  global.DB = { '2026-06-12': { date: '2026-06-12', live: { feel: 1 }, morning: { feel: 9 } }, '2026-06-13': { date: '2026-06-13', pre: { feel: 5 } } };
  O.sb = sbStub({ data: [
    { local_date: '2026-06-12', checkin_type: 'live', feel: 8, doms: 2, complaints: [{ type: 'back', score: 3 }], recorded_at: new Date().toISOString() },
    { local_date: '2026-06-12', checkin_type: 'pre', feel: 7, recorded_at: new Date().toISOString() }
  ], error: null });
  r = await O.checkinStore.hydrateRecentTypes(35, ['live', 'pre', 'post']);
  ok('G hydrate success, 2 angewendet', shape(r) && r.success && r.data.applied === 2);
  ok('G Tabelle gewinnt für live (feel 8, complaints)', DB['2026-06-12'].live.feel === 8 && DB['2026-06-12'].live.complaints[0].type === 'back');
  ok('G pre desselben Tages geschrieben (feel 7)', DB['2026-06-12'].pre.feel === 7);
  ok('G anderer Typ desselben Tages (morning) unberührt', DB['2026-06-12'].morning.feel === 9);
  ok('G anderer Tag (2026-06-13.pre) unberührt', DB['2026-06-13'].pre.feel === 5);

  // H. Cache-Invalidierung
  invalidated = 0; O.sb = sbStub({ data: [{ id: 'x' }], error: null }); navigator.onLine = true;
  await O.checkinStore.persistCheckin('2026-06-19', 'live', { feel: 7 });
  await O.checkinStore.persistCheckin('2026-06-19', 'pre', { feel: 7 });
  await O.checkinStore.persistCheckin('2026-06-19', 'post', { feel: 7 });
  ok('H persist live/pre/post (heute) invalidiert Entscheidung 3×', invalidated === 3, 'count=' + invalidated);
  invalidated = 0; await O.checkinStore.persistCheckin('2020-01-01', 'live', { feel: 7 });
  ok('H persist für anderen Tag invalidiert NICHT', invalidated === 0);

  // I. Score vs. Entscheidung (Engine-Ebene, Trennung bleibt erhalten)
  const dSpike = Calc.buildTrainingDecision({ checkin: { pain: 0, doms: 0, illness: false, sleepH: 8.8, sleepQ: 9, feel: 9, stress: 'Low', hrv: 'Good', readiness: 95 }, components: { recovery: 95, riskRaw: 80, loadFit: 30 }, loads: { load3: 142, load7: 100 }, plannedToday: { t: 'Laufen', l: 'Tempo' }, todayIndex: 2 });
  ok('I Readiness 95 + Lastsprung → Score ≥85 (kein 64-Cap), ORANGE', dSpike.score >= 85 && dSpike.dayState === 'ORANGE', 'score=' + dSpike.score);
  const dPain = Calc.buildTrainingDecision({ checkin: { pain: 6, painRegion: 'Knie', doms: 0, illness: false, sleepH: 8, sleepQ: 8, feel: 8, stress: 'Low', hrv: 'Good', readiness: 95 }, components: { recovery: 95, riskRaw: 20, loadFit: 80 }, loads: { load3: 100, load7: 100 }, plannedToday: { t: 'Laufen', l: 'Tempo' }, todayIndex: 2 });
  ok('I echter Schmerz 6 verschärft/deckelt (Score < 85)', dPain.score < 85, 'score=' + dPain.score);

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });

/* ORVIA · Phase-2 Teilblock 1 (Morgen-Check-in) — Unit-Tests.
   Lädt echte Module mit gestubbtem Supabase/Queue/DB. node supabase/tests/checkin_phase2_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, info) => { console.log((c ? '✅' : '❌') + ' ' + n + (info ? '  — ' + info : '')); c ? pass++ : fail++; };

global.window = {}; global.DB = {}; global.todayStr = () => '2026-06-19';
global.renderDay = () => {};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/repos/repoBase.js');
load('js/repos/checkinRepository.js');
load('js/checkin-store.js');
const O = global.window.ORVIA;

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
  const morning = { sleepMin: 420, sleepQ: 8, rhr: 55, hrvMs: 60, hrv: 'Balanced', bb: 80, stress: 'Low', feel: 8, legs: 7, doms: 1, knee: 2, ts: Date.now() };

  // Round-Trip toRow → rowToMorning
  const row = O.repos.checkin.toRow('2026-06-19', 'morning', morning);
  const back = O.checkinStore.rowToMorning(row);
  ok('Round-Trip Felder erhalten', back.sleepMin === 420 && back.sleepQ === 8 && back.rhr === 55 && back.hrv === 'Balanced' && back.feel === 8 && back.doms === 1);
  ok('Knie via complaints round-trip', back.knee === 2 && Array.isArray(row.complaints) && row.complaints[0].type === 'knee');

  // persistMorning: nichts zu speichern → success skipped
  global.DB = {}; O.user = { id: 'A' }; O.sb = sbStub({ data: [{}], error: null });
  let r = await O.checkinStore.persistMorning('2026-06-19');
  ok('Kein morning → success skipped', shape(r) && r.success && r.data && r.data.skipped);

  // persistMorning online → Upsert mit korrektem Konflikt-Key + eigener user_id
  const cap = {}; global.DB = { '2026-06-19': { date: '2026-06-19', morning: morning } };
  O.sb = sbStub({ data: [{ id: 'x' }], error: null }, cap); navigator.onLine = true;
  r = await O.checkinStore.persistMorning('2026-06-19');
  ok('Online persist: success, source supabase', shape(r) && r.success && r.source === 'supabase');
  ok('Upsert onConflict = user_id,local_date,checkin_type', cap.opts && cap.opts.onConflict === 'user_id,local_date,checkin_type');
  ok('Upsert erzwingt eigene user_id', cap.row && cap.row.user_id === 'A' && cap.row.checkin_type === 'morning');

  // persistMorning: Auth fehlt
  O.user = null; r = await O.checkinStore.persistMorning('2026-06-19');
  ok('Auth fehlt → success false, empty', shape(r) && !r.success && r.source === 'empty');

  // persistMorning offline → Queue, user-scoped Konfliktkey
  O.user = { id: 'A' }; navigator.onLine = false; let enq = {};
  O.offlineQueue = { enqueue: async (t, rr, ck) => { enq = { t, rr, ck }; return { success: true, data: rr, error: null, source: 'indexeddb', sync_status: 'pending' }; } };
  r = await O.checkinStore.persistMorning('2026-06-19');
  ok('Offline → pending, indexeddb', shape(r) && r.success && r.source === 'indexeddb' && r.sync_status === 'pending');
  ok('Queue: Tabelle + Konfliktkey + user_id', enq.t === 'daily_checkins' && enq.ck === 'user_id,local_date,checkin_type' && enq.rr.user_id === 'A');

  // Offline ohne Queue → kein falscher Erfolg
  O.offlineQueue = undefined; r = await O.checkinStore.persistMorning('2026-06-19');
  ok('Offline ohne Queue → success false', shape(r) && !r.success && r.source === 'indexeddb');

  // hydrateRecent: Tabelle gewinnt je Tag, fremde Tage unberührt
  navigator.onLine = true; O.user = { id: 'A' };
  global.DB = { '2026-06-10': { date: '2026-06-10', morning: { feel: 1, sleepQ: 1 } }, '2026-06-11': { date: '2026-06-11', morning: { feel: 9 } } };
  const tableRows = [{ local_date: '2026-06-10', checkin_type: 'morning', sleep_minutes: 480, sleep_quality: 9, feel: 8, complaints: [{ type: 'knee', score: 3 }], recorded_at: new Date().toISOString() }];
  O.sb = sbStub({ data: tableRows, error: null });
  r = await O.checkinStore.hydrateRecent(35);
  ok('hydrate success, 1 angewendet', shape(r) && r.success && r.data.applied === 1);
  ok('Tabelle gewinnt für 2026-06-10 (sleepQ 9, knee 3)', DB['2026-06-10'].morning.sleepQ === 9 && DB['2026-06-10'].morning.knee === 3);
  ok('Tag ohne Tabellenwert (2026-06-11) bleibt Blob (feel 9)', DB['2026-06-11'].morning.feel === 9);

  // hydrateRecent offline → strukturierter Fehler, kein Crash
  navigator.onLine = false; r = await O.checkinStore.hydrateRecent(35);
  ok('hydrate offline → success false, pending', shape(r) && !r.success && r.sync_status === 'pending');

  // ===== Ergänzte Tests A–H (vollständige Morgen-Daten ohne Verlust) =====
  navigator.onLine = true; O.user = { id: 'A' };

  // A. Illness Round-Trip
  const rA1 = O.repos.checkin.toRow('2026-06-19', 'morning', { illness: true });
  ok('A illness=true Round-Trip', rA1.illness === true && O.checkinStore.rowToMorning(rA1).illness === true);
  const rA2 = O.repos.checkin.toRow('2026-06-19', 'morning', { illness: false });
  ok('A illness=false erhalten', rA2.illness === false && O.checkinStore.rowToMorning(rA2).illness === false);

  // B. Mehrere Beschwerden bleiben erhalten
  const mB = { complaints: [{ type: 'knee', score: 3, region: 'left', note: 'unter Patella' }, { type: 'back', score: 2, region: 'lower', note: 'morgens steif' }] };
  const rB = O.repos.checkin.toRow('2026-06-19', 'morning', mB);
  ok('B toRow: 2 complaints + Reihenfolge', rB.complaints.length === 2 && rB.complaints[0].type === 'knee' && rB.complaints[1].type === 'back');
  const bB = O.checkinStore.rowToMorning(rB);
  ok('B rowToMorning: 2 complaints, knee=3, back-Score=2', bB.complaints.length === 2 && bB.knee === 3 && bB.complaints[1].type === 'back' && bB.complaints[1].score === 2);

  // C. Nicht-Knie-Beschwerde bleibt, kein erfundenes knee
  const bC = O.checkinStore.rowToMorning(O.repos.checkin.toRow('2026-06-19', 'morning', { complaints: [{ type: 'back', score: 4, note: 'LWS' }] }));
  ok('C back erhalten, kein erfundenes knee', bC.complaints[0].type === 'back' && bC.complaints[0].score === 4 && !('knee' in bC));

  // D. Notiz und Region bleiben erhalten
  ok('D note + region erhalten', bB.complaints[0].note === 'unter Patella' && bB.complaints[0].region === 'left');

  // E. Leeres/ungültiges complaints → immer []
  ok('E null → []', O.checkinStore.rowToMorning({ complaints: null }).complaints.length === 0);
  ok('E undefined → []', O.checkinStore.rowToMorning({}).complaints.length === 0);
  ok('E object → []', O.checkinStore.rowToMorning({ complaints: {} }).complaints.length === 0);
  ok('E [] → []', O.checkinStore.rowToMorning({ complaints: [] }).complaints.length === 0);
  ok('E toRow null → []', O.repos.checkin.toRow('d', 'morning', { complaints: null }).complaints.length === 0);

  // F. Keine Referenzteilung
  const rowF = { complaints: [{ type: 'knee', score: 5 }] };
  const mF = O.checkinStore.rowToMorning(rowF); mF.complaints[0].score = 99;
  ok('F rowToMorning: keine Referenzteilung', rowF.complaints[0].score === 5);
  const morF = { complaints: [{ type: 'back', score: 2 }] };
  const rF = O.repos.checkin.toRow('d', 'morning', morF); rF.complaints[0].score = 88;
  ok('F toRow: keine Referenzteilung', morF.complaints[0].score === 2);

  // G. Kein doppeltes Knie-Complaint
  const rG = O.repos.checkin.toRow('d', 'morning', { knee: 7, complaints: [{ type: 'knee', score: 3, note: 'alt' }] });
  ok('G genau ein Knie-Complaint', rG.complaints.filter(c => c.type === 'knee').length === 1);
  ok('G Score konsistent = morning.knee (7)', rG.complaints.find(c => c.type === 'knee').score === 7);

  // H. Hydrierung aus Tabelle vollständig
  global.DB = { '2026-06-12': { date: '2026-06-12', morning: { feel: 1 } }, '2026-06-13': { date: '2026-06-13', morning: { feel: 9 } } };
  O.sb = sbStub({ data: [{ local_date: '2026-06-12', checkin_type: 'morning', illness: true, feel: 8, complaints: [{ type: 'knee', score: 4, region: 'left', note: 'p' }, { type: 'back', score: 2, region: 'lower', note: 'b' }], recorded_at: new Date().toISOString() }], error: null });
  const rH = await O.checkinStore.hydrateRecent(35);
  const mH = DB['2026-06-12'].morning;
  ok('H hydrate success, applied 1', rH.success && rH.data.applied === 1);
  ok('H vollständig: illness + 2 complaints + knee=4 + notes', mH.illness === true && mH.complaints.length === 2 && mH.knee === 4 && mH.complaints[0].note === 'p' && mH.complaints[1].type === 'back');
  ok('H Tabelle gewinnt (feel 8 statt 1)', mH.feel === 8);
  ok('H anderer Blob-Tag unberührt (feel 9)', DB['2026-06-13'].morning.feel === 9);

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });

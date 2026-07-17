/* ORVIA · checkin-extra UI-Glue — Unit-Test (DOM-Stubs).
   Prüft gather/save-Verdrahtung: korrekter Payload je Typ + persistCheckin-Aufruf.
   node supabase/tests/checkin_extra_ui_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, info) => { console.log((c ? '✅' : '❌') + ' ' + n + (info ? '  — ' + info : '')); c ? pass++ : fail++; };

// ---- DOM/Helfer-Stubs (wie ui.js sie bereitstellt) ----
let VALUES = {}, SELECTED = {}, PRESENT = new Set();
global.window = {};
global.document = { getElementById: (id) => PRESENT.has(id) ? { value: VALUES[id] } : null };
global.cur = '2026-06-19';
global.LIM = { bb: [0, 100], rhr: [25, 120] };
global.v = (id) => VALUES[id];
global.numIn = (id, min, max) => { const n = +VALUES[id]; return isNaN(n) ? null : Math.max(min, Math.min(max, n)); };
global.chipGet = (id) => SELECTED[id] || [];
global.esc = (s) => String(s == null ? '' : s);
let lastToast = null; global.toast = (m) => { lastToast = m; };
global.save = () => {};
global.canEditCur = () => true;
global.slider = () => ''; global.chips = () => ''; global.initRanges = () => {};
let DBX = {}; global.entry = (d) => { if (!DBX[d]) DBX[d] = { date: d }; return DBX[d]; };

// persistCheckin-Capture
let cap = null;
global.window.ORVIA = { checkinStore: { persistCheckin: (date, type, obj) => { cap = { date, type, obj }; return Promise.resolve({ success: true, data: obj, error: null, source: 'supabase', sync_status: 'synced' }); } } };

(0, eval)(fs.readFileSync(new URL('../../js/checkin-extra.js', import.meta.url), 'utf8'));

function setForm(present, values, selected) { PRESENT = new Set(present); VALUES = values; SELECTED = selected; }

const run = async () => {
  // PRE: bb + rhr vorhanden
  setForm(['x_feel', 'x_stress', 'x_legs', 'x_doms', 'x_ill', 'x_knee', 'x_back', 'x_hip', 'x_bb', 'x_rhr'],
    { x_feel: '8', x_legs: '6', x_doms: '2', x_bb: '70', x_rhr: '55', x_knee: '3', x_back: '0', x_hip: '0' },
    { x_stress: ['Med'], x_ill: ['Nein'] });
  DBX = {}; cap = null;
  window.saveExtraCheckin('pre');
  await Promise.resolve();
  const pre = DBX['2026-06-19'].pre;
  ok('PRE in DB[date].pre geschrieben', !!pre && pre.feel === 8 && pre.legs === 6 && pre.doms === 2 && pre.stress === 'Med' && pre.illness === false);
  ok('PRE complaints aus Slidern (nur knee>0) + knee-Kompat', pre.complaints.length === 1 && pre.complaints[0].type === 'knee' && pre.complaints[0].score === 3 && pre.knee === 3);
  ok('PRE bb + rhr enthalten', pre.bb === 70 && pre.rhr === 55);
  ok('PRE persistCheckin(date,pre,obj) aufgerufen', cap && cap.date === '2026-06-19' && cap.type === 'pre' && cap.obj === pre);

  // POST: kein bb/rhr
  setForm(['x_feel', 'x_stress', 'x_legs', 'x_doms', 'x_ill', 'x_knee', 'x_back', 'x_hip'],
    { x_feel: '6', x_legs: '5', x_doms: '4', x_knee: '0', x_back: '4', x_hip: '0' },
    { x_stress: ['High'], x_ill: ['Ja'] });
  DBX = {}; cap = null;
  window.saveExtraCheckin('post');
  await Promise.resolve();
  const post = DBX['2026-06-19'].post;
  ok('POST kein bb/rhr (cfg)', !('bb' in post) && !('rhr' in post));
  ok('POST illness=true, Nicht-Knie-Beschwerde (back) erhalten, kein erfundenes knee', post.illness === true && post.complaints[0].type === 'back' && post.complaints[0].score === 4 && !('knee' in post));
  ok('POST persistCheckin type=post', cap && cap.type === 'post');

  // LIVE: bb ja, rhr nein
  setForm(['x_feel', 'x_stress', 'x_legs', 'x_doms', 'x_ill', 'x_knee', 'x_back', 'x_hip', 'x_bb'],
    { x_feel: '9', x_legs: '8', x_doms: '0', x_bb: '88', x_knee: '0', x_back: '0', x_hip: '0' },
    { x_stress: ['Low'], x_ill: ['Nein'] });
  DBX = {}; cap = null;
  window.saveExtraCheckin('live');
  await Promise.resolve();
  const live = DBX['2026-06-19'].live;
  ok('LIVE bb enthalten, rhr nicht', live.bb === 88 && !('rhr' in live));
  ok('LIVE keine Beschwerden → complaints []', Array.isArray(live.complaints) && live.complaints.length === 0);

  // Ungültiger Typ → no-op, kein persist
  cap = null; window.saveExtraCheckin('bogus');
  ok('Ungültiger Typ → kein persist', cap === null);

  // ===== Toast-/Fehlerlogik (A–E) =====
  const tick = () => new Promise(r => setTimeout(r, 0));
  setForm(['x_feel', 'x_stress', 'x_legs', 'x_doms', 'x_ill', 'x_knee', 'x_back', 'x_hip', 'x_bb'],
    { x_feel: '8', x_legs: '7', x_doms: '1', x_bb: '70', x_knee: '0', x_back: '0', x_hip: '0' }, { x_stress: ['Low'], x_ill: ['Nein'] });
  global.save = () => true;
  function setPersist(fn) { window.ORVIA = { checkinStore: { persistCheckin: fn } }; }

  // A Cloud-Erfolg
  lastToast = null; setPersist(() => Promise.resolve({ success: true, sync_status: 'synced', source: 'supabase', data: {}, error: null }));
  window.saveExtraCheckin('live'); await tick();
  ok('A synced → Erfolgstoast ✓', /Live-Check-in gespeichert ✓/.test(lastToast || ''), lastToast);

  // B Offline-Queue
  lastToast = null; setPersist(() => Promise.resolve({ success: true, sync_status: 'pending', source: 'indexeddb', data: {}, error: null }));
  window.saveExtraCheckin('live'); await tick();
  ok('B pending → Offline-Toast ⏳ (kein „fehlgeschlagen")', /Offline gespeichert/.test(lastToast || '') && !/fehlgeschlagen/.test(lastToast || ''), lastToast);

  // C Cloud-Fehler bei lokalem Erfolg
  lastToast = null; setPersist(() => Promise.resolve({ success: false, sync_status: 'failed', source: 'supabase', data: null, error: { message: 'db' } }));
  window.saveExtraCheckin('live'); await tick();
  ok('C success:false → lokal/Cloud-Sync fehlgeschlagen', /lokal gespeichert – Cloud-Sync fehlgeschlagen/.test(lastToast || ''), lastToast);

  // D Store fehlt
  lastToast = null; window.ORVIA = {};
  window.saveExtraCheckin('live'); await tick();
  ok('D Store fehlt → Cloud-Sync nicht verfügbar', /Cloud-Sync nicht verfügbar/.test(lastToast || ''), lastToast);

  // E1 Promise reject → kein falscher Erfolg
  lastToast = null; setPersist(() => Promise.reject(new Error('boom')));
  window.saveExtraCheckin('live'); await tick();
  ok('E reject → kein ✓, Cloud-Sync fehlgeschlagen', !/✓/.test(lastToast || '') && /Cloud-Sync fehlgeschlagen/.test(lastToast || ''), lastToast);

  // E2 persist wirft synchron
  lastToast = null; setPersist(() => { throw new Error('sync-boom'); });
  window.saveExtraCheckin('live'); await tick();
  ok('E sync-throw → Cloud-Sync fehlgeschlagen', /Cloud-Sync fehlgeschlagen/.test(lastToast || ''), lastToast);

  // E3 lokales save() wirft → Fehlertoast, KEIN persist-Aufruf
  let persistCalled = 0; setPersist(() => { persistCalled++; return Promise.resolve({ success: true, sync_status: 'synced' }); });
  global.save = () => { throw new Error('quota'); };
  lastToast = null; window.saveExtraCheckin('live'); await tick();
  ok('E save wirft → „konnte nicht gespeichert werden", kein persist', /konnte nicht gespeichert werden/.test(lastToast || '') && persistCalled === 0, lastToast + ' persist=' + persistCalled);

  // E4 lokales save() == false → Fehlertoast, kein persist
  persistCalled = 0; global.save = () => false; lastToast = null;
  window.saveExtraCheckin('live'); await tick();
  ok('E save=false → Fehlertoast, kein persist', /konnte nicht gespeichert werden/.test(lastToast || '') && persistCalled === 0, lastToast);
  global.save = () => true;

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });

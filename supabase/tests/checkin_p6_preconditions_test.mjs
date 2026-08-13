/* ============================================================
   ORVIA · Phase-6-Vorbedingungen (Audit-Befunde 1, 2, 6) — Verhaltenstests
   (a) ill/illness-Feldbruch: gatherMorning schreibt `ill`, Tabelle heißt
       `illness` → toRow akzeptiert beide; rowToCheckin liefert beide zurück.
   (b) Hydration-Merge: Tabelle gewinnt je Feld (auch mit null), aber
       Blob-only-Morgenfelder (weight/ankle/domsRegion) überleben.
   (c) Stille Slider-Defaults (420/6/7/7/2) sind KEINE Messwerte: nur
       bewusst berührte Slider (data-dirty) oder vorhandene Vorwerte zählen.
   Methodik: checkin-store.js + checkinRepository.js werden komplett in einer
   vm-Sandbox ausgeführt; aus ui.js wird der ECHTE Funktionsblock
   (_sliderVal … gatherMorning inkl. _ci*-Helfer) über benannte Funktions-
   grenzen isoliert und mit DOM-Stubs + echter checkin-fields-Registry
   ausgeführt (kein Zeichenfenster-Regex).
   node supabase/tests/checkin_p6_preconditions_test.mjs
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
const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');

/* ---------- Harness A/B: checkinRepository + checkin-store (vollständig) ---------- */
function makeStore(rows) {
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Object = Object; sb.Array = Array;
  sb.String = String; sb.Number = Number; sb.Promise = Promise; sb.isNaN = isNaN;
  sb.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  sb.navigator = { onLine: true };
  sb.DB = {};
  sb.todayStr = () => '2026-07-17';
  sb.ORVIA = { repos: {}, repoBase: {
    requireAuth: () => null, online: () => true, currentUserId: () => 'u1',
    sb: () => null, stampUser: r => r,
    ok: (d, x) => Object.assign({ success: true, data: d, error: null }, x || {}),
    fail: (c, m, x) => Object.assign({ success: false, data: null, error: { code: c, message: m } }, x || {}),
    upsert: async () => ({ success: true, data: null, error: null }),
    upsertMany: async () => ({ success: true, data: null, error: null }),
    selectAll: async () => ({ success: true, data: [], error: null })
  } };
  vm.createContext(sb);
  ['repos/checkinRepository.js', 'checkin-store.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  // listRange-Stub NACH dem Laden ersetzen (Hydration liest aus "der Tabelle").
  sb.ORVIA.repos.checkin.listRange = async () => ({ success: true, data: rows || [], error: null });
  return sb;
}

/* ---------- (a) ill/illness-Feldbruch ---------- */
{
  const sb = makeStore([]);
  const toRow = sb.ORVIA.repos.checkin.toRow;
  const rowToCheckin = sb.ORVIA.checkinStore.rowToCheckin;
  ok('A1 toRow persistiert gatherMorning-Feld `ill` als `illness`', toRow('2026-07-17', 'morning', { ill: true }).illness === true);
  ok('A2 explizites `illness` hat Vorrang, false bleibt false', toRow('2026-07-17', 'morning', { illness: false, ill: true }).illness === false);
  ok('A3 weder ill noch illness ⇒ null (keine Erfindung)', toRow('2026-07-17', 'morning', {}).illness === null);
  const m = rowToCheckin({ illness: true });
  ok('A4 rowToCheckin liefert BEIDE Namen (UI liest m.ill, Engine m.illness)', m.ill === true && m.illness === true);
  const rt = rowToCheckin(toRow('2026-07-17', 'morning', { ill: true }));
  ok('A5 Roundtrip gatherMorning→Tabelle→Hydration erhält Krankheit', rt.ill === true, JSON.stringify({ ill: rt.ill, illness: rt.illness }));
}

/* ---------- (b) Hydration-Merge: Blob-only-Felder überleben ---------- */
await (async () => {
  const row = {
    local_date: '2026-07-17', checkin_type: 'morning', recorded_at: '2026-07-17T06:30:00Z',
    sleep_minutes: 430, sleep_quality: 7, resting_hr: 50, hrv_ms: null, hrv_status: null,
    body_battery: null, stress: null, feel: 8, leg_strength: null, doms: null,
    illness: true, complaints: []
  };
  const sb = makeStore([row]);
  sb.DB['2026-07-17'] = { date: '2026-07-17', morning: { sleepMin: 400, weight: 74.5, ankle: 2, domsRegion: 'Wade', doms: 5, rhr: 58 } };
  const r = await sb.ORVIA.checkinStore.hydrateRecentTypes(35, ['morning']);
  const m = sb.DB['2026-07-17'].morning;
  ok('B1 Hydration erfolgreich, 1 Zeile angewendet', r.success === true && r.data.applied === 1);
  ok('B2 Blob-only-Felder überleben (weight/ankle/domsRegion)', m.weight === 74.5 && m.ankle === 2 && m.domsRegion === 'Wade', JSON.stringify({ w: m.weight, a: m.ankle, dr: m.domsRegion }));
  ok('B3 Tabelle gewinnt bei abgebildeten Feldern (sleepMin 400→430, rhr 58→50)', m.sleepMin === 430 && m.rhr === 50);
  ok('B4 Tabellen-null gewinnt ebenfalls (doms 5→null — dokumentierte Semantik)', m.doms === null);
  ok('B5 Krankheit kommt nach Hydration in der UI an (m.ill)', m.ill === true);
})();

/* ---------- (c) Slider-Defaults: nur berührte Werte zählen ---------- */
/* Echte ui.js-Funktionsblöcke über benannte Funktionsgrenzen isolieren. */
function slice(src, startMarker, endMarker) {
  const s = src.indexOf(startMarker), e = src.indexOf(endMarker);
  if (s < 0 || e < 0 || e <= s) throw new Error('Funktionsgrenzen nicht gefunden: ' + startMarker + ' … ' + endMarker);
  return src.slice(s, e);
}
const gatherBlock = slice(uiSrc, 'function _sliderVal', 'function toggleAnkle');

function makeGather(opts) {
  opts = opts || {};
  const els = opts.els || {};          // id → {value, dataset:{dirty?}}
  const chipsSel = opts.chips || {};   // id → ['Ja'] etc.
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.Date = Date; sb.Number = Number; sb.Math = Math; sb.Object = Object; sb.Array = Array;
  sb.document = { getElementById: id => (id in els ? els[id] : null) };
  sb.v = id => { const e = sb.document.getElementById(id); return e ? e.value : ''; };
  sb.chipGet = id => chipsSel[id] || [];
  sb.numIn = (id, min, max) => { const e = sb.document.getElementById(id); if (!e || e.value === '') return null; const n = Number(e.value); return isNaN(n) ? null : Math.min(max, Math.max(min, n)); };
  sb.LIM = { rhr: [30, 120], bb: [0, 100], weight: [30, 250], hrvMs: [10, 200] };
  sb.entry = () => ({ morning: opts.prev || {} });
  sb.cur = '2026-07-17';
  sb.todayStr = () => '2026-07-17';
  sb.ORVIA = {};
  vm.createContext(sb);
  // Phase 6: gatherMorning ist deklarativ — echte Registry laden, dann den
  // echten Funktionsblock (Anker _sliderVal … toggleAnkle, enthält auch die
  // _ci*-Helfer und gatherMorning) ausführen.
  vm.runInContext(readFileSync(new URL('checkin-fields.js', base), 'utf8'), sb, { filename: 'checkin-fields.js' });
  vm.runInContext(gatherBlock, sb, { filename: 'ui.js#gatherMorning' });
  if (opts.autoMap) sb._ciAuto = { date: '2026-07-17', state: 'ready', map: opts.autoMap };
  return sb;
}
const el = (value, dirty) => ({ value: String(value), dataset: dirty ? { dirty: '1' } : {} });
const FULL_ELS = () => ({ m_sleep: el(420), m_sleepQ: el(6), m_feel: el(7), m_legs: el(7), m_doms: el(2), m_knee: el(0), m_rhr: el(''), m_bb: el(''), m_weight: el(''), m_hrvMs: el(''), m_hrv: {}, m_stress: {}, m_ill: {} });
{
  // C1: frischer Tag, ausführlicher Modus, NICHTS angefasst ⇒ keine Fantasie-Messwerte.
  const g1 = makeGather({ els: FULL_ELS() }).gatherMorning();
  ok('C1 unberührte Slider ⇒ sleepMin/sleepQ/feel/legs/doms = null (nicht 420/6/7/7/2)',
    g1.sleepMin === null && g1.sleepQ === null && g1.feel === null && g1.legs === null && g1.doms === null,
    JSON.stringify({ s: g1.sleepMin, q: g1.sleepQ, f: g1.feel, l: g1.legs, d: g1.doms }));
  // C2: ein Slider bewusst bewegt ⇒ NUR dieser zählt.
  const els2 = FULL_ELS(); els2.m_sleep = el(400, true);
  const g2 = makeGather({ els: els2 }).gatherMorning();
  ok('C2 berührter Schlaf-Slider zählt (400), Rest bleibt null', g2.sleepMin === 400 && g2.feel === null && g2.doms === null);
  // C3: Vorwerte existieren, Slider unberührt ⇒ Vorwerte bleiben erhalten (kein Datenverlust).
  const g3 = makeGather({ els: FULL_ELS(), prev: { sleepMin: 390, sleepQ: 8, feel: 6, legs: 5, doms: 3 } }).gatherMorning();
  ok('C3 unberührt + Vorwert ⇒ Vorwert bleibt (390/8/6/5/3)', g3.sleepMin === 390 && g3.sleepQ === 8 && g3.feel === 6 && g3.legs === 5 && g3.doms === 3);
  // C4: Schnell-Modus ohne Chip-Auswahl ⇒ null statt 420/7.
  const g4 = makeGather({ els: { m_ill: {} } }).gatherMorning();
  ok('C4 Schnell-Modus ohne Auswahl ⇒ sleepMin/feel null', g4.sleepMin === null && g4.feel === null);
  // C5: Schnell-Modus MIT bewusster Chip-Auswahl ⇒ gemappter Wert zählt.
  const g5 = makeGather({ els: { m_ill: {} }, chips: { m_qsleep: ['OK'], m_qfeel: ['Gut'] } }).gatherMorning();
  ok('C5 bewusste Chip-Auswahl zählt (OK→420, Gut→8)', g5.sleepMin === 420 && g5.feel === 8);
  // C6: manuelle Eingaben (rhr/weight) unabhängig von Slidern weiterhin erfasst.
  const els6 = FULL_ELS(); els6.m_rhr = el(52); els6.m_weight = el(74.5);
  const g6 = makeGather({ els: els6 }).gatherMorning();
  ok('C6 Zahleneingaben bleiben unabhängig erfasst (rhr 52, weight 74.5)', g6.rhr === 52 && g6.weight === 74.5 && g6.sleepMin === null);
}

/* ---------- Verdrahtungs-Vertrag: dirty-Markierung existiert im Produktivcode ---------- */
{
  ok('W1 input-Listener markiert Range-Slider als dirty', /morningForm'\)\.addEventListener\('input',e=>\{try\{if\(e&&e\.target&&e\.target\.type==='range'&&e\.target\.dataset\)e\.target\.dataset\.dirty='1';/.test(uiSrc));
  ok('W2 sleepStep markiert m_sleep als dirty', /function sleepStep\(d\)\{const el=document\.getElementById\('m_sleep'\);if\(el&&el\.dataset\)el\.dataset\.dirty='1';/.test(uiSrc));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

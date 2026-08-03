/* ============================================================
   ORVIA · Phase 6 — deklaratives Check-in + CheckinFieldResolver
   Verträge:
   - Registry (checkin-fields.js) ist konsistent: metricIds existieren in der
     metric-registry, el-ids sind eindeutig, table-Spalten kennt toRow.
   - Resolver (checkin-field-resolver.js, pure): ersetzt Fragen NUR durch
     frische automatische Werte (source automatic/override, nicht stale,
     Alter <= autoMaxAgeDays, Wert abbildbar); Fallback immer 'ask'.
   - renderMorning (deklarativ): volle/Quick-Struktur unverändert; Auto-Felder
     werden zur "Automatisch von Garmin"-Zeile mit Bearbeiten-Fallback.
   - gatherMorning: übernommene Werte landen im Check-in + autoSources je Feld;
     Nutzereingabe (Bearbeiten) schlägt Automatik.
   - toRow/rowToCheckin: auto_sources-Roundtrip (Migration 0021), source 'mixed'.
   - Verdrahtung: index.html-Reihenfolge, sw-ASSETS, SW >= v8-189, Migration.
   Methodik: echte Module in vm; ui.js-Blöcke über benannte Funktionsgrenzen.
   node supabase/tests/checkin_field_resolver_p6_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../../app/js/', import.meta.url);
const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');
const TODAY = '2026-07-17';

function slice(src, startMarker, endMarker) {
  const s = src.indexOf(startMarker), e = src.indexOf(endMarker);
  if (s < 0 || e < 0 || e <= s) throw new Error('Funktionsgrenzen nicht gefunden: ' + startMarker + ' … ' + endMarker);
  return src.slice(s, e);
}
const gatherBlock = slice(uiSrc, 'function _sliderVal', 'function toggleAnkle');
const renderBlock = slice(uiSrc, 'function ciEditManually', 'function sleepUpd');
const uiHelpersBlock = slice(uiSrc, 'function slider(', 'function chipGet(') + "\nfunction chipGet(id){const box=document.getElementById(id);if(!box)return[];return[...box.children].filter(c=>c.classList&&c.classList.contains&&c.classList.contains('on')).map(c=>c.dataset.v);}";

/* ---------- Sandbox mit echten Modulen + ui.js-Blöcken ---------- */
function makeUi(opts) {
  opts = opts || {};
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Object = Object; sb.Array = Array;
  sb.String = String; sb.Number = Number; sb.Promise = Promise; sb.isNaN = isNaN; sb.isFinite = isFinite;
  const forms = { morningForm: { innerHTML: '', contains: () => false } };
  sb.document = {
    getElementById: id => (id === 'morningForm' ? forms.morningForm : null),
    querySelectorAll: () => [], activeElement: null
  };
  sb.esc = s => String(s == null ? '' : s);
  sb.jsArg = s => String(s);
  sb.initRanges = () => {};
  sb.checkinContextHint = () => '';
  sb.setCheckinMode = () => {};
  sb.sleepUpd = () => {};
  sb.sleepStep = () => {};
  sb.todayStr = () => TODAY;
  sb.cur = TODAY;
  sb.entry = () => ({ morning: opts.m || {} });
  sb.PROFILE = { checkinMode: opts.mode || 'full' };
  sb.v = () => '';
  sb.numIn = () => null;
  sb.LIM = { rhr: [30, 120], bb: [0, 100], weight: [30, 250], hrvMs: [10, 200] };
  sb.ORVIA = {};
  vm.createContext(sb);
  ['metrics/metric-registry.js', 'checkin-fields.js', 'checkin-field-resolver.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  vm.runInContext(uiHelpersBlock, sb, { filename: 'ui.js#helpers' });
  vm.runInContext(gatherBlock, sb, { filename: 'ui.js#gather' });
  vm.runInContext(renderBlock, sb, { filename: 'ui.js#render' });
  if (opts.autoMap) sb._ciAuto = { date: TODAY, state: 'ready', map: opts.autoMap };
  sb.__form = forms.morningForm;
  return sb;
}

/* ---------- 1) Registry-Konsistenz ---------- */
{
  const sb = makeUi();
  const CF = sb.ORVIA.checkinFields;
  const R = sb.ORVIA.metricRegistry;
  const mids = CF.MORNING.filter(f => f.metricId);
  ok('G1 alle Registry-metricIds existieren in der metric-registry', mids.every(f => !!R.byId(f.metricId)), mids.map(f => f.metricId).join(','));
  const els = CF.MORNING.map(f => f.el).concat(CF.EVENING.map(f => f.el));
  ok('G2 el-ids eindeutig über beide Formulare', new Set(els).size === els.length);
  ok('G3 die 5 objektiven Morgenfelder sind auto-fähig',
    ['sleepMin', 'rhr', 'bb', 'hrvMs', 'hrv'].every(k => { const f = CF.byKey(CF.MORNING, k); return f && f.metricId; }));
  ok('G4 subjektive Felder (feel/legs/doms/sleepQ/ill) NIE auto',
    ['feel', 'legs', 'doms', 'sleepQ', 'ill'].every(k => { const f = CF.byKey(CF.MORNING, k); return f && !f.metricId; }));
}

/* ---------- 2) Resolver-Regeln (pure) ---------- */
{
  const sb = makeUi();
  const CFR = sb.ORVIA.checkinFieldResolver;
  const CF = sb.ORVIA.checkinFields;
  const res = (metricId, value, over) => Object.assign({ metricType: metricId, value, valueText: null, source: 'automatic', stale: false, metricDate: TODAY, measuredAt: TODAY + 'T06:00:00Z' }, over || {});
  const run = map => CFR.resolveCheckinFields(CF.MORNING, map, { today: TODAY });

  const m1 = run({ sleep_duration_min: res('sleep_duration_min', 452), resting_hr: res('resting_hr', 48) });
  ok('F1 frische automatische Werte ersetzen die Frage (sleepMin+rhr)', m1.sleepMin && m1.sleepMin.value === 452 && m1.rhr && m1.rhr.value === 48);
  ok('F2 Schlaf-Anzeigetext formatiert (452 → 7h 32min)', m1.sleepMin.text === '7h 32min', m1.sleepMin.text);
  ok('F3 stale ⇒ Frage bleibt', !run({ resting_hr: res('resting_hr', 48, { stale: true }) }).rhr);
  ok('F4 manuelle Quelle ⇒ Frage bleibt', !run({ resting_hr: res('resting_hr', 48, { source: 'manual' }) }).rhr);
  ok('F5 override ⇒ ersetzt (bewusste Nutzerkorrektur in der Metrik-Welt)', !!run({ resting_hr: res('resting_hr', 48, { source: 'override' }) }).rhr);
  const yday = '2026-07-16';
  ok('F6 Body Battery nur tagesaktuell (autoMaxAgeDays 0): gestern ⇒ ask',
    !run({ body_battery: res('body_battery', 70, { metricDate: yday }) }).bb &&
    !!run({ body_battery: res('body_battery', 70) }).bb);
  /* FIX 19.07.2026: Der Worker datiert Nacht-Metriken auf den AUFWACH-Tag —
     "letzte Nacht" trägt IMMER das heutige Datum. Ein gestern datierter
     Schlafwert ist die VORLETZTE Nacht und darf die Frage NICHT ersetzen
     (Live-Befund: Vortageswerte wurden vor dem Morgen-Sync vorbefüllt). */
  ok('F7 Schlaf von gestern (= VORLETZTE Nacht) ⇒ ask; nur heutiger Wert ersetzt',
    !run({ sleep_duration_min: res('sleep_duration_min', 430, { metricDate: yday }) }).sleepMin &&
    !!run({ sleep_duration_min: res('sleep_duration_min', 430) }).sleepMin);
  ok('F7b Ruhepuls/HRV von gestern ⇒ ask (autoMaxAgeDays 0 durchgängig)',
    !run({ resting_hr: res('resting_hr', 48, { metricDate: yday }) }).rhr &&
    !run({ hrv_ms: res('hrv_ms', 62, { metricDate: yday }) }).hrvMs);
  const hrv = run({ hrv_status: res('hrv_status', null, { valueText: 'BALANCED' }) });
  ok('F8 hrv_status-Text wird auf Chip-Wert gemappt (BALANCED → Balanced)', hrv.hrv && hrv.hrv.value === 'Balanced');
  ok('F9 unbekannter Statustext ⇒ ask', !run({ hrv_status: res('hrv_status', null, { valueText: 'komisch' }) }).hrv);
  ok('F10 Wert außerhalb der Feldgrenzen ⇒ ask (Schlaf 800 > max 720)', !run({ sleep_duration_min: res('sleep_duration_min', 800) }).sleepMin);
  ok('F11 leere Map ⇒ alles ask (Sync-Ausfall degradiert sauber)', Object.keys(run({})).length === 0);
}

/* ---------- 3) renderMorning deklarativ ---------- */
{
  // Ohne Auto-Daten: Struktur entspricht dem Bestand.
  const sb = makeUi({ m: { rhr: 55 } });
  sb.renderMorning();
  const h = sb.__form.innerHTML;
  ok('R1 volle Struktur: Schlaf-Slider mit Default 420', /id="m_sleep"[^>]*value="420"/.test(h));
  ok('R2 Reihenfolge Bestand: sleep < sleepQ < rhr < weight < hrv < ill < feel < doms',
    ['m_sleep"', 'm_sleepQ', 'm_rhr', 'm_weight', 'm_hrv"', 'm_ill', 'm_feel', 'm_doms'].every((id, i, arr) => i === 0 || h.indexOf(arr[i - 1]) < h.indexOf(id)));
  ok('R3 row2-Paare (rhr+bb, weight+hrvMs)', (h.match(/<div class="row2">/g) || []).length === 2);
  ok('R4 gespeicherter Wert vorbelegt (rhr 55)', /id="m_rhr" value="55"/.test(h));
  ok('R5 kein Quick-Hinweis im vollen Modus', !/Schnell-Check —/.test(h));

  const sbQ = makeUi({ mode: 'quick', m: { feel: 8, sleepMin: 400 } });
  sbQ.renderMorning();
  const hq = sbQ.__form.innerHTML;
  ok('R6 Quick-Reihenfolge: Befinden vor Schlaf vor Krankheit', hq.indexOf('m_qfeel') < hq.indexOf('m_qsleep') && hq.indexOf('m_qsleep') < hq.indexOf('m_ill'));
  ok('R7 Quick-Vorauswahl aus gespeicherten Werten (feel 8→Gut aktiv, sleep 400→OK aktiv)',
    /class="chip on" data-v="Gut"/.test(hq) && /class="chip on" data-v="OK"/.test(hq) && /Schnell-Check —/.test(hq));

  // Mit Auto-Daten: Frage wird ersetzt.
  const auto = { sleepMin: { value: 452, text: '7h 32min', metricId: 'sleep_duration_min', source: 'garmin' }, rhr: { value: 48, text: '48 bpm', metricId: 'resting_hr', source: 'garmin' } };
  const sbA = makeUi({ autoMap: auto });
  sbA.renderMorning();
  const ha = sbA.__form.innerHTML;
  ok('A1 Auto-Feld ersetzt Eingabe: kein m_sleep-Input mehr', !/id="m_sleep"/.test(ha));
  ok('A2 kompakte Zeile: Wert + Sync-Punkt + Garmin + ✎-Bearbeiten (UI-Redesign 2026-07-18)',
    /7h 32min/.test(ha) && /ci-auto-dot/.test(ha) && />Garmin</.test(ha) && /ci-auto-edit/.test(ha) && /ciEditManually\('sleepMin'\)/.test(ha));
  ok('A3 nicht-automatische Felder bleiben Eingaben (bb/weight/hrvMs)', /id="m_bb"/.test(ha) && /id="m_weight"/.test(ha) && /id="m_hrvMs"/.test(ha));
  // Bearbeiten-Fallback: Eingabe kehrt zurück, mit Garmin-Wert vorbelegt.
  sbA.ciEditManually('rhr');
  const hb = sbA.__form.innerHTML;
  ok('A4 „Bearbeiten" ⇒ Eingabefeld zurück, Garmin-Wert vorbelegt (48)', /id="m_rhr" value="48"/.test(hb));
}

/* ---------- 4) gatherMorning: Übernahme + autoSources ---------- */
{
  const auto = { sleepMin: { value: 452, text: '7h 32min', metricId: 'sleep_duration_min', source: 'garmin' }, rhr: { value: 48, text: '48 bpm', metricId: 'resting_hr', source: 'garmin' } };
  const sb = makeUi({ autoMap: auto });
  sb.renderMorning(); // Auto-Felder ⇒ keine Inputs im DOM (Stub liefert ohnehin null)
  const g = sb.gatherMorning();
  ok('S1 Auto-Werte in den Check-in übernommen (sleepMin 452, rhr 48)', g.sleepMin === 452 && g.rhr === 48);
  ok('S2 autoSources je Feld gesetzt', g.autoSources && g.autoSources.sleepMin === 'garmin' && g.autoSources.rhr === 'garmin', JSON.stringify(g.autoSources));
  ok('S3 nicht-automatische Felder unverfälscht (feel/legs/doms null ohne Berührung)', g.feel === null && g.legs === null && g.doms === null);
  // Bearbeiten ⇒ Nutzereingabe schlägt Automatik, Feld verliert das garmin-Label.
  const sb2 = makeUi({ autoMap: auto });
  sb2._ciManual = { rhr: 1 };
  const g2 = sb2.gatherMorning();
  ok('S4 manuell übersteuert ⇒ kein autoSources-Eintrag für dieses Feld', g2.autoSources && g2.autoSources.sleepMin === 'garmin' && !('rhr' in g2.autoSources));
  // Auto-Map von GESTERN zählt heute nicht.
  const sb3 = makeUi();
  sb3._ciAuto = { date: '2026-07-16', state: 'ready', map: auto };
  const g3 = sb3.gatherMorning();
  ok('S5 veraltete Auto-Map (anderes Datum) wird ignoriert', g3.sleepMin === null && !g3.autoSources);
}

/* ---------- 5) toRow/rowToCheckin: auto_sources-Roundtrip ---------- */
{
  const sb = {}; sb.window = sb; sb.globalThis = sb; sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.JSON = JSON; sb.Object = Object; sb.Array = Array; sb.Promise = Promise; sb.isNaN = isNaN;
  sb.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  sb.navigator = { onLine: true }; sb.DB = {}; sb.todayStr = () => TODAY;
  sb.ORVIA = { repos: {}, repoBase: { requireAuth: () => null, online: () => true, currentUserId: () => 'u1', sb: () => null, stampUser: r => r, ok: d => ({ success: true, data: d, error: null }), fail: (c, m) => ({ success: false, data: null, error: { code: c, message: m } }), upsert: async () => ({ success: true }), upsertMany: async () => ({ success: true }), selectAll: async () => ({ success: true, data: [] }) } };
  vm.createContext(sb);
  ['repos/checkinRepository.js', 'checkin-store.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  const toRow = sb.ORVIA.repos.checkin.toRow;
  const rowToCheckin = sb.ORVIA.checkinStore.rowToCheckin;
  const row = toRow(TODAY, 'morning', { sleepMin: 452, rhr: 48, autoSources: { sleepMin: 'garmin', rhr: 'garmin' } });
  ok('T1 toRow sendet auto_sources und source \'mixed\'', row.auto_sources && row.auto_sources.sleepMin === 'garmin' && row.source === 'mixed');
  ok('T2 ohne autoSources KEIN auto_sources-Key (H3-Muster, migrationskompatibel)', !('auto_sources' in toRow(TODAY, 'morning', { sleepMin: 400 })));
  const back = rowToCheckin(row);
  ok('T3 Roundtrip: autoSources kommt aus der Tabelle zurück', back.autoSources && back.autoSources.rhr === 'garmin');
  ok('T4 expliziter m.source wird nicht überschrieben', toRow(TODAY, 'morning', { autoSources: { rhr: 'garmin' }, source: 'manual' }).source === 'manual');
}

/* ---------- 6) Verdrahtung ---------- */
{
  const idx = readFileSync(new URL('../index.html', base), 'utf8');
  const pos = p => idx.indexOf('<script src="' + p + '"></script>');
  ok('W1 checkin-fields + checkin-field-resolver VOR ui.js geladen',
    pos('js/checkin-fields.js') > 0 && pos('js/checkin-fields.js') < pos('js/checkin-field-resolver.js') && pos('js/checkin-field-resolver.js') < pos('js/ui.js'));
  const sw = readFileSync(new URL('../sw.js', base), 'utf8');
  ok('W2 beide Module in sw-ASSETS', sw.includes("'./js/checkin-fields.js'") && sw.includes("'./js/checkin-field-resolver.js'"));
  const v = (sw.match(/orvia-v8-(\d+)/) || [])[1];
  ok('W3 SW-Version ≥ v8-189', Number(v) >= 189, 'v8-' + v);
  const mig = readFileSync(new URL('../../_dev/supabase/migrations/0021_checkin_auto_sources.sql', base), 'utf8');
  ok('W4 Migration 0021: auto_sources jsonb additiv', /add column if not exists auto_sources jsonb/.test(mig));
  ok('W5 Abend-Formular: dirty-Markierung im input-Listener', /eveForm'\)\.addEventListener\('input',e=>\{try\{if\(e&&e\.target&&e\.target\.type==='range'/.test(uiSrc));
  ok('W6 autoMorning-Guard nutzt m_ill (Auto-Schlaf darf Save nicht deaktivieren)', /function autoMorning\(\)\{if\(!document\.getElementById\('m_ill'\)&&!document\.getElementById\('m_qfeel'\)\)return;/.test(uiSrc));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);

/* ============================================================
   ORVIA · plan_v14_s3a — Schnitt S3a (Plan-Tab, Delta v14)
   ------------------------------------------------------------
     A. Kernreiz-Marker: nur mit Engine-Einstufung (loadProfile), nie aus Regex
     B. Pace-Zonen-Modell: 5 Zeilen aus perf.running.zones, Quelle/Alter, Leerzustand
     C. Pace-Zonen-HTML: Karte bzw. ehrlicher Leerzustand, keine Zielzeit-Rechnung
     D. Kopfzeile: Wettkampf-Countdown nur mit echtem Zieldatum
   node supabase/tests/plan_v14_s3a_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _ex } from 'node:fs';
import { tStub } from './_i18n-src.mjs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const ui = rd('js/ui.js');
const fnSrc = name => { const m = ui.match(new RegExp('\\n(function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\})\\n')); if (!m) throw new Error('fn ' + name + ' fehlt'); return m[1]; };
const g = globalThis;
g.window = g; g.ORVIA = {};
g._uiT = tStub().t;
g.gmEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
g.icon = n => '<svg class="ic" data-i="' + n + '"></svg>';
g.GM_PACE_ROWS = null;
const rowsDecl = ui.match(/var GM_PACE_ROWS=\[[^\n]*\];/)[0];
(0, eval)(rowsDecl + '\n' + fnSrc('gmPlanIsKeyUnit') + '\n' + fnSrc('gmPaceZonesModel') + '\n' + fnSrc('gmPaceZonesSection') + '\n' + fnSrc('gmPlanRaceCountdown') + '\n;globalThis.__f={gmPlanIsKeyUnit,gmPaceZonesModel,gmPaceZonesSection,gmPlanRaceCountdown};');
const F = g.__f;

sec('A · Kernreiz nur aus der Engine');
{
  ok('A1 ohne planVariants ⇒ false', F.gmPlanIsKeyUnit({ t: 'Laufen', l: 'Intervalle 6×800' }) === false);
  g.ORVIA.planVariants = { isKey: it => /interval/i.test(it.l) };
  ok('A2 planVariants ohne loadProfile (Regex-Rueckfall) ⇒ KEIN Marker', F.gmPlanIsKeyUnit({ t: 'Laufen', l: 'Intervalle 6×800' }) === false);
  g.ORVIA.loadProfile = { profileOf: () => ({ systemic: .9 }) };
  ok('A3 mit Engine ⇒ Einstufung von planVariants.isKey', F.gmPlanIsKeyUnit({ t: 'Laufen', l: 'Intervalle 6×800' }) === true && F.gmPlanIsKeyUnit({ t: 'Laufen', l: 'Lockerer DL' }) === false);
  g.ORVIA.planVariants = { isKey: () => { throw new Error('x'); } };
  ok('A4 Throw ⇒ false, kein Absturz', F.gmPlanIsKeyUnit({}) === false);
  delete g.ORVIA.planVariants; delete g.ORVIA.loadProfile;
}

sec('B · Pace-Zonen-Modell');
{
  const zones = { recovery: { loSecPerKm: 400, hiSecPerKm: 438 }, easy: { loSecPerKm: 376, hiSecPerKm: 408 }, long: { loSecPerKm: 366, hiSecPerKm: 398 }, marathon: { loSecPerKm: 324, hiSecPerKm: 340 }, half: { loSecPerKm: 310, hiSecPerKm: 324 }, threshold: { loSecPerKm: 292, hiSecPerKm: 316 }, tenk: { loSecPerKm: 287, hiSecPerKm: 299 }, fivek: { loSecPerKm: 272, hiSecPerKm: 283 }, vo2: { loSecPerKm: 265, hiSecPerKm: 277 } };
  const perf = { running: { ok: true, zones, confidence: 'moderate', ageDays: 12, freshness: 'fresh', reference: { source: 'hard_workout', date: '2026-09-13' } } };
  const m = F.gmPaceZonesModel(perf);
  ok('B1 5 Zeilen in Prototyp-Reihenfolge (recovery, easy, half, threshold, vo2)', m.ok && m.rows.map(r => r.key).join() === 'recovery,easy,half,threshold,vo2');
  ok('B2 Formatierung m:ss, Regeneration als „> lo"', m.rows[0].text === '> 6:40' && m.rows[3].text === '4:52–5:16', JSON.stringify(m.rows.map(r => r.text)));
  ok('B3 Quelle, Konfidenz, Alter durchgereicht', m.source === 'hard_workout' && m.confidence === 'moderate' && m.ageDays === 12);
  ok('B4 ohne running ⇒ ok:false mit Grund', F.gmPaceZonesModel(null).ok === false && F.gmPaceZonesModel({ running: { ok: false, reason: 'no_reference' } }).reason === 'no_reference');
  ok('B5 fehlende Einzelzone wird weggelassen, nicht erfunden', F.gmPaceZonesModel({ running: { ok: true, zones: { easy: zones.easy } } }).rows.length === 1);
}

sec('C · Pace-Zonen-HTML');
{
  const perf = { running: { ok: true, zones: { recovery: { loSecPerKm: 400, hiSecPerKm: 438 }, easy: { loSecPerKm: 376, hiSecPerKm: 408 }, half: { loSecPerKm: 310, hiSecPerKm: 324 }, threshold: { loSecPerKm: 292, hiSecPerKm: 316 }, vo2: { loSecPerKm: 265, hiSecPerKm: 277 } }, confidence: 'strong', ageDays: 3, reference: { source: 'race' } } };
  const h = F.gmPaceZonesSection(perf);
  ok('C1 Sektion mit Slot, 5 Zeilen, Quelle „aus Wettkampf"', /data-gm-slot="plan-pace-zones"/.test(h) && (h.match(/class="pz-row"/g) || []).length === 5 && /aus Wettkampf/.test(h));
  ok('C2 Alter der Referenz sichtbar', /vor 3 Tagen/.test(h));
  const e = F.gmPaceZonesSection({ running: { ok: false, reason: 'no_reference' } });
  ok('C3 Leerzustand: keine Zeilen, Grund genannt, Sektion bleibt (Struktur schrumpft nie)', /data-gm-slot="plan-pace-zones"/.test(e) && !/pz-row/.test(e) && /keine belastbare Referenz/i.test(e) && /Wunsch, keine Messung/.test(e));
  ok('C4 kein roher i18n-Key im Markup', !/ui\.[a-z_]+/.test(h.replace(/data-gm-slot="[^"]*"/g, '')) && !/ui\.[a-z_]+/.test(e.replace(/data-gm-slot="[^"]*"/g, '')));
  const src = ui.slice(ui.indexOf('function renderGMPlan(){'), ui.indexOf('function gmPlannedStartSelection('));
  ok('C5 Plan-Tab rechnet KEINE Zonen aus der Zielzeit (Calc.paceZones nicht im Renderer)', !/Calc\.paceZones/.test(src) && /gmPaceZonesSection\(_perfBySport\)/.test(src));
}

sec('D · Kopfzeile');
{
  g.daysToSafe = () => 61; g.goalOf = () => ({ type: 'half_marathon' }); g.raceLabel = () => 'Halbmarathon';
  ok('D1 „· Halbmarathon in 61 Tagen"', F.gmPlanRaceCountdown() === ' · Halbmarathon in 61 Tagen', JSON.stringify(F.gmPlanRaceCountdown()));
  g.daysToSafe = () => 1;
  ok('D2 Singular', F.gmPlanRaceCountdown() === ' · Halbmarathon in 1 Tag');
  g.daysToSafe = () => null;
  ok('D3 ohne Zieldatum ⇒ leer', F.gmPlanRaceCountdown() === '');
  g.daysToSafe = () => -3;
  ok('D4 Wettkampf vorbei ⇒ leer (kein „in −3 Tagen")', F.gmPlanRaceCountdown() === '');
  g.daysToSafe = () => 10; g.raceLabel = () => null;
  ok('D5 ohne Ziel-Label ⇒ leer', F.gmPlanRaceCountdown() === '');
}

console.log('\n' + (fail ? '❌' : '✅') + ' ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

/* ============================================================
   ORVIA · debrief_v14_s5a — Debrief als Zustand (Prototyp v14 scrDebrief)
   ------------------------------------------------------------
     A. gmDebriefVerdict: sieben Zustaende aus Record + Kontext, nichts erfunden
     B. gmDebriefModel: Soll/Ist-Zeilen + Mitnahmen nur aus Record-Feldern
     C. gmDebriefCardHTML: Markup, leere Teile entfallen, Plan-CTA nur bei pending
     D. gmDbRecordFor: Treffer ueber sessionId/id (po:), Legacy ueber Schluessel
     E. Verdrahtung: Aktivitaetsseite + Plan-Karte (Debrief-Tag), Katalog, CSS
   node supabase/tests/debrief_v14_s5a_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _ex } from 'node:fs';
import { tStub } from './_i18n-src.mjs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const ui = rd('js/ui.js'); const de = rd('locales/de.js'); const css = rd('styles.css');
const fn = name => { const m = ui.match(new RegExp('\\n(function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\})\\n')); if (!m) throw new Error('fn ' + name); return m[1]; };
const g = globalThis; g.window = g; g.ORVIA = {};
g._uiT = tStub().t;
g.icon = (n) => '<svg data-i="' + n + '"></svg>';
g.gmEsc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
g.fmtDe = v => String(v).replace('.', ',');
g.PROFILE = { performance: { debriefs: [] } };
(0, eval)(ui.match(/var GM_DB_REASONS=\[[\s\S]*?\n\];/)[0] + '\n' + ['gmDbKey', 'gmDbStore', 'gmDbFind', 'gmDbRecordFor', 'gmDbReasonLabel', 'gmDbFmtPace', 'gmDbFmtDelta', 'gmAdpTime', 'gmDebriefVerdict', 'gmDebriefModel', 'gmDebriefCardHTML'].map(fn).join('\n') +
  '\nglobalThis.gmDebriefVerdict=gmDebriefVerdict;globalThis.gmDebriefModel=gmDebriefModel;globalThis.gmDebriefCardHTML=gmDebriefCardHTML;globalThis.gmDbRecordFor=gmDbRecordFor;');
const full = { id: 'db:2026-09-22:psg:1:0:tempo', sessionId: 'po:2026-09-22:psg:1:0:tempo', judged: true, adherence: 'im Ziel', completed: true, completionPct: 1.02, zoneHit: 1, deltaPace: 0, rpe: 7, expectedRpe: 7, deltaRpe: 0, expectedRpeEvidence: 'moderate', note: 'geplant 4:30–4:45/km · gelaufen 4:41/km — im Ziel', debriefedAt: '2026-09-22T18:42:00', snapshot: { plannedDurationMin: 52, plannedDistanceKm: null, targetLoSecPerKm: 270, targetHiSecPerKm: 285 } };
const slow = Object.assign({}, full, { adherence: 'zu langsam', zoneHit: 0.7, deltaPace: 18, rpe: 9, deltaRpe: 2, reason: 'fatigue' });
const abort = Object.assign({}, full, { adherence: 'abgebrochen', completed: false, completionPct: 0.45, zoneHit: null, reason: 'pain', pain: true });
const noref = { judged: true, adherence: 'nicht vergleichbar', zoneHit: null, completionPct: 0.98, note: 'Ohne belastbare Zonen wird die Einheit beschrieben, nicht bewertet.', snapshot: { plannedDurationMin: 45 }, rpe: 6, expectedRpe: 5, deltaRpe: 1 };
const actual = { distanceKm: 9.8, durationMin: 54, paceSecPerKm: 281 };

sec('A · Zustaende');
{
  ok('A1 im Ziel + completed ⇒ full „Zählt voll"', g.gmDebriefVerdict(full, { planLink: 'po:x' }).state === 'full' && g.gmDebriefVerdict(full, {}).title === 'Zählt voll');
  ok('A2 zu langsam ⇒ part, Grund im Text', g.gmDebriefVerdict(slow, {}).state === 'part' && /Müde/.test(g.gmDebriefVerdict(slow, {}).text));
  ok('A3 abgebrochen ⇒ aborted mit % und Grund', g.gmDebriefVerdict(abort, {}).state === 'aborted' && /45 %/.test(g.gmDebriefVerdict(abort, {}).text) && /Beschwerden/.test(g.gmDebriefVerdict(abort, {}).text));
  ok('A4 nicht vergleichbar (judged) ⇒ noref mit Engine-Notiz', g.gmDebriefVerdict(noref, {}).state === 'noref' && /belastbare Zonen/.test(g.gmDebriefVerdict(noref, {}).text));
  ok('A5 ohne Plan-Link und ohne Record ⇒ free', g.gmDebriefVerdict(null, {}).state === 'free');
  ok('A6 Plan-Link ohne Record ⇒ pending', g.gmDebriefVerdict(null, { planLink: 'po:x' }).state === 'pending');
  ok('A7 Kraft ⇒ gym, unabhaengig vom Record', g.gmDebriefVerdict(full, { fam: 'gym' }).state === 'gym');
  ok('A8 im Ziel aber completed=false ⇒ part (nicht voll)', g.gmDebriefVerdict(Object.assign({}, full, { completed: false }), {}).state === 'part');
  ok('A9 unjudged Record ohne Link ⇒ free; mit Link ⇒ noref', g.gmDebriefVerdict({ judged: false, adherence: 'nicht vergleichbar' }, {}).state === 'free' && g.gmDebriefVerdict({ judged: false, adherence: 'nicht vergleichbar', note: 'n' }, { planLink: 'po:x' }).state === 'noref');
}

sec('B · Modell');
{
  const m = g.gmDebriefModel(full, actual, { planLink: 'po:x' });
  ok('B1 Zeilen Dauer/Pace/RPE (keine Distanz ohne Soll UND Ist? Ist vorhanden ⇒ Zeile mit Soll —)', m.rows.map(r => r.l).join() === 'Dauer,Distanz,Pace,Anstrengung (RPE)');
  ok('B2 Dauer 52 → 54 min, +2 min, ok', m.rows[0].soll === '52 min' && m.rows[0].ist === '54 min' && m.rows[0].extra === '+2 min' && m.rows[0].ok === true);
  ok('B3 Pace 4:30–4:45 /km → 4:41 /km, Delta +0 s, ok', m.rows[2].soll === '4:30–4:45 /km' && m.rows[2].ist === '4:41 /km' && m.rows[2].ok === true);
  ok('B4 RPE 7 → 7, ok', m.rows[3].soll === '7' && m.rows[3].ist === '7' && m.rows[3].ok === true);
  ok('B5 Mitnahmen: beibehalten (Band) + Auswirkung „Keine", kein Naechstes-Mal', m.take.length === 2 && /Vorgabeband/.test(m.take[0][1]) && /^Keine\./.test(m.take[1][1]));
  const s = g.gmDebriefModel(slow, actual, {});
  ok('B6 zu langsam: Naechstes Mal mit 18 s/km, Auswirkung Ueberlast (ΔRPE 2), RPE-Zeile warn', s.take.some(t => /18 s\/km langsamer/.test(t[1])) && s.take.some(t => /≥ 2 über Erwartung/.test(t[1])) && s.rows[3].ok === false);
  const a = g.gmDebriefModel(abort, actual, {});
  ok('B7 abgebrochen mit Schmerz: Grund + Beschwerde-Auswirkung', a.take.some(t => /Grund festgehalten: Beschwerden/.test(t[1])) && a.take.some(t => /Beschwerde protokolliert/.test(t[1])));
  const n = g.gmDebriefModel(noref, actual, {});
  ok('B8 noref: keine Pace-Zeile (kein Band), Dauer/Distanz/RPE bleiben, Distanz Soll „—"', !n.rows.some(r => r.l === 'Pace') && n.rows.some(r => r.l === 'Distanz' && r.soll === '—' && r.ok === null));
  ok('B9 ohne Record: keine Zeilen, keine Mitnahmen, keine Quelle', g.gmDebriefModel(null, actual, {}).rows.length === 0 && g.gmDebriefModel(null, actual, {}).take.length === 0 && g.gmDebriefModel(null, actual, {}).source === '');
  ok('B10 Quelle nennt Rueckmeldezeit', /18:42 Uhr/.test(m.source));
  ok('B11 Ist ohne Werte ⇒ „—", kein Throw', g.gmDebriefModel(full, {}, {}).rows[0].ist === '—');
}

sec('C · Markup');
{
  const h = g.gmDebriefCardHTML(g.gmDebriefModel(full, actual, { planLink: 'po:x' }), { planCta: true });
  ok('C1 Karte: Titel, Soll/Ist-Badge ready, Verdict full, 4 Zeilen, 2 Mitnahmen, Quelle', /db-card/.test(h) && /pill-badge ready/.test(h) && /db-verdict full/.test(h) && (h.match(/class="db-row"/g) || []).length === 4 && (h.match(/class="tk"/g) || []).length === 2 && /class="source"/.test(h));
  ok('C2 Status-Icons: check bei ok, alert bei warn, nichts bei null', /st ok"><svg data-i="check"/.test(h) && /st off"><svg data-i="alert"/.test(g.gmDebriefCardHTML(g.gmDebriefModel(slow, actual, {}), {})) && /class="st "><\/span>/.test(g.gmDebriefCardHTML(g.gmDebriefModel(noref, actual, {}), {})));
  const p = g.gmDebriefCardHTML(g.gmDebriefModel(null, actual, { planLink: 'po:x' }), { planCta: true });
  ok('C3 pending: kein Badge, keine Zeilen, Plan-CTA', !/pill-badge/.test(p) && !/db-row/.test(p) && /showTab\('plan'\)/.test(p) && /Rückmeldung fehlt/.test(p));
  const f = g.gmDebriefCardHTML(g.gmDebriefModel(null, actual, {}), { planCta: true, freeText: 'Locker gelaufen.' });
  ok('C4 free: Einordnungstext, kein Plan-CTA', /Locker gelaufen\./.test(f) && !/showTab/.test(f));
  ok('C5 gym: eigener Zustand ohne Zeilen', /Krafteinheit/.test(g.gmDebriefCardHTML(g.gmDebriefModel(full, actual, { fam: 'gym' }), {})) );
}

sec('D · Record-Suche');
{
  g.PROFILE.performance.debriefs = [full, { key: '2026-09-20|Laufen|Locker', judged: true, adherence: 'im Ziel' }];
  g.ORVIA.debriefRecord = { occurrenceIdOf: (d, u) => u && u.id ? 'po:' + d + ':' + u.id : 'occ:' + d + '|' + u.t + '|' + u.l, occurrenceBasisOf: u => u && u.id ? 'template_id' : 'label_fallback' };
  ok('D1 Treffer ueber planLink (sessionId)', g.gmDbRecordFor('po:2026-09-22:psg:1:0:tempo') === full);
  ok('D2 Treffer ueber id-Form ohne po:', g.gmDbRecordFor('po:2026-09-22:psg:1:0:tempo', null, null) === full && g.gmDbRecordFor('occ:2026-09-22:psg:1:0:tempo') === full);
  ok('D3 Legacy ueber Datum+Einheit (Schluessel)', g.gmDbRecordFor(null, '2026-09-20', { t: 'Laufen', l: 'Locker' }).adherence === 'im Ziel');
  ok('D4 nichts ⇒ null, ohne Throw', g.gmDbRecordFor('po:nope') === null && g.gmDbRecordFor(null, null, null) === null);
}

sec('E · Verdrahtung');
{
  const act = ui.slice(ui.indexOf('function gmOpenActivityPage(aid){'), ui.indexOf('function gmOpenActivityPage(aid){') + 40000);
  ok('E1 Aktivitaetsseite: Debrief-Karte aus gmDebriefModel (planLink, Ist aus summary/duration)', /gmDbRecordFor\(vm\.planLink\|\|null,vm\.date\|\|null,null\)/.test(act) && /gmDebriefCardHTML\(_dbM,\{planCta:true,freeText:rate\?rate\.txt:null\}\)/.test(act) && /a\.summary\.distanceKm/.test(act));
  ok('E2 alte coach-card nur noch als Fehler-Rueckfall', (act.match(/class="coach-card"/g) || []).length === 1 && /catch\(_dbE\)/.test(act));
  const plan = ui.slice(ui.indexOf('function renderGMPlan(){'), ui.indexOf('function renderGMPlan(){') + 30000);
  ok('E3 Plan-Karte: Debrief-Tag nur bei done + judged Record derselben Occurrence', /if\(done\)\{var _dbr=gmDbRecordFor\(occ,k,it\);if\(_dbr&&_dbr\.judged\)/.test(plan) && /class="db-tag '\+_dbv\.cls/.test(plan));
  ok('E4 Katalog: alle dbv-Keys vorhanden', ['ui.dbv_full_t', 'ui.dbv_part_t', 'ui.dbv_aborted_t', 'ui.dbv_free_t', 'ui.dbv_noref_t', 'ui.dbv_gym_t', 'ui.dbv_pending_t', 'ui.dbv_prefix', 'ui.dbv_source', 'ui.dbv_impact_none'].every(k => de.indexOf("'" + k + "'") >= 0));
  ok('E5 CSS: .db-card Verdict/Zeilen/Mitnahmen + .session-card .db-tag', /\.db-card \.db-verdict\.full \.v-ic/.test(css) && /\.db-card \.db-row\{display:grid/.test(css) && /\.db-card \.db-take \.tk\{/.test(css) && /\.session-card \.db-tag\.full/.test(css));
}

console.log('\n' + (fail ? '❌' : '✅') + ' debrief_v14_s5a: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

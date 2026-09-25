/* ============================================================
   ORVIA · review_v14_s5b — Rueckblick Woche (js/review-v14.js)
   ------------------------------------------------------------
     A. weekRaw: Planerfuellung aus Plan+Resolver, Aktivitaeten, Erholung
     B. model: Kennzahlen, laengste Einheit, Belastung nur laufende Woche, Vergleich
     C. html: Karten, Leerzustand, keine erfundenen Werte
     D. Verdrahtung: Sheet-Umschalter, index/sw, Katalog, CSS
   node supabase/tests/review_v14_s5b_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _ex } from 'node:fs';
import { tStub } from './_i18n-src.mjs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const g = globalThis; g.window = g; g.ORVIA = { i18n: tStub() };
g.icon = n => '<svg data-i="' + n + '"></svg>';
g.fmtDe = v => String(v).replace('.', ',');
g.todayStr = d => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000) : new Date('2026-09-24T12:00:00Z')).toISOString().slice(0, 10);   /* Do 24.09. */
/* Plan: Mo Lauf(key), Di frei, Mi Gym, Do Tempo(key), Fr frei, Sa Long(key), So frei */
const plan = [[{ id: 'a', t: 'Laufen', l: 'Locker', key: 1 }], [], [{ id: 'b', t: 'Gym', l: 'Beine' }], [{ id: 'c', t: 'Laufen', l: 'Tempo', key: 1 }], [], [{ id: 'd', t: 'Laufen', l: 'Long', key: 1 }], []];
g.gmPlanForOffset = off => ({ days: off === 0 ? plan : [[{ id: 'p', t: 'Laufen', l: 'Locker' }], [], [], [], [], [], []], provenance: off === 0 ? 'current' : 'stored' });
g.activeWeekPlan = () => plan;
g.gmPlanIsKeyUnit = it => !!it.key;
g.planActualResolveForDates = dates => ({ byOcc: { ['po:' + dates[0] + ':a']: { state: 'completed' }, ['po:' + dates[3] + ':c']: { state: 'completed' } } });
const acts = [
  { id: 'x1', sportId: 'running', startedAt: '2026-09-21T07:00:00Z', durationSeconds: 2400, summary: { distanceKm: 7.2, elevationM: 40, name: 'Locker' } },
  { id: 'x2', sportId: 'running', startedAt: '2026-09-24T17:00:00Z', durationSeconds: 3240, summary: { distanceKm: 9.8, elevationM: 42, name: 'Tempolauf' } },
  { id: 'x3', sportId: 'running', startedAt: '2026-09-15T07:00:00Z', durationSeconds: 1800, summary: { distanceKm: 5, elevationM: 10 } }
];
g.ORVIA.activityStore = { listActivities: () => acts, isTombstoned: () => false };
g.ORVIA.activityConfig = {
  dayOfActLocal: a => a.startedAt.slice(0, 10),
  sportLabel: id => ({ running: 'Laufen', gym: 'Krafttraining' })[id] || id,
  weeklyActivityTotals: (as, DB, o) => {
    const d0 = o.weekRef; const wk = as.filter(a => a.startedAt.slice(0, 10) >= d0 && a.startedAt.slice(0, 10) <= d0.slice(0, 8) + String(Number(d0.slice(8)) + 6).padStart(2, '0'));
    const km = wk.reduce((s, a) => s + a.summary.distanceKm, 0), min = wk.reduce((s, a) => s + a.durationSeconds / 60, 0);
    return { totals: { sessionCount: wk.length, durationMin: min, knownDurationMin: min, completeness: { duration: true, distance: true } }, bySport: { running: { sessionCount: wk.length, distanceKm: km, knownDistanceKm: km, completeness: { distance: true } } } };
  }
};
g.DB = { '2026-09-21': { morning: { knee: 0, sleepMin: 450, hrvMs: 52 } }, '2026-09-22': { morning: { knee: 0, sleepMin: 420 } }, '2026-09-24': { morning: { knee: 0, sleepMin: 480, hrvMs: 50 } }, '2026-09-15': { morning: { knee: 0, sleepMin: 400 } } };
g.readinessOf = k => ({ '2026-09-21': 80, '2026-09-22': 76, '2026-09-24': 84, '2026-09-15': 70 })[k] ?? null;
g.allLoads = () => ({ loads: [], confidence: 'ok' });
g.Calc = { loadModel: () => ({ acwr: 1.08, acwrReliable: true }), loadConfidenceContract: () => ({ suppressNumbers: false }) };
g.gmPlanQualityEval = () => ({ score: 71, subscores: { goalCoverage: { limiting: ['no_long_run'] } } });
g.gmGoalBottleneckText = pq => pq && pq.subscores.goalCoverage.limiting.length ? 'Kein langer Lauf in der Woche' : null;
(0, eval)(rd('js/review-v14.js'));
const RV = g.ORVIA.reviewV14;

sec('A · Rohdaten');
{
  const w = RV.weekRaw(0);
  ok('A1 Woche Mo–So um den 24.09. (Do)', w.from === '2026-09-21' && w.to === '2026-09-27' && w.ongoing === true);
  ok('A2 geplant 4, faellig bis heute 3 (Mo, Mi, Do), erledigt 2 (Mo, Do)', w.planned === 4 && w.due === 3 && w.done === 2);
  ok('A3 Kernreize 3 geplant, 2 erledigt', w.keyPlanned === 3 && w.keyDone === 2);
  ok('A4 ausgefallen: Mi Beine (vergangen, nicht erledigt); heute (Do) zaehlt nicht als ausgefallen', w.missed.length === 1 && w.missed[0].label === 'Beine');
  ok('A5 Ruhetage: 3 geplant, bis heute eingehalten 1 (Di)', w.restPlanned === 3 && w.restKept === 1);
  ok('A6 Aktivitaeten der Woche: 2, hm 82, laengste 9,8 km', w.acts.length === 2 && w.elevationM === 82 && w.longest.km === 9.8 && w.longest.id === 'x2');
  ok('A7 Erholung: 3 Readiness-Werte, 3 Schlaf, 2 HRV', w.readiness.length === 3 && w.sleepH.length === 3 && w.hrv.length === 2);
}

sec('B · Modell');
{
  const m = RV.model(0);
  ok('B1 Planerfuellung 2/3 = 67 %', m.fulfil.done === 2 && m.fulfil.due === 3 && m.fulfil.pct === 67);
  ok('B2 KPIs: 17 km vollstaendig, 1:34 h, 82 hm', m.kpi.km === 17 && m.kpi.kmComplete && Math.round(m.kpi.hours) === 94 && m.kpi.elevationM === 82);
  ok('B3 Belastung nur laufende Woche: ACWR 1,08 ok, Band', m.load && m.load.acwr === 1.08 && m.load.zone === 'ok' && m.load.band > 40 && RV.model(-1).load === null);
  ok('B4 Stellschraube aus Planqualitaet', m.lever && /Kein langer Lauf/.test(m.lever.text) && m.lever.score === 71);
  ok('B5 Erholung: Ø Readiness 80, Vorwoche 70 (+10), Schlaf 7,5 h, HRV 51', m.recovery.readiness === 80 && m.recovery.readinessPrev === 70 && Math.abs(m.recovery.sleepH - 7.5) < 0.01 && m.recovery.hrv === 51);
  ok('B6 Vergleich: km 5 → 17, Einheiten 1 → 2, Krafteinheiten 0 → 0', m.compare.find(r => r.key === 'km').from === '5 km' && m.compare.find(r => r.key === 'km').to === '17 km' && m.compare.find(r => r.key === 'km').pct === 240 && m.compare.find(r => r.key === 'sessions').delta === 1);
  ok('B7 Vorwoche (abgeschlossen): due = planned, nicht laufend', RV.model(-1).ongoing === false && RV.model(-1).fulfil.due === 1);
  ok('B8 kein Plan ⇒ fulfil null, KPIs bleiben', (() => { const s = g.gmPlanForOffset; g.gmPlanForOffset = () => null; const r = RV.model(0); g.gmPlanForOffset = s; return r.fulfil === null && r.planAvailable === false && r.kpi.km === 17; })());
  ok('B9 leere Woche ⇒ empty', (() => { const s = [g.gmPlanForOffset, g.ORVIA.activityStore.listActivities, g.DB]; g.gmPlanForOffset = () => null; g.ORVIA.activityStore.listActivities = () => []; g.DB = {}; const r = RV.model(0); g.gmPlanForOffset = s[0]; g.ORVIA.activityStore.listActivities = s[1]; g.DB = s[2]; return r.empty === true; })());
}

sec('C · Markup');
{
  const h = RV.html(RV.model(0));
  ok('C1 Planerfuellung: Ring 2/3, KPIs, Kernreiz-Zeile, Ausgefallen-Hinweis mit Beine', /rev-ring/.test(h) && /<b>2\/3<\/b>/.test(h) && /Kernreize: 2 von 3/.test(h) && /1 Einheit ausgefallen:.*<b>Beine<\/b>/.test(h));
  ok('C2 laengste Einheit tippbar (x2), Pace 5:31 /km', /gmOpenActivityPage\('x2'\)/.test(h) && /Tempolauf · 9,8 km/.test(h) && /5:31 \/km/.test(h));
  ok('C3 Belastung: ACWR 1,08 gruen, Marker', /ACWR <b>1,08<\/b>/.test(h) && /grünen Korridor/.test(h) && /class="mk" style="left:\d+%"/.test(h));
  ok('C4 Stellschraube-Karte + Erholung + Vergleich', /Die eine Stellschraube/.test(h) && /Ø Readiness/.test(h) && /80 · \+10 vs\. Vorwoche/.test(h) && /Vergleich zur Vorwoche/.test(h) && /5 km → 17 km/.test(h));
  const e = RV.html({ empty: true });
  ok('C5 Leerzustand ohne Ring/Zahlen', /Noch nichts zu bilanzieren/.test(e) && !/rev-ring/.test(e));
  ok('C6 keine Zahl „0" fuer fehlende hm/Stunden (—)', (() => { const m = RV.model(0); m.kpi.elevationM = null; m.kpi.hours = null; const x = RV.html(m); return /<b>—<\/b><span>hm<\/span>/.test(x) && /<b>—<\/b><span>Stunden<\/span>/.test(x); })());
}

sec('D · Verdrahtung');
{
  const ui = rd('js/ui.js'), idx = rd('index.html'), sw = rd('sw.js'), css = rd('styles.css'), de = rd('locales/de.js');
  const sheet = ui.slice(ui.indexOf('function gmOpenWeekReviewSheet(){'), ui.indexOf('function gmOpenWeekReviewSheet(){') + 2500);
  ok('D1 Sheet: Umschalter Diese Woche/Vorwoche + RV.html(RV.model(_gmRevOff)), Legacy als Rueckfall', /gmReviewSetOff\(0\)/.test(sheet) && /gmReviewSetOff\(-1\)/.test(sheet) && /RV\.html\(RV\.model\(_gmRevOff\)\)/.test(sheet) && /weeklyReviewHTML\(\)/.test(sheet));
  ok('D2 index.html laedt review-v14.js, sw precached', /js\/review-v14\.js/.test(idx) && /'\.\/js\/review-v14\.js'/.test(sw));
  ok('D3 Katalog rev.* inkl. Plural ausgefallen', ['rev.planerfuellung', 'rev.ausgefallen.one', 'rev.ausgefallen.other', 'rev.acwr_ok', 'rev.stellschraube', 'rev.vergleich', 'rev.diese_woche', 'rev.vorwoche', 'rev.empty_t'].every(k => de.indexOf("'" + k + "'") >= 0));
  ok('D4 CSS: rev-hero/ring/kpis/band/reco/seg + eff-row', ['.rev-hero{', '.rev-ring{', '.rev-kpis{', '.rev-band{', '.rev-reco{', '.rev-seg{', '.eff-row{'].every(c => css.indexOf(c) >= 0));
}

sec('E · Monat (S5d)');
{
  const mm = RV.monthModel({ sport: 'running' });
  ok('E1 12 Wochen, letzte = laufende Woche', mm.weeks.length === 12 && mm.weeks[11].ongoing === true && mm.weeks[11].from === '2026-09-21');
  ok('E2 Wochenwerte: diese Woche 17 km / 2 Einheiten, Vorwoche 5 km', mm.weeks[11].km === 17 && mm.weeks[11].sessions === 2 && mm.weeks[10].km === 5);
  ok('E3 Serie: Vorwoche (1 geplant, 0 erledigt) nicht erfuellt ⇒ 0; laufende Woche zaehlt nicht', mm.streak === 0 && mm.weeks[10].fulfilled === false && mm.weeks[11].fulfilled === false);
  ok('E4 Kalender September 2026: 30 Tage, Mo-Vorlauf 1, Aktivitaetstage 15/21/24, heute 24', mm.month.cells.filter(Boolean).length === 30 && mm.month.cells[0] === null && mm.month.cells[1].day === 1 && mm.month.cells.filter(c => c && c.sports.length).map(c => c.day).join() === '15,21,24' && mm.month.cells.find(c => c && c.today).day === 24);
  ok('E5 Einheiten im Monat = 3', mm.month.sessions === 3);
  ok('E6 zu wenige Wochen (nur 1 abgeschlossene mit Daten) ⇒ enough=false', mm.weeksWithData === 1 && mm.enough === false);
  const h = RV.monthHtml(mm);
  ok('E7 Markup: Serie-Karte, Sportfilter, Leerhinweis statt Balken, Kalender mit 30 Tagen + heute', /rev-serie/.test(h) && /gmReviewSetSport\('gym'\)/.test(h) && /Ein Monat braucht Wochen/.test(h) && !/rev-bars/.test(h) && (h.match(/class="rev-day(?! out)/g) || []).length === 30 && /rev-day act today/.test(h));
  /* genug Wochen: Balken erscheinen, erfuellte Woche gruen */
  g.planActualResolveForDates = dates => { const o = {}; o['po:' + dates[0] + ':p'] = { state: 'completed' }; o['po:' + dates[0] + ':a'] = { state: 'completed' }; o['po:' + dates[3] + ':c'] = { state: 'completed' }; return { byOcc: o }; };
  acts.push({ id: 'x4', sportId: 'running', startedAt: '2026-09-08T07:00:00Z', durationSeconds: 1800, summary: { distanceKm: 6 } });
  const m2 = RV.monthModel({ sport: 'running' });
  ok('E8 Vorwochen erfuellt (1/1) ⇒ Serie 11 (alle abgeschlossenen Wochen mit gespeichertem Plan)', m2.streak === 11 && m2.weeks[10].fulfilled === true);
  const h2 = RV.monthHtml(m2);
  ok('E9 Balken: 12, laufende Woche markiert, erfuellte gruen', (h2.match(/class="rev-bar[ "]/g) || []).length === 12 && /rev-bar now/.test(h2) && /rev-bar ok/.test(h2));
  ok('E10 Sheet: Monat-Umschalter + monthHtml(monthModel({sport}))', /gmReviewSetOff\(\\'m\\'\)/.test(rd('js/ui.js')) && /RV\.monthHtml\(RV\.monthModel\(\{sport:_gmRevSport\}\)\)/.test(rd('js/ui.js')));
  ok('E11 Katalog + CSS Monat', ['rev.monat', 'rev.serie.one', 'rev.serie.other', 'rev.monat_leer_t', 'rev.balken_km'].every(k => rd('locales/de.js').indexOf("'" + k + "'") >= 0) && /\.rev-bars\{/.test(rd('styles.css')) && /\.rev-cal\{/.test(rd('styles.css')));
}

console.log('\n' + (fail ? '❌' : '✅') + ' review_v14_s5b: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);

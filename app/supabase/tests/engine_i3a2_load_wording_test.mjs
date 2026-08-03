/* ============================================================
   ORVIA · Engine 3c · I3a.2 — Last-Anzeige-/Semantikvertrag (Mikrofix)
   Korrigiert eine fachlich falsche Aussage aus I3a.1: CTL aus measured+estimated
   ist KEINE "Untergrenze" (eine Schaetzung kann ueber oder unter der wahren Last
   liegen). Eine echte Untergrenze ("bekannte Teilsumme") besteht ausschliesslich
   aus measuredLoad. Dieser Test prueft NUR den Anzeige-/Semantikvertrag (Calc.
   loadConfidenceContract + die measured-only Untergrenze ueber die BESTEHENDE
   EWMA-Formel). Das Safety-Gate aus I3a.1 (buildTrainingDecision) ist NICHT
   Gegenstand dieses Tests und bleibt unveraendert.
   node supabase/tests/engine_i3a2_load_wording_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const base = new URL('../../js/', import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, info) => { console.log((c ? '✅' : '❌') + ' ' + n + (info != null ? '  — ' + info : '')); c ? pass++ : fail++; };

globalThis.window = globalThis;
globalThis.ORVIA = { user: { id: 'u1' } };
await import(new URL('training-domain.js', base));
await import(new URL('activity-normalize.js', base));
await import(new URL('activity-config.js', base));
const cfg = globalThis.ORVIA.activityConfig;
(0, eval)(readFileSync(new URL('calc.js', base), 'utf8'));
const Calc = globalThis.Calc;

const TZ = 'Europe/Vienna';
const gAct = (day, o) => Object.assign({ clientRecordId: 'g:' + day + ':' + (o && o.tag || 'x'), source: 'garmin', sourceRecordId: 's:' + day + ':' + (o && o.tag || 'x'), sportId: 'running', status: 'completed', startedAt: day + 'T10:00:00.000Z' }, o || {});
const S = (sessions, opts) => cfg.dailyLoadSeries((opts && opts.acts) || [], sessions || {}, Object.assign({ days: 42, endDay: '2026-07-18', timezone: TZ }, opts || {}));
const shiftDay = (endISO, back) => { const d = new Date(endISO + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - back); return d.toISOString().slice(0, 10); };

/* ================= 0) Statischer Wortlaut-Schutz: die falsche Aussage darf nicht mehr vorkommen ================= */
{
  const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');
  ok('[0-1] ui.js enthaelt NICHT mehr die falsche Aussage "CTL als Untergrenze"', uiSrc.indexOf('CTL als Untergrenze') === -1);
  ok('[0-2] renderACWRCard verwendet den Anzeigevertrag Calc.loadConfidenceContract', uiSrc.indexOf('loadConfidenceContract') !== -1);
  const calcSrc = readFileSync(new URL('calc.js', base), 'utf8');
  ok('[0-3] calc.js exportiert loadConfidenceContract im Calc-Objekt', /loadConfidenceContract/.test(calcSrc) && typeof Calc.loadConfidenceContract === 'function');
}

/* ================= A) Calc.loadConfidenceContract — reiner Anzeigevertrag je Confidence-Stufe ================= */
{
  const hi = Calc.loadConfidenceContract('hoch');
  ok('[A1-1] hoch: keine Einschraenkung (suppressNumbers=false, keine Notizen)', hi.suppressNumbers === false && hi.ctlAtlNote == null && hi.acwrTsbNote == null, JSON.stringify(hi));

  const red = Calc.loadConfidenceContract('reduziert');
  ok('[A2-1] reduziert: CTL/ATL als geschaetzt/Schaetzwert gekennzeichnet, NICHT als Untergrenze behauptet', /geschätzt|Schätzwert/.test(red.ctlAtlNote) && red.ctlAtlNote.indexOf('CTL als Untergrenze') === -1, red.ctlAtlNote);
  ok('[A2-2] reduziert: Text stellt explizit klar "keine Untergrenze"', /keine Untergrenze/.test(red.ctlAtlNote), red.ctlAtlNote);
  ok('[A2-3] reduziert: ACWR/TSB als "nicht exakt" gekennzeichnet', /nicht exakt/.test(red.acwrTsbNote), red.acwrTsbNote);
  ok('[A2-4] reduziert: Zahlen bleiben sichtbar (suppressNumbers=false)', red.suppressNumbers === false);

  const na = Calc.loadConfidenceContract('not_assessable');
  ok('[A3-1] not_assessable: CTL/ATL "nicht belastbar" (keine scheinpraezise Zahl)', /nicht belastbar/.test(na.ctlAtlNote), na.ctlAtlNote);
  ok('[A3-2] not_assessable: ACWR/TSB ebenfalls "nicht belastbar"', /nicht belastbar/.test(na.acwrTsbNote), na.acwrTsbNote);
  ok('[A3-3] not_assessable: Zahlen werden unterdrueckt (suppressNumbers=true)', na.suppressNumbers === true);

  const unk = Calc.loadConfidenceContract(null);
  ok('[A4-1] unbekannte/keine Confidence verhaelt sich wie "hoch" (rueckwaertskompatibel, kein stiller Block)', unk.suppressNumbers === false && unk.ctlAtlNote == null);
}

/* ================= B) Gegenprobe 1 — VOLLSTAENDIG GEMESSENE Serie ================= */
{
  const sess = {};
  for (let w = 0; w < 4; w++) for (let d = 0; d < 5; d++) { const day = shiftDay('2026-07-18', w * 7 + d); sess[day] = { sessions: { Gym: { dur: 60, rpe: 7 } } }; }
  const r = S(sess);
  ok('[B1-1] vollstaendig gemessen: confidence === "hoch"', r.confidence === 'hoch', 'conf=' + r.confidence);
  const cc = Calc.loadConfidenceContract(r.confidence);
  ok('[B1-2] Anzeigevertrag fuer "hoch": keine Einschraenkung, Zahlen normal', cc.suppressNumbers === false && cc.ctlAtlNote == null);
  const ctlCombined = Calc.loadSeries(r.loads).ctl; const ctlM = Calc.loadSeries(r.measuredLoads).ctl;
  ok('[B1-3] Gegenprobe: gemessen-only CTL === kombinierte CTL (keine Schaetzung vorhanden)', Math.abs(ctlCombined[ctlCombined.length - 1] - ctlM[ctlM.length - 1]) < 0.01, ctlCombined[ctlCombined.length - 1] + ' vs ' + ctlM[ctlM.length - 1]);
}

/* ================= C) Gegenprobe 2 — GEMESSEN + GESCHAETZT ================= */
{
  const sess = {}; const acts = [];
  for (let w = 0; w < 4; w++) {
    const measDay = shiftDay('2026-07-18', w * 7 + 0);
    sess[measDay] = { sessions: { Gym: { dur: 45, rpe: 6 } } };
    for (let d = 1; d <= 4; d++) { const day = shiftDay('2026-07-18', w * 7 + d); acts.push(gAct(day, { tag: 'w' + w + 'd' + d, durationSeconds: 3600, summary: {} })); }
  }
  const r = S(sess, { acts });
  ok('[C1-1] gemessen+geschaetzt: mindestens ein Tag mit estimatedLoad>0 und einer mit measuredLoad>0', r.completeness.estimatedLoad > 0 && r.completeness.measuredLoad > 0, JSON.stringify(r.completeness));
  ok('[C1-2] confidence !== "hoch" (Last teils geschaetzt)', r.confidence !== 'hoch', 'conf=' + r.confidence);
  ok('[C1-3] confidence === "reduziert" (nicht not_assessable — keine unbekannten Einheiten, nur Schaetzung)', r.confidence === 'reduziert', 'conf=' + r.confidence);
  const cc = Calc.loadConfidenceContract(r.confidence);
  ok('[C1-4] Anzeigevertrag "reduziert": geschaetzt/Schaetzwert, NICHT "CTL als Untergrenze"', /geschätzt|Schätzwert/.test(cc.ctlAtlNote) && cc.ctlAtlNote.indexOf('CTL als Untergrenze') === -1);
  const ctlCombined = Calc.loadSeries(r.loads).ctl; const ctlM = Calc.loadSeries(r.measuredLoads).ctl;
  const cLast = ctlCombined[ctlCombined.length - 1], mLast = ctlM[ctlM.length - 1];
  ok('[C1-5] echte Untergrenze (nur gemessen) <= modellierter Schaetzwert (kombiniert) — mathematisch garantiert', mLast <= cLast + 1e-9, 'measured=' + mLast + ' combined=' + cLast);
  ok('[C1-6] echte Untergrenze ist STRIKT kleiner als der Schaetzwert (Schaetzanteil traegt sichtbar bei)', mLast < cLast - 0.01, 'measured=' + mLast + ' combined=' + cLast);
}

/* ================= D) Gegenprobe 3 — GEMESSEN + UNBEKANNT (keine belastbare Schaetzung) ================= */
{
  const sess = {}; const acts = [];
  // Woche 3 (aelteste der juengsten 4): ein gemessener Tag -> nur 1 "bekannte" Woche von 4.
  const measDay = shiftDay('2026-07-18', 3 * 7 + 0);
  sess[measDay] = { sessions: { Gym: { dur: 50, rpe: 6 } } };
  // Wochen 0,1,2: ausschliesslich Aktivitaeten OHNE Dauer/RPE -> loadBasis 'unknown' (keine Last-Schaetzung moeglich).
  for (let w = 0; w < 3; w++) for (let d = 0; d < 3; d++) { const day = shiftDay('2026-07-18', w * 7 + d); acts.push(gAct(day, { tag: 'u' + w + 'd' + d })); }
  const r = S(sess, { acts });
  ok('[D1-1] gemessen+unbekannt: es gibt Tage mit unknownUnits>0', r.completeness.unknownDays > 0, 'unknownDays=' + r.completeness.unknownDays);
  ok('[D1-2] weniger als 2 bekannte Wochen in der juengsten Historie', r.completeness.knownWeeks < 2, 'knownWeeks=' + r.completeness.knownWeeks);
  ok('[D1-3] confidence === "not_assessable" (keine belastbare Schaetzung fuer die unbekannten Einheiten)', r.confidence === 'not_assessable', 'conf=' + r.confidence);
  const cc = Calc.loadConfidenceContract(r.confidence);
  ok('[D1-4] Anzeigevertrag "not_assessable": CTL/ATL "nicht belastbar", KEINE scheinpraezise Zahl', /nicht belastbar/.test(cc.ctlAtlNote) && cc.suppressNumbers === true, cc.ctlAtlNote);
  ok('[D1-5] Anzeigevertrag "not_assessable": ACWR/TSB ebenfalls "nicht belastbar"', /nicht belastbar/.test(cc.acwrTsbNote), cc.acwrTsbNote);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
console.log('I3a.2: ' + (fail === 0 ? 'GRÜN — CTL/ATL aus measured+estimated korrekt als Schätzwert (nicht Untergrenze) gekennzeichnet; echte Untergrenze ausschließlich aus measuredLoad; unbekannte Einheiten ohne Schätzung ⇒ nicht belastbar.' : 'ROT — ' + fail + ' offen (erwartet vor dem Fix).'));

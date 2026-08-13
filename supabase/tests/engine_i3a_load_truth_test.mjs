/* ============================================================
   ORVIA · Engine 3c · Schritt 0 · Inkrement I3 · Teil A — Lastwahrheit (Golden)
   Kanonische Tageslast-Serie als Grundlage für CTL/ATL/TSB, mit Provenienz
   (measured/estimated/unknown), Missingness und Confidence.
   Neuer Vertrag: ORVIA.activityConfig.dailyLoadSeries(activities, sessions, opts).
   Baut STRIKT auf dailyLoadUnits auf (keine neue Lastformel), reiht je lokalem
   Tag auf, trennt Herkunft, weist unbekannte Tage aus (nie 0=Ruhe), zählt
   bekannte Wochen und blockiert bei nicht endlicher/negativer Last.

   Pflicht-Gegenbeispiele (Teil A):
   C1 Garmin mit Dauer ohne RPE ⇒ Last geschätzt (nicht 0), Confidence reduziert.
   C2 echte bekannte Null-Last (Ruhetag) ⇒ 0, known.
   C3 Store- + Legacy-Spiegel derselben Einheit ⇒ genau einmal gezählt.
   C4 gemessene + geschätzte Last ⇒ Herkunft getrennt.
   C5 unbekannter Tag (Aktivität ohne quantifizierbare Last) ⇒ nicht als Ruhetag.
   C6 nicht endliche/negative Last ⇒ Auswertung blockiert (valid:false).
   C11 2–3 bekannte von 4 Wochen ⇒ reduzierte Confidence + sichtbare Completeness.
   C12 <2 bekannte Wochen ⇒ not_assessable.
   C13 Zeitzonengrenze ⇒ korrekter lokaler Tag.
   C14 Determinismus ⇒ identische Eingaben, identisches Ergebnis.
   node supabase/tests/engine_i3a_load_truth_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const base = new URL(_APPREL + 'js/', import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, info) => { console.log((c ? '✅' : '❌') + ' ' + n + (info != null ? '  — ' + info : '')); c ? pass++ : fail++; };

globalThis.window = globalThis;
globalThis.ORVIA = { user: { id: 'u1' } };
await import(new URL('training-domain.js', base));
await import(new URL('activity-normalize.js', base));
await import(new URL('activity-config.js', base));
const cfg = globalThis.ORVIA.activityConfig;
ok('[C0] dailyLoadSeries ist exportiert', typeof cfg.dailyLoadSeries === 'function');

const TZ = 'Europe/Vienna';
const gAct = (day, o) => Object.assign({ clientRecordId: 'g:' + day + ':' + (o && o.tag || 'x'), source: 'garmin', sourceRecordId: 's:' + day + ':' + (o && o.tag || 'x'), sportId: 'running', status: 'completed', startedAt: day + 'T10:00:00.000Z' }, o || {});
const S = (days, sessions, o) => cfg.dailyLoadSeries((o && o.acts) || [], sessions || {}, Object.assign({ days: days, endDay: '2026-07-18', timezone: TZ }, o || {}));
const dayOf = (res, day) => res.days.find(d => d.day === day);

/* ---------- C1: Garmin mit Dauer ohne RPE ⇒ geschätzt, nicht 0 ---------- */
{
  const r = S(7, {}, { acts: [gAct('2026-07-16', { durationSeconds: 3600, summary: {} })] });
  const d = dayOf(r, '2026-07-16');
  ok('[C1-1] Tag mit Garmin-Dauer-ohne-RPE: Last > 0 (geschätzt, nicht 0)', !!d && d.load > 0, 'load=' + (d && d.load));
  ok('[C1-2] Herkunft estimated (measuredLoad 0, estimatedLoad > 0)', !!d && d.measuredLoad === 0 && d.estimatedLoad > 0, JSON.stringify(d && { m: d.measuredLoad, e: d.estimatedLoad }));
  ok('[C1-3] Serie-Confidence ist NICHT "hoch" (geschätzte Last senkt Sicherheit)', r.confidence !== 'hoch', 'conf=' + r.confidence);
  ok('[C1-4] I3a.1: authoritativeLoad === null, knownForSafety === false (Schätzung ist keine gemessene Safety-Last)', !!d && d.authoritativeLoad === null && d.knownForSafety === false, JSON.stringify(d && { a: d.authoritativeLoad, k: d.knownForSafety }));
}

/* ---------- C2: echte bekannte Null-Last (Ruhetag) ---------- */
{
  const r = S(7, {}, { acts: [] });
  const d = dayOf(r, '2026-07-16');
  ok('[C2-1] Ruhetag ohne Aktivität: load 0, known true, basis rest', !!d && d.load === 0 && d.known === true && d.basis === 'rest', JSON.stringify(d && { l: d.load, k: d.known, b: d.basis }));
  ok('[C2-2] loads-Array enthält für den Ruhetag exakt 0', r.loads[r.days.indexOf(d)] === 0, 'ist=' + r.loads[r.days.indexOf(d)]);
}

/* ---------- C3: echter Store+Legacy-Spiegel (verlinkt über workoutSessionId) ⇒ einmal ----------
   Ein verlinkter Spiegel (Live-Workout in beiden Welten) ist eine Einheit; der kanonische
   Dedupe-Vertrag (dailyLoadUnits, L2/L3) zählt ihn genau einmal. Die Serie erbt das. */
{
  const storeRun = gAct('2026-07-16', { workoutSessionId: 'W1', durationSeconds: 3600, summary: { distanceKm: 10 } });
  const blobDay = { '2026-07-16': { sessions: { Laufen: { dur: 60, rpe: 6, source: 'live', workoutSessionId: 'W1', sportId: 'running' } } } };
  const dB = dayOf(S(7, blobDay, { acts: [] }), '2026-07-16');           // Blob allein: measured 360
  const dS = dayOf(S(7, {}, { acts: [storeRun] }), '2026-07-16');        // Store allein: geschätzt
  const dBoth = dayOf(S(7, blobDay, { acts: [storeRun] }), '2026-07-16'); // Spiegel: einmal
  ok('[C3-1] verlinkter Spiegel: Last NICHT verdoppelt (nicht Summe beider Quellen)', !!dBoth && dBoth.load > 0 && dBoth.load !== (dB.load + dS.load), 'both=' + (dBoth && dBoth.load) + ' blob=' + dB.load + ' store=' + dS.load);
  ok('[C3-2] genau einmal gezählt (kanonische Store-Aktivität gewinnt, Regel 1)', !!dBoth && dBoth.load === dS.load, 'both=' + (dBoth && dBoth.load) + ' store=' + dS.load);
}

/* ---------- C4: gemessene + geschätzte Last ⇒ getrennt ---------- */
{
  const r = S(7, { '2026-07-16': { sessions: { Gym: { dur: 60, rpe: 8 } } } }, { acts: [gAct('2026-07-16', { durationSeconds: 3000, summary: {} })] });
  const d = dayOf(r, '2026-07-16');
  ok('[C4-1] measuredLoad > 0 UND estimatedLoad > 0 (getrennt)', !!d && d.measuredLoad > 0 && d.estimatedLoad > 0, JSON.stringify(d && { m: d.measuredLoad, e: d.estimatedLoad }));
  ok('[C4-2] basis "mixed"', !!d && d.basis === 'mixed', 'basis=' + (d && d.basis));
  ok('[C4-3] Tages-load = measuredLoad + estimatedLoad', !!d && d.load === d.measuredLoad + d.estimatedLoad, 'load=' + (d && d.load));
}

/* ---------- C5: unbekannter Tag ⇒ nicht als Ruhetag ---------- */
{
  const r = S(7, {}, { acts: [gAct('2026-07-16', { durationSeconds: null, summary: {} })] });
  const d = dayOf(r, '2026-07-16');
  ok('[C5-1] Aktivität ohne quantifizierbare Last: active true, known false (nicht Ruhe)', !!d && d.active === true && d.known === false, JSON.stringify(d && { a: d.active, k: d.known, b: d.basis }));
  ok('[C5-2] basis "unknown", NICHT "rest"', !!d && d.basis === 'unknown', 'basis=' + (d && d.basis));
  ok('[C5-3] unterscheidbar vom echten Ruhetag (unknownDays > 0 in Completeness)', r.completeness.unknownDays > 0, 'unknownDays=' + r.completeness.unknownDays);
}

/* ---------- C6: nicht endliche/negative Last ⇒ blockiert ---------- */
{
  const rOk = S(7, { '2026-07-16': { sessions: { Gym: { dur: 60, rpe: 8 } } } }, { acts: [] });
  ok('[C6-1] Normalfall: valid true, alle loads endlich & >= 0', rOk.valid === true && rOk.loads.every(x => Number.isFinite(x) && x >= 0), 'valid=' + rOk.valid);
  const rBad = S(7, { '2026-07-16': { sessions: { Gym: { dur: 1e400, rpe: 5 } } } }, { acts: [] });
  ok('[C6-2] nicht endliche Last (dur=Infinity) ⇒ valid false + invalidReason', rBad.valid === false && !!rBad.invalidReason, 'valid=' + rBad.valid + ' reason=' + rBad.invalidReason);
}

/* ---------- C11 / C12: Historienvollständigkeit (bekannte Wochen) ---------- */
{
  // Woche 0 (07-12..18), 1 (07-05..11), 2 (06-28..07-04), 3 (06-21..27) relativ zu endDay 07-18.
  const measured = d => ({ [d]: { sessions: { Gym: { dur: 60, rpe: 7 } } } });
  const merge = (...os) => Object.assign({}, ...os);
  // C11: 3 bekannte Wochen (0,1,2 gemessen), Woche 3 nur unbekannte Aktivität.
  const s11 = merge(measured('2026-07-15'), measured('2026-07-08'), measured('2026-07-01'));
  const r11 = S(28, s11, { acts: [gAct('2026-06-24', { tag: 'unk', durationSeconds: null, summary: {} })] });
  ok('[C11-1] 3 bekannte von 4 Wochen ⇒ completeness.knownWeeks === 3', r11.completeness.knownWeeks === 3, 'knownWeeks=' + r11.completeness.knownWeeks + '/' + r11.completeness.totalWeeks);
  ok('[C11-2] Confidence "reduziert" (weder hoch noch not_assessable)', r11.confidence === 'reduziert', 'conf=' + r11.confidence);

  // C12: nur Woche 0 gemessen, Wochen 1–3 nur unbekannte Aktivität ⇒ knownWeeks 1.
  const r12 = S(28, measured('2026-07-15'), { acts: [
    gAct('2026-07-08', { tag: 'u1', durationSeconds: null, summary: {} }),
    gAct('2026-07-01', { tag: 'u2', durationSeconds: null, summary: {} }),
    gAct('2026-06-24', { tag: 'u3', durationSeconds: null, summary: {} })
  ] });
  ok('[C12-1] <2 bekannte Wochen ⇒ confidence "not_assessable"', r12.confidence === 'not_assessable', 'conf=' + r12.confidence + ' knownWeeks=' + r12.completeness.knownWeeks);
  ok('[C12-2] Completeness sichtbar (knownWeeks < 2)', r12.completeness.knownWeeks < 2, 'knownWeeks=' + r12.completeness.knownWeeks);
}

/* ---------- C13: Zeitzonengrenze ⇒ korrekter lokaler Tag ---------- */
{
  // 2026-07-16T23:30Z ⇒ Europe/Vienna (+2) = 2026-07-17 01:30 lokal.
  const r = S(7, {}, { acts: [gAct('x', { clientRecordId: 'tz1', sourceRecordId: 'tz1', startedAt: '2026-07-16T23:30:00.000Z', durationSeconds: 3600, summary: { distanceKm: 8 } })] });
  const d17 = dayOf(r, '2026-07-17'), d16 = dayOf(r, '2026-07-16');
  ok('[C13-1] Aktivität 23:30Z ⇒ lokaler Tag 2026-07-17 (Vienna +2), nicht 07-16', !!d17 && d17.active === true && (!d16 || d16.active === false), 'a17=' + (d17 && d17.active) + ' a16=' + (d16 && d16.active));
}

/* ---------- C14: Determinismus ---------- */
{
  const mk = () => S(28, { '2026-07-15': { sessions: { Gym: { dur: 60, rpe: 7 } } } }, { acts: [gAct('2026-07-10', { durationSeconds: 3600, summary: { distanceKm: 10, avg_hr: 150 } })] });
  const a = mk(), b = mk();
  ok('[C14-1] identische Eingaben ⇒ identische loads-Serie', JSON.stringify(a.loads) === JSON.stringify(b.loads));
  ok('[C14-2] identische Eingaben ⇒ identische Confidence/Completeness', a.confidence === b.confidence && JSON.stringify(a.completeness) === JSON.stringify(b.completeness));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
console.log('I3a: ' + (fail === 0 ? 'GRÜN — kanonische Lastserie mit Provenienz, Missingness, Wochen-Completeness, Blockade bei ungültiger Last.' : 'ROT — ' + fail + ' offen (erwartet vor dem Fix).'));

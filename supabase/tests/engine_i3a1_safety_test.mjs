/* ============================================================
   ORVIA · Engine 3c · I3a.1 — Safety-Wirksamkeit der Lastwahrheit (Golden/E2E)
   Zwei sicherheitskritische Verträge:
   A) dailyLoadSeries trennt AUTORITATIVE (gemessene) Last von Schätzung:
      Garmin/device ohne echtes RPE ⇒ authoritativeLoad=null, knownForSafety=false,
      estimatedLoad separat. Nie als gemessene Safety-Last. Akutes 7-Tage-Fenster
      mit unbekannter/nur geschätzter Last ⇒ acuteAssessable=false.
   B) buildTrainingDecision (AKTIVER Pfad) wertet das WIRKLICH aus:
      gute übrige Signale + nicht belastbare akute Last ⇒ KEIN GREEN, kein Peak,
      keine Intensitätssteigerung. Gegenprobe: vollständig gemessene Last ⇒ normal.
   node supabase/tests/engine_i3a1_safety_test.mjs
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
(0, eval)(readFileSync(new URL('calc.js', base), 'utf8'));
const Calc = globalThis.Calc;

const TZ = 'Europe/Vienna';
const gAct = (day, o) => Object.assign({ clientRecordId: 'g:' + day + ':' + (o && o.tag || 'x'), source: 'garmin', sourceRecordId: 's:' + day + ':' + (o && o.tag || 'x'), sportId: 'running', status: 'completed', startedAt: day + 'T10:00:00.000Z' }, o || {});
const S = (days, sessions, o) => cfg.dailyLoadSeries((o && o.acts) || [], sessions || {}, Object.assign({ days: days, endDay: '2026-07-18', timezone: TZ }, o || {}));
const dayOf = (r, d) => r.days.find(x => x.day === d);

/* ================= A) Provider: autoritative vs. geschätzte Last ================= */
{
  // Garmin mit Dauer ohne RPE ⇒ authoritativeLoad null, knownForSafety false, estimatedLoad > 0.
  const rEst = S(7, {}, { acts: [gAct('2026-07-16', { durationSeconds: 3600, summary: {} })] });
  const dEst = dayOf(rEst, '2026-07-16');
  ok('[A1-1] Garmin ohne RPE: authoritativeLoad === null (nicht als gemessene Last)', !!dEst && dEst.authoritativeLoad === null, 'auth=' + (dEst && dEst.authoritativeLoad));
  ok('[A1-2] knownForSafety === false', !!dEst && dEst.knownForSafety === false, 'k=' + (dEst && dEst.knownForSafety));
  ok('[A1-3] estimatedLoad separat > 0', !!dEst && dEst.estimatedLoad > 0, 'e=' + (dEst && dEst.estimatedLoad));
  ok('[A1-4] akutes 7-Tage-Fenster ⇒ acuteAssessable === false', rEst.acuteAssessable === false, 'acute=' + rEst.acuteAssessable);

  // Gemessene Blob-Einheit ⇒ authoritativeLoad = measured, knownForSafety true.
  const rMeas = S(7, { '2026-07-16': { sessions: { Gym: { dur: 60, rpe: 8 } } } }, { acts: [] });
  const dMeas = dayOf(rMeas, '2026-07-16');
  ok('[A2-1] gemessene Einheit: authoritativeLoad === measuredLoad (>0), knownForSafety true', !!dMeas && dMeas.authoritativeLoad === dMeas.measuredLoad && dMeas.authoritativeLoad > 0 && dMeas.knownForSafety === true, JSON.stringify(dMeas && { a: dMeas.authoritativeLoad, m: dMeas.measuredLoad, k: dMeas.knownForSafety }));
  ok('[A2-2] rein gemessene/ruhende Serie ⇒ acuteAssessable === true', rMeas.acuteAssessable === true, 'acute=' + rMeas.acuteAssessable);

  // Ruhetag ⇒ authoritativeLoad 0, knownForSafety true.
  const dRest = dayOf(rMeas, '2026-07-15');
  ok('[A3-1] Ruhetag: authoritativeLoad === 0, knownForSafety true', !!dRest && dRest.authoritativeLoad === 0 && dRest.knownForSafety === true, JSON.stringify(dRest && { a: dRest.authoritativeLoad, k: dRest.knownForSafety }));

  // Gemischt (measured + estimated) am selben Tag ⇒ knownForSafety false, authoritativeLoad null.
  const rMix = S(7, { '2026-07-16': { sessions: { Gym: { dur: 60, rpe: 8 } } } }, { acts: [gAct('2026-07-16', { durationSeconds: 3000, summary: {} })] });
  const dMix = dayOf(rMix, '2026-07-16');
  ok('[A4-1] measured+estimated: knownForSafety false, authoritativeLoad null (nicht scheinbar vollständig)', !!dMix && dMix.knownForSafety === false && dMix.authoritativeLoad === null, JSON.stringify(dMix && { k: dMix.knownForSafety, a: dMix.authoritativeLoad, m: dMix.measuredLoad, e: dMix.estimatedLoad }));
  ok('[A4-2] measuredLoad bleibt separat ausgewiesen (>0)', !!dMix && dMix.measuredLoad > 0, 'm=' + (dMix && dMix.measuredLoad));

  // Ein geschätzter Tag im akuten Fenster kippt acuteAssessable, auch wenn übrige Tage gemessen sind.
  const rContam = S(7, { '2026-07-14': { sessions: { Gym: { dur: 60, rpe: 7 } } }, '2026-07-15': { sessions: { Gym: { dur: 45, rpe: 6 } } } }, { acts: [gAct('2026-07-12', { durationSeconds: 3600, summary: {} })] });
  ok('[A5-1] gemessene Tage + EIN geschätzter Tag im akuten Fenster ⇒ acuteAssessable false', rContam.acuteAssessable === false, 'acute=' + rContam.acuteAssessable);
}

/* ================= B) buildTrainingDecision: Gate greift wirklich ================= */
{
  const goodCheckin = { readiness: 92, pain: 0, doms: 0, illness: false, sleepH: 8, sleepQ: 8, feel: 8, stress: 'Low', hrv: 'balanced' };
  const mkDec = (loads) => Calc.buildTrainingDecision({
    checkin: goodCheckin, components: { recovery: 92 }, loads: loads,
    plannedToday: { t: 'Laufen', l: 'Intervalle', hard: true }, profile: {}, dataQuality: { days: 40 }
  });

  // Baseline/Gegenprobe: vollständig gemessene akute Last ⇒ darf GREEN sein.
  const decMeasured = mkDec({ load3: 100, load7: 100, acuteAssessable: true });
  ok('[B1-1] Gegenprobe: gute Signale + vollständig gemessene Last ⇒ GREEN erlaubt', decMeasured.dayState === 'GREEN', 'state=' + decMeasured.dayState);
  ok('[B1-2] Gegenprobe: loadAssessable !== false', decMeasured.loadAssessable !== false, 'la=' + decMeasured.loadAssessable);

  // Pflicht-E2E: gute Signale + akute Last NICHT belastbar ⇒ KEIN GREEN, kein Peak.
  const decUnknown = mkDec({ load3: 100, load7: 100, acuteAssessable: false });
  ok('[B2-1] E2E: gute Signale + nicht belastbare akute Last ⇒ dayState !== GREEN', decUnknown.dayState !== 'GREEN', 'state=' + decUnknown.dayState);
  ok('[B2-2] E2E: kein Peak-Status', decUnknown.statusText !== 'Peak', 'status=' + decUnknown.statusText);
  ok('[B2-3] E2E: Entscheidung markiert loadAssessable === false', decUnknown.loadAssessable === false, 'la=' + decUnknown.loadAssessable);
  ok('[B2-4] E2E: keine Intensitätssteigerung (Session nicht „nach Plan hart"/KEEP bei GREEN)', decUnknown.todayAction !== 'KEEP' || decUnknown.dayState !== 'GREEN', 'action=' + decUnknown.todayAction + ' state=' + decUnknown.dayState);
  ok('[B2-5] E2E: Begründung nennt die nicht belastbare Last', /[Ll]ast/.test((decUnknown.readinessReasons || []).join(' ')) && /belastbar|geschätzt|unbekannt|nicht bewertbar/.test((decUnknown.readinessReasons || []).join(' ')), JSON.stringify(decUnknown.readinessReasons));

  // Nur herabstufen, nie heraufstufen: bereits RED bleibt RED trotz nicht belastbarer Last.
  const decRed = Calc.buildTrainingDecision({ checkin: { readiness: 20, pain: 9, illness: false }, components: { recovery: 20 }, loads: { load3: 100, load7: 100, acuteAssessable: false }, plannedToday: { t: 'Laufen', hard: true }, profile: {}, dataQuality: { days: 40 } });
  ok('[B3-1] bereits RED bleibt RED (Gate stuft nur herab, nie herauf)', decRed.dayState === 'RED', 'state=' + decRed.dayState);

  // Rückwärtskompatibilität: ohne acuteAssessable-Feld unverändertes Verhalten.
  const decLegacy = mkDec({ load3: 100, load7: 100 });
  ok('[B4-1] Rückwärtskompatibel: ohne acuteAssessable ⇒ GREEN wie bisher (kein stiller Block)', decLegacy.dayState === 'GREEN', 'state=' + decLegacy.dayState);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
console.log('I3a.1: ' + (fail === 0 ? 'GRÜN — autoritative vs. geschätzte Last getrennt; Decision-Pfad blockiert nicht belastbare akute Last fail-closed.' : 'ROT — ' + fail + ' offen (erwartet vor dem Fix).'));
